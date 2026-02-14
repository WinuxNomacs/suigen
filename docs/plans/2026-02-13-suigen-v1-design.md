# Suigen v1 Design

## Purpose

Help curious non-scientists visually conceptualize fermion-level physical interactions within an atom. The visualization should be self-explanatory — if it needs text to explain what's happening, the visuals aren't good enough yet.

**Primary example use case**: Watching step-by-step as a photon propagates through a single atom, gets absorbed by an electron, and causes an orbital transition.

## Key Decisions

- **Audience**: Curious general public — visual appeal and clarity over mathematical rigor
- **Mode**: Sandbox (free particle placement) + preset scenarios (guided interactions)
- **Narration**: Minimal — visuals speak, info available on hover/click but not forced
- **Rendering**: Three.js on Electron
- **Physics**: Approximated visuals using analytical solutions (not numerical solvers)
- **Architecture**: Scene-driven — Three.js scene is source of truth, physics as animation rules

---

## Application Shell

**Electron app** with context isolation, preload script for safe IPC.

- **Main process**: Window management, file I/O (save/load scenarios)
- **Renderer process**: Single window with full UI and 3D scene
- **No worker threads initially** — analytical physics is lightweight enough for the animation loop

**Project structure:**

```
suigen/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── renderer/       # UI + 3D
│   │   ├── index.html
│   │   ├── app.ts      # Entry point
│   │   ├── scene/      # Three.js scene management
│   │   ├── particles/  # Particle types & behaviors
│   │   ├── physics/    # Analytical physics rules
│   │   ├── ui/         # Toolbar, panels, timeline
│   │   └── scenarios/  # Preset scenario loader
│   └── shared/         # Types, constants, physical constants
├── scenarios/          # JSON scenario files
├── package.json
└── tsconfig.json
```

TypeScript throughout. Electron Forge for scaffolding and packaging.

---

## 3D Scene & Particle System

### Scene

- Dark background with subtle ambient lighting
- Translucent sphere showing atomic boundary (~0.1-0.5nm)
- XYZ axes with femtometer-scale grid (toggleable)
- OrbitControls for rotate/zoom/pan

### Particle Rendering

| Particle | Visual | Color |
|----------|--------|-------|
| Electron | Small glowing sphere + translucent orbital cloud | Blue |
| Proton | Sphere (~1fm scale representation) | Red |
| Neutron | Sphere (similar size to protons) | Gray |
| Photon | Point light with trailing wave animation | Yellow |

Each particle has a subtle glow/bloom effect.

### Orbital Visualization

- Pre-computed spherical harmonic meshes for s, p, d, f orbitals
- Rendered as translucent volumetric shells around the nucleus
- Color intensity maps to probability density
- Smooth morphing animation when electron transitions between energy levels

### Camera & Interaction

- Raycasting for click-to-select and click-to-place
- Drag particles with position constrained to atomic bounds
- Hover shows minimal tooltip (particle type, energy state)

---

## Physics & Animation Rules

The "physics engine" is a set of animation rules based on known analytical physics.

### Electromagnetic Interactions

- Coulomb attraction/repulsion visualized as force lines between charged particles
- Field strength shown via color gradients in surrounding space
- Photon-electron interaction: photon approaches, absorbed, electron orbital changes with smooth morph

### Electron Orbitals

- Analytical hydrogen-like wavefunctions: ψ(n,l,m) = R(n,l) * Y(l,m)
- Pre-compute orbital shapes for n=1-4, all valid l,m combinations
- Transition animations: smooth interpolation between orbital shapes (~500ms)
- Ground state placement automatic when electron added near nucleus

### Nuclear Forces

- Proton-neutron binding visualized as short-range attractive field (Yukawa-style falloff)
- Proton-proton repulsion visible but overcome by strong force at nuclear distances
- Visual: pulsing glow between bound nucleons

### Photon Propagation

- Photon modeled as traveling wave packet (sine wave along direction of travel)
- Speed slowed dramatically for visualization
- On absorption: wave packet collapses into electron, orbital transitions
- On emission: orbital drops, photon wave packet emerges

### Time Controls

- Adjustable playback speed
- Step forward/backward through key interaction moments
- Pause to inspect current state

---

## UI Layout

```
┌─────────────────────────────────────────────┐
│ Menu Bar (File, Edit, View, Simulation)     │
├──────────┬──────────────────────┬───────────┤
│ Particle │                      │Properties │
│ Toolbar  │   3D Viewport        │ Panel     │
│          │   (WebGL Canvas)     │           │
│ [e⁻]    │                      │ Selected: │
│ [p⁺]    │                      │ Electron  │
│ [n⁰]    │                      │ x: 0.05nm │
│ [γ]     │                      │ y: 0.00nm │
│          │                      │ z: 0.02nm │
├──────────┴──────────────────────┴───────────┤
│ Timeline: [◀ ⏸ ▶] Speed: [1x▼] t=0.5fs    │
└─────────────────────────────────────────────┘
```

Plain HTML/CSS, CSS Grid layout, dark theme. No heavy UI framework.

---

## Scenario System

Scenarios are JSON files defining initial particle states and timed events.

```json
{
  "name": "Photon Absorption",
  "description": "A photon is absorbed by a hydrogen atom",
  "particles": [
    { "type": "proton", "position": [0, 0, 0] },
    { "type": "electron", "orbital": { "n": 1, "l": 0, "m": 0 } }
  ],
  "events": [
    {
      "time": 0,
      "action": "spawn",
      "particle": { "type": "photon", "position": [-500, 0, 0], "direction": [1, 0, 0], "energy": 10.2 }
    },
    {
      "time": 200,
      "action": "absorb",
      "photon": 2,
      "electron": 1,
      "targetOrbital": { "n": 2, "l": 1, "m": 0 }
    }
  ]
}
```

### Bundled Presets (v1)

1. **Hydrogen ground state** — 1 proton + 1 electron in 1s orbital
2. **Photon absorption** — photon hits hydrogen, electron jumps to 2p
3. **Photon emission** — excited electron drops back, emits photon
4. **Helium atom** — 2 protons, 2 neutrons, 2 electrons showing Pauli exclusion

---

## First Milestone

A working app where you can:

1. Launch the app and see a 3D viewport with atom boundary
2. Load "Hydrogen ground state" and see a proton + electron orbital
3. Load "Photon absorption" and watch a photon propagate in, get absorbed, and the electron orbital transition from 1s to 2p
4. Place/remove particles manually in sandbox mode
5. Rotate/zoom/pan the 3D view
6. Play/pause/step through time

## Deferred

- Measurement tools
- Save/load user files
- Export video/PNG
- Auto-updater
- Advanced orbitals beyond n=4
- Multi-atom molecules
