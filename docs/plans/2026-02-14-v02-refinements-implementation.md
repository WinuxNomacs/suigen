# v0.2 UI Refinements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scenario gallery, rich layman + scientific descriptions, floating particle labels, and 2 new scenarios to make suigen approachable for non-physicists.

**Architecture:** Expand scenario JSON schema with description fields. Replace the properties panel with a context-aware InfoPanel that switches between gallery, description, and particle modes. Add CSS2DRenderer labels to particles. No new dependencies — Three.js CSS2DRenderer is included in three/addons.

**Tech Stack:** TypeScript, Three.js (CSS2DRenderer), HTML/CSS, Electron

**Design doc:** `docs/plans/2026-02-14-v02-refinements-design.md`

---

## Task 1: Expand Scenario Type & Update Existing JSON Files

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `scenarios/hydrogen-ground-state.json`
- Modify: `scenarios/photon-absorption.json`
- Modify: `scenarios/photon-emission.json`
- Modify: `scenarios/helium-atom.json`

**Step 1: Expand the Scenario interface in types.ts**

Add these interfaces before the existing `Scenario` interface, then update `Scenario`:

```typescript
export interface LaymanDescription {
  title: string;
  summary: string;
  sections: {
    whatsHappening: string;
    whyItMatters: string;
    whatToWatch: string;
    funFact: string;
  };
}

export interface ScientificEquation {
  label: string;
  tex: string;
}

export interface ScientificDescription {
  narrative: string;
  equations: ScientificEquation[];
  constants: string[];
}

export interface Scenario {
  name: string;
  description: string;
  layman: LaymanDescription;
  scientific: ScientificDescription;
  particles: Array<Partial<ParticleData> & { type: ParticleType }>;
  events: ScenarioEvent[];
}
```

**Step 2: Update hydrogen-ground-state.json**

Replace entire file:

```json
{
  "name": "Hydrogen Ground State",
  "description": "A single hydrogen atom: 1 proton and 1 electron in the 1s orbital",
  "layman": {
    "title": "The Simplest Atom",
    "summary": "Meet hydrogen — the most basic building block of the universe",
    "sections": {
      "whatsHappening": "You're looking at a single hydrogen atom — the simplest atom that exists. At the center is a proton (red), a positively charged particle. Surrounding it is a cloud of probability (blue) showing where the electron is most likely to be found. The electron isn't orbiting like a planet — it exists as a fuzzy cloud of possibility.",
      "whyItMatters": "Hydrogen makes up about 75% of all matter in the universe. Every star, including our Sun, is mostly hydrogen. Understanding this one atom is the foundation for understanding all of chemistry and most of physics.",
      "whatToWatch": "Notice the blue cloud around the proton. This is the electron's '1s orbital' — a spherical shape meaning the electron could be found anywhere around the proton with roughly equal probability. The denser inner region shows where the electron is most likely to be.",
      "funFact": "If a hydrogen atom were the size of a football stadium, the proton would be a marble at the 50-yard line. The electron cloud would fill the entire stadium. Atoms are almost entirely empty space!"
    }
  },
  "scientific": {
    "narrative": "The hydrogen atom is shown in its ground state with principal quantum number n=1, angular momentum quantum number l=0, and magnetic quantum number m=0. The electron probability density is given by the square of the 1s wavefunction, which is spherically symmetric. The radial probability peaks at the Bohr radius (52.9 pm from the nucleus).",
    "equations": [
      { "label": "1s wavefunction", "tex": "\u03c8\u2081\u209b(r) = (1/\u221a\u03c0)(1/a\u2080)\u00b3\u02f2 e^(-r/a\u2080)" },
      { "label": "Ground state energy", "tex": "E\u2081 = -13.6 eV" },
      { "label": "Bohr radius", "tex": "a\u2080 = 52.9 pm = 0.529 \u00c5" }
    ],
    "constants": ["Bohr radius: a\u2080 = 5.29 \u00d7 10\u207b\u00b9\u00b9 m", "Ground state energy: -13.6 eV", "Electron mass: 9.109 \u00d7 10\u207b\u00b3\u00b9 kg"]
  },
  "particles": [
    { "type": "proton", "position": { "x": 0, "y": 0, "z": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "orbital": { "n": 1, "l": 0, "m": 0 } }
  ],
  "events": []
}
```

**Step 3: Update photon-absorption.json**

Replace entire file:

