const SAVE_KEY = "eclipse-devourer-save-v1";
const MAX_LOG = 80;
const SYMBOL_POOL = ["✦", "☾", "☽", "✧", "✴", "⬢", "⬡"];
const PHASE_LABELS = {
  NORMAL: "通常",
  PRELUDE: "前兆",
  CZ: "BLOOD GATE",
  EP_BONUS: "ECLIPSE BONUS",
  AT: "DEVOUR RUSH",
  BATTLE: "ABYSS BATTLE",
  FRENZY: "FRENZY ZONE"
};

const ROLES = {
  blank: { key: "blank", label: "ハズレ", icon: "✦", payout: 0 },
  bell: { key: "bell", label: "ベル", icon: "🔔", payout: 8 },
  replay: { key: "replay", label: "リプレイ", icon: "↺", payout: 0 },
  cherry: { key: "cherry", label: "チェリー", icon: "🍒", payout: 3 },
  moon: { key: "moon", label: "ムーン", icon: "🌙", payout: 6 },
  chance: { key: "chance", label: "チャンス目", icon: "⚔️", payout: 10 },
  eye: { key: "eye", label: "下段リプレイ", icon: "👁️", payout: 0 },
  crush: { key: "crush", label: "強レア役", icon: "💀", payout: 15 }
};

const SETTING_DATA = {
  1: { cz: 1.0, ep: 1.0, at: 1.0, heaven: 0.06, upper: 1.0, battle: 1.0 },
  2: { cz: 1.05, ep: 1.03, at: 1.02, heaven: 0.08, upper: 1.04, battle: 1.02 },
  3: { cz: 1.08, ep: 1.06, at: 1.04, heaven: 0.11, upper: 1.08, battle: 1.04 },
  4: { cz: 1.12, ep: 1.1, at: 1.08, heaven: 0.15, upper: 1.12, battle: 1.08 },
  5: { cz: 1.18, ep: 1.16, at: 1.13, heaven: 0.2, upper: 1.18, battle: 1.14 },
  6: { cz: 1.25, ep: 1.24, at: 1.2, heaven: 0.28, upper: 1.28, battle: 1.22 }
};

const MODE_TABLE = {
  A: [150, 250, 350, 450, 600],
  B: [100, 200, 300, 400, 500],
  C: [100, 150, 250, 350, 450],
  chance: [50, 100, 150, 200],
  prep: [50, 100, 150],
  heaven: [30, 50, 80, 100]
};

const ROLE_WEIGHTS = {
  NORMAL: { blank: 46, bell: 30, replay: 15, cherry: 4.2, moon: 2.4, chance: 1.2, eye: 0.6, crush: 0.6 },
  EYE: { blank: 0, bell: 20, replay: 14, cherry: 34, moon: 20, chance: 7, eye: 2, crush: 3 },
  CZ: { blank: 34, bell: 32, replay: 17, cherry: 7, moon: 4, chance: 4, eye: 0, crush: 2 },
  EP: { blank: 0, bell: 28, replay: 15, cherry: 22, moon: 18, chance: 10, eye: 0, crush: 7 },
  AT: { blank: 27, bell: 38, replay: 16, cherry: 9, moon: 6, chance: 2, eye: 1, crush: 1 },
  AT_EYE: { blank: 0, bell: 20, replay: 14, cherry: 32, moon: 18, chance: 8, eye: 2, crush: 6 },
  BATTLE: { blank: 4, bell: 30, replay: 12, cherry: 18, moon: 15, chance: 11, eye: 2, crush: 8 },
  FRENZY: { blank: 0, bell: 22, replay: 10, cherry: 24, moon: 20, chance: 14, eye: 0, crush: 10 }
};

const ENEMIES = [
  { name: "DREAD HOUND", win: 36 },
  { name: "BLOOD REAPER", win: 50 },
  { name: "ABYSS EATER", win: 66 },
  { name: "CROWN EXECUTOR", win: 82 }
];

const FRENZY_TYPES = {
  NIGHT_RAID: { label: "NIGHT RAID", games: [5, 6, 7], addMin: 15, addMax: 50 },
  CENTIPEDE_RUSH: { label: "CENTIPEDE RUSH", games: [4, 5], addMin: 40, addMax: 100 },
  KING_EATER: { label: "KING EATER", games: [3, 4], addMin: 80, addMax: 320 }
};

const $ = (id) => document.getElementById(id);

