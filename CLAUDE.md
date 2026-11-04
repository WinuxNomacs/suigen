# Suigen

Electron + Three.js desktop app that animates events inside a single atom for teaching. TypeScript, Vite, Electron Forge. The same renderer also runs in a browser (`npm run web`).

## Commands

| Command | Purpose |
| --- | --- |
| `./run.sh` | Install if needed, then launch (`--dev` DevTools, `--web` browser, `--setup-only`) |
| `npm start` | Desktop app with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`npm test -- -u` regenerates `src/shared/scenario.schema.json`) |
| `npm run web:build` | Browser build to `out/web` |

Run `typecheck`, `lint` and `test` before every commit. Tests live next to the code (`*.test.ts`); engine tests use `src/test/FakeParticleManager.ts` instead of a Three.js scene.

## Layout

- [src/main/](src/main/): Electron main process (opens the window) and the preload. The only IPC is saving and opening a scenario file (`scenarioFiles.ts`: system dialog, `.json` only, 1 MB limit, top frame of an app window only); the preload exposes just those two calls as `window.suigenFiles`. Keep it that narrow.
- [src/renderer/](src/renderer/): everything else. `physics/SimulationEngine.ts` replays a timed event list (the scene depends only on the starting particles, the events and the time; rewinding replays from zero). `physics/transitions.ts` holds the only physics rules. `particles/` draws particles, clouds and trails. `ui/` holds the toolbar, timeline and info panel.
- [src/shared/](src/shared/): types and physical constants (CODATA values in `constants.ts`).
- [scenarios/](scenarios/): preset JSON, bundled at build time through `scenarios/ScenarioLoader.ts`, which validates each one (zod schema in `src/shared/scenarioSchema.ts`, physics checks in `renderer/scenarios/validateScenario.ts`). Each has plain-language text (`layman`), a science panel (`scientific`), starting `particles`, timed `events` (in animation ticks), optional `compressions` (fast-forwarded spans) and `simplifications`.
- [docs/plans/](docs/plans/): design and implementation plans. The README's feature list is a wishlist: much of it (forces, worker threads, save/load) is not built.

## Work tracking

[upcoming-changes.md](upcoming-changes.md) starts with the phase list (Up next / Then / Later), then each phase's details and decisions. Check items off and move them to "Done" with their commit hash as they land. New requests arrive in `new.md` (untracked): turn them into phases there, then clear it back to its title.

## What a push starts

- Pushing a branch or `main` starts nothing: CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs only for a `v*` tag or by hand, because Actions minutes are limited.
- Pushing a `v*` tag runs CI: typecheck, lint, tests and web build on three OSes and two Node versions, then packaging on three OSes (macOS runners cost 10x). Nothing is published; `npm run publish` is manual.
- Dependencies are pinned to exact versions (`.npmrc` has `save-exact=true`); upgrading one is its own tested change.

## Rules

- **Scientific accuracy comes first.** Compute every physical number shown in the app or written in scenario text (run the calculation, don't estimate) and keep the formula next to it. Use CODATA constants from `src/shared/constants.ts`.
- **Every simplification must be shown to the user** in the app's simplifications list. Nothing on screen may look real when it isn't (for example, times that include compressed waits are marked).
- Never build DOM from HTML strings: create elements and set `textContent` (lint enforces no `innerHTML`/`outerHTML` assignment).
- Physics claims in scenario files need a test or a validator check where practical (see `scenarios.test.ts`, Compton).
- Keep Electron's security defaults: no `nodeIntegration`, isolated context, the page security policy in `index.html`.
