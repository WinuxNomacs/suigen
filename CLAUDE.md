# Suigen

Electron + Three.js desktop app that animates events inside a single atom for teaching. TypeScript, Vite, Electron Forge. The same renderer also runs in a browser (`npm run web`).

## Commands

| Command | Purpose |
| --- | --- |
| `./run.sh` | Install if needed, then launch (`--dev` DevTools, `--web` browser, `--setup-only`) |
| `npm start` | Desktop app with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run web:build` | Browser build to `out/web` |

Run `typecheck` and `lint` before every commit. There is no test runner yet (planned in [upcoming-changes.md](upcoming-changes.md), Phase 3: Vitest).

## Layout

- [src/main/](src/main/): Electron main process (opens one window) and an empty preload. No IPC.
- [src/renderer/](src/renderer/): everything else. `physics/SimulationEngine.ts` replays a timed event list (the scene depends only on the starting particles, the events and the time; rewinding replays from zero). `physics/transitions.ts` holds the only physics rules. `particles/` draws particles, clouds and trails. `ui/` holds the toolbar, timeline and info panel.
- [src/shared/](src/shared/): types and physical constants (CODATA values in `constants.ts`).
- [scenarios/](scenarios/): preset JSON, bundled at build time through `scenarios/ScenarioLoader.ts`. Each has plain-language text (`layman`), a science panel (`scientific`), starting `particles` and timed `events`.
- [docs/plans/](docs/plans/): design and implementation plans. The README's feature list is a wishlist: much of it (forces, worker threads, save/load) is not built.

## Work tracking

[upcoming-changes.md](upcoming-changes.md) holds the phased fix plan and the decisions made for each item. Check items off and move them to "Done" with their commit hash as they land.

## Rules

- **Scientific accuracy comes first.** Compute every physical number shown in the app or written in scenario text (run the calculation, don't estimate) and keep the formula next to it. Use CODATA constants from `src/shared/constants.ts`.
- **Every simplification must be shown to the user** in the app's simplifications list. Nothing on screen may look real when it isn't (for example, times that include compressed waits are marked).
- Scenario text is inserted as HTML in `ui/InfoPanel.ts`. Don't insert user-supplied content until that is changed (plan item 3.4).
- Keep Electron's security defaults: no `nodeIntegration`, isolated context, the page security policy in `index.html`.
