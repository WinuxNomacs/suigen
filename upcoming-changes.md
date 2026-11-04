# Upcoming Changes

Tracks the fixes from the 2026-11-03 project review. Check items off as they land and note the commit next to each one.

Order: science accuracy first, then interaction bugs, then validation and tests, then tooling. Each phase should pass `npm run typecheck` and `npm run lint`, and be checked by hand in `./run.sh` before the next one starts.

---

## Phase 1: Scientific accuracy

The app aims to be scientifically accurate (README, "Accuracy & Validation"). These items make the shipped content match the physics it describes.

- [x] **1.1 Fix the Compton scattering energy** ([scenarios/compton-scattering.json](scenarios/compton-scattering.json))
  - Problem: a 100 eV photon scattered at 45 degrees comes out at 99.994 eV, but the scenario shows 80 eV.
  - **Decision (2026-11-03): 100 keV photon scattered at 90 deg.** Computed with E' = E / (1 + (E / m_e c^2)(1 - cos θ)), m_e c^2 = 510,998.95 eV:
    - Outgoing photon: 83,633.4 eV (-16.4%), wavelength 12.40 -> 14.82 pm, direction (0, 1, 0).
    - Recoil electron: 16,366.6 eV kinetic energy at 39.9 deg below the incoming direction (on the opposite side from the photon).
  - Scale the photon trail wavelength ([PhotonTrail.ts:22](src/renderer/particles/PhotonTrail.ts#L22), currently fixed at 2000) with the photon's real wavelength, so the scattered photon's wave is visibly about 20% longer.
  - Update `scientific.narrative`, `equations` and `constants` to these numbers. Mention Compton's 1923 molybdenum X-ray experiment in the "Fun fact" text.
  - Done when: photon energies in the JSON match the Compton formula to within 0.1%.

- [x] **1.2 Show the electron recoil in Compton scattering**
  - Problem: the narrative says the electron takes momentum, but nothing moves it.
  - Fix: at the scattering event, swap the electron for a moving one (`remove` + `spawn` with a `direction`), aimed according to momentum conservation. A new `move` event in [SimulationEngine.ts](src/renderer/physics/SimulationEngine.ts) would be cleaner if this comes up again.
  - Done when: the electron moves away at the correct recoil angle after the scattering event.

- [x] **1.3 Show that time is slowed down**
  - Problem: photons move 50 fm per displayed fs ([constants.ts](src/shared/constants.ts), `VISUAL_SPEED_FM_PER_FS`). Real light covers about 3.0e8 fm per fs, so the animation is about 6 million times slower than labeled. A photon crossing 80,000 fm really takes 0.00027 fs, not 1600 fs.
  - **Decision (2026-11-03): show real time.** Keep the animation speed; the timeline shows real time = animation time x 1.668e-7 (50 / c in fm/fs), with units chosen automatically (fs / as / zs). Example: a photon crossing 80,000 fm shows 267 zs.
  - Resolved: scenarios declare `compressions` (tick spans that stand for a real duration). The timeline shows `fast-forward: <label>` while one plays and "≈" afterwards.
  - Original issue: scripted waits are not light travel. The photon-emission scenario emits at animation time 500 (83 zs real), but the real 2p lifetime is about 1.6 ns, roughly 10^13 times longer. Such gaps must be marked as compressed (for example "~1.6 ns later") instead of showing a fake real time.
  - Done when: every time on screen is either real or clearly marked as compressed.

- [x] **1.4 Draw electron clouds at the right size** ([OrbitalMesh.ts:6](src/renderer/particles/OrbitalMesh.ts#L6))
  - Problem: the cloud radius is `n^2 * a0 * 0.4`, so the 1s cloud is 21 pm wide while the scenario text says the electron is most likely found at a0 (52.9 pm). The 2p cloud (85 pm) extends past the atom outline at 53,000 fm.
  - **Decision (2026-11-03): outer surface at the 90% boundary, inner sphere at the most likely distance.** The electron is inside the outer surface 90% of the time, as in textbook orbital pictures. Remove the unexplained 0.4 and say what the sizes mean in code and in the science panel.
  - Radii in units of a0 (52.918 pm), distance from the nucleus, computed by integrating the hydrogen radial probability (averages match a0/2 * (3n^2 - l(l+1))):

    | Orbital | Most likely (inner) | 90% boundary (outer) |
    | --- | --- | --- |
    | 1s | 1.00 | 2.66 |
    | 2p | 4.00 | 7.99 |
    | 3s | 13.07 | 19.44 |
    | 3p | 12.00 | 18.39 |
    | 4p | 23.58 | 32.59 |

  - Store these as a lookup table, or compute them, with a unit test against these numbers.
  - Follow-up: the 4p cloud is about 1.72e6 fm wide (32.6x the current 53,000 fm atom outline). Resize the atom outline sphere ([SceneManager.ts](src/renderer/scene/SceneManager.ts)), the starting camera position and the camera's far distance (500,000), and check that photon start positions (-80,000 fm) are still outside the clouds.
  - Done when: cloud sizes match the table, and the hydrogen scenario text states both the most likely distance and the 90% boundary.

- [x] **1.5 List simplifications in the app**
  - Problem: the README requires approximation warnings; the UI shows none.
  - Fix: add a "Simplifications" section to the science panel in [InfoPanel.ts](src/renderer/ui/InfoPanel.ts), covering slowed time, no forces, straight-line photons, hydrogen-like energies only, round and dumbbell shapes only, and the absorption tolerance (±0.05 eV, much wider than real line widths).
  - Done when: every scenario and the sandbox show the list.

---

## Phase 2: Interaction bugs

- [x] **2.1 Clicks that miss the floor place particles at the center** ([app.ts:79-80](src/renderer/app.ts#L79-L80))
  - Problem: the code ignores `intersectPlane`'s null return value and checks a variable that is always set. Clicking above the horizon places the particle at (0, 0, 0).
  - Fix: `const hit = raycaster.ray.intersectPlane(plane, intersection); if (hit) { ... }`
  - Done when: clicking the sky does nothing.

- [x] **2.2 Rotating the camera counts as a click**
  - Problem: releasing the mouse after a drag fires `click`. Rotating with a particle type selected places a particle; rotating without one closes the particle panel.
  - Fix: record the pointer position on `pointerdown` and ignore the click if the pointer moved more than about 5 px.
  - Done when: rotating and panning never place or deselect particles.

- [x] **2.3 Make particles visible and clickable**
  - Problem: particles are 3 fm wide while the camera starts 150,000 fm or more away, so they render smaller than a pixel. Clicking one to inspect it is practically impossible. Confirmed in screenshots 2026-11-03: only labels are visible.
  - Fix: give particles a minimum size on screen (sprites with `sizeAttenuation: false`, or scale by camera distance), and raycast against that size or the labels.
  - Done when: every particle in every scenario can be seen and clicked from the starting camera position.

- [x] **2.4 The label toggle (L key) doesn't stick** ([app.ts:103-109](src/renderer/app.ts#L103-L109), [ParticleManager.ts](src/renderer/particles/ParticleManager.ts))
  - Problem: new particles, and all particles after rewinding, get visible labels even when labels are switched off.
  - Fix: keep `labelsVisible` in `ParticleManager` and apply it in `addParticle`.
  - Done when: hiding labels lasts through placing particles, rewinding and loading scenarios.

- [x] **2.6 Labels at the nucleus overlap**
  - Problem: the proton and electron labels sit at the same point (electrons are placed at the nucleus), so they draw on top of each other ("el proton s)").
  - Fix: offset the electron label to the cloud's edge, or merge co-located labels into one line.
  - Done when: every label in every scenario is readable from the starting camera position.

- [x] **2.5 Remove photons that leave the scene**
  - Problem: photons that miss keep flying and are tracked forever.
  - Fix: remove a photon once it is well past the atom outline (for example 2x its radius). Do it as a time-based rule so rewinding still works.
  - Done when: the particle count goes back down after a photon misses.

---

## Phase 3: Validation and tests

- [x] **3.1 Add a test runner**
  - Vitest fits the existing Vite setup. Add an `npm test` script and run a trivial test first to confirm the setup works.

- [x] **3.2 Unit tests for the physics**
  - `transitions.ts`: each toolbar photon energy (10.2, 12.09, 12.75, 1.89 eV) produces the expected jump; 5.0 eV produces none; the allowed shape changes are respected.
  - `SimulationEngine`: rewinding and replaying gives the same scene; sandbox placements survive rewinding; an absorption event is only recorded once.

- [x] **3.3 Check scenario files against the expected format**
  - Problem: [ScenarioLoader.ts](src/renderer/scenarios/ScenarioLoader.ts) loads the JSON with `as unknown as Scenario`, so a malformed file isn't caught.
  - Fix: a checker that runs when scenarios load, plus a test that runs it on every file in [scenarios/](scenarios/). Also check the physics: photon energies against the energy formula, and that referenced particle ids exist.
  - **Decision (2026-11-03): use zod 4** (checked 2026-11-03: v4.6.7, MIT, no runtime dependencies). Measure the bundle size before and after adding it, and write the result down here.
  - Export a JSON Schema from the zod schema and point `.vscode/settings.json` `json.schemas` at it for `scenarios/*.json`, so VS Code autocompletes and flags errors while editing scenarios.

- [x] **3.4 Stop inserting scenario text as raw HTML (SEC-05)** ([InfoPanel.ts](src/renderer/ui/InfoPanel.ts))
  - Problem: scenario text is inserted with `innerHTML`. This is safe while scenarios ship with the app, but becomes a script-injection risk once users can load their own files (planned in the README).
  - Fix: build the panel with `textContent` / `createElement`, or escape every value inserted. Must land before user-loaded scenarios are added.

---

## Phase 4: Tooling and documentation

- [x] **4.1 Upgrade ESLint 8 to ESLint 9** (ESLint 8 is no longer supported), moving to `eslint.config.mjs` and the matching typescript-eslint config. Lint results should not change.
- [x] **4.2 Review `npm audit`**: 39 warnings, all in development tools (0 in what the app ships). Fix what upgrades without breaking changes; write down the rest.
- [x] **4.3 Add a "Status" section to the README** saying what is built versus planned (forces, worker threads, save/load, measuring tools, d/f orbitals), so readers don't take the wishlist as current features.
- [x] **4.4 Bundle size warning**: `chunkSizeWarningLimit: 800` (kB) in `vite.renderer.config.mts`. Measured 2026-11-03: splitting gives three.js 569.65 kB, zod 86.73 kB, app 50.82 kB, so three.js alone stays over the 500 kB default and a split could not clear the warning. Size doesn't matter for a desktop app loading from disk.

---

## Phase 5: Sandbox editing

Chosen 2026-11-03. From the README's interaction patterns: select, delete and drag particles. Edits are recorded in the engine's event log like placements, so rewinding before an edit undoes it and playing forward redoes it. Loading a scenario again resets all edits.

- [x] **5.1 Selection**
  - Clicking a particle selects it: the label is highlighted, the marker grows, and the info panel shows it. Escape or clicking empty space clears the selection. If the selected particle stops existing (rewound before its spawn, absorbed, departed), the selection clears.

- [x] **5.2 Delete**
  - Delete or Backspace (not while typing in a control), or a Delete button in the particle panel, removes the selected particle by recording a `remove` event at the current time.
  - Done when: deleting works for every particle type, and rewinding before the deletion brings the particle back.

- [x] **5.3 Drag**
  - Dragging a marker moves that particle in the horizontal plane through it. A nucleon drags its whole nucleus and the electron clouds centered on it, so an atom moves as one. Moving particles (photons in flight, a recoiling electron) can't be dragged: their path is fixed by their start point and time.
  - The camera doesn't rotate during a particle drag. Clouds are not drag handles, otherwise a cloud filling the view would block camera rotation.
  - Movement is limited to the scenario's framed extent. On release, one `move` event per moved particle is recorded at the current time.
  - New event type `move` (`targetId`, `position`) in the types, the zod schema and the physics checker (the target must exist and must not be moving).
  - Done when: dragging moves the atom, rewinding before the drag puts it back, and a photon fired after the move is absorbed at the atom's new position.

- [x] **5.4 Tests**: engine tests for `remove` and `move` across rewinds and for absorption at a moved atom; validator tests for `move`; the Electron interaction script extended with delete and drag.

## Phase 6: Continuous integration

Chosen 2026-11-03 (recommended earlier as small and protective of phases 1-5).

- [x] **6.1 GitHub Actions** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): type-check, lint, tests and web build on ubuntu, macOS and Windows with Node 22 (oldest supported) and 26 (current LTS); packaging on all three OSes for pushes to `main` and manual runs. Actions pinned to commit SHAs, read-only token, no Electron download where it isn't needed.
- [x] **6.2 Line endings**: `*.json text eol=lf` in `.gitattributes`, so the generated JSON Schema matches its snapshot test on Windows checkouts.
- [x] **6.3 README badge** for CI status.

## Phase 7: Dependencies up to date

Requested 2026-11-03: upgrade Node and bring every package current.

- [x] **7.1 Node 26.13.0 LTS** on this machine (`brew upgrade node`, from the end-of-life 25.6.1).
- [x] **7.2 Packages to latest**: Vitest 5.1.0, ESLint 10.14.0 (+ `@eslint/js` 10.0.1), three and `@types/three` 0.187.0, Electron 45.2.2, TypeScript 6.0.3. `eslint-plugin-import` (supports ESLint only up to 9) replaced by `eslint-plugin-import-x` 4.17.1.
- [x] **7.3 TypeScript 6 config**: removed the deprecated, unused `baseUrl`; `strict` is now on (the TS 6 default, set explicitly). It found one real issue: a particle with energy 0 would have shown a stray "0" in the info panel.
- [ ] **7.4 TypeScript 7** (latest is 7.0.2), on the back burner (decided 2026-11-03): little to gain (typecheck takes 1.5-1.7 s today; builds use Vite, not `tsc`). Blocked until typescript-eslint supports it (8.72.1 peer range is `>=4.8.4 <6.1.0`). Recheck on typescript-eslint releases.


## Phase 8: Scientific accuracy review

Review requested 2026-11-03 ("I don't need perfect but I don't want to miss mistakes"). Every number was recomputed; constants checked against the NIST CODATA 2022 table.

- [x] **8.1 Hydrogen levels**: `E_n = -13.598 eV / n²` from the Rydberg energy with the reduced-mass factor (was a rounded 13.6, off by 1.7 meV at n = 1, 30 times more than the simplifications text admitted). Toolbar and scenario photon energies set to the exact gaps (10.1987, 12.0874, 12.7484, 1.8887 eV); a test ties each toolbar value to its labeled transition and checks Lyman-alpha = 121.567 nm.
- [x] **8.2 Sandbox simplifications listed**: hydrogen 1s cloud for every electron (any nucleus, or none), no Pauli exclusion, clouds left behind when a proton is deleted, absorption at the 90% surface, no ionization.
- [x] **8.3 Scenario text**: helium's origin (mostly Big Bang; Earth's from alpha decay), Pauli applies to identical fermions, photons above 13.6 eV ionize, lasers use stimulated emission, 2p decay rate 6.26 × 10⁸ /s (with reduced mass), helium 90% radius 83.5 pm, deuterium gamma 2.2232 MeV after 1.3 keV deuteron recoil, deuterium is one of two fusion fuels. Tests now compute the decay rate, helium radius, Lyman-alpha energies and gamma energy and compare them with the files.
- [x] **8.4 README** overview no longer claims a "scientifically accurate simulation" of "fermion fields" for research.
- [x] **8.5 Spin display**: intrinsic spin by type (1/2 or 1), plus m_s only when a scenario sets it; validator rejects impossible projections.
- [x] **8.6 Constants** updated from CODATA 2018 to 2022 (changes of about 1e-9; nothing visible). Added the deuteron mass.
- [ ] **8.7 (Latent)** p orbitals with m = ±1 would be drawn as dumbbells; the real |ψ|² is a ring around the axis. Nothing creates m ≠ 0 yet.
- [ ] **8.8 (Latent)** Absorption from 2p always picks 3s because d clouds aren't drawn, though 2p → 3d is also allowed. Revisit with d orbitals.

## Phase 9: Timeline controls

Requested 2026-11-04.

- [x] **9.1 Buttons**: reset (start, paused), step back, play/pause, step forward, in that order. The play icon follows the engine state, so reset and scrubbing keep it right.
- [x] **9.2 Scrubber**: a slider from 0 to the scene's end (`SimulationEngine.getDuration`: the last event, or the last moving particle leaving the scene, solved from its straight path). Dragging pauses playback and resumes it on release. The end grows with sandbox edits or when playing past it.

## Phase 10: Playback end and speed

Requested 2026-11-04: "the timer continues even after the scenario has completed" and the speed slider was too sensitive.

- [x] **10.1 Stop at the end**: playback pauses at `getDuration()` (moving in reverse, at 0). Play at the end starts over. Exits get a 1-tick margin so departed particles are gone when playback stops. Step forward stops at the end too.
- [x] **10.2 Speed slider**: stops at -10x, -5x, -2x, -1x, 0, 1x, 2x with 20 even steps between each (0.05x between -2x and 2x), clickable stop labels, a readout that resets to 1x when clicked, arrow keys step one position. Negative speeds play in reverse.
- [x] **10.3 Reverse playback cost**: going back without crossing an event or a departure only moves particles along their paths instead of rebuilding the scene each frame.

## Phase 11: Speed stops and resuming

Requested 2026-11-04.

- [x] **11.1 Stops** at -2x, -1x, -.5x, -.25x, 0, .25x, .5x, 1x, 2x, 10 steps between each (0.025x near 0, 0.1x between 1x and 2x). Slider widened to 320 px so the nine labels fit.
- [x] **11.2 Play continues from the current time**: play never moves the playhead (phase 10 restarted from the start when pressed at the end; now it stays paused there, and reset or the scrubber starts over). `tick` does nothing while paused, so a paused scene cannot drift. Speed changes, paused or playing, keep the current time.
- [x] **11.3 Steady speed controls**: the readout button has a fixed width for the longest value (7 characters, checked by a test), and only the scrubber and time text may shrink, so dragging the speed no longer resizes the slider. A long fast-forward label is cut with an ellipsis (full text in its tooltip) instead of overflowing the bar.

## Phase 12: Loop and default speed

Requested 2026-11-04.

- [x] **12.1 Default speed 0.25x** (`DEFAULT_PLAYBACK_SPEED`); clicking the readout returns to it. A test ties the slider's starting position and readout in `index.html` to the constant.
- [x] **12.2 Loop toggle** (looping-arrows button after step forward), on by default: at the end playback restarts from the start, in reverse it wraps from the start to the end, and play at the end starts over. With loop off, phase 11 behavior (stop at the end, play stays put).

---

## Done

_Move finished items here with their commit hash._

- **Phase 1 (1.1-1.5)**: `5581ca7` on branch `phase-1-science-accuracy`. Verified with typecheck, lint and Electron screenshots of every scenario.
  - Time model: animation ticks, light moves 5,000 fm per tick (`LIGHT_SPEED_FM_PER_TICK`), so 1 tick = 1.668e-5 fs real. Photon start positions moved to ±600,000 fm, outside the 2p cloud (423,000 fm).
  - Cloud radii computed at load from the hydrogen radial functions ([physics/hydrogen.ts](src/renderer/physics/hydrogen.ts)); matches the table in 1.4.
  - Removed the "atom boundary" sphere (it marked a0, which no longer matches any drawn surface); the camera now frames each scenario's `extent`.
  - Also fixed factual errors found in the scenario text: femtometer size (was 1000x off), X-ray image contrast, how the Sun makes deuterium, "all light comes from electron drops", hydrogen abundance, the stadium comparison (was about 8x off), a description of a glow effect that does not exist, and the deuteron capture narrative.
- **Phase 2 (2.1-2.6)**: `412f0a8`. Verified with typecheck, lint and a scripted Electron run using real mouse events (12/12 checks: nucleus and cloud picking, sky click, drag with and without a selected type, label toggle across rewind, photon removal and restore on rewind, merged labels).
  - Markers are screen-space sprites (constant pixel size); the femtometer-scale spheres remain for close zoom. A bound electron has no marker: clicking its cloud selects it, and markers take priority over clouds.
  - Departure rule: a moving particle heading away from the origin beyond 2x the scenario extent is removed.
  - Also fixed: photon trails were drawn at full length even behind the point where the photon was created (visible after Compton scattering).
- **Phase 3 (3.1-3.4)**: `bf9f8da`. `npm test`: 37 tests pass. Electron interaction checks (12/12) rerun after the info panel rewrite.
  - Vitest 4.1.12, not 5.x: vitest 5 supports Node `^22.12 || ^24 || >=26`, which excludes the Node 25.6.1 on this machine. Revisit when Node is upgraded to 26.
  - zod 4.6.7 bundle cost (web build, 2026-11-03): 576.31 kB -> 667.18 kB (+90.9 kB; gzip 149.04 -> 175.46 kB, +26.4 kB). Kept: negligible for a desktop app loaded from disk. `zod/mini` is the option if size ever matters.
  - JSON Schema at [src/shared/scenario.schema.json](src/shared/scenario.schema.json), checked by a test; regenerate with `npm test -- -u`. VS Code maps it to `scenarios/*.json` in `.vscode/settings.json`.
  - Bug found by the new engine tests and fixed: absorption was checked only at sampled frame times, so seeking or stepping past a cloud (or a long frame at high speed) let a matching photon pass through. The crossing time is now solved exactly.
  - Lint rule (`no-restricted-syntax`) rejects `innerHTML`/`outerHTML` assignment.
- **Phase 4 (4.1-4.3)**: `ba00e44`. Verified typecheck, lint, 37 tests, web build, `npm run package` (darwin arm64) and a launch of the packaged app.
  - ESLint 9.39.5, not 10: eslint-plugin-import 2.32.0 supports ESLint up to 9. Lint rules were checked to still fire (unresolved import, unused variable, `any`, `innerHTML`).
  - `npm audit fix` (compatible updates only) cleared all 5 high-severity findings: 39 -> 34, all moderate. The remaining 34 trace to two packages: `minimatch` < 11.0.1 (via ESLint 9) and `glob` 9-14.0.1 (via Electron Forge 8). Fixing them needs major-version changes those tools don't support (npm's suggested "fix" downgrades to Forge 7 / ESLint 4). Dev tooling only, never shipped, and it only processes the project's own file patterns. Recheck when ESLint or Forge release updates.
- **Phase 5 (5.1-5.4)**: `8dea1d5`. `npm test`: 42 tests pass. Scripted Electron run with real mouse and key events: 10/10 phase 5 checks (select and highlight, Escape, drag moves the atom with its cloud, camera stays put during a particle drag, rewind restores the position, Delete key, Delete button, empty-space drag still free), and the 12 phase 2 checks still pass.
  - Bug caught by the Electron run before commit: releasing a drag cleared the drag state before computing the drop position, so every drag snapped back.
- **Phase 6 (6.1-6.3)**: `8bb32f9` (CI), `4ae2800` (plan). First GitHub Actions run (41740227403) passed all 9 jobs: `check` on ubuntu, macos and windows with Node 22.x and 26.x (typecheck, lint, tests, web build), and `package` on all three OSes.
- **Phase 7 (7.1-7.3)**: Node 26.13.0; typecheck, lint, 42 tests, web build (707.44 kB, gzip 182.84 kB), `npm run package` (darwin arm64) and a launch of the packaged app all pass; the scripted Electron checks pass 22/22 (12 phase 2, 10 phase 5) on three 0.187. Lint rules checked to still fire (unresolved import, `any`, unused variable, `innerHTML`).
  - `npm audit`: still 34 moderate, 0 high. All are `minimatch` < 11.0.1 (GHSA-g3hv-75wg-m249) and `glob` 9-14.0.1 (GHSA-3g3m-2fjr-6pw4) pinned inside Electron Forge 8, ESLint 10 and typescript-eslint, which are already at their latest versions. npm's suggested fix downgrades them. Dev tooling only.
  - `fsevents` install script denied in `allowScripts` (npm 11.20 asks): its prebuilt binary ships in the package, so the script isn't needed.
- **Phase 8 (8.1-8.6)**: `5cbef8c`. Typecheck, lint, 50 tests; scripted Electron checks 22/22 plus the new sandbox and energy-level panel text.
- **Phase 9 (9.1-9.2)**: `819fa1d`. Typecheck, lint, 53 tests (duration for each scenario, nothing changes after it, reset). Scripted Electron run with real mouse input: button order, scrubber range, drag to 70%, step back/forward by 10 ticks, play icon, reset, pause during scrub and resume; the 22 phase 2 and 5 checks still pass.
- **Phase 10 (10.1-10.3)**: `e38fdc2`. Typecheck, lint, 60 tests (end stop and restart, reverse playback matches seeking, speed 0, slider mapping round-trip). Scripted Electron run with real mouse and keys: 9 speed checks (end stop, restart, drag through slow and reverse speeds, arrow-key step, reverse to 0, readout reset, stop label), 8 timeline checks, and the 22 phase 2 and 5 checks.
- **Phase 11 (11.1-11.2)**: `507b3d4`. Typecheck, lint, 61 tests (stops and steps, play after pause and speed changes continues from the same time and matches seeking, end behavior). Scripted Electron run with real mouse and keys: 13 speed checks (labels, no overlap, pause holds, resume after speed change, change while playing, reverse, 0x, end stop, play at end, reverse from end, drag, arrow key), plus the 30 timeline, phase 2 and phase 5 checks.
- **11.3**: `947706e`. 62 tests. Electron, every speed position swept at 1280 and 1024 px: speed slider, readout and scrubber widths constant, longest readout not clipped, no overflow with the longest fast-forward label; speed, timeline, phase 2 and 5 checks (43) pass.
