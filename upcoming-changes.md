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
  - Resolved: scenarios declare `compressions` (tick spans that stand for a real duration). The timeline shows "fast-forward: <label>" while one plays and "≈" afterwards.
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

- [ ] **3.1 Add a test runner**
  - Vitest fits the existing Vite setup. Add an `npm test` script and run a trivial test first to confirm the setup works.

- [ ] **3.2 Unit tests for the physics**
  - `transitions.ts`: each toolbar photon energy (10.2, 12.09, 12.75, 1.89 eV) produces the expected jump; 5.0 eV produces none; the allowed shape changes are respected.
  - `SimulationEngine`: rewinding and replaying gives the same scene; sandbox placements survive rewinding; an absorption event is only recorded once.

- [ ] **3.3 Check scenario files against the expected format**
  - Problem: [ScenarioLoader.ts](src/renderer/scenarios/ScenarioLoader.ts) loads the JSON with `as unknown as Scenario`, so a malformed file isn't caught.
  - Fix: a checker that runs when scenarios load, plus a test that runs it on every file in [scenarios/](scenarios/). Also check the physics: photon energies against the energy formula, and that referenced particle ids exist.
  - **Decision (2026-11-03): use zod 4** (checked 2026-11-03: v4.6.7, MIT, no runtime dependencies). Measure the bundle size before and after adding it, and write the result down here.
  - Export a JSON Schema from the zod schema and point `.vscode/settings.json` `json.schemas` at it for `scenarios/*.json`, so VS Code autocompletes and flags errors while editing scenarios.

- [ ] **3.4 Stop inserting scenario text as raw HTML (SEC-05)** ([InfoPanel.ts](src/renderer/ui/InfoPanel.ts))
  - Problem: scenario text is inserted with `innerHTML`. This is safe while scenarios ship with the app, but becomes a script-injection risk once users can load their own files (planned in the README).
  - Fix: build the panel with `textContent` / `createElement`, or escape every value inserted. Must land before user-loaded scenarios are added.

---

## Phase 4: Tooling and documentation

- [ ] **4.1 Upgrade ESLint 8 to ESLint 9** (ESLint 8 is no longer supported), moving to `eslint.config.mjs` and the matching typescript-eslint config. Lint results should not change.
- [ ] **4.2 Review `npm audit`**: 39 warnings, all in development tools (0 in what the app ships). Fix what upgrades without breaking changes; write down the rest.
- [ ] **4.3 Add a "Status" section to the README** saying what is built versus planned (forces, worker threads, save/load, measuring tools, d/f orbitals), so readers don't take the wishlist as current features.
- [ ] **4.4 (Optional)** Split three.js into its own file to clear the 500 kB bundle warning.

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
