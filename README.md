# suigen

## Project Overview
Electron-based desktop application for real-time 3D visualization of quantum particle interactions within atomic-scale fermion fields. Scientifically accurate simulation with intuitive UI for educational and research purposes.

---

## Functional Requirements

### Core Visualization
- **3D rendering engine** for real-time fermion field visualization
- **Particle placement system**: User can add/remove particles (protons, neutrons, electrons, photons) at arbitrary 3D coordinates
- **Field calculations**: Compute and display quantum field interactions (electromagnetic, strong/weak nuclear forces where applicable)
- **Spatial constraint**: Maximum simulation volume = 1 atomic diameter (~0.1-0.5 nm depending on element)
- **Visual feedback**: Display field strength, probability densities, wave functions, force vectors

### Particle Types & Properties
- **Fermions**: Electrons, protons, neutrons (half-integer spin, Pauli exclusion)
- **Bosons**: Photons (integer spin, force carriers)
- Each particle type displays:
  - Position (x, y, z in femtometers/picometers)
  - Charge
  - Spin state
  - Energy level (for electrons: orbital quantum numbers)
  - Interaction range/field influence

### User Interface
- **3D viewport**: Rotate, zoom, pan controls (mouse/trackpad)
- **Particle toolbar**: Click to select particle type, click in 3D space to place
- **Properties panel**: Edit selected particle parameters (position, energy state)
- **Timeline/animation controls**: Play/pause simulation, adjust time scale
- **Measurement tools**: Distance between particles, field strength at point, energy calculations
- **Presets**: Load common configurations (hydrogen atom, helium nucleus, photon absorption scenarios)

### Physics Engine
- **Quantum electrodynamics (QED)**: Photon-electron interactions
- **Nuclear forces**: Strong force for nucleon binding (proton-proton, proton-neutron, neutron-neutron)
- **Electron orbitals**: Schrödinger equation solutions for probability clouds (s, p, d, f orbitals)
- **Pauli exclusion**: Prevent identical fermions in same quantum state
- **Uncertainty principle**: Heisenberg constraints on position-momentum visualization
- **Real-time recalculation**: Update fields on particle addition/removal/movement

### Accuracy & Validation
- Use established physical constants (Planck constant, fine structure constant, etc.)
- Cite quantum mechanics equations used (equations displayed in UI documentation)
- Validate against known atomic structures (hydrogen ground state, helium stability)
- Display approximation warnings when simplifications are made

---

## Technical Requirements

### Architecture
- **Main process**: Window management, file I/O, physics calculations (offload to worker threads)
- **Renderer process**: UI, 3D rendering, user input handling
- **IPC**: Communicate simulation state between main/renderer
- **Worker threads**: Heavy physics computations to avoid UI blocking

### Rendering Stack
- **WebGL 2.0**: 3D graphics via Three.js or Babylon.js
- **Shaders**: Custom GLSL for field visualization (gradient colors for field strength)
- **Particle representation**: Spheres for particles, volumetric rendering for probability clouds
- **Performance target**: 60fps with up to 100 particles (approximate upper bound for single atom)

### Physics Libraries
- Evaluate existing quantum simulation libraries (QuTiP, QuantumOptics.js) or implement custom solvers
- Matrix math: gl-matrix or mathjs for quantum state calculations
- Units: femtometers (10^-15 m) for spatial scale, electronvolts for energy

### Data Model
```javascript
{
  particles: [
    {
      id: uuid,
      type: "electron" | "proton" | "neutron" | "photon",
      position: {x, y, z}, // femtometers
      momentum: {px, py, pz}, // kg·m/s
      spin: -0.5 | 0.5 | 1 | -1, // ℏ units
      quantumState: {...} // orbital numbers, etc.
    }
  ],
  fieldGrid: [...], // 3D array of field values at discrete points
  simulationTime: number, // femtoseconds
  spatialBounds: {min, max} // enforce atomic scale
}
```

