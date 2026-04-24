/*
 * machine-config.js
 *
 * This file contains all tunable parameters for the Dark Ghoul AT simulator. The
 * configuration is designed to be data‑driven so that developers and users
 * can modify probabilities, distributions and game logic without touching
 * the core engine in app.js. All numeric values are documented in the
 * accompanying README.md.
 */

// Global machine configuration object
const MACHINE_CONFIG = {
  // Human readable name for this machine
  name: 'Dark Ghoul AT',

  // Base spin count per 50 credits (used for balancing internal counters)
  baseSpinPer50: 31,

  // Settings definitions for 1 through 6. Each entry describes the machine
  // behaviour under a particular setting. The probabilities here refer to
  // theoretical hit rates for core features; the engine uses them as
  // guidelines when constructing runtime distributions.
  settings: [
    {
      id: 1,
      czProbability: 1 / 262.6,
      strongCzProbability: 1 / 2079.1,
      episodeProbability: 1 / 6620.2,
      atProbability: 1 / 394.4,
      payoutRate: 0.975,
      reminiscenceAppear: 1 / 300.5,
      strongCzAppear: 1 / 2079.1,
      episodeAppear: 1 / 6620.2,
      hiddenUpperStart: 0.0110,
      lowerReplay: 1 / 1260.3
    },
    {
      id: 2,
      czProbability: 1 / 255.6,
      strongCzProbability: 1 / 1906.5,
      episodeProbability: 1 / 5879.7,
      atProbability: 1 / 380.5,
      payoutRate: 0.990,
      reminiscenceAppear: 1 / 295.1,
      strongCzAppear: 1 / 1906.5,
      episodeAppear: 1 / 5879.7,
      hiddenUpperStart: 0.0132,
      lowerReplay: 1 / 1213.6
    },
    {
      id: 3,
      czProbability: 1 / 246.5,
      strongCzProbability: 1 / 1722.8,
      episodeProbability: 1 / 5114.5,
      atProbability: 1 / 357.0,
      payoutRate: 1.016,
      reminiscenceAppear: 1 / 287.6,
      strongCzAppear: 1 / 1722.8,
      episodeAppear: 1 / 5114.5,
      hiddenUpperStart: 0.0163,
      lowerReplay: 1 / 1170.3
    },
    {
      id: 4,
      czProbability: 1 / 233.1,
      strongCzProbability: 1 / 1478.9,
      episodeProbability: 1 / 4062.5,
      atProbability: 1 / 325.9,
      payoutRate: 1.056,
      reminiscenceAppear: 1 / 276.7,
      strongCzAppear: 1 / 1478.9,
      episodeAppear: 1 / 4062.5,
      hiddenUpperStart: 0.0219,
      lowerReplay: 1 / 1129.9
    },
    {
      id: 5,
      czProbability: 1 / 216.4,
      strongCzProbability: 1 / 1226.6,
      episodeProbability: 1 / 3166.7,
      atProbability: 1 / 291.2,
      payoutRate: 1.103,
      reminiscenceAppear: 1 / 262.7,
      strongCzAppear: 1 / 1226.6,
      episodeAppear: 1 / 3166.7,
      hiddenUpperStart: 0.0285,
      lowerReplay: 1 / 1092.3
    },
    {
      id: 6,
      czProbability: 1 / 203.7,
      strongCzProbability: 1 / 1074.9,
      episodeProbability: 1 / 2639.5,
      atProbability: 1 / 261.3,
      payoutRate: 1.149,
      reminiscenceAppear: 1 / 251.2,
      strongCzAppear: 1 / 1074.9,
      episodeAppear: 1 / 2639.5,
      hiddenUpperStart: 0.0332,
      lowerReplay: 1 / 1024.0
    }
  ],

  // Base role probabilities independent of settings. These define the
  // likelihood of each small win or special symbol being drawn. Some roles
  // have setting‑dependent values (lowerReplay) which are overwritten at
  // runtime using the current setting.
  roles: {
    replay: 1 / 7.3,
    diagonalBell: 1 / 131.1,
    weakCherry: 1 / 70.3,
    suika: 1 / 100.5,
    chanceA: 1 / 585.1,
    chanceB: 1 / 585.1,
    strongCherry: 1 / 356.2,
    specialSymbol: 1 / 2048.0,
    guaranteedCherry: 1 / 16384.0
  },

  // Distribution of next battle trigger games inside AT. Keys are battle
  // levels (A–D) and values are objects whose keys are the game counts and
  // values are the probability mass. The engine uses these to schedule
  // upcoming battles when entering AT.
  battleDistribution: {
    A: { '15': 0.0625, '30': 0.4063, '45': 0.0312, '60': 0.25, '75': 0.0312, '90': 0.125, '150': 0.0938 },
    D: { '15': 0.0625, '30': 0.4063, '45': 0.0625, '60': 0.2187, '75': 0.0312, '90': 0.125, '150': 0.0938 }
  },

  // Initial difference distribution when starting AT. The keys represent
  // starting difference (in internal units) and the values the selection
  // weights.
  atInitDifference: { '150': 0.50, '200': 0.30, '250': 0.15, '300': 0.05 },

  // Zone definitions specify how add‑on and special zones behave. Each zone
  // defines a minimum and maximum possible difference to add, a loop rate
  // indicating the chance to continue and a base average used for testing.
  zoneTypes: {
    addOn: { min: 20, max: 100, loopRate: 0.65, base: 30 },
    special1: { min: 50, max: 300, loopRate: 0.35, base: 100 },
    special2: { min: 100, max: 500, loopRate: 0.20, base: 200 }
  },

  // Global ceilings (in games) for CZ and AT when no hit occurs. The engine
  // resets the counters when these thresholds are reached.
  czCeiling: 600,
  atCeiling: 1200,
  resetShortCeiling: 200,

  /**
   * Video presets define which looping videos to play for each machine state
   * and which cut‑in videos to play for various role categories. These values
   * correspond to filenames located in the assets/video directory. When the
   * machine transitions to a new state, a random entry from the corresponding
   * array will be selected. If no specific entry exists for a state, the
   * DEFAULT list is used. Cut‑ins are triggered for rare roles; see
   * app.js for the exact role categories. Users can modify these lists to
   * customise the audiovisual experience or add new files without touching
   * the core engine.
   */
  videoPresets: {
    background: {
      // Fallback list used when a specific state key is not defined.
      DEFAULT: ['glitch-overlay-particles.mp4', 'green-wiggle-glitch.mp4', 'hypnotic-circles.mp4', 'psychedelic-cloud.mp4'],
      // Normal spins: a mix of subtle glitches to avoid monotony.
      NORMAL: ['glitch-overlay-particles.mp4', 'green-wiggle-glitch.mp4', 'hypnotic-circles.mp4'],
      // High rare-role state (赫眼) uses more intense loops.
      KAKUGAN: ['green-wiggle-glitch.mp4', 'hypnotic-circles.mp4'],
      // Standard CZ uses an energetic but not overpowering loop.
      CZ_STANDARD: ['green-wiggle-glitch.mp4', 'hypnotic-circles.mp4'],
      // Stronger CZ emphasises tension with the hypnotic loop.
      CZ_STRONG: ['hypnotic-circles.mp4'],
      // Episode bonus uses a dreamy psychedelic loop.
      EPISODE: ['psychedelic-cloud.mp4'],
      // Main AT uses both hypnotic and psychedelic loops for variety.
      AT_MAIN: ['psychedelic-cloud.mp4', 'hypnotic-circles.mp4'],
      // Battles lean on the hypnotic loop to raise tension.
      BATTLE: ['hypnotic-circles.mp4'],
      // Zones use the psychedelic loop for a sense of escalation.
      ZONE: ['psychedelic-cloud.mp4'],
      // Judgment phase also uses the hypnotic loop to heighten suspense.
      JUDGMENT: ['hypnotic-circles.mp4']
    },
    cutin: {
      // Strong cut‑ins (e.g. strong cherry, special symbol) use our most impactful loops.
      strong: ['hypnotic-circles.mp4', 'psychedelic-cloud.mp4'],
      // Weak cut‑ins (e.g. weak cherry, suika) use mild glitch loops.
      weak: ['green-wiggle-glitch.mp4', 'glitch-overlay-particles.mp4'],
      // Special cut‑ins (e.g. guaranteed or special symbol) combine loops for surprise.
      special: ['psychedelic-cloud.mp4', 'hypnotic-circles.mp4', 'glitch-overlay-particles.mp4']
    }
  }
};