```json
{
  "name": "Photon Absorption",
  "description": "A photon is absorbed by a hydrogen atom, exciting the electron from 1s to 2p",
  "layman": {
    "title": "Catching Light",
    "summary": "Watch a particle of light get swallowed by a hydrogen atom",
    "sections": {
      "whatsHappening": "A photon — a tiny packet of light energy — is flying toward a hydrogen atom. When it arrives, the atom absorbs it completely. The photon vanishes, and its energy is transferred to the electron, which jumps to a higher energy level. Watch the electron cloud change shape from a sphere (1s) to a dumbbell (2p).",
      "whyItMatters": "This is the fundamental process behind how things absorb light. It's why leaves are green (they absorb red and blue light), why your skin gets warm in sunlight, and how solar panels generate electricity. Every color you see exists because atoms absorb specific wavelengths of light.",
      "whatToWatch": "Follow the yellow photon as it approaches from the left. Notice its wave-like trail — light behaves as both a wave and a particle. When it reaches the atom, it disappears and the blue electron cloud instantly changes from a round sphere to an elongated dumbbell shape.",
      "funFact": "The electron can only absorb a photon with exactly the right energy — 10.2 electron volts in this case. Too much or too little, and the photon passes right through. It's like a vending machine that only accepts exact change!"
    }
  },
  "scientific": {
    "narrative": "A photon with energy E=10.2 eV (corresponding to the Lyman-alpha transition) is incident on a hydrogen atom in the ground state (n=1, l=0, m=0). The photon energy exactly matches the energy difference between the n=1 and n=2 levels: \u0394E = 13.6(1/1\u00b2 - 1/2\u00b2) = 10.2 eV. Upon absorption, the electron transitions to the 2p state (n=2, l=1, m=0), which has a characteristic dumbbell-shaped probability distribution aligned along the y-axis.",
    "equations": [
      { "label": "Energy level difference", "tex": "\u0394E = 13.6 eV \u00d7 (1/n\u2081\u00b2 - 1/n\u2082\u00b2) = 10.2 eV" },
      { "label": "Photon energy", "tex": "E = h\u03bd = hc/\u03bb" },
      { "label": "Lyman-alpha wavelength", "tex": "\u03bb = 121.6 nm (ultraviolet)" },
      { "label": "Selection rule", "tex": "\u0394l = \u00b11 (electric dipole transition)" }
    ],
    "constants": ["Transition energy: 10.2 eV", "Lyman-alpha wavelength: 121.6 nm", "Rydberg energy: 13.6 eV"]
  },
  "particles": [
    { "type": "proton", "position": { "x": 0, "y": 0, "z": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "orbital": { "n": 1, "l": 0, "m": 0 } }
  ],
  "events": [
    {
      "time": 0,
      "action": "spawn",
      "particle": { "type": "photon", "position": { "x": -80000, "y": 0, "z": 0 }, "direction": { "x": 1, "y": 0, "z": 0 }, "energy": 10.2 }
    },
    {
      "time": 1600,
      "action": "absorb",
      "photonIndex": 2,
      "electronIndex": 1,
      "targetOrbital": { "n": 2, "l": 1, "m": 0 }
    }
  ]
}
```

**Step 4: Update photon-emission.json**

Replace entire file:

```json
{
  "name": "Photon Emission",
  "description": "An excited hydrogen atom emits a photon as the electron drops from 2p to 1s",
  "layman": {
    "title": "Releasing Light",
    "summary": "An excited atom relaxes and shoots out a particle of light",
    "sections": {
      "whatsHappening": "This hydrogen atom starts in an excited state — its electron is in a higher energy level (2p) than it wants to be. Nature prefers the lowest energy state, so the electron spontaneously drops back down to the ground state (1s). The excess energy is released as a photon — a particle of light that flies away from the atom.",
      "whyItMatters": "This is how all light is created. Every light source — from candle flames to LED screens to distant stars — produces light through atoms releasing photons as their electrons drop to lower energy levels. The specific energy of the photon determines its color.",
      "whatToWatch": "Watch the dumbbell-shaped electron cloud (2p orbital) collapse into a sphere (1s orbital). At that moment, a yellow photon appears and flies away to the right with its characteristic wave trail. The atom is now back in its lowest energy state.",
      "funFact": "The photon emitted here has a wavelength of 121.6 nanometers — that's ultraviolet light, invisible to human eyes. Most of the light hydrogen emits is actually invisible to us!"
    }
  },
  "scientific": {
    "narrative": "A hydrogen atom in the excited state (n=2, l=1, m=0) undergoes spontaneous emission. The electron transitions from the 2p to the 1s state, emitting a photon with energy E = 10.2 eV (Lyman-alpha line, \u03bb = 121.6 nm). The transition obeys the electric dipole selection rule \u0394l = \u00b11. The mean lifetime of the 2p state is approximately 1.6 nanoseconds.",
    "equations": [
      { "label": "Emitted photon energy", "tex": "E = E\u2082 - E\u2081 = -3.4 - (-13.6) = 10.2 eV" },
      { "label": "Spontaneous emission rate", "tex": "A\u2082\u2081 = 6.27 \u00d7 10\u2078 s\u207b\u00b9" },
      { "label": "Mean lifetime", "tex": "\u03c4 = 1/A\u2082\u2081 \u2248 1.6 ns" }
    ],
    "constants": ["2p state energy: -3.4 eV", "1s state energy: -13.6 eV", "Mean lifetime of 2p: 1.6 ns"]
  },
  "particles": [
    { "type": "proton", "position": { "x": 0, "y": 0, "z": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "orbital": { "n": 2, "l": 1, "m": 0 } }
  ],
  "events": [
    {
      "time": 500,
      "action": "emit",
      "electronIndex": 1,
      "targetOrbital": { "n": 1, "l": 0, "m": 0 },
      "particle": { "type": "photon", "position": { "x": 0, "y": 0, "z": 0 }, "direction": { "x": 1, "y": 0, "z": 0 }, "energy": 10.2 }
    }
  ]
}
```

