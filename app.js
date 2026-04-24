/*
 * app.js
 *
 * Core engine and UI bindings for the Dark Ghoul AT simulator. The engine
 * implements a simplified state machine inspired by commercially available
 * slots but avoids any proprietary content. It relies entirely on the
 * configuration defined in machine-config.js. The simulation is intended
 * for personal study and entertainment.
 */

(function () {
  // PRNG implementation (mulberry32)
  class PRNG {
    constructor(seed) {
      // ensure seed is a 32-bit unsigned integer
      this.seed = (seed >>> 0) || 123456789;
    }
    next() {
      // mulberry32 algorithm
      let t = this.seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return result;
    }
    nextInt(max) {
      return Math.floor(this.next() * max);
    }
  }

  // Global PRNG instance for glitch effect. This is independent from the
  // machine PRNG to ensure that UI animations remain deterministic when
  // reloading from a save.
  const prng = new PRNG(Date.now() >>> 0);

  /**
   * Weighted random choice helper.
   * Accepts an object of {key: weight} and returns a chosen key. Weights
   * do not need to sum to 1. Random numbers are drawn from the supplied
   * PRNG so that results are reproducible with a seed.
   */
  function weightedChoice(weights, prng) {
    let total = 0;
    for (const key in weights) total += weights[key];
    let r = prng.next() * total;
    for (const key in weights) {
      r -= weights[key];
      if (r < 0) return key;
    }
    // fallback
    return Object.keys(weights)[0];
  }

  // UI element references
  const elMachineName = document.getElementById('machine-name');
  const elCredits = document.getElementById('credits');
  const elBet = document.getElementById('bet');
  const elDiff = document.getElementById('diff');
  const elInternalMode = document.getElementById('internal-mode');
  const elLastRole = document.getElementById('last-role');
  const reel1 = document.getElementById('reel1');
  const reel2 = document.getElementById('reel2');
  const reel3 = document.getElementById('reel3');
  const messageOverlay = document.getElementById('message-overlay');
  const starOverlay = document.getElementById('star-overlay');
  const modalOverlay = document.getElementById('modal-overlay');
  const modals = document.getElementById('modals');

  // Canvas for glitch effect
  const canvas = document.getElementById('glitch-canvas');
  const ctx = canvas.getContext('2d');
  let glitchAnimationId = null;
  // Adjust canvas size to parent
  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /**
   * Starts the glitch animation. The effect uses a combination of noise and
   * tinted backgrounds to emulate a dynamic video without requiring external
   * assets. Each state maps to a specific base color to convey mood.
   */
  function startGlitch(state) {
    // cancel previous animation
    if (glitchAnimationId) {
      cancelAnimationFrame(glitchAnimationId);
      glitchAnimationId = null;
    }
    // choose base color based on state
    const colors = {
      NORMAL: '#111',
      KAKUGAN: '#400',
      PRE_CZ: '#013',
      CZ: '#202040',
      EPISODE: '#330014',
      AT: '#420016',
      UPPER_AT: '#600018',
      ZONE: '#310031',
      BATTLE: '#440000',
      JUDGMENT: '#223322'
    };
    const baseColor = colors[state] || '#111';
    // intensity controls amount of noise
    const intensity = (state === 'AT' || state === 'UPPER_AT') ? 300 : (state === 'KAKUGAN' ? 200 : 100);
    // animation loop
    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      // base tinted fill
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      // draw random noise
      for (let i = 0; i < intensity; i++) {
        const x = prng.next() * w;
        const y = prng.next() * h;
        const s = prng.next() * 4 + 1;
        const lum = Math.floor(prng.next() * 255);
        ctx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, 0.3)`;
        ctx.fillRect(x, y, s, s);
      }
      glitchAnimationId = requestAnimationFrame(draw);
    }
    draw();
  }

  /**
   * Display a message overlay with optional color and star rating. The overlay
   * automatically fades out after a short duration. Colors can be one of
   * 'red', 'orange', 'purple', 'green', or omitted for default. Star level
   * should be 0–5; when >0, the star overlay will appear.
   */
  function showMessage(text, color, starLevel) {
    messageOverlay.textContent = text;
    // set color via style or class
    const colorMap = {
      red: '#ff4444',
      orange: '#ffaa33',
      purple: '#aa55ff',
      green: '#55cc55'
    };
    messageOverlay.style.color = colorMap[color] || '#ffffff';
    messageOverlay.style.textShadow = `0 0 6px ${colorMap[color] || '#ffffff'}`;
    // star handling
    if (starLevel && starLevel > 0) {
      starOverlay.innerHTML = '';
      for (let i = 0; i < starLevel; i++) {
        const span = document.createElement('span');
        span.className = 'star';
        span.textContent = '★';
        starOverlay.appendChild(span);
      }
      starOverlay.dataset.level = starLevel;
      starOverlay.classList.add('show');
    } else {
      starOverlay.classList.remove('show');
    }
    // show message overlay
    messageOverlay.classList.add('show');
    // hide after delay
    clearTimeout(showMessage.timeout);
    showMessage.timeout = setTimeout(() => {
      messageOverlay.classList.remove('show');
      starOverlay.classList.remove('show');
    }, 1500);
  }

  /**
   * SlotMachine class encapsulates the current game state and logic. Many
   * behaviours are simplified for demonstration while retaining the feel of a
   * Japanese-style AT slot. Event hooks call UI update functions to reflect
   * changes.
   */
  class SlotMachine {
    constructor(config, setting) {
      this.config = config;
      this.setting = setting;
      this.state = 'NORMAL';
      this.credits = 50;
      this.bet = 1;
      this.difference = 0;
      this.prng = new PRNG(Date.now() & 0xffffffff);
      this.gameCount = 0;
      this.czCounter = 0;
      this.atCounter = 0;
      this.kakuganCounter = 0;
      this.atRemainingDiff = 0;
      this.upperMode = false;
      this.zoneStack = [];
      this.autoMode = false;
      this.skipMode = false;
      this.debugMode = false;
      // stats
      this.stats = {
        totalGames: 0,
        totalCZ: 0,
        totalAT: 0,
        czSuccess: 0,
        zoneHits: 0,
        battleWins: 0,
        upperStarts: 0
      };
      // UI update initial values
      this.updateUI();
    }

    setSetting(setting) {
      this.setting = setting;
    }

    toggleDebug(on) {
      this.debugMode = on;
      document.body.classList.toggle('debug-mode', this.debugMode);
    }

    /**
     * Determine next role based on configuration and current state. During
     * KAKUGAN or UPPER_AT, the weights for rare roles are increased.
     */
    chooseRole() {
      const roleWeights = Object.assign({}, this.config.roles);
      // insert lowerReplay for this setting
      const settingObj = this.config.settings[this.setting];
      roleWeights.lowerReplay = settingObj.lowerReplay;
      // boost rare roles in certain states
      const boost = (this.state === 'KAKUGAN' || this.upperMode) ? 3 : 1;
      roleWeights.weakCherry *= boost;
      roleWeights.suika *= boost;
      roleWeights.chanceA *= boost;
      roleWeights.chanceB *= boost;
      roleWeights.strongCherry *= boost;
      roleWeights.specialSymbol *= boost;
      roleWeights.guaranteedCherry *= boost;
      // choose
      return weightedChoice(roleWeights, this.prng);
    }

    /**
     * Main spin function. Handles credit deduction, role determination and
     * calls state-specific handlers. If auto mode is active, the spin will
     * schedule itself recursively. Skip mode bypasses short delays.
     */
    spin() {
      if (this.credits < this.bet) {
        showMessage('クレジット不足', 'red', 0);
        this.autoMode = false;
        return;
      }
      // deduct bet
      this.credits -= this.bet;
      this.stats.totalGames++;
      this.gameCount++;
      this.atCounter++;
      // choose role
      const role = this.chooseRole();
      this.displayReels(role);
      elLastRole.textContent = role;
      // handle state logic
      switch (this.state) {
        case 'NORMAL':
          this.handleNormal(role);
          break;
        case 'KAKUGAN':
          this.handleKakugan(role);
          break;
        case 'PRE_CZ':
          this.handlePreCZ(role);
          break;
        case 'CZ':
          this.handleCZ(role);
          break;
        case 'EPISODE':
          this.handleEpisode(role);
          break;
        case 'AT':
        case 'UPPER_AT':
          this.handleAT(role);
          break;
        case 'BATTLE':
          this.handleBattle(role);
          break;
        case 'ZONE':
          this.handleZone(role);
          break;
        case 'JUDGMENT':
          this.handleJudgment(role);
          break;
      }
      this.updateUI();
      // auto spin schedule
      if (this.autoMode) {
        const delay = this.skipMode ? 10 : 300;
        setTimeout(() => this.spin(), delay);
      }
    }

    /** Update UI fields based on current properties */
    updateUI() {
      elMachineName.textContent = this.config.machineName;
      elCredits.textContent = this.credits.toString();
      elBet.textContent = this.bet.toString();
      elDiff.textContent = this.difference.toFixed(0);
      elInternalMode.textContent = `STATE:${this.state} ${this.upperMode ? 'UPPER' : ''}`;
    }

    /** Display simple reel placeholders. In a more complete
     * implementation this would update reel images.
     */
    displayReels(role) {
      // For demonstration, random digits/letters represent reels
      const symbols = '0123456789ABCDEF';
      reel1.textContent = symbols[this.prng.nextInt(symbols.length)];
      reel2.textContent = symbols[this.prng.nextInt(symbols.length)];
      reel3.textContent = symbols[this.prng.nextInt(symbols.length)];
    }

    /** Normal state handler. Decides whether to transition to other states. */
    handleNormal(role) {
      const settingObj = this.config.settings[this.setting];
      // check for Episode bonus first
      if (this.prng.next() < settingObj.episodeProbability) {
        this.enterEpisode();
        return;
      }
      // check for CZ trigger by probability
      if (this.prng.next() < settingObj.czProbability) {
        this.enterPreCZ();
        return;
      }
      // check for KAKUGAN via lowerReplay
      if (role === 'lowerReplay') {
        this.enterKakugan();
        return;
      }
      // otherwise, remain in normal and maybe random hint
      if (role === 'weakCherry' || role === 'suika') {
        showMessage('レア役成立', 'purple', 2);
      }
    }

    handleKakugan(role) {
      // high mode for limited games
      this.kakuganCounter--;
      if (role === 'strongCherry' || role === 'specialSymbol') {
        showMessage('強レア役！', 'orange', 3);
      }
      if (this.kakuganCounter <= 0) {
        this.state = 'NORMAL';
        showMessage('赫眼終了', 'purple', 1);
        startGlitch(this.state);
      }
    }

    handlePreCZ(role) {
      // PreCZ lasts random 4–8 games then enters CZ
      this.czCounter--;
      if (this.czCounter <= 0) {
        // choose CZ type based on probability split
        const settingObj = this.config.settings[this.setting];
        const total = settingObj.czAProbability + settingObj.czBProbability;
        const rand = this.prng.next() * total;
        const zoneType = rand < settingObj.czAProbability ? 'standardCZ' : 'strongCZ';
        this.enterCZ(zoneType);
      }
    }

    handleCZ(role) {
      // During CZ, rare roles increase success rate slightly
      if (!this.currentZone) return;
      this.currentZone.gamesLeft--;
      // chance of success each game
      let successChance = this.currentZone.baseSuccessRate;
      if (role === 'weakCherry' || role === 'suika') successChance += 0.05;
      if (role === 'strongCherry' || role === 'specialSymbol') successChance += 0.15;
      if (this.prng.next() < successChance) {
        // success, go to AT
        this.stats.czSuccess++;
        this.enterAT();
        showMessage('CZ突破！ATへ', 'orange', this.currentZone.starLevel);
        return;
      }
      if (this.currentZone.gamesLeft <= 0) {
        // fail
        showMessage('CZ失敗…', 'purple', this.currentZone.starLevel);
        this.state = 'NORMAL';
        this.currentZone = null;
        startGlitch(this.state);
      }
    }

    handleEpisode(role) {
      if (!this.currentZone) return;
      this.currentZone.gamesLeft--;
      if (this.currentZone.gamesLeft <= 0) {
        // Episode grants AT with some initial difference boost
        this.enterAT();
        this.difference += 100;
        showMessage('ストーリー終了 ATへ', 'orange', this.currentZone.starLevel);
      }
    }

    handleAT(role) {
      // Each game reduces remaining difference; base add per spin
      if (this.atRemainingDiff <= 0) {
        this.endAT();
        return;
      }
      // add base difference by spin
      this.atRemainingDiff -= 4;
      this.difference += 4;
      // random zone or battle triggers
      if (this.prng.next() < 0.05) {
        this.enterBattle();
        return;
      }
      if (this.prng.next() < 0.03) {
        this.enterZone('bites');
        return;
      }
    }

    handleBattle(role) {
      // simplified battle: determine win based on rate and upper mode
      if (!this.currentBattle) return;
      this.currentBattle.gamesLeft--;
      if (this.currentBattle.gamesLeft <= 0) {
        // evaluate win
        let winRate = 0.5;
        if (this.upperMode) winRate += 0.15;
        if (this.prng.next() < winRate) {
          this.stats.battleWins++;
          showMessage('バトル勝利！', 'orange', 3);
          this.enterZone('frenzy');
        } else {
          showMessage('敗北…', 'purple', 2);
        }
        this.state = this.upperMode ? 'UPPER_AT' : 'AT';
        this.currentBattle = null;
        startGlitch(this.state);
      }
    }

    handleZone(role) {
      if (!this.currentZone) return;
      const z = this.currentZone;
      // apply add-ons each game
      const add = Math.floor(z.minAdd + this.prng.next() * (z.maxAdd - z.minAdd + 1));
      this.difference += add;
      this.atRemainingDiff += add;
      z.gamesLeft--;
      if (z.gamesLeft <= 0) {
        // check continuation
        if (z.continuationRate && this.prng.next() < z.continuationRate) {
          // extend zone
          z.gamesLeft = z.minGames;
          showMessage(`${z.name}継続！`, 'orange', z.starLevel);
        } else {
          showMessage(`${z.name}終了`, 'purple', z.starLevel);
          // return to AT or UPPER_AT
          this.state = this.upperMode ? 'UPPER_AT' : 'AT';
          this.currentZone = null;
          startGlitch(this.state);
        }
      }
    }

    handleJudgment(role) {
      // Called after AT end; one spin to show result
      // determine success based on upperStartRate from setting
      const rate = this.config.settings[this.setting].upperStartRate;
      if (this.prng.next() < rate) {
        this.upperMode = true;
        this.stats.upperStarts++;
        showMessage('ジャッジ成功！上位へ', 'red', 5);
        this.enterAT(true);
      } else {
        showMessage('ジャッジ失敗', 'purple', 1);
        this.state = 'NORMAL';
        startGlitch(this.state);
      }
    }

    /**
     * Transition helpers
     */
    enterKakugan() {
      this.state = 'KAKUGAN';
      // random duration from {10, 20, 30, 50}
      const durations = [10, 20, 30, 50];
      const weights = [70, 20, 8, 2];
      const dist = {};
      for (let i = 0; i < durations.length; i++) dist[durations[i]] = weights[i];
      this.kakuganCounter = parseInt(weightedChoice(dist, this.prng), 10);
      showMessage('赫眼モード突入', 'red', 3);
      startGlitch(this.state);
    }

    enterPreCZ() {
      this.state = 'PRE_CZ';
      this.stats.totalCZ++;
      // random 4–8 games
      this.czCounter = 4 + this.prng.nextInt(5);
      showMessage('前兆開始', 'purple', 2);
      startGlitch(this.state);
    }

    enterCZ(zoneType) {
      this.state = 'CZ';
      const zoneDef = this.config.zoneTypes[zoneType];
      this.currentZone = {
        type: zoneType,
        name: zoneDef.name,
        baseSuccessRate: zoneDef.baseSuccessRate,
        gamesLeft: zoneDef.minGames,
        starLevel: zoneDef.starLevel
      };
      showMessage(`${zoneDef.name}突入`, 'orange', zoneDef.starLevel);
      startGlitch(this.state);
    }

    enterEpisode() {
      this.state = 'EPISODE';
      const zoneDef = this.config.zoneTypes.episode;
      this.currentZone = {
        type: 'episode',
        name: zoneDef.name,
        gamesLeft: zoneDef.fixedGames,
        starLevel: zoneDef.starLevel
      };
      showMessage('エピソードBONUS', 'orange', zoneDef.starLevel);
      startGlitch(this.state);
    }

    enterAT(fromUpper) {
      this.state = fromUpper ? 'UPPER_AT' : 'AT';
      this.stats.totalAT++;
      // initial difference: random around 150
      const base = 150 + this.prng.nextInt(100);
      this.atRemainingDiff = base;
      showMessage('AT開始！', 'orange', 3);
      startGlitch(this.state);
    }

    enterBattle() {
      this.state = 'BATTLE';
      // each battle lasts random 3–5 games
      this.currentBattle = {
        gamesLeft: 3 + this.prng.nextInt(3)
      };
      showMessage('バトル開始', 'orange', 4);
      startGlitch(this.state);
    }

    enterZone(zoneType) {
      this.state = 'ZONE';
      const zoneDef = this.config.zoneTypes[zoneType];
      this.currentZone = {
        type: zoneType,
        name: zoneDef.name,
        gamesLeft: zoneDef.minGames,
        continuationRate: zoneDef.continuationRate,
        minAdd: zoneDef.minAdd,
        maxAdd: zoneDef.maxAdd,
        starLevel: zoneDef.starLevel
      };
      this.stats.zoneHits++;
      showMessage(`${zoneDef.name}突入！`, 'red', zoneDef.starLevel);
      startGlitch(this.state);
    }

    endAT() {
      // finish AT and go to judgment
      showMessage('AT終了', 'purple', 2);
      this.state = 'JUDGMENT';
      this.atRemainingDiff = 0;
      // proceed to judgment on next spin
    }
  }

  // instantiate with default setting 1
  let slot = new SlotMachine(MachineConfig, 1);
  startGlitch(slot.state);

  /**
   * UI button bindings
   */
  document.getElementById('btn-bet').addEventListener('click', () => {
    // increment bet up to 3 then wrap
    slot.bet = slot.bet % 3 + 1;
    slot.updateUI();
  });
  document.getElementById('btn-lever').addEventListener('click', () => {
    slot.spin();
  });
  // stop buttons simply spin again in this simplified implementation
  document.getElementById('btn-stop1').addEventListener('click', () => {
    slot.spin();
  });
  document.getElementById('btn-stop2').addEventListener('click', () => {
    slot.spin();
  });
  document.getElementById('btn-stop3').addEventListener('click', () => {
    slot.spin();
  });
  // auto
  document.getElementById('btn-auto').addEventListener('click', (e) => {
    slot.autoMode = !slot.autoMode;
    e.target.classList.toggle('active', slot.autoMode);
    if (slot.autoMode) slot.spin();
  });
  // skip
  document.getElementById('btn-skip').addEventListener('click', (e) => {
    slot.skipMode = !slot.skipMode;
    e.target.classList.toggle('active', slot.skipMode);
  });
  // menu button: open settings modal
  document.getElementById('btn-menu').addEventListener('click', () => {
    openModal('settings');
  });
  // settings, save, load, stats, debug buttons
  document.getElementById('btn-settings').addEventListener('click', () => openModal('settings'));
  document.getElementById('btn-save').addEventListener('click', () => openModal('save'));
  document.getElementById('btn-load').addEventListener('click', () => openModal('save'));
  document.getElementById('btn-stats').addEventListener('click', () => openModal('stats'));
  document.getElementById('btn-debug').addEventListener('click', () => {
    slot.toggleDebug(!slot.debugMode);
  });

  /**
   * Modal handling
   */
  function openModal(name) {
    modalOverlay.style.display = 'block';
    for (const modal of modals.children) {
      if (modal.dataset.modal === name) {
        modal.classList.remove('hidden');
        // populate dynamic content
        if (name === 'settings') populateSettings();
        if (name === 'save') populateSaveSlots();
        if (name === 'stats') populateStats();
      } else {
        modal.classList.add('hidden');
      }
    }
  }
  function closeModal() {
    modalOverlay.style.display = 'none';
    for (const modal of modals.children) {
      modal.classList.add('hidden');
    }
  }
  modalOverlay.addEventListener('click', closeModal);
  modals.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) {
      closeModal();
    }
  });

  /**
   * Populate settings modal: fill select options and bind changes.
   */
  function populateSettings() {
    const select = document.getElementById('select-setting');
    select.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `設定${i}`;
      if (i === slot.setting) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = () => {
      slot.setSetting(parseInt(select.value, 10));
    };
    // debug toggle
    const chkDebug = document.getElementById('toggle-debug');
    chkDebug.checked = slot.debugMode;
    chkDebug.onchange = () => {
      slot.toggleDebug(chkDebug.checked);
    };
  }

  /**
   * Saving and loading: store up to three slots in localStorage.
   */
  function populateSaveSlots() {
    const container = modals.querySelector('#modal-save .save-slots');
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.className = 'save-slot';
      slotDiv.textContent = `スロット ${i + 1}`;
      const data = localStorage.getItem(`dg-slot${i}`);
      if (data) {
        slotDiv.textContent += ' (保存済み)';
      }
      slotDiv.addEventListener('click', () => {
        // present options: save or load
        if (data) {
          // confirm load
          if (confirm('このスロットを読込ますか？現在の進行は上書きされます。')) {
            loadFromSlot(i);
            closeModal();
          }
        } else {
          // save current
          if (confirm('このスロットに保存しますか？')) {
            saveToSlot(i);
            populateSaveSlots();
          }
        }
      });
      container.appendChild(slotDiv);
    }
  }
  function saveToSlot(i) {
    const saveObj = {
      configVersion: 1,
      credits: slot.credits,
      bet: slot.bet,
      difference: slot.difference,
      state: slot.state,
      setting: slot.setting,
      upperMode: slot.upperMode,
      atRemainingDiff: slot.atRemainingDiff,
      kakuganCounter: slot.kakuganCounter,
      czCounter: slot.czCounter,
      prngSeed: slot.prng.seed,
      stats: slot.stats
    };
    localStorage.setItem(`dg-slot${i}`, JSON.stringify(saveObj));
    showMessage(`スロット${i + 1}に保存`, 'green', 1);
  }
  function loadFromSlot(i) {
    const data = localStorage.getItem(`dg-slot${i}`);
    if (!data) return;
    const obj = JSON.parse(data);
    slot = new SlotMachine(MachineConfig, obj.setting);
    slot.credits = obj.credits;
    slot.bet = obj.bet;
    slot.difference = obj.difference;
    slot.state = obj.state;
    slot.upperMode = obj.upperMode;
    slot.atRemainingDiff = obj.atRemainingDiff;
    slot.kakuganCounter = obj.kakuganCounter;
    slot.czCounter = obj.czCounter;
    slot.prng.seed = obj.prngSeed;
    slot.stats = obj.stats;
    slot.updateUI();
    startGlitch(slot.state);
    showMessage(`スロット${i + 1}を読込`, 'green', 1);
  }

  /**
   * Populate statistics modal
   */
  function populateStats() {
    const container = document.getElementById('stats-content');
    const s = slot.stats;
    const lines = [];
    lines.push(`総回転数: ${s.totalGames}`);
    lines.push(`CZ突入回数: ${s.totalCZ}`);
    lines.push(`CZ突破回数: ${s.czSuccess}`);
    lines.push(`AT突入回数: ${s.totalAT}`);
    lines.push(`ゾーン突入回数: ${s.zoneHits}`);
    lines.push(`バトル勝利回数: ${s.battleWins}`);
    lines.push(`上位モード突入回数: ${s.upperStarts}`);
    container.innerHTML = lines.join('<br/>');
  }

})();