const dom = {
  phaseLabel: $("phase-label"),
  flagMode: $("flag-mode"),
  flagKakugan: $("flag-kakugan"),
  flagUpper: $("flag-upper"),
  flagThrough: $("flag-through"),
  creditValue: $("credit-value"),
  totalDiff: $("total-diff"),
  atRemain: $("at-remain"),
  leverBtn: $("lever-btn"),
  stopBtns: [$("stop-0"), $("stop-1"), $("stop-2")],
  autoBtn: $("auto-btn"),
  normalGames: $("normal-games"),
  totalGames: $("total-games"),
  czCount: $("cz-count"),
  atCount: $("at-count"),
  epCount: $("ep-count"),
  bestShot: $("best-shot"),
  settingBadge: $("setting-badge"),
  modeReadout: $("mode-readout"),
  preReadout: $("pre-readout"),
  czPoint: $("cz-point"),
  ceilingReadout: $("ceiling-readout"),
  upperReadout: $("upper-readout"),
  throughReadout: $("through-readout"),
  eventLog: $("event-log"),
  debugBadge: $("debug-badge"),
  screenSmall: $("screen-small"),
  screenBig: $("screen-big"),
  screenMid: $("screen-mid"),
  homeModal: $("home-modal"),
  openHome: $("open-home"),
  closeHome: $("close-home"),
  newGame: $("new-game"),
  resumeGame: $("resume-game"),
  settingGrid: $("setting-grid"),
  autoStopDefault: $("auto-stop-default"),
  saveBtn: $("save-btn"),
  loadBtn: $("load-btn"),
  manualSave: $("manual-save"),
  manualLoad: $("manual-load"),
  exportSave: $("export-save"),
  resetSave: $("reset-save"),
  saveText: $("save-text"),
  toggleDebug: $("toggle-debug"),
  reels: [$("reel-0"), $("reel-1"), $("reel-2")]
};

const runtime = {
  spinning: false,
  currentOutcome: null,
  currentStopIndex: 0,
  intervals: [null, null, null],
  autoTimer: null,
  reelViews: [[], [], []]
};

function createInitialState(setting = 1) {
  const state = {
    version: 1,
    setting,
    autoMode: false,
    autoStopDefault: false,
    debug: false,
    credits: 500,
    totalDiff: 0,
    normalGames: 0,
    totalGames: 0,
    czCount: 0,
    atCount: 0,
    epCount: 0,
    bestShot: 0,
    mode: pickNextMode(setting),
    ceiling: 0,
    kakuganRemain: 0,
    czPoint: 0,
    phase: "NORMAL",
    preludeKind: null,
    preludeGames: 0,
    czGamesLeft: 0,
    czSuccessRate: 0,
    czForceSuccess: false,
    epGamesLeft: 0,
    epBonusAdd: 0,
    atRemain: 0,
    atBasePayout: 8,
    atStartDiff: 0,
    battlePoint: 0,
    battleEnemy: null,
    battleGamesLeft: 0,
    battleBoost: 0,
    frenzyType: null,
    frenzyGamesLeft: 0,
    upperMode: false,
    upperMeter: 0,
    throughStock: 0,
    throughGrace: 0,
    upperSeed: false,
    upperLoopCount: 0,
    logs: []
  };
  state.ceiling = pickCeiling(state.mode);
  return state;
}