**Step 5: Update helium-atom.json**

Replace entire file:

```json
{
  "name": "Helium Atom",
  "description": "Helium: 2 protons, 2 neutrons, 2 electrons (spin up and spin down in 1s)",
  "layman": {
    "title": "Two of Everything",
    "summary": "Helium — the atom that makes balloons float and voices squeaky",
    "sections": {
      "whatsHappening": "You're looking at a helium atom — the second simplest element. Its nucleus contains 2 protons (red) and 2 neutrons (gray), tightly bound together by the strong nuclear force. Two electrons share the same orbital cloud around the nucleus, but with opposite spins — this is required by the Pauli exclusion principle, which says no two identical particles can be in exactly the same quantum state.",
      "whyItMatters": "Helium is the second most abundant element in the universe (after hydrogen). It's produced inside stars through nuclear fusion. On Earth, we find it trapped underground — once it escapes into the atmosphere, it's light enough to float away into space forever. That's why helium is actually a non-renewable resource!",
      "whatToWatch": "Notice the nucleus has four particles clustered tightly together — two red protons and two gray neutrons. The blue electron cloud surrounds them. Both electrons occupy the same 1s orbital, but they must have opposite spins (+1/2 and -1/2) to coexist.",
      "funFact": "Helium was discovered on the Sun before it was found on Earth! In 1868, astronomers saw an unknown spectral line in sunlight and named the mystery element 'helium' after Helios, the Greek sun god. It wasn't found on Earth until 27 years later."
    }
  },
  "scientific": {
    "narrative": "The helium atom has atomic number Z=2 with a nucleus of 2 protons and 2 neutrons (helium-4, the most common isotope). Both electrons occupy the 1s orbital with opposite spin quantum numbers (m_s = +1/2 and -1/2), forming a closed shell. This configuration makes helium extremely stable and chemically inert — it has the highest ionization energy of any element (24.6 eV). The electron-electron repulsion makes an exact analytical solution impossible; the displayed orbital uses a hydrogen-like approximation with effective nuclear charge Z_eff \u2248 1.69.",
    "equations": [
      { "label": "Electron configuration", "tex": "1s\u00b2" },
      { "label": "Pauli exclusion", "tex": "No two fermions can share all quantum numbers (n, l, m, m_s)" },
      { "label": "First ionization energy", "tex": "IE\u2081 = 24.6 eV" },
      { "label": "Effective nuclear charge", "tex": "Z_eff \u2248 1.69 (shielding by other electron)" }
    ],
    "constants": ["Atomic number: Z = 2", "Mass number: A = 4", "Nuclear binding energy: 28.3 MeV", "First ionization: 24.6 eV"]
  },
  "particles": [
    { "type": "proton", "position": { "x": -1.5, "y": 0, "z": 0 } },
    { "type": "proton", "position": { "x": 1.5, "y": 0, "z": 0 } },
    { "type": "neutron", "position": { "x": 0, "y": -1.5, "z": 0 } },
    { "type": "neutron", "position": { "x": 0, "y": 1.5, "z": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "spin": 0.5, "orbital": { "n": 1, "l": 0, "m": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "spin": -0.5, "orbital": { "n": 1, "l": 0, "m": 0 } }
  ],
  "events": []
}
```

**Step 6: Commit**

