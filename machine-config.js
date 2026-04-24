/*
 * machine-config.js
 *
 * This file contains all configurable aspects of the Dark Ghoul AT simulator.
 * Changing values here will alter the underlying mechanics without touching
 * the engine code. All probabilities are expressed as floats (e.g. 1/262.6)
 * and may be overridden or extended by advanced users.
 */

const MachineConfig = {
  machineName: "Dark Ghoul AT",
  baseSpinPer50Credits: 31,

  /*
   * Settings definitions 1–6. Each setting defines various appearance
   * probabilities for CZ, AT, and payout rate. Additional per-setting values
   * such as lower replay probability and upper mode start rate are also
   * provided here. Probabilities are specified as the reciprocal of the
   * appearance rate from the specification.
   */
  settings: {
    1: {
      czProbability: 1 / 262.6,
      atProbability: 1 / 394.4,
      payoutRate: 0.975,
      czAProbability: 1 / 300.5,
      czBProbability: 1 / 2079.1,
      episodeProbability: 1 / 6620.2,
      lowerReplay: 1 / 1260.3,
      upperStartRate: 0.0110
    },
    2: {
      czProbability: 1 / 255.6,
      atProbability: 1 / 380.5,
      payoutRate: 0.990,
      czAProbability: 1 / 295.1,
      czBProbability: 1 / 1906.5,
      episodeProbability: 1 / 5879.7,
      lowerReplay: 1 / 1213.6,
      upperStartRate: 0.0132
    },
    3: {
      czProbability: 1 / 246.5,
      atProbability: 1 / 357.0,
      payoutRate: 1.016,
      czAProbability: 1 / 287.6,
      czBProbability: 1 / 1722.8,
      episodeProbability: 1 / 5114.5,
      lowerReplay: 1 / 1170.3,
      upperStartRate: 0.0163
    },
    4: {
      czProbability: 1 / 233.1,
      atProbability: 1 / 325.9,
      payoutRate: 1.056,
      czAProbability: 1 / 276.7,
      czBProbability: 1 / 1478.9,
      episodeProbability: 1 / 4062.5,
      lowerReplay: 1 / 1129.9,
      upperStartRate: 0.0219
    },
    5: {
      czProbability: 1 / 216.4,
      atProbability: 1 / 291.2,
      payoutRate: 1.103,
      czAProbability: 1 / 262.7,
      czBProbability: 1 / 1226.6,
      episodeProbability: 1 / 3166.7,
      lowerReplay: 1 / 1092.3,
      upperStartRate: 0.0285
    },
    6: {
      czProbability: 1 / 203.7,
      atProbability: 1 / 261.3,
      payoutRate: 1.149,
      czAProbability: 1 / 251.2,
      czBProbability: 1 / 1074.9,
      episodeProbability: 1 / 2639.5,
      lowerReplay: 1 / 1024.0,
      upperStartRate: 0.0332
    }
  },

  /*
   * Base role probabilities. These values apply across all settings except
   * `lowerReplay`, which is specified separately in each setting. Values are
   * provided as appearance rates (1/x) and will be converted to weights in
   * the engine.
   */
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
    // lowerReplay probability is contained within settings
  },

  /*
   * Battle trigger distribution for internal levels A–D. Each entry defines
   * possible scheduled game values (in G) and their relative weights based on
   * the specification. The weights will be normalized by the engine.
   */
  battleDistribution: {
    A: {
      15: 6.25,
      30: 40.63,
      45: 3.12,
      60: 25.00,
      75: 3.12,
      90: 12.50,
      150: 9.38
    },
    B: {
      15: 6.25,
      30: 40.63,
      45: 3.12,
      60: 25.00,
      75: 3.12,
      90: 12.50,
      150: 9.38
    },
    C: {
      15: 6.25,
      30: 40.63,
      45: 3.12,
      60: 25.00,
      75: 3.12,
      90: 12.50,
      150: 9.38
    },
    D: {
      15: 6.25,
      30: 40.63,
      45: 6.25,
      60: 21.87,
      75: 3.12,
      90: 12.50,
      150: 9.38
    }
  },

  /*
   * Zone definitions for special segments. Each zone can define its own
   * guaranteed duration, continuation rates, and expected difference (枚数)
   * range. These values are rough approximations to keep the structure
   * flexible. Advanced users can fine-tune or add more zones here.
   */
  zoneTypes: {
    standardCZ: {
      name: "標準CZ",
      baseSuccessRate: 0.45,
      starLevel: 3,
      minGames: 8,
      maxGames: 8
    },
    strongCZ: {
      name: "強力CZ",
      baseSuccessRate: 0.65,
      starLevel: 4,
      minGames: 8,
      maxGames: 8
    },
    episode: {
      name: "ストーリーBONUS",
      fixedGames: 20,
      starLevel: 4
    },
    bites: {
      name: "加算ゾーンA",
      minGames: 5,
      maxGames: 5,
      minAdd: 10,
      maxAdd: 50,
      starLevel: 3
    },
    frenzy: {
      name: "加算ゾーンB",
      minGames: 4,
      maxGames: 4,
      continuationRate: 0.7,
      minAdd: 20,
      maxAdd: 80,
      starLevel: 4
    },
    apocalypse: {
      name: "上位ゾーン",
      minGames: 3,
      maxGames: 3,
      continuationRate: 0.8,
      minAdd: 50,
      maxAdd: 200,
      starLevel: 5
    }
  },

  /*
   * Video presets for each major state. Users can place video files under
   * assets/video and reference them here. When no video is available the
   * engine falls back to the built-in glitch canvas. Videos should be in
   * WebM or MP4 format and relative paths (without the assets/video prefix).
   */
  videoPresets: {
    NORMAL: ["glitch-overlay-particles.mp4", "green-wiggle-glitch.mp4"],
    KAKUGAN: ["psychedelic-cloud.mp4", "hypnotic-circles.mp4"],
    PRE_CZ: ["glitch-overlay-particles.mp4"],
    CZ: ["green-wiggle-glitch.mp4"],
    EPISODE: ["psychedelic-cloud.mp4"],
    AT: ["hypnotic-circles.mp4"],
    BATTLE: ["green-wiggle-glitch.mp4"],
    ZONE: ["psychedelic-cloud.mp4"],
    UPPER: ["hypnotic-circles.mp4"]
  }
};