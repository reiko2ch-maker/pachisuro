# Dark Ghoul AT Simulator

This repository contains a self‑contained simulator for an **original dark
fantasy themed slot machine** inspired by the publicly available gameplay
information of commercial AT machines. It is *not* a 1:1 copy of any
licensed title. Instead it provides a flexible framework to reproduce
the feeling of a modern "smart slot" while allowing users to swap in their
own artwork, video and probability tables.

The simulator runs entirely in the browser using plain HTML, CSS and
Vanilla JavaScript. It is designed first and foremost for smartphone
portrait mode but will function on desktop as well. You can host it
directly on GitHub Pages without any build step.

## File structure

```
dark-ghoul-sim/
├── index.html            # Main document housing the UI
├── style.css             # Dark/glitch inspired styles and responsive layout
├── app.js                # Core engine, UI binding and state machine
├── machine-config.js     # All tunable parameters and probability tables
├── README.md             # This file
└── assets/
    └── video/            # Optional video files for LCD and cut‑ins
```

If you wish to include your own images or sounds, create additional
subdirectories under `assets` (e.g. `assets/img` or `assets/audio`) and
adjust `app.js` accordingly. By default the simulator uses CSS effects to
provide feedback when no media is available.

## Running locally

No installation is necessary. Simply open `index.html` in a modern
browser. For a better mobile experience you can add the page to your
homescreen. To host on GitHub Pages, push this folder to a repository
and enable Pages via the repository settings.

## Gameplay overview

- **Normal game**: Each lever pull consumes 3 credits and advances
  multiple internal counters. The machine draws a *role* based on
  weighted probabilities. Lower replay triggers a temporary *Kakugan*
  mode in which rare roles become much more frequent. Scheduled
  counters determine when various features start: common CZs, strong CZs,
  episode bonuses and direct AT entries. The rates for these features
  depend on the selected setting.
- **Kakugan**: When activated the machine enters a heightened state for
  10–50 games (drawn from a weighted distribution) during which the
  probability of rare roles is tripled. Kakugan can overlap with other
  scheduled triggers but automatically ends when the counter expires.
- **CZ (Chance Zone)**: Two types of CZ exist. A standard CZ occurs
  relatively often but starts with a low success chance. A strong CZ is
  rarer but begins with a higher success base. Each lasts 8 games and
  builds success probability based on the roles drawn. On success the
  machine enters AT; on failure it returns to Normal.
- **Episode Bonus**: A 20 game bonus that always leads into AT. Rare
  roles drawn during the bonus add extra difference to the upcoming AT.
- **AT (Assist Time)**: The heart of the machine. A difference is
  initially awarded from a weighted distribution (150/200/250/300) and
  reduced by a small amount each game. Roles drawn during AT increase
  difference. Hidden upper mode can be entered randomly or via CZ.
  Battles and special zones occur at scheduled or random intervals and
  can further increase difference. When difference runs out the machine
  performs a judgment to determine if the player returns to normal or
  proceeds to upper mode.
- **Battles**: On trigger the machine immediately determines the
  opponent and outcome. Winning awards difference and may spawn a zone.
- **Zones**: Three types of zones (add‑on, special1, special2) add
  random amounts of difference and may loop based on their loop rate.
- **Judgment**: A final coin toss using the setting’s hidden upper
  probability to determine if upper AT begins or normal play resumes.

## State machine

The simulator is driven by an explicit state machine. The high‑level
states are:

```
NORMAL → KAKUGAN → CZ_STANDARD → AT_MAIN → BATTLE → ZONE → JUDGMENT
      ↘             ↘ CZ_STRONG ↗
                    ↘ EPISODE  ↗
```

State transitions are controlled by counters and random draws. All
branches eventually return to NORMAL unless a loop (upper AT) is
entered.

## Configuration

All numeric tables and tunable parameters live in
`machine-config.js`. You can adjust probabilities, ceilings, role
weights, battle distributions and zone behaviour there. Each setting
defines its own hit rates for CZ, strong CZ, episodes, AT entries,
payout and hidden upper mode start. Role probabilities are shared
across settings except for `lowerReplay` which varies per setting.