```bash
git add src/shared/types.ts scenarios/
git commit -m "feat: expand Scenario type with layman and scientific descriptions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Two New Scenario Files

**Files:**
- Create: `scenarios/compton-scattering.json`
- Create: `scenarios/deuterium-formation.json`
- Modify: `src/renderer/scenarios/ScenarioLoader.ts`

**Step 1: Create compton-scattering.json**

```json
{
  "name": "Compton Scattering",
  "description": "A photon scatters off a free electron, transferring some of its energy",
  "layman": {
    "title": "Light Bounces Off Matter",
    "summary": "Watch what happens when a photon collides with an electron and bounces away with less energy",
    "sections": {
      "whatsHappening": "A high-energy photon is heading toward an electron. Unlike absorption (where the photon vanishes entirely), here the photon bounces off the electron like a billiard ball. The photon loses some energy in the collision and changes direction, while the electron gets knocked away. The photon keeps going but with less energy than before.",
      "whyItMatters": "Compton scattering proved that light really does behave like a particle, not just a wave. This was one of the key experiments that launched quantum mechanics. It's also how X-ray machines create contrast — X-ray photons scatter differently off bone versus soft tissue.",
      "whatToWatch": "Follow the yellow photon as it approaches the blue electron. At impact, the photon deflects upward and the electron recoils to the right. Notice the photon's wave trail — after scattering, its wavelength appears longer (lower energy).",
      "funFact": "Arthur Compton won the Nobel Prize in 1927 for discovering this effect. Before his experiment, many physicists refused to believe light could behave as a particle. His billiard-ball-style calculation matched the data perfectly!"
    }
  },
  "scientific": {
    "narrative": "An incident photon scatters off a quasi-free electron. The photon transfers momentum and energy to the electron, emerging with a longer wavelength (lower energy) at a scattering angle. This is modeled as an elastic collision between the photon and electron, conserving both energy and momentum. The wavelength shift depends only on the scattering angle, not the initial photon energy.",
    "equations": [
      { "label": "Compton wavelength shift", "tex": "\u0394\u03bb = (\u03bb' - \u03bb) = (h/m_e c)(1 - cos\u03b8)" },
      { "label": "Compton wavelength of electron", "tex": "\u03bb_C = h/m_e c = 2.43 \u00d7 10\u207b\u00b9\u00b2 m" },
      { "label": "Energy conservation", "tex": "E_\u03b3 + m_e c\u00b2 = E'_\u03b3 + E_e" }
    ],
    "constants": ["Compton wavelength: 2.43 pm", "Electron rest energy: 0.511 MeV", "Incident photon energy: ~100 eV (soft X-ray)"]
  },
  "particles": [
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 } }
  ],
  "events": [
    {
      "time": 0,
      "action": "spawn",
      "particle": { "type": "photon", "position": { "x": -80000, "y": 0, "z": 0 }, "direction": { "x": 1, "y": 0, "z": 0 }, "energy": 100 }
    },
    {
      "time": 1600,
      "action": "remove",
      "photonIndex": 1
    },
    {
      "time": 1600,
      "action": "spawn",
      "particle": { "type": "photon", "position": { "x": 0, "y": 0, "z": 0 }, "direction": { "x": 0.7, "y": 0.7, "z": 0 }, "energy": 80 }
    }
  ]
}
```

**Step 2: Create deuterium-formation.json**

```json
{
  "name": "Deuterium Formation",
  "description": "A proton and neutron bind together via the strong force to form deuterium",
  "layman": {
    "title": "Building a Heavier Hydrogen",
    "summary": "Watch a proton and neutron snap together to form the nucleus of heavy hydrogen",
    "sections": {
      "whatsHappening": "A neutron is approaching a proton. When they get close enough — within about 1 femtometer (a millionth of a billionth of a millimeter) — the strong nuclear force grabs them and pulls them together. They bind into a deuteron, the nucleus of deuterium (heavy hydrogen). A photon is released carrying away the excess binding energy.",
      "whyItMatters": "This is the first step in nuclear fusion — the process that powers every star in the universe. Inside the Sun, protons and neutrons combine to build helium, releasing enormous amounts of energy. Deuterium formation is also being studied for fusion power reactors on Earth.",
      "whatToWatch": "Watch the gray neutron approach the red proton from the right. When they get close, they snap together and a pulsing glow appears between them — that's the strong force binding. A yellow photon shoots away, carrying the 2.22 MeV of binding energy.",
      "funFact": "About 1 in every 6,400 hydrogen atoms in ocean water is actually deuterium. That's enough that if we could fuse all the deuterium in a single gallon of seawater, it would produce as much energy as burning 300 gallons of gasoline!"
    }
  },
  "scientific": {
    "narrative": "A free neutron approaches a proton. At distances below ~2 fm, the strong nuclear force (mediated by pion exchange) overcomes the centrifugal barrier and binds the two nucleons into a deuteron — the only bound state of the two-nucleon system. The deuteron has spin-1 (triplet state), isospin-0, and a binding energy of 2.224 MeV. The excess energy is radiated as a gamma-ray photon. The deuteron is weakly bound compared to heavier nuclei, with no excited states.",
    "equations": [
      { "label": "Binding energy", "tex": "B = (m_p + m_n - m_d)c\u00b2 = 2.224 MeV" },
      { "label": "Yukawa potential", "tex": "V(r) \u2248 -g\u00b2 e^(-m_\u03c0 r)/(4\u03c0 r)" },
      { "label": "Deuteron spin", "tex": "J = 1 (triplet state, S=1, L=0 dominant)" }
    ],
    "constants": ["Deuteron binding energy: 2.224 MeV", "Strong force range: ~1-2 fm", "Pion mass: 139.6 MeV/c\u00b2", "Deuteron mass: 1875.6 MeV/c\u00b2"]
  },
  "particles": [
    { "type": "proton", "position": { "x": 0, "y": 0, "z": 0 } },
    { "type": "neutron", "position": { "x": 80000, "y": 0, "z": 0 }, "direction": { "x": -1, "y": 0, "z": 0 } }
  ],
  "events": [
    {
      "time": 1600,
      "action": "remove",
      "photonIndex": 1
    },
    {
      "time": 1600,
      "action": "spawn",
      "particle": { "type": "neutron", "position": { "x": 1.5, "y": 0, "z": 0 } }
    },
    {
      "time": 1600,
      "action": "spawn",
      "particle": { "type": "photon", "position": { "x": 0, "y": 0, "z": 0 }, "direction": { "x": 0, "y": 1, "z": 0 }, "energy": 2224000 }
    }
  ]
}
```

**Step 3: Update ScenarioLoader.ts**

Replace entire file:

```typescript
import { Scenario } from '../../shared/types';