let state = createInitialState();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(table) {
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let roll = Math.random() * total;
  for (const [key, value] of entries) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function pickNextMode(setting, bonus = 0) {
  const heavenChance = SETTING_DATA[setting].heaven + bonus;
  const roll = Math.random();
  if (roll < heavenChance) return "heaven";
  if (roll < heavenChance + 0.08) return "prep";
  if (roll < heavenChance + 0.18) return "chance";
  if (roll < heavenChance + 0.34) return "C";
  if (roll < heavenChance + 0.56) return "B";
  return "A";
}

function pickCeiling(mode) {
  return MODE_TABLE[mode][randInt(0, MODE_TABLE[mode].length - 1)];
}

function seedNextFrontDoor(bonus = 0) {
  state.mode = pickNextMode(state.setting, bonus);
  state.ceiling = state.normalGames + pickCeiling(state.mode);
}

function makeLog(text, type = "") {
  state.logs.unshift({ text, type });
  state.logs = state.logs.slice(0, MAX_LOG);
}

function randomDecorSymbol(exclude) {
  const options = SYMBOL_POOL.filter((s) => s !== exclude);
  return options[randInt(0, options.length - 1)];
}

function randomThree(center) {
  return [randomDecorSymbol(center), center, randomDecorSymbol(center)];
}

function buildReelsForRole(roleKey) {
  if (roleKey === "blank") {
    return Array.from({ length: 3 }, () => [randomDecorSymbol(""), randomDecorSymbol(""), randomDecorSymbol("")]);
  }
  const icon = ROLES[roleKey].icon;
  return [randomThree(icon), randomThree(icon), randomThree(icon)];
}

function renderSingleReel(index, symbols) {
  runtime.reelViews[index] = symbols;
  dom.reels[index].innerHTML = symbols
    .map((symbol, row) => {
      const label = row === 1 ? findRoleLabelByIcon(symbol) : "";
      return `<div class="symbol-cell">${symbol}${label ? `<span class="symbol-label">${label}</span>` : ""}</div>`;
    })
    .join("");
}

function findRoleLabelByIcon(icon) {
  const role = Object.values(ROLES).find((item) => item.icon === icon);
  return role ? role.label : "";
}

function initReels() {
  for (let i = 0; i < 3; i += 1) {
    renderSingleReel(i, [randomDecorSymbol(""), randomDecorSymbol(""), randomDecorSymbol("")]);
  }
}

function determineWeightTable() {
  if (state.phase === "CZ") return ROLE_WEIGHTS.CZ;
  if (state.phase === "EP_BONUS") return ROLE_WEIGHTS.EP;
  if (state.phase === "BATTLE") return ROLE_WEIGHTS.BATTLE;
  if (state.phase === "FRENZY") return ROLE_WEIGHTS.FRENZY;
  if (state.phase === "AT") {
    return state.kakuganRemain > 0 ? ROLE_WEIGHTS.AT_EYE : ROLE_WEIGHTS.AT;
  }
  return state.kakuganRemain > 0 ? ROLE_WEIGHTS.EYE : ROLE_WEIGHTS.NORMAL;
}

function generateOutcome() {
  const roleKey = weightedPick(determineWeightTable());
  return {
    role: ROLES[roleKey],
    reels: buildReelsForRole(roleKey)
  };
}

function consumeBet() {
  if (state.credits < 3) {
    makeLog("クレジット不足。HOMEからNEW GAMEまたはLOADを実行してください。", "highlight");
    render();
    return false;
  }
  state.credits -= 3;
  state.totalDiff -= 3;
  return true;
}

function startSpin() {
  if (runtime.spinning || dom.homeModal.classList.contains("visible")) return;
  if (!consumeBet()) return;

  state.totalGames += 1;
  if (["NORMAL", "PRELUDE"].includes(state.phase)) {
    state.normalGames += 1;
    if (state.throughGrace > 0) state.throughGrace -= 1;
  }

  runtime.currentOutcome = generateOutcome();
  runtime.spinning = true;
  runtime.currentStopIndex = 0;

  dom.stopBtns.forEach((btn, index) => {
    btn.disabled = index !== 0;
  });
  dom.leverBtn.disabled = true;

  for (let i = 0; i < 3; i += 1) {
    clearInterval(runtime.intervals[i]);
    runtime.intervals[i] = setInterval(() => {
      const reelSymbols = [randomDecorSymbol(""), randomDecorSymbol(""), randomDecorSymbol("")];
      renderSingleReel(i, reelSymbols);
    }, 70 + i * 12);
  }

  if (state.autoMode || state.autoStopDefault) {
    queueAutoStops();
  }

  render();
}

function queueAutoStops() {
  clearTimeout(runtime.autoTimer);
  runtime.autoTimer = setTimeout(() => stopReel(0), 320);
  setTimeout(() => stopReel(1), 620);
  setTimeout(() => stopReel(2), 920);
}

function stopReel(index) {
  if (!runtime.spinning || runtime.currentStopIndex !== index) return;
  clearInterval(runtime.intervals[index]);
  renderSingleReel(index, runtime.currentOutcome.reels[index]);
  dom.stopBtns[index].disabled = true;
  runtime.currentStopIndex += 1;

  if (index < 2) {
    dom.stopBtns[index + 1].disabled = false;
  } else {
    finalizeSpin();
  }
}

function finalizeSpin() {
  runtime.spinning = false;
  dom.leverBtn.disabled = false;
  dom.stopBtns.forEach((btn) => (btn.disabled = true));
  const outcome = runtime.currentOutcome;
  let payout = outcome.role.payout;

  if (state.phase === "NORMAL") {
    payout += processNormalPhase(outcome.role);
  } else if (state.phase === "PRELUDE") {
    payout += processPreludePhase(outcome.role);
  } else if (state.phase === "CZ") {
    payout += processCzPhase(outcome.role);
  } else if (state.phase === "EP_BONUS") {
    payout += processEpPhase(outcome.role);
  } else if (state.phase === "AT") {
    payout += processAtPhase(outcome.role);
  } else if (state.phase === "BATTLE") {
    payout += processBattlePhase(outcome.role);
  } else if (state.phase === "FRENZY") {
    payout += processFrenzyPhase(outcome.role);
  }

  state.credits += payout;
  maybeExpireKakugan();
  autoSave();
  render();

  if (state.autoMode && !dom.homeModal.classList.contains("visible")) {
    clearTimeout(runtime.autoTimer);
    runtime.autoTimer = setTimeout(() => startSpin(), 650);
  }
}

function maybeExpireKakugan() {
  if (["NORMAL", "PRELUDE", "AT", "BATTLE", "FRENZY"].includes(state.phase) && state.kakuganRemain > 0) {
    state.kakuganRemain -= 1;
    if (state.kakuganRemain === 0) {
      makeLog("赫眼終了。静寂が戻る。", "");
    }
  }
}

function enterKakugan(extra = null) {
  const length = extra || weightedPick({ 10: 70, 20: 20, 30: 8, 50: 2 });
  state.kakuganRemain = Math.max(state.kakuganRemain, Number(length));
  makeLog(`赫眼突入 ${length}G。レア役密度が上昇。`, "highlight");
}

function startPrelude(kind, games = 3) {
  state.phase = "PRELUDE";
  state.preludeKind = kind;
  state.preludeGames = games;
  const label = kind === "CZ" ? "BLOOD GATE" : kind === "EP" ? "ECLIPSE BONUS" : "DEVOUR RUSH";
  makeLog(`${label} 前兆開始。`, "highlight");
}

function enterCz(initialRate = 28) {
  state.phase = "CZ";
  state.preludeKind = null;
  state.preludeGames = 0;
  state.czGamesLeft = 8;
  state.czSuccessRate = clamp(initialRate, 10, 92);
  state.czForceSuccess = false;
  state.czCount += 1;
  makeLog(`CZ「BLOOD GATE」突入。成功期待度 ${state.czSuccessRate.toFixed(0)}%`, "highlight");
}

function enterEpBonus() {
  state.phase = "EP_BONUS";
  state.preludeKind = null;
  state.preludeGames = 0;
  state.epGamesLeft = 20;
  state.epBonusAdd = 0;
  state.epCount += 1;
  makeLog("ECLIPSE BONUS突入。消化後AT確定。", "highlight");
}

function startAT(base, reason = "") {
  state.phase = "AT";
  state.atCount += 1;
  state.atRemain = base;
  state.atBasePayout = state.upperMode ? 10 : 8;
  state.atStartDiff = state.totalDiff;
  state.battlePoint = 0;
  state.battleEnemy = null;
  state.battleGamesLeft = 0;
  state.battleBoost = 0;
  state.frenzyType = null;
  state.frenzyGamesLeft = 0;
  state.czGamesLeft = 0;
  state.czSuccessRate = 0;
  state.epGamesLeft = 0;
  state.epBonusAdd = 0;
  state.normalGames = 0;
  state.czPoint = 0;
  state.upperMeter = 0;
  seedNextFrontDoor(state.throughStock > 0 ? 0.25 : 0);

  if (state.throughStock > 0 || state.upperSeed) {
    state.upperMode = true;
    state.upperLoopCount += 1;
    state.atRemain += 120;
    if (state.throughStock > 0) state.throughStock -= 1;
    state.upperSeed = false;
    makeLog("貫き発動。上位ATを引き継いで再突入。", "win");
  }

  makeLog(`AT「DEVOUR RUSH」開始 +${base}枚${reason ? ` / ${reason}` : ""}`, "win");
}

function startBattle() {
  state.phase = "BATTLE";
  state.battleGamesLeft = 3;
  state.battleBoost = 0;
  const weighted = state.upperMode ? { 0: 20, 1: 32, 2: 30, 3: 18 } : { 0: 40, 1: 30, 2: 20, 3: 10 };
  const enemyIndex = Number(weightedPick(weighted));
  state.battleEnemy = ENEMIES[enemyIndex];
  makeLog(`対決開始: ${state.battleEnemy.name}`, "highlight");
}

function startFrenzy(typeKey) {
  const frenzy = FRENZY_TYPES[typeKey];
  state.phase = "FRENZY";
  state.frenzyType = typeKey;
  state.frenzyGamesLeft = frenzy.games[randInt(0, frenzy.games.length - 1)];
  makeLog(`${frenzy.label} 突入。${state.frenzyGamesLeft}G継続。`, "win");
}

function enterUpperMode(reason = "") {
  if (state.upperMode) return;
  state.upperMode = true;
  state.upperMeter = 0;
  state.atRemain += 180;
  makeLog(`上位モード「CROWN ECLIPSE」突入${reason ? ` / ${reason}` : ""}`, "win");
}

function endAT() {
  const shot = state.totalDiff - state.atStartDiff;
  state.bestShot = Math.max(state.bestShot, shot);
  const throughCondition = state.upperMode && (shot >= 1500 || Math.random() < 0.68);

  if (throughCondition) {
    state.phase = "NORMAL";
    state.upperMode = false;
    state.kakuganRemain = 0;
    state.throughStock = clamp(state.throughStock + 1, 0, 2);
    state.throughGrace = 80;
    state.upperSeed = true;
    state.normalGames = 0;
    state.mode = "heaven";
    state.ceiling = pickCeiling("heaven");
    state.czPoint = 35;
    makeLog(`AT終了後、貫き待機へ移行。一撃 ${shot}枚 / 次回上位優遇。`, "win");
    return;
  }

  state.phase = "NORMAL";
  state.upperMode = false;
  state.kakuganRemain = 0;
  state.upperSeed = false;
  state.throughGrace = 0;
  state.normalGames = 0;
  state.czPoint = 0;
  state.mode = pickNextMode(state.setting);
  state.ceiling = pickCeiling(state.mode);
  makeLog(`AT終了。一撃 ${shot}枚。通常へ。`, shot >= 800 ? "highlight" : "");
}

function processNormalPhase(role) {
  let extraPayout = 0;
  const setting = SETTING_DATA[state.setting];

  if (role.key === "eye") enterKakugan();
  if (role.key === "crush" && Math.random() < 0.2) enterKakugan(20);

  const rarePointTable = {
    cherry: 10,
    moon: 18,
    chance: 28,
    crush: 40
  };
  if (rarePointTable[role.key]) {
    const boost = state.kakuganRemain > 0 ? 1.35 : 1;
    state.czPoint += Math.floor(rarePointTable[role.key] * boost);
    state.upperMeter += Math.floor(rarePointTable[role.key] * 0.35);
  }

  if (state.throughGrace > 0 && (role.key === "chance" || role.key === "crush" || state.normalGames >= 18)) {
    startPrelude(Math.random() < 0.45 ? "EP" : "AT", 2);
    state.throughGrace = 0;
    return extraPayout;
  }

  if (role.key === "crush" && Math.random() < 0.12 * setting.ep) {
    startPrelude("EP", 3);
    seedNextFrontDoor(0.06);
    return extraPayout;
  }

  if ((role.key === "chance" || role.key === "crush") && Math.random() < 0.06 * setting.at * (state.upperSeed ? 3 : 1)) {
    startPrelude("AT", 2);
    seedNextFrontDoor(0.12);
    return extraPayout;
  }

  if (state.czPoint >= 100 || (role.key !== "blank" && Math.random() < 0.015 * setting.cz * (state.kakuganRemain > 0 ? 2.2 : 1))) {
    startPrelude(Math.random() < 0.22 * setting.ep ? "EP" : "CZ", state.kakuganRemain > 0 ? 2 : 3);
    state.czPoint = Math.max(0, state.czPoint - 80);
    seedNextFrontDoor(0.04);
    return extraPayout;
  }

  if (state.normalGames >= state.ceiling) {
    startPrelude(state.upperSeed || state.throughStock > 0 ? "EP" : "CZ", 2);
    state.czPoint = Math.max(30, state.czPoint);
    seedNextFrontDoor(0.08);
    return extraPayout;
  }

  return extraPayout;
}

function processPreludePhase(role) {
  let extraPayout = 0;
  const isRare = ["cherry", "moon", "chance", "crush"].includes(role.key);
  if (role.key === "eye") enterKakugan(20);

  if (isRare) {
    state.preludeGames -= role.key === "crush" ? 2 : 1;
    if (state.preludeKind === "CZ" && (role.key === "chance" || role.key === "crush") && Math.random() < 0.45) {
      state.preludeKind = "EP";
      makeLog("前兆昇格。ECLIPSE BONUSへ。", "highlight");
    }
  } else {
    state.preludeGames -= 1;
  }

  if (state.preludeGames <= 0) {
    if (state.preludeKind === "CZ") {
      enterCz(28 + state.czPoint * 0.2 + state.kakuganRemain * 0.35);
    } else if (state.preludeKind === "EP") {
      enterEpBonus();
    } else {
      startAT(randInt(160, 280), "直AT");
    }
  }

  return extraPayout;
}

function processCzPhase(role) {
  let extraPayout = 0;
  const addTable = { bell: 10, cherry: 18, moon: 25, chance: 40, crush: 65, replay: 2 };
  state.czGamesLeft -= 1;
  state.czSuccessRate += addTable[role.key] || 0;

  if (role.key === "crush") {
    state.czForceSuccess = true;
    makeLog("強レア役成立。CZ成功濃厚。", "win");
  }
  if (role.key === "eye") enterKakugan(20);

  if (state.czGamesLeft <= 0) {
    const successRate = clamp(state.czSuccessRate * 0.44 * SETTING_DATA[state.setting].cz, 5, 97);
    if (state.czForceSuccess || Math.random() * 100 < successRate) {
      startAT(randInt(180, 300), "CZ成功");
    } else {
      state.phase = "NORMAL";
      state.czGamesLeft = 0;
      state.czSuccessRate = 0;
      state.czForceSuccess = false;
      makeLog(`CZ失敗。通常へ。`, "");
    }
  }

  return extraPayout;
}

function processEpPhase(role) {
  let extraPayout = 5;
  const addTable = { bell: 0, replay: 0, cherry: 20, moon: 40, chance: 80, crush: 150 };
  state.epGamesLeft -= 1;
  state.epBonusAdd += addTable[role.key] || 0;

  if (role.key === "eye") enterKakugan(20);

  if (state.epGamesLeft <= 0) {
    const base = randInt(180, 260) + state.epBonusAdd;
    startAT(base, "EP BONUS");
  }
  return extraPayout;
}

function maybeTriggerUpper(role) {
  if (state.upperMode) return;
  const meterAdd = { cherry: 10, moon: 18, chance: 32, crush: 55 };
  state.upperMeter += meterAdd[role.key] || 0;
  const threshold = 170 / SETTING_DATA[state.setting].upper;
  if (state.upperMeter >= threshold || (role.key === "crush" && Math.random() < 0.12 * SETTING_DATA[state.setting].upper)) {
    enterUpperMode("覚醒連鎖");
  }
}

function maybeStartFrenzyByRole(role) {
  if (role.key === "crush") {
    startFrenzy(weightedPick(state.upperMode ? { KING_EATER: 45, CENTIPEDE_RUSH: 35, NIGHT_RAID: 20 } : { CENTIPEDE_RUSH: 45, NIGHT_RAID: 40, KING_EATER: 15 }));
    return true;
  }
  if (role.key === "chance" && Math.random() < (state.upperMode ? 0.22 : 0.08)) {
    startFrenzy(weightedPick({ NIGHT_RAID: 50, CENTIPEDE_RUSH: 35, KING_EATER: 15 }));
    return true;
  }
  return false;
}

function processAtPhase(role) {
  let extraPayout = state.upperMode ? 10 : 8;
  state.atRemain -= state.upperMode ? 10 : 8;
  const pointTable = { bell: 12, replay: 2, cherry: 24, moon: 38, chance: 56, crush: 92, eye: 8 };
  state.battlePoint += pointTable[role.key] || 0;

  if (role.key === "eye") enterKakugan(state.upperMode ? 30 : 20);
  if (state.kakuganRemain > 0 && ["cherry", "moon", "chance", "crush"].includes(role.key)) {
    state.battlePoint += 22;
    state.upperMeter += 8;
  }

  maybeTriggerUpper(role);

  if (maybeStartFrenzyByRole(role)) {
    return extraPayout;
  }

  const battleThreshold = state.upperMode ? 85 : 110;
  if (state.battlePoint >= battleThreshold) {
    state.battlePoint = Math.max(0, state.battlePoint - battleThreshold);
    startBattle();
    return extraPayout;
  }

  if (state.atRemain <= 0) {
    endAT();
  }

  return extraPayout;
}

function processBattlePhase(role) {
  let extraPayout = state.upperMode ? 12 : 10;
  state.atRemain -= state.upperMode ? 10 : 8;
  const boostTable = { bell: 10, replay: 0, cherry: 18, moon: 28, chance: 45, crush: 70, eye: 5 };
  state.battleBoost += boostTable[role.key] || 0;
  state.battleGamesLeft -= 1;

  if (role.key === "eye") enterKakugan(20);

  if (state.battleGamesLeft <= 0) {
    const finalRate = clamp(state.battleEnemy.win + state.battleBoost * 0.42 + (state.upperMode ? 14 : 0), 12, 99);
    if (Math.random() * 100 < finalRate) {
      const rewardRoll = state.upperMode
        ? weightedPick({ small: 30, medium: 35, large: 20, frenzy: 15 })
        : weightedPick({ small: 40, medium: 35, large: 15, frenzy: 10 });
      if (rewardRoll === "small") {
        const add = randInt(40, 80);
        state.atRemain += add;
        makeLog(`${state.battleEnemy.name} 撃破。+${add}枚`, "win");
      } else if (rewardRoll === "medium") {
        const add = randInt(90, 180);
        state.atRemain += add;
        makeLog(`${state.battleEnemy.name} 撃破。+${add}枚`, "win");
      } else if (rewardRoll === "large") {
        const add = randInt(220, 420);
        state.atRemain += add;
        makeLog(`${state.battleEnemy.name} 撃破。大上乗せ +${add}枚`, "win");
      } else {
        startFrenzy(weightedPick(state.upperMode ? { KING_EATER: 50, CENTIPEDE_RUSH: 35, NIGHT_RAID: 15 } : { CENTIPEDE_RUSH: 42, NIGHT_RAID: 40, KING_EATER: 18 }));
        state.battleEnemy = null;
        state.battleGamesLeft = 0;
        state.battleBoost = 0;
        return extraPayout;
      }
    } else {
      makeLog(`${state.battleEnemy.name} に敗北。AT継続。`, "");
    }
    state.phase = "AT";
    state.battleEnemy = null;
    state.battleGamesLeft = 0;
    state.battleBoost = 0;
    if (state.atRemain <= 0) endAT();
  }

  return extraPayout;
}

function processFrenzyPhase(role) {
  let extraPayout = state.upperMode ? 12 : 10;
  const frenzy = FRENZY_TYPES[state.frenzyType];
  const baseAdd = randInt(frenzy.addMin, frenzy.addMax);
  const roleBoost = { cherry: 15, moon: 25, chance: 50, crush: 120 }[role.key] || 0;
  const add = baseAdd + roleBoost + (state.upperMode ? 25 : 0);

  state.atRemain += add;
  state.frenzyGamesLeft -= 1;
  makeLog(`${frenzy.label} +${add}枚`, "win");

  if (role.key === "eye") enterKakugan(20);
  if (role.key === "crush" && state.frenzyType !== "KING_EATER" && Math.random() < 0.25) {
    startFrenzy("KING_EATER");
    return extraPayout;
  }

  if (state.frenzyGamesLeft <= 0) {
    state.phase = "AT";
    state.frenzyType = null;
    state.frenzyGamesLeft = 0;
  }
  return extraPayout;
}

function renderLogs() {
  dom.eventLog.innerHTML = state.logs
    .map((item) => `<div class="log-item ${item.type || ""}">${item.text}</div>`)
    .join("");
}

function formatDiff(num) {
  return `${num >= 0 ? "+" : ""}${num}`;
}

function renderFlags() {
  dom.flagMode.textContent = `MODE ${state.mode.toUpperCase()}`;
  dom.flagKakugan.textContent = `EYE ${state.kakuganRemain}G`;
  dom.flagKakugan.className = `status-pill ${state.kakuganRemain > 0 ? "active-eye" : "off"}`;
  dom.flagUpper.textContent = state.upperMode ? `UPPER ON` : state.upperSeed ? `UPPER SEED` : "UPPER OFF";
  dom.flagUpper.className = `status-pill ${state.upperMode || state.upperSeed ? "active-upper" : "off"}`;
  dom.flagThrough.textContent = `THROUGH ${state.throughStock}`;
  dom.flagThrough.className = `status-pill ${state.throughStock > 0 ? "active-upper" : "off"}`;
}

function renderScreen() {
  dom.phaseLabel.textContent = PHASE_LABELS[state.phase];
  if (state.phase === "NORMAL") {
    dom.screenSmall.textContent = state.upperSeed ? "THROUGH STANDBY" : "NORMAL STATE";
    dom.screenBig.textContent = state.kakuganRemain > 0 ? "SCARLET EYE" : "PRESS LEVER";
    dom.screenMid.textContent = state.upperSeed
      ? `上位継承待機。${state.ceiling}G以内の当選に期待。`
      : `天井まであと ${Math.max(0, state.ceiling - state.normalGames)}G / CZポイント ${state.czPoint}`;
  } else if (state.phase === "PRELUDE") {
    dom.screenSmall.textContent = "PRELUDE";
    dom.screenBig.textContent = state.preludeKind === "CZ" ? "BLOOD GATE" : state.preludeKind === "EP" ? "ECLIPSE BONUS" : "DEVOUR RUSH";
    dom.screenMid.textContent = `発展まで残り ${state.preludeGames}G`;
  } else if (state.phase === "CZ") {
    dom.screenSmall.textContent = "CZ";
    dom.screenBig.textContent = "BLOOD GATE";
    dom.screenMid.textContent = `残り ${state.czGamesLeft}G / 成功期待 ${Math.floor(clamp(state.czSuccessRate * 0.44, 0, 99))}%`;
  } else if (state.phase === "EP_BONUS") {
    dom.screenSmall.textContent = "BONUS";
    dom.screenBig.textContent = "ECLIPSE BONUS";
    dom.screenMid.textContent = `残り ${state.epGamesLeft}G / AT上乗せ ${state.epBonusAdd}枚`;
  } else if (state.phase === "AT") {
    dom.screenSmall.textContent = state.upperMode ? "UPPER AT" : "AT";
    dom.screenBig.textContent = state.upperMode ? "CROWN ECLIPSE" : "DEVOUR RUSH";
    dom.screenMid.textContent = `残差枚 ${Math.max(0, state.atRemain)} / バトルpt ${state.battlePoint}`;
  } else if (state.phase === "BATTLE") {
    dom.screenSmall.textContent = "BATTLE";
    dom.screenBig.textContent = state.battleEnemy?.name || "ABYSS BATTLE";
    dom.screenMid.textContent = `残り ${state.battleGamesLeft}G / ブースト ${state.battleBoost}`;
  } else if (state.phase === "FRENZY") {
    dom.screenSmall.textContent = "FRENZY";
    dom.screenBig.textContent = FRENZY_TYPES[state.frenzyType]?.label || "FRENZY ZONE";
    dom.screenMid.textContent = `残り ${state.frenzyGamesLeft}G`;
  }
}

function renderStats() {
  dom.creditValue.textContent = state.credits;
  dom.totalDiff.textContent = formatDiff(state.totalDiff);
  dom.atRemain.textContent = Math.max(0, Math.floor(state.atRemain));
  dom.normalGames.textContent = state.normalGames;
  dom.totalGames.textContent = state.totalGames;
  dom.czCount.textContent = state.czCount;
  dom.atCount.textContent = state.atCount;
  dom.epCount.textContent = state.epCount;
  dom.bestShot.textContent = state.bestShot;
  dom.settingBadge.textContent = `設定${state.setting}`;
  dom.modeReadout.textContent = state.mode.toUpperCase();
  dom.preReadout.textContent = state.phase === "PRELUDE" ? `${state.preludeKind} ${state.preludeGames}G` : "-";
  dom.czPoint.textContent = Math.floor(state.czPoint);
  dom.ceilingReadout.textContent = `${Math.max(0, state.ceiling - state.normalGames)}G`;
  dom.upperReadout.textContent = state.upperMode ? "ACTIVE" : state.upperSeed ? "SEED" : "OFF";
  dom.throughReadout.textContent = state.throughStock;
  dom.debugBadge.textContent = state.debug ? "詳細表示中" : "演出モード";
  dom.autoBtn.textContent = state.autoMode ? "AUTO ON" : "AUTO OFF";
  renderFlags();
  renderScreen();
  renderLogs();
}

function renderHomeSettingGrid() {
  dom.settingGrid.innerHTML = "";
  for (let i = 1; i <= 6; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `setting-option ${state.setting === i ? "active" : ""}`;
    button.innerHTML = `<span>設定</span><strong>${i}</strong>`;
    button.addEventListener("click", () => {
      state.setting = i;
      autoSave();
      render();
      renderHomeSettingGrid();
    });
    dom.settingGrid.appendChild(button);
  }
  dom.autoStopDefault.checked = !!state.autoStopDefault;
}

function render() {
  renderStats();
  renderHomeSettingGrid();
}

function sanitizeLoadedState(raw) {
  const base = createInitialState(Number(raw.setting) || 1);
  const merged = { ...base, ...raw };
  merged.setting = clamp(Number(merged.setting) || 1, 1, 6);
  merged.logs = Array.isArray(merged.logs) ? merged.logs.slice(0, MAX_LOG) : [];
  merged.phase = ["NORMAL", "PRELUDE", "CZ", "EP_BONUS", "AT", "BATTLE", "FRENZY"].includes(merged.phase) ? merged.phase : "NORMAL";
  return merged;
}

function autoSave() {
  const payload = { ...state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error(error);
  }
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return sanitizeLoadedState(JSON.parse(raw));
  } catch (error) {
    console.error(error);
    return null;
  }
}