Changing numbers in `machine-config.js` does **not** require any changes
to the engine. The simulator will automatically incorporate your new
values on reload.

### Example modifications

To make CZ appear more frequently in setting 3, edit the
`settings` array in `machine-config.js`:

```js
{
  id: 3,
  czProbability: 1 / 200, // previously 1/246.5
  strongCzProbability: 1 / 1600,
  // ...
},
```

To adjust the distribution of the starting difference for AT, modify

```js
atInitDifference: { '100': 0.3, '200': 0.4, '300': 0.3 },
```

To add a new zone type called `frenzy`, add it to `zoneTypes`:

```js
zoneTypes: {
  // existing definitions
  frenzy: { min: 200, max: 800, loopRate: 0.10, base: 400 }
}
```

and update the selection weights in `app.js` where zone types are chosen.

## Persistence

The simulator supports saving and loading the entire machine state to
`localStorage` via three save slots. A full serialisation includes the
PRNG state so that the future sequence of spins is reproducible.

Export and import functions allow you to download or upload save files
in JSON format. These can be used to move your session between browsers
or devices. See the Save/Load menu for details.

## Statistics

Basic statistics are collected as you play, including total spins,
feature counts, win/loss totals and the maximum difference achieved.
Reset these statistics via the Statistics menu. Longer term research
such as 10k spin trials can be performed using the auto and skip
modes. If you require more detailed analytics, consider instrumenting
the `SlotMachine` class or writing a separate harness.

## Extending the simulator

The code is intentionally modular. To incorporate video or image
assets, place files into `assets/video` and modify the `<video>`
elements in `index.html` or the playback logic in `app.js`. Sound
support can be added by creating audio elements and triggering them
during state transitions.

## Video assets and attribution

By default the repository includes several royalty‑free video loops to
demonstrate the LCD and cut‑in functionality. These clips are all
licensed for personal and commercial use under the Creative Commons
Attribution 4.0 International (CC BY 4.0) license as provided by
Free Stock Footage Archive. When using these videos in your own
projects you **must** provide appropriate credit. The table below
summarises the included files and their sources:

| File name | Description | Source & License |
|---|---|---|
| `glitch-overlay-particles.mp4` | Dark glitch overlay particles looping background. | Free Stock Footage Archive – Glitch Overlay Particles, licensed under CC BY 4.0【131317271297058†L67-L86】. |
| `green-wiggle-glitch.mp4` | Green wiggle glitch texture effect loop. | Free Stock Footage Archive – Green Wiggle Glitch Texture Effect Loop, CC BY 4.0【796810408310993†L70-L82】. |
| `psychedelic-cloud.mp4` | Psychedelic abstract cloud effect loop. | Free Stock Footage Archive – Psychedelic Cloud – Trippy Abstract Effect Loop, CC BY 4.0【146142594557437†L71-L80】. |
| `hypnotic-circles.mp4` | Strange hypnotic circles with colour split effect. | Free Stock Footage Archive – Strange Hypnotic Circles – Color Split Effect Loop, CC BY 4.0【710184536521551†L76-L82】. |

These videos are mapped to machine states and cut‑in categories via the
`videoPresets` object in `machine-config.js`. To customise or replace
the loops, add your own MP4/WebM files into `assets/video/` and
update the arrays under `videoPresets.background` and
`videoPresets.cutin`. When adding external footage, check the
licensing terms and include attribution if required.


To implement additional features like more complex mode tables,
detailed reel stops or richer CZ systems, extend the state handling
methods (`handleNormal`, `handleCZ`, `handleAT`, etc.) and add new
configuration fields as required. Always keep engine logic separate
from UI code to maintain clarity.

## License

This project is provided as‑is for educational and research purposes.
It intentionally avoids including any copyrighted names, characters,
logos or audio/visual materials. You are responsible for ensuring
that any external assets you add are properly licensed for your use.