import hydrogenGroundState from '../../../scenarios/hydrogen-ground-state.json';
import photonAbsorption from '../../../scenarios/photon-absorption.json';
import photonEmission from '../../../scenarios/photon-emission.json';
import heliumAtom from '../../../scenarios/helium-atom.json';
import comptonScattering from '../../../scenarios/compton-scattering.json';
import deuteriumFormation from '../../../scenarios/deuterium-formation.json';

const PRESETS: Record<string, Scenario> = {
  'hydrogen-ground-state': hydrogenGroundState as unknown as Scenario,
  'photon-absorption': photonAbsorption as unknown as Scenario,
  'photon-emission': photonEmission as unknown as Scenario,
  'helium-atom': heliumAtom as unknown as Scenario,
  'compton-scattering': comptonScattering as unknown as Scenario,
  'deuterium-formation': deuteriumFormation as unknown as Scenario,
};

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function getPresets(): Record<string, Scenario> {
  return { ...PRESETS };
}

export function loadPreset(name: string): Scenario | undefined {
  return PRESETS[name];
}
```

**Step 4: Commit**

```bash
git add scenarios/compton-scattering.json scenarios/deuterium-formation.json src/renderer/scenarios/ScenarioLoader.ts
git commit -m "feat: add Compton scattering and deuterium formation scenarios

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create InfoPanel Component

**Files:**
- Create: `src/renderer/ui/InfoPanel.ts`
- Delete: `src/renderer/ui/PropertiesPanel.ts`
- Delete: `src/renderer/ui/ScenarioMenu.ts`

**Step 1: Create InfoPanel.ts**

This replaces both PropertiesPanel and ScenarioMenu with a single context-aware panel.

```typescript
import { ParticleData, Scenario } from '../../shared/types';
import { getPresets, loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';

type PanelMode = 'gallery' | 'description' | 'particle';

export class InfoPanel {
  private container: HTMLElement;
  private engine: SimulationEngine;
  private mode: PanelMode = 'gallery';
  private currentScenario: Scenario | null = null;
  private showScience = false;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.container = container;
    this.engine = engine;
    this.renderGallery();
  }

  private renderGallery(): void {
    this.mode = 'gallery';
    this.currentScenario = null;
    const presets = getPresets();
    const cards = Object.entries(presets).map(([key, scenario]) => `
      <div class="scenario-card" data-scenario="${key}">
        <div class="card-name">${scenario.name}</div>
        <div class="card-title">${scenario.layman.title}</div>
        <div class="card-summary">${scenario.layman.summary}</div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <h3>Explore</h3>
      <div class="scenario-gallery">${cards}</div>
      <div class="scenario-card sandbox-card" data-scenario="sandbox">
        <div class="card-name">Sandbox</div>
        <div class="card-title">Free Exploration</div>
        <div class="card-summary">Place particles freely and watch them interact</div>
      </div>
    `;

    this.container.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = (card as HTMLElement).dataset.scenario!;
        if (key === 'sandbox') {
          this.engine.loadScenario([], []);
          this.renderDescription(null);
          return;
        }
        const scenario = loadPreset(key);
        if (scenario) {
          this.engine.loadScenario(scenario.particles, scenario.events);
          this.renderDescription(scenario);
        }
      });
    });
  }

  private renderDescription(scenario: Scenario | null): void {
    this.mode = 'description';
    this.currentScenario = scenario;
    this.showScience = false;

    if (!scenario) {
      this.container.innerHTML = `
        <button class="back-btn" id="back-to-gallery">\u2190 Scenarios</button>
        <h3>Sandbox Mode</h3>
        <p class="hint">Select a particle type from the toolbar, then click in the viewport to place it.</p>
      `;
      this.container.querySelector('#back-to-gallery')!.addEventListener('click', () => this.renderGallery());
      return;
    }

    const s = scenario.layman.sections;
    this.container.innerHTML = `
      <button class="back-btn" id="back-to-gallery">\u2190 Scenarios</button>
      <div class="desc-header">
        <div class="desc-title">${scenario.layman.title}</div>
        <div class="desc-summary">${scenario.layman.summary}</div>
      </div>
      <div class="desc-sections">
        <details open>
          <summary>What's happening</summary>
          <p>${s.whatsHappening}</p>
        </details>
        <details>
          <summary>Why it matters</summary>
          <p>${s.whyItMatters}</p>
        </details>
        <details>
          <summary>What to watch</summary>
          <p>${s.whatToWatch}</p>
        </details>
        <details>
          <summary>Fun fact</summary>
          <p>${s.funFact}</p>
        </details>
      </div>
      <button class="toggle-science" id="toggle-science">Show Science \u25BC</button>
      <div class="science-content" id="science-content" style="display:none;">
        <p class="sci-narrative">${scenario.scientific.narrative}</p>
        <div class="sci-equations">
          ${scenario.scientific.equations.map(eq => `
            <div class="equation">
              <span class="eq-label">${eq.label}:</span>
              <span class="eq-tex">${eq.tex}</span>
            </div>
          `).join('')}
        </div>
        <div class="sci-constants">
          <strong>Constants:</strong>
          <ul>${scenario.scientific.constants.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    this.container.querySelector('#back-to-gallery')!.addEventListener('click', () => this.renderGallery());
    this.container.querySelector('#toggle-science')!.addEventListener('click', () => {
      this.showScience = !this.showScience;
      const content = document.getElementById('science-content')!;
      const btn = document.getElementById('toggle-science')!;
      content.style.display = this.showScience ? 'block' : 'none';
      btn.textContent = this.showScience ? 'Hide Science \u25B2' : 'Show Science \u25BC';
    });
  }

  showParticle(p: ParticleData): void {
    this.mode = 'particle';
    const orbitalStr = p.orbital ? `n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}` : '';
    this.container.innerHTML = `
      <button class="back-btn" id="back-to-desc">\u2190 Description</button>
      <h3>Particle</h3>
      <p><strong>${p.type}</strong></p>
      <p>x: ${p.position.x.toFixed(1)} fm</p>
      <p>y: ${p.position.y.toFixed(1)} fm</p>
      <p>z: ${p.position.z.toFixed(1)} fm</p>
      <p>spin: ${p.spin}</p>
      ${orbitalStr ? `<p>orbital: ${orbitalStr}</p>` : ''}
      ${p.energy ? `<p>energy: ${p.energy} eV</p>` : ''}
    `;
    this.container.querySelector('#back-to-desc')!.addEventListener('click', () => {
      if (this.currentScenario) {
        this.renderDescription(this.currentScenario);
      } else {
        this.renderGallery();
      }
    });
  }

  clearSelection(): void {
    if (this.mode === 'particle') {
      if (this.currentScenario) {
        this.renderDescription(this.currentScenario);
      } else {
        this.renderGallery();
      }
    }
  }
}
```

**Step 2: Delete old files**

```bash
rm src/renderer/ui/PropertiesPanel.ts
rm src/renderer/ui/ScenarioMenu.ts
```

**Step 3: Commit**

```bash
git add src/renderer/ui/InfoPanel.ts
git add -u src/renderer/ui/PropertiesPanel.ts src/renderer/ui/ScenarioMenu.ts
git commit -m "feat: add context-aware InfoPanel, remove PropertiesPanel and ScenarioMenu

