/*
 * app.js
 *
 * Core logic and UI wiring for the Dark Ghoul AT simulator. The code is
 * organised into a few key parts:
 *  - A simple seeded pseudo random number generator (PRNG) for reproducible
 *    simulations.
 *  - Utility functions for weighted random selections.
 *  - A SlotMachine class encapsulating the state machine and all game
 *    mechanics (normal spins, CZs, AT, zones, battles, judgment, etc.).
 *  - A small UI layer that binds HTML controls to the machine, updates
 *    display elements and manages modals for settings, statistics and
 *    persistence.
 *
 * All probabilities and tunable parameters live in machine-config.js. By
 * modifying MACHINE_CONFIG you can adjust the behaviour of this simulator or
 * substitute your own values. See the README for guidance.
 */

(() => {
  'use strict';

  /**
   * PRNG based on mulberry32 algorithm. It stores its seed so that the
   * generator state can be serialised and restored. See
   * https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
   */
  class PRNG {
    constructor(seed = Date.now()) {
      // Force seed into a 32bit unsigned integer
      this.seed = seed >>> 0;
    }
    next() {
      // Advance the state and return a float between 0 and 1
      let t = this.seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      this.seed = t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // Allow reading the current seed for saving
    get state() {
      return this.seed >>> 0;
    }
    set state(val) {
      this.seed = val >>> 0;
    }
  }

  /**
   * Pick a key from a weight map. The object keys are strings and values
   * represent relative probabilities (they do not need to sum to 1). Returns
   * the selected key. If the map is empty, undefined is returned.
   *
   * @param {Object} weightMap
   * @param {PRNG} rng
   */
  function pickWeighted(weightMap, rng) {
    let total = 0;
    for (const key in weightMap) {
      total += weightMap[key];
    }
    if (total <= 0) return undefined;
    const r = rng.next() * total;
    let acc = 0;
    for (const key in weightMap) {
      acc += weightMap[key];
      if (r < acc) return key;
    }
    // Fallback
    return Object.keys(weightMap)[0];
  }

  /**
   * Sample from a geometric distribution with success probability p. Returns
   * the number of Bernoulli trials until the first success (inclusive). If p
   * is zero or invalid, returns a large number (Infinity).
   *
   * @param {number} p
   * @param {PRNG} rng
   */
  function sampleGeometric(p, rng) {
    if (!p || p <= 0) return Infinity;
    // Geometric distribution: number of trials ~ floor(log(U)/log(1-p)) + 1
    const u = rng.next();
    return Math.floor(Math.log(1 - u) / Math.log(1 - p)) + 1;
  }

  /**
   * Map each role to a display symbol. These are used to render the reel
   * contents in a simple textual form. Feel free to modify the symbols to
   * better suit your tastes or incorporate image assets.
   */
  const ROLE_SYMBOLS = {
    replay: '↺',
    diagonalBell: '☻',
    weakCherry: '♣',
    suika: '♦',
    chanceA: '☆',
    chanceB: '★',
    strongCherry: '♠',
    specialSymbol: '✚',
    guaranteedCherry: '✪',
    lowerReplay: '⚡'
  };

  /**
   * Main SlotMachine class. It encapsulates the current machine state,
   * performs spins, transitions between modes and records statistics. The
   * UI layer communicates with this class via public methods such as
   * `spin`, `changeSetting`, `saveState` and `loadState`.
   */
  class SlotMachine {
    constructor(config) {
      this.config = config;
      // Load persisted setting or default to 1
      const persistedSetting = parseInt(localStorage.getItem('dg_setting'), 10);
      this.setting = isNaN(persistedSetting) ? 1 : persistedSetting;
      // Determine debug flag
      this.debug = localStorage.getItem('dg_debug') === '1';
      // Statistics
      this.stats = {
        totalSpins: 0,
        totalCZ: 0,
        totalStrongCZ: 0,
        totalEpisode: 0,
        totalAT: 0,
        totalATUpper: 0,
        totalBattles: 0,
        battleWins: 0,
        battleLosses: 0,
        totalZones: 0,
        totalJudgments: 0,
        judgmentSuccess: 0,
        maxDifference: 0
      };
      // PRNG with persisted seed or default
      const persistedSeed = parseInt(localStorage.getItem('dg_seed'), 10);
      this.rng = new PRNG(isNaN(persistedSeed) ? Date.now() : persistedSeed);
      // Initialise state
      this.reset();
    }

    /**
     * Reset the machine to its initial state. Counters, differences and
     * triggers are reinitialised; the setting and debug flag remain.
     */
    reset() {
      // Machine state: NORMAL, KAKUGAN, CZ_STANDARD, CZ_STRONG, EPISODE,
      // AT_MAIN, BATTLE, ZONE, JUDGMENT
      this.state = 'NORMAL';
      this.mode = 'A';
      this.upperMode = false;
      // Counters
      this.gameCount = 0;     // total games since start/reset
      this.czCounter = 0;      // games since last CZ
      this.strongCzCounter = 0; // games since last strong CZ
      this.episodeCounter = 0;  // games since last episode bonus
      this.atCounter = 0;      // games since last AT
      // Next triggers (geometric sampling)
      this.nextCzGame = sampleGeometric(this.currentSetting().czProbability, this.rng);
      this.nextStrongCzGame = sampleGeometric(this.currentSetting().strongCzProbability, this.rng);
      this.nextEpisodeGame = sampleGeometric(this.currentSetting().episodeProbability, this.rng);
      this.nextAtGame = sampleGeometric(this.currentSetting().atProbability, this.rng);
      // KAKUGAN remaining games and role multiplier
      this.kakuganRemaining = 0;
      // CZ state
      this.czRemaining = 0;
      this.czSuccessChance = 0;
      this.czType = 'standard';
      // EPISODE state
      this.episodeRemaining = 0;
      this.episodeBonus = 0;
      // AT state
      this.atDifference = 0;
      this.atMode = 'A';
      this.nextBattleGame = 0;
      this.atGameCounter = 0;
      // Battle state
      this.battleWinRate = 0;
      this.battleEnemy = '';
      // Zone state
      this.zoneType = '';
      this.zoneRemaining = 0;
      // Judgment state
      this.judgmentPending = false;
      // Player wallet
      this.credits = 0;
      this.difference = 0;
      this.stats.maxDifference = Math.max(this.stats.maxDifference, this.difference);
      // Logging buffer for debug
      this.logLines = [];
    }

    /**
     * Return the current setting object.
     */
    currentSetting() {
      return this.config.settings.find(s => s.id === this.setting) || this.config.settings[0];
    }

    /**
     * Set a new machine setting (1–6). Resets triggers accordingly.
     * @param {number} id
     */
    setSetting(id) {
      const numeric = parseInt(id, 10);
      if (numeric >= 1 && numeric <= this.config.settings.length) {
        this.setting = numeric;
        localStorage.setItem('dg_setting', String(numeric));
        // Resample triggers on setting change
        this.nextCzGame = sampleGeometric(this.currentSetting().czProbability, this.rng);
        this.nextStrongCzGame = sampleGeometric(this.currentSetting().strongCzProbability, this.rng);
        this.nextEpisodeGame = sampleGeometric(this.currentSetting().episodeProbability, this.rng);
        this.nextAtGame = sampleGeometric(this.currentSetting().atProbability, this.rng);
      }
    }

    /**
     * Toggle debug mode. Persist the value in localStorage.
     * @param {boolean} enabled
     */
    setDebug(enabled) {
      this.debug = !!enabled;
      localStorage.setItem('dg_debug', this.debug ? '1' : '0');
    }

    /**
     * Get the full probability map for roles based on the current setting and
     * whether the machine is in KAKUGAN. Lower replay probability is setting
     * dependent and rare roles are scaled during KAKUGAN.
     */
    getRoleProbabilities() {
      const base = { ...this.config.roles };
      // Override lowerReplay with setting specific value
      base.lowerReplay = this.currentSetting().lowerReplay;
      // Copy probabilities to work with
      const probs = { ...base };
      // During KAKUGAN we increase the chance of rare roles by factor
      if (this.state === 'KAKUGAN') {
        const factor = 3; // boost factor
        for (const key of ['weakCherry','suika','chanceA','chanceB','strongCherry','specialSymbol','guaranteedCherry']) {
          probs[key] = (probs[key] || 0) * factor;
        }
        // lowerReplay should still be relatively rare
        probs.lowerReplay = base.lowerReplay;
      }
      return probs;
    }

    /**
     * Draw a role according to current probabilities. Uses weighted random.
     */
    drawRole() {
      const probs = this.getRoleProbabilities();
      const role = pickWeighted(probs, this.rng);
      return role;
    }

    /**
     * Handle a lever pull (spin). Performs one game cycle. In this simulator
     * lever, stop1, stop2 and stop3 are condensed into a single action; the
     * animation still reflects three reels spinning. Returns an object
     * describing the result so the UI can update accordingly.
     */
    spin() {
      // Increase counters irrespective of state
      this.gameCount++;
      this.czCounter++;
      this.strongCzCounter++;
      this.episodeCounter++;
      this.atCounter++;
      this.stats.totalSpins++;
      // Cost per game: assume 3 credits consumed for each spin
      this.credits -= 3;
      // Bound credits at zero
      if (this.credits < 0) this.credits = 0;
      // Draw a role
      const role = this.drawRole();
      // Process according to current state
      switch (this.state) {
        case 'NORMAL':
          this.handleNormal(role);
          break;
        case 'KAKUGAN':
          this.handleKakugan(role);
          break;
        case 'CZ_STANDARD':
        case 'CZ_STRONG':
          this.handleCZ(role);
          break;
        case 'EPISODE':
          this.handleEpisode(role);
          break;
        case 'AT_MAIN':
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
        default:
          // Unknown state: do nothing
          break;
      }
      // Record maximum difference for stats
      if (this.difference > this.stats.maxDifference) {
        this.stats.maxDifference = this.difference;
      }
      // Return information for UI
      return {
        role,
        state: this.state,
        difference: this.difference,
        credits: this.credits,
        gameCount: this.gameCount,
        mode: this.mode,
        debugInfo: {
          nextCzGame: this.nextCzGame,
          czCounter: this.czCounter,
          nextAtGame: this.nextAtGame,
          atCounter: this.atCounter,
          kakuganRemaining: this.kakuganRemaining,
          czSuccessChance: this.czSuccessChance
        }
      };
    }

    /**
     * Log a message for debugging. Only recorded when debug mode is enabled.
     * @param {string} msg
     */
    log(msg) {
      if (this.debug) {
        this.logLines.push(msg);
        if (this.logLines.length > 200) this.logLines.shift();
      }
    }

    /**
     * Normal state logic. Checks for scheduled triggers and role‑driven
     * transitions such as entry into KAKUGAN, CZ, episode or AT.
     * @param {string} role
     */
    handleNormal(role) {
      this.log(`NORMAL: role ${role}`);
      // Lower replay triggers KAKUGAN
      if (role === 'lowerReplay') {
        this.startKakugan();
        return;
      }
      // Rare roles may trigger episodes or strong CZ
      if (role === 'specialSymbol' || role === 'guaranteedCherry') {
        if (this.rng.next() < 0.5) {
          this.startEpisode();
        } else {
          this.startCZ('strong');
        }
        return;
      }
      if (role === 'strongCherry' && this.rng.next() < 0.3) {
        this.startCZ('strong');
        return;
      }
      // Check scheduled strong CZ
      if (this.strongCzCounter >= this.nextStrongCzGame) {
        this.startCZ('strong');
        return;
      }
      // Check scheduled episode
      if (this.episodeCounter >= this.nextEpisodeGame) {
        this.startEpisode();
        return;
      }
      // Check scheduled normal CZ
      if (this.czCounter >= this.nextCzGame) {
        this.startCZ('standard');
        return;
      }
      // Check scheduled AT (direct AT) via atCounter
      if (this.atCounter >= this.nextAtGame) {
        this.startAT(false);
        return;
      }
      // Otherwise remain in normal state
    }

    /**
     * KAKUGAN state boosts rare roles. It expires after a random number of
     * games. The distribution of durations is 70%:10G, 20%:20G, 8%:30G,
     * 2%:50G. Counts down each spin.
     */
    handleKakugan(role) {
      this.log(`KAKUGAN: role ${role}, remaining ${this.kakuganRemaining}`);
      // Reduce remaining counter
      this.kakuganRemaining--;
      // When time runs out return to normal
      if (this.kakuganRemaining <= 0) {
        this.state = 'NORMAL';
        // Reset normal triggers to avoid immediate re-entry
        // (optional: don't reset counters)
        return;
      }
      // Even in KAKUGAN we check triggers but with reduced frequency
      this.handleNormal(role);
    }

    /**
     * Initialise a KAKUGAN period with a random duration drawn from the
     * distribution described in the specification.
     */
    startKakugan() {
      this.state = 'KAKUGAN';
      // Distribution: 10G (70%), 20G (20%), 30G (8%), 50G (2%)
      const durations = { 10: 70, 20: 20, 30: 8, 50: 2 };
      const chosen = parseInt(pickWeighted(durations, this.rng), 10);
      this.kakuganRemaining = chosen;
      this.log(`Enter KAKUGAN for ${chosen} games`);
    }

    /**
     * Begin a CZ. Standard CZs are easier to reach but have lower success
     * expectations, whereas strong CZs occur rarely but provide higher
     * success rates. Both CZ types have 8 games and accumulate success
     * probability based on the small roles drawn.
     * @param {string} type 'standard' or 'strong'
     */
    startCZ(type) {
      this.state = (type === 'strong') ? 'CZ_STRONG' : 'CZ_STANDARD';
      this.czType = type;
      this.czRemaining = 8;
      this.czSuccessChance = (type === 'strong') ? 0.25 : 0.0;
      this.stats.totalCZ++;
      if (type === 'strong') this.stats.totalStrongCZ++;
      // Reset counters and resample next triggers
      this.czCounter = 0;
      this.nextCzGame = sampleGeometric(this.currentSetting().czProbability, this.rng);
      this.strongCzCounter = 0;
      this.nextStrongCzGame = sampleGeometric(this.currentSetting().strongCzProbability, this.rng);
      this.episodeCounter = 0;
      this.nextEpisodeGame = sampleGeometric(this.currentSetting().episodeProbability, this.rng);
      this.log(`Enter ${type === 'strong' ? 'STRONG CZ' : 'CZ'} (8G)`);
    }

    /**
     * Process a CZ game. Each spin builds success chance depending on
     * the role. When the 8th game concludes we test success and either
     * enter AT or return to normal.
     * @param {string} role
     */
    handleCZ(role) {
      this.log(`${this.state}: role ${role}, remaining ${this.czRemaining}`);
      // Increase success chance based on role and CZ type
      const incrementsStandard = {
        replay: 0.0,
        diagonalBell: 0.05,
        weakCherry: 0.10,
        suika: 0.10,
        chanceA: 0.15,
        chanceB: 0.15,
        strongCherry: 0.25,
        specialSymbol: 0.40,
        guaranteedCherry: 1.0,
        lowerReplay: 0.0
      };
      const incrementsStrong = {
        replay: 0.05,
        diagonalBell: 0.10,
        weakCherry: 0.20,
        suika: 0.20,
        chanceA: 0.30,
        chanceB: 0.30,
        strongCherry: 0.50,
        specialSymbol: 0.70,
        guaranteedCherry: 1.0,
        lowerReplay: 0.05
      };
      const incMap = this.state === 'CZ_STRONG' ? incrementsStrong : incrementsStandard;
      this.czSuccessChance += incMap[role] || 0;
      // Clamp success chance between 0 and 1
      if (this.czSuccessChance > 1) this.czSuccessChance = 1;
      // Decrement remaining games
      this.czRemaining--;
      if (this.czRemaining <= 0) {
        // Determine success
        const success = this.rng.next() < this.czSuccessChance;
        this.log(`CZ ${success ? 'succeeded' : 'failed'} (chance=${this.czSuccessChance.toFixed(2)})`);
        if (success) {
          // 50% of strong CZ successes directly enter hidden upper mode
          const upper = (this.state === 'CZ_STRONG') && (this.rng.next() < 0.5);
          this.startAT(upper);
        } else {
          // Failure: return to normal and maybe promote mode
          this.state = 'NORMAL';
        }
      }
    }

    /**
     * Enter an episode bonus. This always leads to AT after 20 games and
     * awards difference increases during the bonus. Duration is fixed at 20
     * games.
     */
    startEpisode() {
      this.state = 'EPISODE';
      this.episodeRemaining = 20;
      this.episodeBonus = 0;
      this.stats.totalEpisode++;
      // Reset counters and sample next triggers
      this.czCounter = 0;
      this.strongCzCounter = 0;
      this.episodeCounter = 0;
      this.atCounter = 0;
      this.nextCzGame = sampleGeometric(this.currentSetting().czProbability, this.rng);
      this.nextStrongCzGame = sampleGeometric(this.currentSetting().strongCzProbability, this.rng);
      this.nextEpisodeGame = sampleGeometric(this.currentSetting().episodeProbability, this.rng);
      this.nextAtGame = sampleGeometric(this.currentSetting().atProbability, this.rng);
      this.log('Enter EPISODE BONUS (20G)');
    }

    /**
     * Process an episode game. Each game counts down to zero; certain roles
     * award additional difference on the upcoming AT. After 20 games, AT
     * begins automatically.
     * @param {string} role
     */
    handleEpisode(role) {
      this.log(`EPISODE: role ${role}, remaining ${this.episodeRemaining}`);
      // Award extra difference on specific roles
      const bonusMap = {
        weakCherry: 10,
        suika: 10,
        chanceA: 20,
        chanceB: 20,
        strongCherry: 50,
        specialSymbol: 80,
        guaranteedCherry: 100
      };
      this.episodeBonus += bonusMap[role] || 0;
      this.episodeRemaining--;
      if (this.episodeRemaining <= 0) {
        // Start AT with extra difference
        this.startAT(false, this.episodeBonus);
      }
    }

    /**
     * Start the AT. The initial difference is drawn from the config's
     * distribution and any bonus difference carried over from episodes is
     * added. The parameter `upper` indicates whether the hidden upper mode
     * should be active from the start.
     *
     * @param {boolean} upper
     * @param {number} bonus
     */
    startAT(upper = false, bonus = 0) {
      this.state = 'AT_MAIN';
      this.upperMode = upper;
      this.stats.totalAT++;
      if (upper) this.stats.totalATUpper++;
      // Determine initial difference
      const diffKey = pickWeighted(this.config.atInitDifference, this.rng);
      const baseDiff = parseInt(diffKey, 10);
      this.atDifference = baseDiff + bonus;
      this.difference += this.atDifference;
      // Reset counters for AT
      this.atCounter = 0;
      this.nextAtGame = sampleGeometric(this.currentSetting().atProbability, this.rng);
      // Schedule first battle
      this.atGameCounter = 0;
      this.scheduleNextBattle();
      // Reset zone and judgment flags
      this.zoneType = '';
      this.zoneRemaining = 0;
      this.judgmentPending = false;
      this.log(`Enter AT (upper=${upper}) starting diff=${this.atDifference}, bonus=${bonus}`);
    }

    /**
     * Schedules the next battle game inside AT using the battle distribution.
     */
    scheduleNextBattle() {
      const dist = this.config.battleDistribution[this.upperMode ? 'D' : 'A'];
      const key = pickWeighted(dist, this.rng);
      this.nextBattleGame = parseInt(key, 10);
    }

    /**
     * Process the AT main game. Each spin reduces difference and checks for
     * battle triggers or zone entries. When the difference is exhausted,
     * judgment is performed.
     * @param {string} role
     */
    handleAT(role) {
      this.log(`AT: role ${role}, diff=${this.atDifference}, game=${this.atGameCounter}/${this.nextBattleGame}`);
      this.atGameCounter++;
      // Decrease difference by base cost per game (~4) but ensure non‑negative
      const perGameCost = 4;
      this.atDifference -= perGameCost;
      if (this.atDifference < 0) this.atDifference = 0;
      this.difference -= perGameCost;
      // Apply role bonus while in AT
      const bonusMap = {
        weakCherry: 5,
        suika: 5,
        chanceA: 10,
        chanceB: 10,
        strongCherry: 20,
        specialSymbol: 30,
        guaranteedCherry: 50
      };
      const bonus = bonusMap[role] || 0;
      this.atDifference += bonus;
      this.difference += bonus;
      // Check if it's time for a battle
      if (this.atGameCounter >= this.nextBattleGame) {
        this.startBattle();
        return;
      }
      // Random chance to enter a zone (add on or special). Upper mode makes
      // zones more frequent.
      const zoneChance = this.upperMode ? 0.05 : 0.02;
      if (this.rng.next() < zoneChance) {
        // Choose zone type based on weighted probabilities
        const zoneKey = pickWeighted({ addOn: 0.7, special1: 0.2, special2: 0.1 }, this.rng);
        this.startZone(zoneKey);
        return;
      }
      // Check for hidden upper mode triggers when not already in upper
      if (!this.upperMode) {
        const startRate = this.currentSetting().hiddenUpperStart;
        if (this.rng.next() < startRate) {
          // Immediately upgrade to upper mode; schedule new battle distribution
          this.upperMode = true;
          this.scheduleNextBattle();
          this.log('Hidden upper mode activated during AT');
        }
      }
      // If difference exhausted, prepare judgment
      if (this.atDifference <= 0 && !this.judgmentPending) {
        this.startJudgment();
      }
    }

    /**
     * Start a battle. Determines the opponent based on hidden upper mode
     * status and assigns a win probability. Winning grants a random amount
     * of difference and may spawn a zone. Losing does nothing. After
     * resolution, schedules the next battle.
     */
    startBattle() {
      this.state = 'BATTLE';
      this.stats.totalBattles++;
      // Choose enemy: weights skew heavier in normal mode; in upper mode,
      // stronger foes appear with lower frequency
      const enemies = this.upperMode
        ? { weak: 0.20, medium: 0.40, strong: 0.25, boss: 0.15 }
        : { weak: 0.40, medium: 0.30, strong: 0.20, boss: 0.10 };
      this.battleEnemy = pickWeighted(enemies, this.rng);
      // Assign win rates based on spec examples (converted to probabilities)
      const winRates = {
        weak: 0.40,
        medium: 0.47,
        strong: 0.53,
        boss: 0.76
      };
      this.battleWinRate = winRates[this.battleEnemy] || 0.5;
      // Immediately determine outcome
      const won = this.rng.next() < this.battleWinRate;
      if (won) {
        this.stats.battleWins++;
        // Add difference based on enemy difficulty
        const diffGain = {
          weak: 30,
          medium: 50,
          strong: 100,
          boss: 200
        }[this.battleEnemy] || 30;
        this.atDifference += diffGain;
        this.difference += diffGain;
        // Chance to spawn a zone
        if (this.rng.next() < 0.5) {
          const zoneKey = pickWeighted({ addOn: 0.6, special1: 0.3, special2: 0.1 }, this.rng);
          this.startZone(zoneKey);
          return;
        }
      } else {
        this.stats.battleLosses++;
      }
      // Return to AT and schedule next battle
      this.state = 'AT_MAIN';
      this.atGameCounter = 0;
      this.scheduleNextBattle();
    }

    /**
     * Start a zone (add‑on or special). Zones add difference and may loop
     * according to their loop rate. Different zone types have different
     * ranges of difference gain. After the zone ends, control returns to
     * AT_MAIN.
     * @param {string} type 'addOn' | 'special1' | 'special2'
     */
    startZone(type) {
      this.state = 'ZONE';
      this.zoneType = type;
      this.zoneRemaining = 1; // first iteration
      this.stats.totalZones++;
      this.log(`Enter zone ${type}`);
    }

    /**
     * Process the zone. Each iteration adds a random amount of difference
     * within the zone's min/max range. If the random loop check fails,
     * exit back to AT. Otherwise loop again. Zones consume no spins in
     * terms of counters.
     */
    handleZone(role) {
      const z = this.config.zoneTypes[this.zoneType];
      if (!z) {
        this.state = 'AT_MAIN';
        return;
      }
      // Add a random amount between min and max
      const gain = Math.floor(z.min + this.rng.next() * (z.max - z.min + 1));
      this.atDifference += gain;
      this.difference += gain;
      this.log(`Zone ${this.zoneType}: +${gain}`);
      // Determine if zone continues
      if (this.rng.next() < z.loopRate) {
        // Continue zone; immediate next call will process again
        return;
      }
      // Exit zone
      this.state = 'AT_MAIN';
    }

    /**
     * Prepare judgment sequence. A flag is set so that the next spin after
     * difference exhaustion enters the JUDGMENT state. This design allows
     * the reel animation to finish before the judgment happens.
     */
    startJudgment() {
      this.judgmentPending = true;
    }

    /**
     * Process judgment. A single spin after AT determines whether upper
     * mode is granted (success) or the machine returns to normal. The
     * success rate here is arbitrary but configurable via hiddenUpperStart.
     */
    handleJudgment(role) {
      this.log(`JUDGMENT: role ${role}`);
      // Determine success using current setting's hiddenUpperStart as base
      const baseRate = this.currentSetting().hiddenUpperStart;
      const success = this.rng.next() < baseRate;
      this.stats.totalJudgments++;
      if (success) {
        this.stats.judgmentSuccess++;
        this.startAT(true);
      } else {
        // Return to normal after failed judgment
        this.state = 'NORMAL';
      }
      this.judgmentPending = false;
    }

    /**
     * Handles the transition from AT when difference hits zero. We set the
     * machine state to JUDGMENT; the next spin will run handleJudgment.
     */
    checkJudgment() {
      if (this.state === 'AT_MAIN' && this.atDifference <= 0 && !this.judgmentPending) {
        this.state = 'JUDGMENT';
      }
    }

    /**
     * Save the current machine state into a plain object suitable for
     * serialisation. This includes the PRNG seed so that the future spins
     * reproduce identically when loaded. Do not save references to DOM.
     */
    serialize() {
      return {
        setting: this.setting,
        debug: this.debug,
        rngSeed: this.rng.state,
        state: this.state,
        mode: this.mode,
        upperMode: this.upperMode,
        gameCount: this.gameCount,
        czCounter: this.czCounter,
        strongCzCounter: this.strongCzCounter,
        episodeCounter: this.episodeCounter,
        atCounter: this.atCounter,
        nextCzGame: this.nextCzGame,
        nextStrongCzGame: this.nextStrongCzGame,
        nextEpisodeGame: this.nextEpisodeGame,
        nextAtGame: this.nextAtGame,
        kakuganRemaining: this.kakuganRemaining,
        czRemaining: this.czRemaining,
        czSuccessChance: this.czSuccessChance,
        czType: this.czType,
        episodeRemaining: this.episodeRemaining,
        episodeBonus: this.episodeBonus,
        atDifference: this.atDifference,
        difference: this.difference,
        atGameCounter: this.atGameCounter,
        nextBattleGame: this.nextBattleGame,
        zoneType: this.zoneType,
        zoneRemaining: this.zoneRemaining,
        judgmentPending: this.judgmentPending,
        credits: this.credits,
        stats: this.stats
      };
    }

    /**
     * Load a previously serialised state object. Overwrites the current
     * machine completely. Should be used with objects created via serialize().
     * @param {Object} obj
     */
    deserialize(obj) {
      if (!obj) return;
      this.setting = obj.setting || this.setting;
      this.debug = !!obj.debug;
      this.rng = new PRNG(obj.rngSeed || Date.now());
      this.state = obj.state || 'NORMAL';
      this.mode = obj.mode || 'A';
      this.upperMode = !!obj.upperMode;
      this.gameCount = obj.gameCount || 0;
      this.czCounter = obj.czCounter || 0;
      this.strongCzCounter = obj.strongCzCounter || 0;
      this.episodeCounter = obj.episodeCounter || 0;
      this.atCounter = obj.atCounter || 0;
      this.nextCzGame = obj.nextCzGame || sampleGeometric(this.currentSetting().czProbability, this.rng);
      this.nextStrongCzGame = obj.nextStrongCzGame || sampleGeometric(this.currentSetting().strongCzProbability, this.rng);
      this.nextEpisodeGame = obj.nextEpisodeGame || sampleGeometric(this.currentSetting().episodeProbability, this.rng);
      this.nextAtGame = obj.nextAtGame || sampleGeometric(this.currentSetting().atProbability, this.rng);
      this.kakuganRemaining = obj.kakuganRemaining || 0;
      this.czRemaining = obj.czRemaining || 0;
      this.czSuccessChance = obj.czSuccessChance || 0;
      this.czType = obj.czType || 'standard';
      this.episodeRemaining = obj.episodeRemaining || 0;
      this.episodeBonus = obj.episodeBonus || 0;
      this.atDifference = obj.atDifference || 0;
      this.difference = obj.difference || 0;
      this.atGameCounter = obj.atGameCounter || 0;
      this.nextBattleGame = obj.nextBattleGame || 0;
      this.zoneType = obj.zoneType || '';
      this.zoneRemaining = obj.zoneRemaining || 0;
      this.judgmentPending = !!obj.judgmentPending;
      this.credits = obj.credits || 0;
      this.stats = obj.stats || this.stats;
      // Resample triggers if missing
      if (!obj.nextBattleGame) {
        this.scheduleNextBattle();
      }
      localStorage.setItem('dg_setting', String(this.setting));
      localStorage.setItem('dg_debug', this.debug ? '1' : '0');
      localStorage.setItem('dg_seed', String(this.rng.state));
    }
  }

  /* -----------------------------------------------------------------------
   * UI layer
   *
   * The following code binds UI elements to the SlotMachine instance and
   * handles user interactions. Modals are created dynamically depending on
   * which menu item is selected. The UI layer is deliberately kept
   * lightweight so that the core game logic can be easily separated and
   * modified.
   */
  const machine = new SlotMachine(MACHINE_CONFIG);

  // DOM elements
  const menuBtn = document.getElementById('menu-btn');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  const creditsEl = document.getElementById('credits');
  const diffEl = document.getElementById('difference');
  const gameCountEl = document.getElementById('game-count');
  const debugStateEl = document.getElementById('debug-state');
  const debugModeEl = document.getElementById('debug-mode');

  const reelEls = [
    document.querySelector('#reel1 .symbol'),
    document.querySelector('#reel2 .symbol'),
    document.querySelector('#reel3 .symbol')
  ];
  const logPanel = document.getElementById('log-panel');

  const betBtn = document.getElementById('bet-btn');
  const leverBtn = document.getElementById('lever-btn');
  const autoBtn = document.getElementById('auto-btn');
  const skipBtn = document.getElementById('skip-btn');

  // Video elements. The background video loops according to the current
  // machine state. The cut‑in video plays short clips for rare roles. The
  // lcd video layer is reserved for future expansions (e.g., battle
  // intros or special zones) and remains unused unless explicitly set.
  const bgVideoEl = document.getElementById('background-video');
  const cutinVideoEl = document.getElementById('cutin-video');
  const lcdVideoEl = document.getElementById('lcd-video');

  // Track the current background state to avoid unnecessary reloads.
  let currentBgState = '';

  /**
   * Update the background video based on the machine's current state. If the
   * state maps to a list of video names in the config, a random entry is
   * selected. Otherwise the DEFAULT list is used. The function uses the
   * machine's PRNG to ensure reproducible selection when a seed is set.
   */
  function updateBackgroundVideo() {
    const presets = MACHINE_CONFIG.videoPresets?.background || {};
    const stateKey = machine.state || 'DEFAULT';
    // Avoid changing video if state hasn't changed
    if (stateKey === currentBgState) return;
    currentBgState = stateKey;
    const list = presets[stateKey] || presets.DEFAULT || [];
    if (!Array.isArray(list) || list.length === 0) return;
    // Pick a random video. Use machine.rng if available for determinism.
    const idx = Math.floor((machine.rng?.next() ?? Math.random()) * list.length);
    const file = list[idx];
    // If already playing this file, do nothing
    if (bgVideoEl.dataset.currentSrc === file) return;
    bgVideoEl.dataset.currentSrc = file;
    bgVideoEl.src = 'assets/video/' + file;
    // Ensure the video loops smoothly; load and play
    bgVideoEl.load();
    const playPromise = bgVideoEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {/* ignore play errors (e.g., due to user gesture) */});
    }
  }

  /**
   * Play a cut‑in video corresponding to a role. Roles are categorised
   * into strong, weak and special categories. If the role is not
   * recognised, no cut‑in will be played. The cut‑in will be hidden
   * automatically when it finishes playing.
   *
   * @param {string} role The role string as returned by the engine
   */
  function playCutin(role) {
    // Determine category based on role
    let category;
    switch (role) {
      case 'strongCherry':
      case 'guaranteedCherry':
        category = 'strong';
        break;
      case 'specialSymbol':
        category = 'special';
        break;
      case 'weakCherry':
      case 'suika':
      case 'diagonalBell':
      case 'chanceA':
      case 'chanceB':
        category = 'weak';
        break;
      default:
        return;
    }
    const presets = MACHINE_CONFIG.videoPresets?.cutin || {};
    const list = presets[category] || [];
    if (!Array.isArray(list) || list.length === 0) return;
    // Randomly select a file using machine rng for reproducibility
    const idx = Math.floor((machine.rng?.next() ?? Math.random()) * list.length);
    const file = list[idx];
    // Do not interrupt if a cut‑in is already playing
    if (!cutinVideoEl.classList.contains('hidden')) return;
    cutinVideoEl.dataset.currentSrc = file;
    cutinVideoEl.src = 'assets/video/' + file;
    cutinVideoEl.classList.remove('hidden');
    cutinVideoEl.load();
    const p = cutinVideoEl.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {/* ignore play errors */});
    }
    // Trigger a brief screen shake for strong or special categories
    if (category === 'strong' || category === 'special') {
      const lcd = document.getElementById('lcd-container');
      if (lcd) {
        lcd.classList.add('shake');
        setTimeout(() => {
          lcd.classList.remove('shake');
        }, 450);
      }
    }
    // When finished, hide again
    cutinVideoEl.onended = () => {
      cutinVideoEl.classList.add('hidden');
      cutinVideoEl.onended = null;
    };
  }

  let autoMode = false;
  let skipMode = false;
  let autoInterval = null;

  /**
   * Update the top bar counters and debug information.
   */
  function updateStatusDisplay() {
    creditsEl.textContent = machine.credits;
    diffEl.textContent = machine.difference;
    gameCountEl.textContent = machine.gameCount;
    if (machine.debug) {
      debugStateEl.textContent = machine.state;
      debugModeEl.textContent = machine.mode;
    }
  }

  /**
   * Render the latest role into the three reel slots. Since our simulator
   * condenses stopping into a single action, all reels show the same symbol.
   * In a more detailed implementation each reel could spin individually.
   */
  function updateReels(role) {
    const symbol = ROLE_SYMBOLS[role] || '-';
    for (const el of reelEls) {
      el.textContent = symbol;
    }
  }

  /**
   * Append a log line to the debug log panel.
   */
  function appendLogLines() {
    if (!machine.debug) return;
    logPanel.innerHTML = '';
    machine.logLines.forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      logPanel.appendChild(div);
    });
    // Scroll to bottom
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  /**
   * Perform a single spin: call machine.spin and update UI. If auto mode
   * is enabled, schedule the next spin automatically.
   */
  function performSpin() {
    // Perform the core spin
    const result = machine.spin();
    // Update UI elements
    updateReels(result.role);
    updateStatusDisplay();
    appendLogLines();
    // Trigger cut‑ins for certain roles
    playCutin(result.role);
    // Update background video if the state changed
    updateBackgroundVideo();
    // If we just exhausted AT difference and have pending judgment
    if (machine.judgmentPending && machine.state === 'AT_MAIN' && machine.atDifference <= 0) {
      machine.state = 'JUDGMENT';
    }
    // Auto mode scheduling
    if (autoMode) {
      const delay = skipMode ? 10 : 300; // ms between spins
      clearTimeout(autoInterval);
      autoInterval = setTimeout(performSpin, delay);
    }
  }

  /**
   * Toggle auto spin mode. Updates button label accordingly.
   */
  function toggleAuto() {
    autoMode = !autoMode;
    autoBtn.textContent = autoMode ? 'AUTO ON' : 'AUTO';
    if (autoMode) {
      performSpin();
    } else {
      clearTimeout(autoInterval);
    }
  }

  /**
   * Toggle skip (fast) mode. When enabled, auto spins occur at a much
   * shorter interval and animations are suppressed.
   */
  function toggleSkip() {
    skipMode = !skipMode;
    skipBtn.textContent = skipMode ? 'SKIP ON' : 'SKIP';
  }

  /**
   * Increment credits by 50. In real machines this would correspond to
   * inserting money or coins. Here we simply credit the player.
   */
  function addCredits() {
    machine.credits += 50;
    updateStatusDisplay();
  }

  // Bind buttons
  betBtn.addEventListener('click', addCredits);
  leverBtn.addEventListener('click', () => {
    if (!autoMode) {
      performSpin();
    }
  });
  autoBtn.addEventListener('click', toggleAuto);
  skipBtn.addEventListener('click', toggleSkip);

  /**
   * Show the main menu. Options are provided via buttons that load
   * different modal contents.
   */
  function openMenu() {
    modalTitle.textContent = 'Menu';
    modalBody.innerHTML = '';
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.style.margin = '0';
    const items = [
      { name: 'Change Setting & Options', action: openSettingsModal },
      { name: 'Statistics', action: openStatisticsModal },
      { name: 'Save / Load', action: openSaveLoadModal },
      { name: machine.debug ? 'Disable Debug' : 'Enable Debug', action: toggleDebug },
      { name: 'Export State', action: exportState },
      { name: 'Import State', action: importState }
    ];
    items.forEach(item => {
      const li = document.createElement('li');
      li.style.marginBottom = '0.5rem';
      const btn = document.createElement('button');
      btn.textContent = item.name;
      btn.style.width = '100%';
      btn.className = 'modal-menu-btn';
      btn.addEventListener('click', () => {
        item.action();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    modalBody.appendChild(list);
    showModal();
  }

  /**
   * Show settings modal allowing the user to change machine setting, toggle
   * debug and adjust auto/skip preferences.
   */
  function openSettingsModal() {
    modalTitle.textContent = 'Settings & Options';
    modalBody.innerHTML = '';
    // Setting selector
    const section1 = document.createElement('div');
    section1.className = 'modal-section';
    const h3 = document.createElement('h3');
    h3.textContent = 'Machine Setting';
    section1.appendChild(h3);
    const sel = document.createElement('select');
    MACHINE_CONFIG.settings.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = 'Setting ' + s.id;
      if (s.id === machine.setting) opt.selected = true;
      sel.appendChild(opt);
    });
    section1.appendChild(sel);
    // Debug checkbox
    const debugSection = document.createElement('div');
    debugSection.className = 'modal-section';
    const debugLabel = document.createElement('label');
    debugLabel.innerHTML = '<input type="checkbox" id="debug-toggle"> Debug Mode';
    debugSection.appendChild(debugLabel);
    // Auto & skip toggles display only for reference (cannot modify here)
    const info = document.createElement('p');
    info.textContent = 'Use the AUTO and SKIP buttons on the main screen to control autoplay and fast mode.';
    info.style.fontSize = '0.7rem';
    info.style.color = '#888';
    section1.appendChild(info);
    modalBody.appendChild(section1);
    modalBody.appendChild(debugSection);
    // Initialise debug toggle
    const debugToggle = debugLabel.querySelector('#debug-toggle');
    debugToggle.checked = machine.debug;
    // Save button
    const btnSection = document.createElement('div');
    btnSection.className = 'modal-section';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Apply';
    btnSection.appendChild(saveBtn);
    modalBody.appendChild(btnSection);
    saveBtn.addEventListener('click', () => {
      const selectedSetting = parseInt(sel.value, 10);
      machine.setSetting(selectedSetting);
      const debugEnabled = debugToggle.checked;
      machine.setDebug(debugEnabled);
      updateDebugVisibility();
      updateStatusDisplay();
      hideModal();
    });
  }

  /**
   * Render statistics modal showing aggregated counts and measured hit rates.
   */
  function openStatisticsModal() {
    modalTitle.textContent = 'Statistics';
    modalBody.innerHTML = '';
    const stats = machine.stats;
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const rows = [
      ['Total Spins', stats.totalSpins],
      ['Total CZ', stats.totalCZ],
      ['Strong CZ', stats.totalStrongCZ],
      ['Episode Bonus', stats.totalEpisode],
      ['AT Entries', stats.totalAT],
      ['Upper AT Entries', stats.totalATUpper],
      ['Battles', stats.totalBattles],
      ['Battle Wins', stats.battleWins],
      ['Battle Losses', stats.battleLosses],
      ['Zones', stats.totalZones],
      ['Judgments', stats.totalJudgments],
      ['Judgment Success', stats.judgmentSuccess],
      ['Max Difference', stats.maxDifference]
    ];
    rows.forEach(([label, value], idx) => {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = label;
      tdLabel.style.padding = '0.3rem';
      tdLabel.style.borderBottom = '1px solid #333';
      const tdValue = document.createElement('td');
      tdValue.textContent = value;
      tdValue.style.padding = '0.3rem';
      tdValue.style.borderBottom = '1px solid #333';
      tdValue.style.textAlign = 'right';
      tr.appendChild(tdLabel);
      tr.appendChild(tdValue);
      table.appendChild(tr);
    });
    modalBody.appendChild(table);
    // Reset stats button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Statistics';
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all statistics?')) {
        machine.stats = {
          totalSpins: 0,
          totalCZ: 0,
          totalStrongCZ: 0,
          totalEpisode: 0,
          totalAT: 0,
          totalATUpper: 0,
          totalBattles: 0,
          battleWins: 0,
          battleLosses: 0,
          totalZones: 0,
          totalJudgments: 0,
          judgmentSuccess: 0,
          maxDifference: 0
        };
        updateStatusDisplay();
        hideModal();
      }
    });
    resetBtn.style.marginTop = '1rem';
    modalBody.appendChild(resetBtn);
  }

  /**
   * Render the save/load modal. Allows saving into three slots and loading
   * from them. Save data includes full machine state and statistics.
   */
  function openSaveLoadModal() {
    modalTitle.textContent = 'Save / Load';
    modalBody.innerHTML = '';
    const container = document.createElement('div');
    for (let i = 0; i < 3; i++) {
      const slotIndex = i;
      const slotKey = 'dg_save_' + slotIndex;
      const slotData = localStorage.getItem(slotKey);
      const section = document.createElement('div');
      section.className = 'modal-section';
      const title = document.createElement('h3');
      title.textContent = 'Slot ' + (slotIndex + 1);
      section.appendChild(title);
      const info = document.createElement('p');
      info.style.fontSize = '0.75rem';
      info.style.color = '#aaa';
      if (slotData) {
        try {
          const obj = JSON.parse(slotData);
          const date = new Date(obj.timestamp);
          info.textContent = 'Saved on ' + date.toLocaleString();
        } catch (e) {
          info.textContent = 'Corrupt save data';
        }
      } else {
        info.textContent = 'Empty';
      }
      section.appendChild(info);
      const btnSave = document.createElement('button');
      btnSave.textContent = 'Save';
      btnSave.addEventListener('click', () => {
        const data = { timestamp: Date.now(), state: machine.serialize() };
        localStorage.setItem(slotKey, JSON.stringify(data));
        hideModal();
      });
      const btnLoad = document.createElement('button');
      btnLoad.textContent = 'Load';
      btnLoad.disabled = !slotData;
      btnLoad.addEventListener('click', () => {
        if (slotData) {
          try {
            const obj = JSON.parse(slotData);
            machine.deserialize(obj.state);
            updateStatusDisplay();
            updateDebugVisibility();
            hideModal();
          } catch (e) {
            alert('Failed to load save slot ' + (slotIndex + 1));
          }
        }
      });
      section.appendChild(btnSave);
      section.appendChild(btnLoad);
      container.appendChild(section);
    }
    // Export and import
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Current State';
    exportBtn.style.display = 'block';
    exportBtn.style.marginTop = '1rem';
    exportBtn.addEventListener('click', () => {
      const data = { timestamp: Date.now(), state: machine.serialize() };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dark-ghoul-save.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import State';
    importBtn.style.display = 'block';
    importBtn.style.marginTop = '0.5rem';
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const obj = JSON.parse(evt.target.result);
            machine.deserialize(obj.state);
            updateStatusDisplay();
            updateDebugVisibility();
            hideModal();
          } catch (err) {
            alert('Failed to import state');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
    modalBody.appendChild(container);
    modalBody.appendChild(exportBtn);
    modalBody.appendChild(importBtn);
  }

  /**
   * Toggle debug mode on or off through the menu. Updates persistent flag and
   * hides or shows debug UI elements.
   */
  function toggleDebug() {
    machine.setDebug(!machine.debug);
    updateDebugVisibility();
    hideModal();
  }

  /**
   * Export the current machine state as a JSON file. This is also
   * accessible via the save/load panel.
   */
  function exportState() {
    const data = { timestamp: Date.now(), state: machine.serialize() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dark-ghoul-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    hideModal();
  }

  /**
   * Prompt the user to import a machine state from a JSON file.
   */
  function importState() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const obj = JSON.parse(evt.target.result);
          machine.deserialize(obj.state);
          updateStatusDisplay();
          updateDebugVisibility();
          hideModal();
        } catch (err) {
          alert('Failed to import state');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  /**
   * Show the modal overlay.
   */
  function showModal() {
    modalOverlay.classList.remove('hidden');
  }
  /**
   * Hide the modal overlay.
   */
  function hideModal() {
    modalOverlay.classList.add('hidden');
  }
  modalCloseBtn.addEventListener('click', hideModal);
  menuBtn.addEventListener('click', openMenu);

  /**
   * Update the visibility of debug UI elements. Called whenever debug
   * mode toggles.
   */
  function updateDebugVisibility() {
    const debugEls = document.querySelectorAll('.debug-only');
    debugEls.forEach(el => {
      el.style.display = machine.debug ? '' : 'none';
    });
    // Clear logs if disabling debug
    if (!machine.debug) {
      machine.logLines = [];
      logPanel.innerHTML = '';
    }
    updateStatusDisplay();
  }

  // Initial UI state
  updateStatusDisplay();
  updateDebugVisibility();
  // Load an initial background video for the starting state
  updateBackgroundVideo();
})();