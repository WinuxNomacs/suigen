# Suigen v0.2 Design — UI Refinements, Ease of Use & Rich Scenarios

## Purpose

Make suigen approachable for someone with zero physics background. The beta works but drops users into an empty viewport with cryptic controls. v0.2 adds a scenario gallery for discovery, rich layman + scientific descriptions for every scenario, and floating particle labels so users always know what they're looking at.

## Key Decisions

- **Info panel approach**: Context-aware right panel (gallery / description / particle props)
- **Description depth**: Full sidebar with 4 layman sections + togglable scientific detail with equations
- **Scenario count**: 6 total (existing 4 enriched + 2 new)
- **Labels**: Floating CSS2D labels on particles + color legend in viewport

---

## 1. Expanded Scenario Data Model

Each scenario JSON gains `layman` and `scientific` fields:

```json
{
  "name": "Photon Absorption",
  "layman": {
    "title": "Catching Light",
    "summary": "Watch a particle of light get swallowed by a hydrogen atom",
    "sections": {
      "whatsHappening": "A photon — a tiny packet of light energy — flies toward...",
      "whyItMatters": "This is how atoms interact with light...",
      "whatToWatch": "Notice how the electron cloud changes shape...",
      "funFact": "This exact process happens trillions of times per second in your eyes..."
    }
  },
  "scientific": {
    "narrative": "The hydrogen atom begins in the ground state (n=1, l=0)...",
    "equations": [
      { "label": "Photon energy requirement", "tex": "E_photon = E_2 - E_1 = 10.2 eV" },
      { "label": "Energy levels", "tex": "E_n = -13.6 eV / n^2" }
    ],
    "constants": ["Rydberg energy: 13.6 eV", "Bohr radius: 52.9 pm"]
  },
  "particles": [...],
  "events": [...]
}
```

### Scenarios (6 total)

1. **Hydrogen Ground State** — "The Simplest Atom"
2. **Photon Absorption** — "Catching Light"
3. **Photon Emission** — "Releasing Light"
4. **Helium Atom** — "Two of Everything"
5. **Compton Scattering** (new) — "Light Bounces Off Matter"
6. **Deuterium Formation** (new) — "Building a Heavier Hydrogen"

Each gets full layman sections and scientific descriptions.

---

## 2. Context-Aware Info Panel

The right panel replaces the current properties panel. It has three modes:

### Gallery Mode (default on launch)

- 2-column grid of scenario cards
- Each card shows: scenario name, layman title, one-line summary
- Click a card to load the scenario
- "Sandbox" card at the bottom for free placement mode
- Replaces the tiny toolbar dropdown

### Description Mode (scenario loaded)

- Layman title and summary at top
- Four collapsible sections: What's happening, Why it matters, What to watch, Fun fact
- "Show Science" toggle reveals: technical narrative, equations (rendered in HTML/CSS, no LaTeX dependency), constants used
- "Back to Gallery" button at top

### Particle Mode (particle clicked)

- Particle type, position, spin, orbital quantum numbers
- "Back to Description" link

### Layout Change

- Panel width: 200px -> 280px
- Remove scenario dropdown from toolbar (gallery replaces it)

---

## 3. Particle Labels & Visual Clarity

### Floating Labels

- Use Three.js CSS2DRenderer for text labels that always face the camera
- Each particle shows its type above it: "proton", "electron (1s)", "photon (10.2 eV)"
- Orbital notation shown near the cloud (e.g. "1s", "2p₀")
- Labels toggle with L key, default ON

### Color Legend

- Small horizontal bar in bottom-left of viewport
- Shows: red circle = proton, blue circle = electron, gray circle = neutron, yellow circle = photon
- Always visible, semi-transparent background

---

## 4. Files Affected

- `src/shared/types.ts` — expand Scenario type with layman/scientific fields
- `scenarios/*.json` — add descriptions to all 6 scenarios
- `src/renderer/ui/InfoPanel.ts` — new, replaces PropertiesPanel
- `src/renderer/ui/ScenarioGallery.ts` — new, card grid component
- `src/renderer/ui/ScenarioMenu.ts` — remove (replaced by gallery)
- `src/renderer/ui/PropertiesPanel.ts` — remove (absorbed into InfoPanel)
- `src/renderer/particles/ParticleLabels.ts` — new, CSS2DRenderer labels
- `src/renderer/scene/SceneManager.ts` — add CSS2DRenderer
- `src/renderer/index.html` — update panel markup
- `src/renderer/styles.css` — gallery cards, description sections, legend
- `src/renderer/app.ts` — rewire panel and label systems

## Deferred

- LaTeX equation rendering (use HTML/CSS superscripts and subscripts instead)
- Measurement tools
- Save/load user files
- Export video/PNG
- d/f orbital shapes