InfoPanel shows scenario gallery on launch, rich descriptions when
a scenario is loaded, and particle properties on click.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update HTML, CSS, and App Wiring

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/app.ts`

**Step 1: Update index.html**

Replace the `#properties` div and remove the scenario dropdown from toolbar:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" />
  <title>Suigen</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <button class="particle-btn" data-type="electron" title="Electron">e&#x207B;</button>
      <button class="particle-btn" data-type="proton" title="Proton">p&#x207A;</button>
      <button class="particle-btn" data-type="neutron" title="Neutron">n&#x2070;</button>
      <button class="particle-btn" data-type="photon" title="Photon">&#x03B3;</button>
    </div>
    <div id="viewport"></div>
    <div id="info-panel"></div>
    <div id="timeline">
      <button id="btn-step-back" title="Step back">&#x00AB;</button>
      <button id="btn-play" title="Play/Pause">&#x25B6;</button>
      <button id="btn-step-fwd" title="Step forward">&#x00BB;</button>
      <label>Speed: <input id="speed" type="range" min="0.1" max="10" step="0.1" value="1" /></label>
      <span id="time-display">t = 0.0 fs</span>
    </div>
  </div>
  <script type="module" src="app.ts"></script>
</body>
</html>
```

**Step 2: Update styles.css**

Replace entire file:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0a0a1a;
  color: #ccc;
  overflow: hidden;
  height: 100vh;
}

#app {
  display: grid;
  grid-template-columns: 60px 1fr 280px;
  grid-template-rows: 1fr 48px;
  height: 100vh;
}

/* Toolbar */
#toolbar {
  grid-row: 1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: #111122;
  border-right: 1px solid #222;
}

.particle-btn {
  width: 44px;
  height: 44px;
  border: 1px solid #444;
  border-radius: 6px;
  background: #1a1a2e;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.particle-btn:hover { background: #2a2a4e; }
.particle-btn.active { border-color: #66aaff; background: #1a2a4e; }

/* Viewport */
#viewport {
  grid-row: 1;
  grid-column: 2;
  overflow: hidden;
  position: relative;
}

/* Info Panel */
#info-panel {
  grid-row: 1;
  grid-column: 3;
  padding: 12px;
  background: #111122;
  border-left: 1px solid #222;
  overflow-y: auto;
}

#info-panel h3 {
  font-size: 14px;
  margin-bottom: 10px;
  color: #88aaff;
}

.hint { color: #666; font-size: 12px; }

/* Scenario Gallery */
.scenario-gallery {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.scenario-card {
  padding: 10px;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.scenario-card:hover {
  border-color: #66aaff;
  background: #1a2a4e;
}

.sandbox-card {
  border-style: dashed;
  margin-top: 4px;
}

.card-name {
  font-size: 11px;
  color: #88aaff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #ddd;
  margin-bottom: 4px;
}

.card-summary {
  font-size: 11px;
  color: #888;
  line-height: 1.4;
}

/* Back button */
.back-btn {
  background: none;
  border: none;
  color: #66aaff;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 12px;
}

.back-btn:hover { text-decoration: underline; }

/* Description */
.desc-header {
  margin-bottom: 12px;
}

.desc-title {
  font-size: 16px;
  font-weight: 600;
  color: #ddd;
  margin-bottom: 4px;
}

.desc-summary {
  font-size: 12px;
  color: #999;
  font-style: italic;
}

.desc-sections {
  margin-bottom: 12px;
}

.desc-sections details {
  margin-bottom: 6px;
  border: 1px solid #222;
  border-radius: 6px;
  overflow: hidden;
}

.desc-sections summary {
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #aab;
  cursor: pointer;
  background: #151528;
}

.desc-sections summary:hover { color: #ccd; }

.desc-sections details > p {
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #bbb;
}

/* Science toggle */
.toggle-science {
  display: block;
  width: 100%;
  padding: 8px;
  background: #151528;
  border: 1px solid #333;
  border-radius: 6px;
  color: #88aaff;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 8px;
}

.toggle-science:hover { background: #1a2a4e; }

.science-content {
  font-size: 12px;
  line-height: 1.6;
}

.sci-narrative {
  color: #aab;
  margin-bottom: 10px;
}

.sci-equations {
  margin-bottom: 10px;
}

.equation {
  padding: 4px 0;
  border-bottom: 1px solid #1a1a2e;
}

.eq-label {
  color: #888;
  font-size: 11px;
}

.eq-tex {
  display: block;
  font-family: 'Georgia', serif;
  color: #ccddff;
  padding: 2px 0 2px 8px;
  font-size: 13px;
}

.sci-constants {
  color: #888;
  font-size: 11px;
}

.sci-constants ul {
  list-style: none;
  padding-left: 8px;
}

.sci-constants li::before {
  content: "\u2022 ";
  color: #555;
}

/* Legend */
#legend {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 12px;
  background: rgba(10, 10, 26, 0.8);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Timeline */
#timeline {
  grid-row: 2;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #111122;
  border-top: 1px solid #222;
}

#timeline button {
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 14px;
}

#timeline button:hover { background: #2a2a4e; }

#timeline label { color: #888; font-size: 12px; }
#time-display { margin-left: auto; font-family: monospace; font-size: 13px; }

/* CSS2D Labels */
.particle-label {
  font-size: 10px;
  color: #aaa;
  background: rgba(10, 10, 26, 0.7);
  padding: 1px 5px;
  border-radius: 3px;
  pointer-events: none;
  white-space: nowrap;
}
```