function applyLoadedState(nextState) {
  state = sanitizeLoadedState(nextState);
  clearAllRuntime();
  initReels();
  render();
}

function clearAllRuntime() {
  runtime.spinning = false;
  runtime.currentOutcome = null;
  runtime.currentStopIndex = 0;
  runtime.intervals.forEach((interval, index) => {
    clearInterval(interval);
    runtime.intervals[index] = null;
  });
  clearTimeout(runtime.autoTimer);
  dom.leverBtn.disabled = false;
  dom.stopBtns.forEach((btn) => (btn.disabled = true));
}

function exportSaveData() {
  const text = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  dom.saveText.value = text;
  makeLog("セーブデータを書き出しました。", "highlight");
  render();
}

function importOrLoadSave() {
  const text = dom.saveText.value.trim();
  if (text) {
    try {
      const decoded = decodeURIComponent(escape(atob(text)));
      applyLoadedState(JSON.parse(decoded));
      autoSave();
      makeLog("テキストからセーブを読み込みました。", "highlight");
      render();
      return;
    } catch (error) {
      makeLog("セーブ文字列の読み込みに失敗しました。", "highlight");
      render();
      return;
    }
  }
  const loaded = loadFromLocalStorage();
  if (loaded) {
    applyLoadedState(loaded);
    makeLog("ローカルセーブを読み込みました。", "highlight");
  } else {
    makeLog("保存データがありません。", "highlight");
  }
  render();
}