### Electron Configuration
- **Chromium version**: Latest stable (via Electron 30+)
- **Node integration**: Disabled in renderer (security)
- **Context isolation**: Enabled
- **Preload scripts**: Expose safe IPC channels to renderer
- **CSP**: Restrict inline scripts, allow WebGL

### File Operations
- **Save/load simulations**: JSON format with particle states
- **Export visualizations**: PNG/video capture of 3D viewport
- **Import presets**: Bundle educational scenarios (atomic configurations)

### Build & Distribution
- **Electron Forge** or **electron-builder** for packaging
- Target platforms: macOS (arm64/x64), Windows (x64), Linux (x64)
- Auto-updater integration (optional)
- Dev environment: Hot reload, DevTools enabled

---

## UI/UX Specifications

### Layout
```
┌─────────────────────────────────────────────┐
│ Menu Bar (File, Edit, View, Simulation)    │
├──────────┬──────────────────────┬───────────┤
│ Particle │                      │Properties │
│ Toolbar  │   3D Viewport        │ Panel     │
│          │   (WebGL Canvas)     │           │
│ [e⁻]     │                      │ Selected: │
│ [p⁺]     │                      │ Electron  │
│ [n⁰]     │                      │ x: 0.05nm │
│ [γ]      │                      │ y: 0.00nm │
│          │                      │ z: 0.02nm │
├──────────┴──────────────────────┴───────────┤
│ Timeline: [◀ ⏸ ▶] Speed: [1x▼] t=0.5fs    │
└─────────────────────────────────────────────┘
```

### Interaction Patterns
- **Add particle**: Select type from toolbar → click in viewport → particle appears with defaults
- **Move particle**: Drag existing particle in 3D (constrained to atomic bounds)
- **Delete particle**: Select → press Delete key or right-click menu
- **Adjust view**: Mouse drag (rotate), scroll (zoom), shift+drag (pan)
- **Measure**: Ruler tool to show distances/field values between points

### Visual Design
- **Color coding**: Electrons (blue), protons (red), neutrons (gray), photons (yellow)
- **Field visualization**: Heatmap gradient (blue=weak, red=strong)
- **Grid overlay**: Optional wireframe showing atomic scale boundaries
- **Axes**: X/Y/Z indicators with femtometer labels

---

## Performance Constraints
- **Max particles**: ~100 (sufficient for single atom + field interactions)
- **Field resolution**: Adaptive (higher detail near particles)
- **Frame rate**: ≥60fps on modern hardware (2020+ laptops)
- **Memory**: <500MB for typical simulation
- **Startup time**: <3 seconds

---

## Scientific Accuracy Checklist
- [ ] Correct fundamental constants (e, ℏ, c, etc.)
- [ ] Proper fermion/boson statistics
- [ ] Coulomb force law (1/r²) for electromagnetism
- [ ] Yukawa potential for strong force (exponential decay)
- [ ] Electron orbital shapes match Schrödinger solutions
- [ ] Energy conservation in interactions
- [ ] Spin quantum numbers enforced
- [ ] Heisenberg uncertainty: Δx·Δp ≥ ℏ/2

---

## Out of Scope (Future Enhancements)
- Multi-atom molecules
- Relativistic effects (fine for atomic scale)
- Quantum tunneling visualization
- Real-time collaboration
- VR/AR support

---

## Dependencies (Estimated)
- `electron` - Desktop framework
- `three.js` - 3D rendering
- `mathjs` - Linear algebra
- `uuid` - Particle IDs
- `electron-store` - Persist user settings

---

## Development Workflow
1. Scaffold Electron project with Forge/Builder
2. Implement basic 3D viewport (Three.js scene)
3. Add particle placement UI
4. Integrate physics engine (start with classical forces, add QM)
5. Build property editors
6. Optimize rendering performance
7. Add presets and educational content
8. Package for distribution

---

## Success Metrics
- User can construct a stable hydrogen atom (1 proton + 1 electron in ground state)
- Visualization matches textbook quantum orbital shapes
- No scientific inaccuracies flagged by domain experts during review
- Smooth interaction on target hardware