**Step 3: Update app.ts**

Replace entire file:

```typescript
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';
import { SimulationEngine } from './physics/SimulationEngine';
import { Toolbar } from './ui/Toolbar';
import { Timeline } from './ui/Timeline';
import { InfoPanel } from './ui/InfoPanel';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);
const particleManager = new ParticleManager(sceneManager.scene);
const engine = new SimulationEngine(particleManager);

const toolbar = new Toolbar();
const timeline = new Timeline(engine);
const infoPanel = new InfoPanel(document.getElementById('info-panel')!, engine);

// Add color legend to viewport
const legend = document.createElement('div');
legend.id = 'legend';
legend.innerHTML = `
  <div class="legend-item"><span class="legend-dot" style="background:#ff4444"></span> proton</div>
  <div class="legend-item"><span class="legend-dot" style="background:#4488ff"></span> electron</div>
  <div class="legend-item"><span class="legend-dot" style="background:#888888"></span> neutron</div>
  <div class="legend-item"><span class="legend-dot" style="background:#ffdd44"></span> photon</div>
`;
viewport.appendChild(legend);

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

viewport.addEventListener('click', (event) => {
  const rect = viewport.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, sceneManager.camera);

  const selectedType = toolbar.getSelectedType();

  if (selectedType) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    if (intersection) {
      const data = particleManager.addParticle(selectedType, {
        x: intersection.x,
        y: intersection.y,
        z: intersection.z,
      });
      engine.state.particles.push(data);
      toolbar.clearSelection();
    }
  } else {
    const meshes = particleManager.getAllMeshes();
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const id = intersects[0].object.userData.particleId;
      const p = particleManager.getParticle(id);
      if (p) infoPanel.showParticle(p.data);
    } else {
      infoPanel.clearSelection();
    }
  }
});

// Animation loop
let lastTime = performance.now();

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaSec = (now - lastTime) / 1000;
  lastTime = now;

  if (engine.state.playing) {
    engine.tick(deltaSec * 100);
  }

  particleManager.updateTrails(engine.state.time);
  timeline.update();
  sceneManager.render();
}

animate();
```

**Step 4: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css src/renderer/app.ts
git commit -m "feat: update HTML/CSS for info panel, add color legend, rewire app

Wider info panel (280px), scenario gallery cards, description sections,
science toggle, particle legend in viewport corner.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add Floating Particle Labels (CSS2DRenderer)