function newGame() {
  state = createInitialState(state.setting);
  state.autoStopDefault = dom.autoStopDefault.checked;
  state.logs = [{ text: "新しいセッションを開始しました。", type: "highlight" }];
  clearAllRuntime();
  initReels();
  autoSave();
  render();
  closeHomeModal();
}

function openHomeModal() {
  dom.homeModal.classList.add("visible");
}

function closeHomeModal() {
  dom.homeModal.classList.remove("visible");
}

function toggleAutoMode() {
  state.autoMode = !state.autoMode;
  autoSave();
  render();
  if (state.autoMode && !runtime.spinning) {
    startSpin();
  }
}

function bindEvents() {
  dom.leverBtn.addEventListener("click", startSpin);
  dom.stopBtns.forEach((btn, index) => btn.addEventListener("click", () => stopReel(index)));
  dom.autoBtn.addEventListener("click", toggleAutoMode);
  dom.openHome.addEventListener("click", openHomeModal);
  dom.closeHome.addEventListener("click", closeHomeModal);
  dom.newGame.addEventListener("click", newGame);
  dom.resumeGame.addEventListener("click", () => {
    const loaded = loadFromLocalStorage();
    if (loaded) {
      applyLoadedState(loaded);
      makeLog("CONTINUEでセーブを読み込みました。", "highlight");
      render();
    }
    closeHomeModal();
  });
  dom.autoStopDefault.addEventListener("change", (event) => {
    state.autoStopDefault = event.target.checked;
    autoSave();
  });
  dom.saveBtn.addEventListener("click", () => {
    autoSave();
    makeLog("手動セーブしました。", "highlight");
    render();
  });
  dom.loadBtn.addEventListener("click", importOrLoadSave);
  dom.manualSave.addEventListener("click", () => {
    autoSave();
    makeLog("手動セーブしました。", "highlight");
    render();
  });
  dom.manualLoad.addEventListener("click", importOrLoadSave);
  dom.exportSave.addEventListener("click", exportSaveData);
  dom.resetSave.addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    dom.saveText.value = "";
    makeLog("保存データを削除しました。", "highlight");
    render();
  });
  dom.toggleDebug.addEventListener("click", () => {
    state.debug = !state.debug;
    autoSave();
    render();
  });
  window.addEventListener("keydown", (event) => {
    if (dom.homeModal.classList.contains("visible")) return;
    if (event.code === "Space") {
      event.preventDefault();
      startSpin();
    }
    if (event.code === "Digit1") stopReel(0);
    if (event.code === "Digit2") stopReel(1);
    if (event.code === "Digit3") stopReel(2);
  });
}

function boot() {
  const loaded = loadFromLocalStorage();
  if (loaded) {
    state = sanitizeLoadedState(loaded);
  }
  initReels();
  bindEvents();
  makeLog("起動完了。HOMEから設定変更、NEW GAME、CONTINUEが可能。", "highlight");
  render();
}

boot();