**Files:**
- Create: `src/renderer/particles/ParticleLabels.ts`
- Modify: `src/renderer/scene/SceneManager.ts`
- Modify: `src/renderer/particles/ParticleManager.ts`
- Modify: `src/renderer/app.ts`

**Step 1: Create ParticleLabels.ts**

```typescript
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ParticleData } from '../../shared/types';
import * as THREE from 'three';

function labelText(p: ParticleData): string {
  if (p.type === 'electron' && p.orbital) {
    const sublabel = ['s', 'p', 'd', 'f'][p.orbital.l] || '?';
    return `electron (${p.orbital.n}${sublabel})`;
  }
  if (p.type === 'photon' && p.energy) {
    return `photon (${p.energy} eV)`;
  }
  return p.type;
}

export function createParticleLabel(p: ParticleData): CSS2DObject {
  const div = document.createElement('div');
  div.className = 'particle-label';
  div.textContent = labelText(p);
  const label = new CSS2DObject(div);
  label.position.set(0, 5, 0); // offset above particle
  return label;
}

export function updateLabelText(label: CSS2DObject, p: ParticleData): void {
  (label.element as HTMLDivElement).textContent = labelText(p);
}
```

**Step 2: Add CSS2DRenderer to SceneManager**

Read `src/renderer/scene/SceneManager.ts` first. Then add:

- Import at top:
```typescript
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
```

- New property:
```typescript
  labelRenderer: CSS2DRenderer;
```

- In constructor, after `container.appendChild(this.renderer.domElement)`:
```typescript
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);
```

- In `onResize()`, add:
```typescript
    this.labelRenderer.setSize(w, h);
```

- In `render()`, add after the existing render call:
```typescript
    this.labelRenderer.render(this.scene, this.camera);
```

- The viewport container needs `position: relative` for the absolute positioning to work. This is already handled in styles.css (we added `position: relative` to `#viewport`).

**Step 3: Add labels to ParticleManager**

Read `src/renderer/particles/ParticleManager.ts` first. Then:

- Add import:
```typescript
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createParticleLabel, updateLabelText } from './ParticleLabels';
```

- Add to SceneParticle interface:
```typescript
  label?: CSS2DObject;
```

- In `addParticle()`, after creating the mesh and before `this.particles.set(id, sp)`, add:
```typescript
    const label = createParticleLabel(data);
    mesh.add(label);
    sp.label = label;
```

- In `setOrbital()`, after updating the orbital, update the label:
```typescript
    if (sp.label) updateLabelText(sp.label, sp.data);
```

- Add a method to toggle labels:
```typescript
  setLabelsVisible(visible: boolean): void {
    for (const sp of this.particles.values()) {
      if (sp.label) {
        sp.label.visible = visible;
      }
    }
  }
```

**Step 4: Add L key toggle in app.ts**

Read `src/renderer/app.ts` first. Add after the existing event listeners:

```typescript
// Toggle particle labels with L key
let labelsVisible = true;
document.addEventListener('keydown', (e) => {
  if (e.key === 'l' || e.key === 'L') {
    labelsVisible = !labelsVisible;
    particleManager.setLabelsVisible(labelsVisible);
  }
});
```

**Step 5: Verify**

```bash
npm start
```

Expected: Each particle shows a floating text label above it. Press L to toggle labels on/off. Labels stay camera-facing.

**Step 6: Commit**

```bash
git add src/renderer/particles/ParticleLabels.ts src/renderer/scene/SceneManager.ts src/renderer/particles/ParticleManager.ts src/renderer/app.ts
git commit -m "feat: add floating particle labels using CSS2DRenderer

Labels show particle type and orbital notation, togglable with L key.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Final Verification

**Files:**
- Various small fixes as needed

**Step 1: Verify all v0.2 features**

Run `npm start` and check:

1. App opens to scenario gallery (6 cards + sandbox)
2. Click "Hydrogen Ground State" card — loads scenario, panel shows layman description with 4 collapsible sections
3. Click "Show Science" — reveals scientific narrative, equations, constants
4. Click "Back to Scenarios" — returns to gallery
5. Load "Photon Absorption" — press play — photon moves in, gets absorbed, orbital changes. Description explains what's happening.
6. Click on a particle — panel shows particle properties. "Back to Description" returns to scenario info.
7. Load "Compton Scattering" and "Deuterium Formation" — verify they work
8. Particle labels visible above each particle, toggle with L key
9. Color legend in bottom-left corner of viewport
10. Toolbar no longer has scenario dropdown (removed)

**Step 2: Fix any issues**

**Step 3: Commit and tag**

```bash
git add -A
git commit -m "feat: v0.2 polish and verification

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git tag -a v0.2.0-beta -m "v0.2.0-beta: UI refinements, rich descriptions, particle labels"
git push && git push --tags
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Expand Scenario type, add descriptions to 4 existing scenarios |
| 2 | Add 2 new scenarios (Compton scattering, deuterium formation) |
| 3 | Create InfoPanel component (gallery + description + particle modes) |
| 4 | Update HTML/CSS/app wiring for new panel, add color legend |
| 5 | Add floating particle labels with CSS2DRenderer |
| 6 | Final verification and release |
