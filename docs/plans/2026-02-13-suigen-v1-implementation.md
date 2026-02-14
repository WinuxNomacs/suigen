# Suigen v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working Electron + Three.js app that visualizes quantum particle interactions inside an atom, with sandbox mode and preset scenarios.

**Architecture:** Scene-driven — Three.js scene is the source of truth. Physics are approximated using analytical solutions applied as animation rules in the render loop. Scenarios are JSON files with initial particle states and timed events.

**Tech Stack:** Electron (Forge + Vite), TypeScript, Three.js, plain HTML/CSS

**Design doc:** `docs/plans/2026-02-13-suigen-v1-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Replace: `.gitignore`
- Create: `package.json`, `tsconfig.json`, `forge.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- Create: `src/main/main.ts`, `src/main/preload.ts`
- Create: `src/renderer/index.html`, `src/renderer/app.ts`, `src/renderer/styles.css`

**Step 1: Initialize Electron Forge with Vite + TypeScript**

```bash
# Save existing files
cp README.md README.md.bak
cp -r docs docs.bak

# Initialize Electron Forge in a temp dir and copy config
npx create-electron-app@latest suigen-temp --template=vite-typescript
```

**Step 2: Copy Forge scaffolding into project root**

Copy from `suigen-temp` into project root:
- `package.json` (update name to "suigen", description to match README)
- `forge.config.ts`
- `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- `tsconfig.json`
- `src/` directory structure

Then restore `README.md`, `docs/`, and `LICENSE`.

**Step 3: Replace .gitignore with Node.js/Electron version**

```gitignore
node_modules/
out/
dist/
.vite/
*.tsbuildinfo
.DS_Store
```

**Step 4: Install Three.js**

```bash
npm install three
npm install -D @types/three
```

**Step 5: Restructure src/ to match design**

Rename/move files to match the design doc structure:
```
src/
├── main/
│   ├── main.ts          # (from Forge scaffold)
│   └── preload.ts       # (from Forge scaffold)
├── renderer/
│   ├── index.html       # (from Forge scaffold, update layout)
│   ├── app.ts           # (from Forge scaffold renderer entry)
│   ├── styles.css       # (from Forge scaffold, replace content)
│   ├── scene/           # (create empty)
│   ├── particles/       # (create empty)
│   ├── physics/         # (create empty)
│   ├── ui/              # (create empty)
│   └── scenarios/       # (create empty)
└── shared/              # (create empty)
```

**Step 6: Verify the app launches**

```bash
npm start
```

Expected: Electron window opens with default content. Close it.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron Forge project with Vite + TypeScript + Three.js"
```

---

## Task 2: Shared Types & Physical Constants

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`

**Step 1: Create shared types**

```typescript
// src/shared/types.ts

export type ParticleType = 'electron' | 'proton' | 'neutron' | 'photon';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalState {
  n: number; // principal quantum number (1-4)
  l: number; // angular momentum (0 to n-1)
  m: number; // magnetic (-l to +l)
}

export interface ParticleData {
  id: string;
  type: ParticleType;
  position: Vec3;
  momentum: Vec3;
  spin: number;
  orbital?: OrbitalState; // electrons only
  direction?: Vec3;       // photons only
  energy?: number;        // eV, photons only
}

export interface ScenarioEvent {
  time: number; // femtoseconds
  action: 'spawn' | 'absorb' | 'emit' | 'remove';
  particle?: Partial<ParticleData> & { type: ParticleType };
  photonIndex?: number;
  electronIndex?: number;
  targetOrbital?: OrbitalState;
}

export interface Scenario {
  name: string;
  description: string;
  particles: Array<Partial<ParticleData> & { type: ParticleType }>;
  events: ScenarioEvent[];
}

export interface SimulationState {
  playing: boolean;
  time: number;       // femtoseconds
  speed: number;      // multiplier
  particles: ParticleData[];
}
```

**Step 2: Create physical constants**

```typescript
// src/shared/constants.ts

// Fundamental constants (SI units unless noted)
export const PLANCK_CONSTANT = 6.62607015e-34;        // J·s
export const HBAR = 1.054571817e-34;                   // J·s (reduced Planck)
export const ELECTRON_CHARGE = 1.602176634e-19;        // C
export const ELECTRON_MASS = 9.1093837015e-31;         // kg
export const PROTON_MASS = 1.67262192369e-27;          // kg
export const NEUTRON_MASS = 1.67492749804e-27;         // kg
export const SPEED_OF_LIGHT = 2.99792458e8;            // m/s
export const FINE_STRUCTURE = 7.2973525693e-3;          // dimensionless
export const BOHR_RADIUS = 5.29177210903e-11;          // meters
export const COULOMB_CONSTANT = 8.9875517923e9;        // N·m²/C²
export const EV_TO_JOULES = 1.602176634e-19;           // J/eV

// Visualization scale: 1 unit in scene = 1 femtometer (1e-15 m)
export const FM_PER_UNIT = 1;
export const BOHR_RADIUS_FM = BOHR_RADIUS * 1e15;     // ~52917.7 fm

// Particle visual sizes (scene units, not physical scale)
export const PROTON_VISUAL_RADIUS = 3;
export const NEUTRON_VISUAL_RADIUS = 3;
export const ELECTRON_VISUAL_RADIUS = 1.5;
export const PHOTON_VISUAL_RADIUS = 1;

// Particle colors
export const PARTICLE_COLORS = {
  electron: 0x4488ff,
  proton: 0xff4444,
  neutron: 0x888888,
  photon: 0xffdd44,
} as const;

// Atomic boundary (hydrogen atom radius for default)
export const DEFAULT_ATOM_RADIUS_FM = 53000; // ~53 pm = 53000 fm

// Simulation defaults
export const DEFAULT_SPEED = 1;
export const TIME_STEP_FS = 0.1; // femtoseconds per simulation step
```

**Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types and physical constants"
```

---

## Task 3: Three.js Scene Setup

**Files:**
- Create: `src/renderer/scene/SceneManager.ts`
- Modify: `src/renderer/app.ts`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css`

**Step 1: Create SceneManager**

```typescript
// src/renderer/scene/SceneManager.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_ATOM_RADIUS_FM } from '../../shared/constants';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  private container: HTMLElement;
  private atomBoundary: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.container = container;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 500000);
    this.camera.position.set(80000, 60000, 80000);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xffffff, 1, 0);
    point.position.set(100000, 100000, 100000);
    this.scene.add(point);

    // Atom boundary sphere (translucent)
    const boundaryGeo = new THREE.SphereGeometry(DEFAULT_ATOM_RADIUS_FM, 32, 32);
    const boundaryMat = new THREE.MeshBasicMaterial({
      color: 0x4444aa,
      transparent: true,
      opacity: 0.05,
      wireframe: true,
    });
    this.atomBoundary = new THREE.Mesh(boundaryGeo, boundaryMat);
    this.scene.add(this.atomBoundary);

    // Axes helper
    const axes = new THREE.AxesHelper(DEFAULT_ATOM_RADIUS_FM * 1.2);
    this.scene.add(axes);

    // Handle resize
    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
```

**Step 2: Update index.html with app layout**

```html
<!-- src/renderer/index.html -->
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
      <button class="particle-btn" data-type="electron" title="Electron">e⁻</button>
      <button class="particle-btn" data-type="proton" title="Proton">p⁺</button>
      <button class="particle-btn" data-type="neutron" title="Neutron">n⁰</button>
      <button class="particle-btn" data-type="photon" title="Photon">&gamma;</button>
    </div>
    <div id="viewport"></div>
    <div id="properties">
      <h3>Properties</h3>
      <div id="properties-content">
        <p class="hint">Select a particle</p>
      </div>
    </div>
    <div id="timeline">
      <button id="btn-step-back" title="Step back">&laquo;</button>
      <button id="btn-play" title="Play/Pause">&#9654;</button>
      <button id="btn-step-fwd" title="Step forward">&raquo;</button>
      <label>Speed: <input id="speed" type="range" min="0.1" max="10" step="0.1" value="1" /></label>
      <span id="time-display">t = 0.0 fs</span>
    </div>
  </div>
  <script type="module" src="app.ts"></script>
</body>
</html>
```

**Step 3: Create styles.css**

```css
/* src/renderer/styles.css */
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
  grid-template-columns: 60px 1fr 200px;
  grid-template-rows: 1fr 48px;
  height: 100vh;
}

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

#viewport {
  grid-row: 1;
  grid-column: 2;
  overflow: hidden;
}

#properties {
  grid-row: 1;
  grid-column: 3;
  padding: 12px;
  background: #111122;
  border-left: 1px solid #222;
  overflow-y: auto;
}

#properties h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #88aaff;
}

.hint { color: #666; font-size: 12px; }

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
```

**Step 4: Update app.ts to initialize scene**

```typescript
// src/renderer/app.ts
import { SceneManager } from './scene/SceneManager';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
```

**Step 5: Verify the app launches with 3D viewport**

```bash
npm start
```

Expected: Dark window with translucent wireframe sphere (atom boundary), XYZ axes, orbit controls working (drag to rotate, scroll to zoom).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Three.js scene with atom boundary, axes, and orbit controls"
```

---

## Task 4: Particle Rendering

**Files:**
- Create: `src/renderer/particles/ParticleFactory.ts`
- Create: `src/renderer/particles/ParticleManager.ts`
- Modify: `src/renderer/app.ts`

**Step 1: Create ParticleFactory**

Creates Three.js meshes for each particle type.

```typescript
// src/renderer/particles/ParticleFactory.ts
import * as THREE from 'three';
import {
  ParticleType,
  PARTICLE_COLORS,
  PROTON_VISUAL_RADIUS,
  NEUTRON_VISUAL_RADIUS,
  ELECTRON_VISUAL_RADIUS,
  PHOTON_VISUAL_RADIUS,
} from '../../shared/constants';

export function createParticleMesh(type: ParticleType): THREE.Mesh {
  const colorHex = PARTICLE_COLORS[type];
  const color = new THREE.Color(colorHex);

  let radius: number;
  switch (type) {
    case 'proton':   radius = PROTON_VISUAL_RADIUS; break;
    case 'neutron':  radius = NEUTRON_VISUAL_RADIUS; break;
    case 'electron': radius = ELECTRON_VISUAL_RADIUS; break;
    case 'photon':   radius = PHOTON_VISUAL_RADIUS; break;
  }

  const geometry = new THREE.SphereGeometry(radius, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Add glow sprite
  const spriteMat = new THREE.SpriteMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.scale.set(radius * 6, radius * 6, 1);
  mesh.add(glow);

  return mesh;
}
```

**Step 2: Create ParticleManager**

Manages the collection of particles in the scene.

```typescript
// src/renderer/particles/ParticleManager.ts
import * as THREE from 'three';
import { ParticleData, ParticleType, Vec3 } from '../../shared/types';
import { createParticleMesh } from './ParticleFactory';

interface SceneParticle {
  data: ParticleData;
  mesh: THREE.Mesh;
}

let nextId = 1;

export class ParticleManager {
  private particles: Map<string, SceneParticle> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addParticle(type: ParticleType, position: Vec3, extra?: Partial<ParticleData>): ParticleData {
    const id = `p${nextId++}`;
    const data: ParticleData = {
      id,
      type,
      position: { ...position },
      momentum: { x: 0, y: 0, z: 0 },
      spin: type === 'photon' ? 1 : 0.5,
      ...extra,
    };

    const mesh = createParticleMesh(type);
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData.particleId = id;
    this.scene.add(mesh);

    this.particles.set(id, { data, mesh });
    return data;
  }

  removeParticle(id: string): void {
    const sp = this.particles.get(id);
    if (sp) {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      (sp.mesh.material as THREE.Material).dispose();
      this.particles.delete(id);
    }
  }

  getParticle(id: string): SceneParticle | undefined {
    return this.particles.get(id);
  }

  getAllParticles(): ParticleData[] {
    return Array.from(this.particles.values()).map(sp => sp.data);
  }

  updatePosition(id: string, pos: Vec3): void {
    const sp = this.particles.get(id);
    if (sp) {
      sp.data.position = { ...pos };
      sp.mesh.position.set(pos.x, pos.y, pos.z);
    }
  }

  getMeshById(id: string): THREE.Mesh | undefined {
    return this.particles.get(id)?.mesh;
  }

  getAllMeshes(): THREE.Mesh[] {
    return Array.from(this.particles.values()).map(sp => sp.mesh);
  }

  clear(): void {
    for (const [id] of this.particles) {
      this.removeParticle(id);
    }
  }
}
```

**Step 3: Update app.ts to add a test proton at the origin**

```typescript
// src/renderer/app.ts
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);
const particleManager = new ParticleManager(sceneManager.scene);

// Test: place a proton at the origin
particleManager.addParticle('proton', { x: 0, y: 0, z: 0 });

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
```

**Step 4: Verify**

```bash
npm start
```

Expected: Red glowing sphere at origin inside the wireframe boundary.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add particle factory and manager with glowing particle meshes"
```

---

## Task 5: Orbital Visualization (1s and 2p)

**Files:**
- Create: `src/renderer/particles/OrbitalMesh.ts`
- Modify: `src/renderer/particles/ParticleManager.ts`

**Step 1: Create OrbitalMesh**

Generates Three.js meshes representing electron orbital probability clouds using spherical harmonics.

```typescript
// src/renderer/particles/OrbitalMesh.ts
import * as THREE from 'three';
import { OrbitalState } from '../../shared/types';
import { BOHR_RADIUS_FM } from '../../shared/constants';

/**
 * Create a mesh representing an electron orbital.
 * Uses parametric geometry shaped by spherical harmonics.
 */
export function createOrbitalMesh(orbital: OrbitalState): THREE.Object3D {
  const { n, l, m } = orbital;
  const group = new THREE.Group();

  // Scale factor: orbital radius ~ n² * a₀
  const scale = n * n * BOHR_RADIUS_FM * 0.4;

  if (l === 0) {
    // s orbital: spherical shell
    const geo = new THREE.SphereGeometry(scale, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(geo, mat));

    // Inner denser region
    const innerGeo = new THREE.SphereGeometry(scale * 0.5, 24, 24);
    const innerMat = mat.clone();
    innerMat.opacity = 0.08;
    group.add(new THREE.Mesh(innerGeo, innerMat));
  } else if (l === 1) {
    // p orbital: two lobes along an axis
    const lobeMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Create elongated sphere (lobe) using scaled sphere
    for (const sign of [1, -1]) {
      const lobeGeo = new THREE.SphereGeometry(scale * 0.6, 24, 24);
      const lobe = new THREE.Mesh(lobeGeo, lobeMat.clone());

      // Determine axis from m quantum number
      if (m === 0) {
        lobe.position.set(0, sign * scale * 0.5, 0);
        lobe.scale.set(0.6, 1.2, 0.6); // elongated along Y
      } else if (Math.abs(m) === 1) {
        if (m === 1) {
          lobe.position.set(sign * scale * 0.5, 0, 0);
          lobe.scale.set(1.2, 0.6, 0.6); // elongated along X
        } else {
          lobe.position.set(0, 0, sign * scale * 0.5);
          lobe.scale.set(0.6, 0.6, 1.2); // elongated along Z
        }
      }
      group.add(lobe);
    }
  }
  // d and f orbitals deferred for now

  return group;
}
```

**Step 2: Add orbital support to ParticleManager**

In `ParticleManager`, when adding an electron with an orbital state, also add the orbital mesh:

Add to the `SceneParticle` interface:
```typescript
interface SceneParticle {
  data: ParticleData;
  mesh: THREE.Mesh;
  orbitalMesh?: THREE.Object3D;
}
```

In `addParticle()`, after adding the mesh, if the particle is an electron with an orbital:
```typescript
if (type === 'electron' && data.orbital) {
  const orbitalMesh = createOrbitalMesh(data.orbital);
  this.scene.add(orbitalMesh);
  this.particles.set(id, { data, mesh, orbitalMesh });
} else {
  this.particles.set(id, { data, mesh });
}
```

Add import for `createOrbitalMesh` from `./OrbitalMesh`.

In `removeParticle()`, also remove the orbital mesh if present.

Add a method to update the orbital (for transitions):
```typescript
setOrbital(id: string, orbital: OrbitalState): void {
  const sp = this.particles.get(id);
  if (!sp || sp.data.type !== 'electron') return;
  if (sp.orbitalMesh) {
    this.scene.remove(sp.orbitalMesh);
  }
  sp.data.orbital = { ...orbital };
  sp.orbitalMesh = createOrbitalMesh(orbital);
  this.scene.add(sp.orbitalMesh);
}
```

**Step 3: Test with hydrogen atom**

Update `app.ts`:
```typescript
particleManager.addParticle('proton', { x: 0, y: 0, z: 0 });
particleManager.addParticle('electron', { x: 0, y: 0, z: 0 }, {
  orbital: { n: 1, l: 0, m: 0 },
});
```

**Step 4: Verify**

```bash
npm start
```

Expected: Red proton at center, translucent blue spherical cloud (1s orbital) around it.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add electron orbital visualization with spherical harmonics"
```

---

## Task 6: Photon Rendering (Wave Packet)

**Files:**
- Create: `src/renderer/particles/PhotonTrail.ts`
- Modify: `src/renderer/particles/ParticleFactory.ts`

**Step 1: Create PhotonTrail**

A sine-wave trail behind a moving photon.

```typescript
// src/renderer/particles/PhotonTrail.ts
import * as THREE from 'three';

export class PhotonTrail {
  private line: THREE.Line;
  private points: THREE.Vector3[] = [];
  private geometry: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    const material = new THREE.LineBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.geometry = new THREE.BufferGeometry();
    this.line = new THREE.Line(this.geometry, material);
    scene.add(this.line);
  }

  /**
   * Update the trail to show a sine wave behind the photon.
   * @param position Current photon position
   * @param direction Normalized direction of travel
   * @param time Current simulation time (for wave animation)
   */
  update(position: THREE.Vector3, direction: THREE.Vector3, time: number): void {
    this.points = [];
    const wavelength = 2000; // visual wavelength in scene units
    const amplitude = 800;
    const trailLength = 20000;
    const segments = 100;

    // Build a perpendicular vector for the sine oscillation
    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(direction, up).normalize();
    if (perp.length() < 0.1) {
      perp.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
    }

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const dist = t * trailLength;
      const p = position.clone().sub(direction.clone().multiplyScalar(dist));
      const wave = Math.sin((dist / wavelength) * Math.PI * 2 + time * 0.01) * amplitude * (1 - t);
      p.add(perp.clone().multiplyScalar(wave));
      this.points.push(p);
    }

    this.geometry.setFromPoints(this.points);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.line);
    this.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add photon wave packet trail visualization"
```

---

## Task 7: Simulation Engine

**Files:**
- Create: `src/renderer/physics/SimulationEngine.ts`
- Modify: `src/renderer/app.ts`

**Step 1: Create SimulationEngine**

Manages simulation time, processes scenario events, and updates particle positions per frame.

```typescript
// src/renderer/physics/SimulationEngine.ts
import { ScenarioEvent, SimulationState, ParticleData, ParticleType, Vec3 } from '../../shared/types';
import { TIME_STEP_FS } from '../../shared/constants';
import { ParticleManager } from '../particles/ParticleManager';

export class SimulationEngine {
  state: SimulationState;
  private events: ScenarioEvent[] = [];
  private processedEventIndices: Set<number> = new Set();
  private particleManager: ParticleManager;
  private onEvent?: (event: ScenarioEvent, particleIds: string[]) => void;

  constructor(particleManager: ParticleManager) {
    this.particleManager = particleManager;
    this.state = {
      playing: false,
      time: 0,
      speed: 1,
      particles: [],
    };
  }

  loadScenario(particles: Array<Partial<ParticleData> & { type: ParticleType }>, events: ScenarioEvent[]): void {
    this.particleManager.clear();
    this.state.time = 0;
    this.state.particles = [];
    this.processedEventIndices.clear();
    this.events = [...events];

    for (const p of particles) {
      const pos = p.position || { x: 0, y: 0, z: 0 };
      const data = this.particleManager.addParticle(p.type, pos, p);
      this.state.particles.push(data);
    }
  }

  setOnEvent(cb: (event: ScenarioEvent, particleIds: string[]) => void): void {
    this.onEvent = cb;
  }

  play(): void { this.state.playing = true; }
  pause(): void { this.state.playing = false; }
  togglePlay(): void { this.state.playing = !this.state.playing; }
  setSpeed(s: number): void { this.state.speed = s; }

  stepForward(): void {
    this.tick(TIME_STEP_FS * 10);
  }

  stepBack(): void {
    // Simple: reload and fast-forward to time - step
    // For v1, just prevent going below 0
    this.state.time = Math.max(0, this.state.time - TIME_STEP_FS * 10);
  }

  tick(deltaFs: number): void {
    if (!this.state.playing && deltaFs === 0) return;

    const dt = deltaFs * this.state.speed;
    this.state.time += dt;

    // Process events that should fire at this time
    for (let i = 0; i < this.events.length; i++) {
      if (this.processedEventIndices.has(i)) continue;
      const event = this.events[i];
      if (this.state.time >= event.time) {
        this.processedEventIndices.add(i);
        this.processEvent(event);
      }
    }

    // Move photons along their direction
    for (const pd of this.state.particles) {
      if (pd.type === 'photon' && pd.direction) {
        const speed = 50; // scene units per fs (slowed for visualization)
        pd.position.x += pd.direction.x * speed * dt;
        pd.position.y += pd.direction.y * speed * dt;
        pd.position.z += pd.direction.z * speed * dt;
        this.particleManager.updatePosition(pd.id, pd.position);
      }
    }
  }

  private processEvent(event: ScenarioEvent): void {
    const ids: string[] = [];

    switch (event.action) {
      case 'spawn': {
        if (event.particle) {
          const pos = event.particle.position || { x: 0, y: 0, z: 0 };
          const data = this.particleManager.addParticle(event.particle.type, pos, event.particle as Partial<ParticleData>);
          this.state.particles.push(data);
          ids.push(data.id);
        }
        break;
      }
      case 'absorb': {
        // Remove photon, transition electron orbital
        if (event.photonIndex !== undefined && event.electronIndex !== undefined && event.targetOrbital) {
          const photon = this.state.particles[event.photonIndex];
          const electron = this.state.particles[event.electronIndex];
          if (photon) {
            this.particleManager.removeParticle(photon.id);
            ids.push(photon.id);
          }
          if (electron) {
            this.particleManager.setOrbital(electron.id, event.targetOrbital);
            electron.orbital = { ...event.targetOrbital };
            ids.push(electron.id);
          }
        }
        break;
      }
      case 'emit': {
        // Transition electron orbital down, spawn photon
        if (event.electronIndex !== undefined && event.targetOrbital && event.particle) {
          const electron = this.state.particles[event.electronIndex];
          if (electron) {
            this.particleManager.setOrbital(electron.id, event.targetOrbital);
            electron.orbital = { ...event.targetOrbital };
            ids.push(electron.id);
          }
          const pos = event.particle.position || { x: 0, y: 0, z: 0 };
          const photonData = this.particleManager.addParticle('photon', pos, event.particle as Partial<ParticleData>);
          this.state.particles.push(photonData);
          ids.push(photonData.id);
        }
        break;
      }
      case 'remove': {
        if (event.particle && event.photonIndex !== undefined) {
          const p = this.state.particles[event.photonIndex];
          if (p) {
            this.particleManager.removeParticle(p.id);
            ids.push(p.id);
          }
        }
        break;
      }
    }

    if (this.onEvent) {
      this.onEvent(event, ids);
    }
  }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add simulation engine with event processing and photon movement"
```

---

## Task 8: Scenario Loader & Preset Scenarios

**Files:**
- Create: `scenarios/hydrogen-ground-state.json`
- Create: `scenarios/photon-absorption.json`
- Create: `scenarios/photon-emission.json`
- Create: `scenarios/helium-atom.json`
- Create: `src/renderer/scenarios/ScenarioLoader.ts`

**Step 1: Create scenario JSON files**

```json
// scenarios/hydrogen-ground-state.json
{
  "name": "Hydrogen Ground State",
  "description": "A single hydrogen atom: 1 proton and 1 electron in the 1s orbital",
  "particles": [
    { "type": "proton", "position": { "x": 0, "y": 0, "z": 0 } },
    { "type": "electron", "position": { "x": 0, "y": 0, "z": 0 }, "orbital": { "n": 1, "l": 0, "m": 0 } }
  ],
  "events": []
}
```

```json
// scenarios/photon-absorption.json
{
  "name": "Photon Absorption",
  "description": "A photon is absorbed by a hydrogen atom, exciting the electron from 1s to 2p",
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

```json
// scenarios/photon-emission.json
{
  "name": "Photon Emission",
  "description": "An excited hydrogen atom emits a photon as the electron drops from 2p to 1s",
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

```json
// scenarios/helium-atom.json
{
  "name": "Helium Atom",
  "description": "Helium: 2 protons, 2 neutrons, 2 electrons (spin up and spin down in 1s)",
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

**Step 2: Create ScenarioLoader**

```typescript
// src/renderer/scenarios/ScenarioLoader.ts
import { Scenario } from '../../shared/types';

// Import scenarios statically (bundled by Vite)
import hydrogenGroundState from '../../../scenarios/hydrogen-ground-state.json';
import photonAbsorption from '../../../scenarios/photon-absorption.json';
import photonEmission from '../../../scenarios/photon-emission.json';
import heliumAtom from '../../../scenarios/helium-atom.json';

const PRESETS: Record<string, Scenario> = {
  'hydrogen-ground-state': hydrogenGroundState as unknown as Scenario,
  'photon-absorption': photonAbsorption as unknown as Scenario,
  'photon-emission': photonEmission as unknown as Scenario,
  'helium-atom': heliumAtom as unknown as Scenario,
};

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function loadPreset(name: string): Scenario | undefined {
  return PRESETS[name];
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add preset scenario JSON files and scenario loader"
```

---

## Task 9: UI Wiring (Toolbar, Timeline, Properties)

**Files:**
- Create: `src/renderer/ui/Toolbar.ts`
- Create: `src/renderer/ui/Timeline.ts`
- Create: `src/renderer/ui/PropertiesPanel.ts`
- Create: `src/renderer/ui/ScenarioMenu.ts`
- Modify: `src/renderer/index.html` (add scenario dropdown)
- Modify: `src/renderer/app.ts` (wire everything together)

**Step 1: Create Toolbar**

```typescript
// src/renderer/ui/Toolbar.ts
import { ParticleType } from '../../shared/types';

export class Toolbar {
  private selectedType: ParticleType | null = null;
  private buttons: NodeListOf<HTMLButtonElement>;
  private onSelect?: (type: ParticleType | null) => void;

  constructor() {
    this.buttons = document.querySelectorAll('.particle-btn');
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type as ParticleType;
        if (this.selectedType === type) {
          this.selectedType = null;
          btn.classList.remove('active');
        } else {
          this.buttons.forEach(b => b.classList.remove('active'));
          this.selectedType = type;
          btn.classList.add('active');
        }
        this.onSelect?.(this.selectedType);
      });
    });
  }

  setOnSelect(cb: (type: ParticleType | null) => void): void {
    this.onSelect = cb;
  }

  getSelectedType(): ParticleType | null {
    return this.selectedType;
  }

  clearSelection(): void {
    this.selectedType = null;
    this.buttons.forEach(b => b.classList.remove('active'));
  }
}
```

**Step 2: Create Timeline**

```typescript
// src/renderer/ui/Timeline.ts
import { SimulationEngine } from '../physics/SimulationEngine';

export class Timeline {
  private engine: SimulationEngine;
  private btnPlay: HTMLButtonElement;
  private timeDisplay: HTMLSpanElement;
  private speedInput: HTMLInputElement;

  constructor(engine: SimulationEngine) {
    this.engine = engine;
    this.btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    this.timeDisplay = document.getElementById('time-display') as HTMLSpanElement;
    this.speedInput = document.getElementById('speed') as HTMLInputElement;

    this.btnPlay.addEventListener('click', () => {
      engine.togglePlay();
      this.btnPlay.textContent = engine.state.playing ? '\u23F8' : '\u25B6';
    });

    document.getElementById('btn-step-back')!.addEventListener('click', () => {
      engine.stepBack();
    });

    document.getElementById('btn-step-fwd')!.addEventListener('click', () => {
      engine.stepForward();
    });

    this.speedInput.addEventListener('input', () => {
      engine.setSpeed(parseFloat(this.speedInput.value));
    });
  }

  update(): void {
    this.timeDisplay.textContent = `t = ${this.engine.state.time.toFixed(1)} fs`;
  }
}
```

**Step 3: Create PropertiesPanel**

```typescript
// src/renderer/ui/PropertiesPanel.ts
import { ParticleData } from '../../shared/types';

export class PropertiesPanel {
  private content: HTMLElement;

  constructor() {
    this.content = document.getElementById('properties-content')!;
  }

  showParticle(p: ParticleData): void {
    const orbitalStr = p.orbital ? `n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}` : '';
    this.content.innerHTML = `
      <p><strong>${p.type}</strong></p>
      <p>x: ${p.position.x.toFixed(1)} fm</p>
      <p>y: ${p.position.y.toFixed(1)} fm</p>
      <p>z: ${p.position.z.toFixed(1)} fm</p>
      <p>spin: ${p.spin}</p>
      ${orbitalStr ? `<p>orbital: ${orbitalStr}</p>` : ''}
    `;
  }

  clear(): void {
    this.content.innerHTML = '<p class="hint">Select a particle</p>';
  }
}
```

**Step 4: Create ScenarioMenu**

Add a dropdown to index.html in the toolbar area:

```html
<!-- Add after particle buttons in #toolbar -->
<hr style="border-color: #333; margin: 8px 0;" />
<select id="scenario-select" style="width: 44px; font-size: 10px; background: #1a1a2e; color: #ccc; border: 1px solid #444; border-radius: 4px; padding: 2px;" title="Load scenario">
  <option value="">Presets</option>
  <option value="hydrogen-ground-state">H</option>
  <option value="photon-absorption">Abs</option>
  <option value="photon-emission">Emit</option>
  <option value="helium-atom">He</option>
</select>
```

```typescript
// src/renderer/ui/ScenarioMenu.ts
import { loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';

export class ScenarioMenu {
  constructor(engine: SimulationEngine) {
    const select = document.getElementById('scenario-select') as HTMLSelectElement;
    select.addEventListener('change', () => {
      const name = select.value;
      if (!name) return;
      const scenario = loadPreset(name);
      if (scenario) {
        engine.loadScenario(scenario.particles, scenario.events);
      }
      select.value = '';
    });
  }
}
```

**Step 5: Wire everything in app.ts**

```typescript
// src/renderer/app.ts
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';
import { SimulationEngine } from './physics/SimulationEngine';
import { Toolbar } from './ui/Toolbar';
import { Timeline } from './ui/Timeline';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { ScenarioMenu } from './ui/ScenarioMenu';
import { TIME_STEP_FS } from '../shared/constants';
import { ParticleType } from '../shared/types';

// Initialize
const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);
const particleManager = new ParticleManager(sceneManager.scene);
const engine = new SimulationEngine(particleManager);

const toolbar = new Toolbar();
const timeline = new Timeline(engine);
const properties = new PropertiesPanel();
new ScenarioMenu(engine);

// Raycaster for click-to-place and selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

viewport.addEventListener('click', (event) => {
  const rect = viewport.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, sceneManager.camera);

  const selectedType = toolbar.getSelectedType();

  if (selectedType) {
    // Place particle: intersect with a plane at y=0
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
    // Try to select existing particle
    const meshes = particleManager.getAllMeshes();
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const id = intersects[0].object.userData.particleId;
      const p = particleManager.getParticle(id);
      if (p) properties.showParticle(p.data);
    } else {
      properties.clear();
    }
  }
});

// Delete selected particle on Delete/Backspace
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // For v1, simple delete not implemented yet
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
    // Convert real seconds to femtoseconds (1 real second = 100 fs at speed 1)
    engine.tick(deltaSec * 100);
  }

  timeline.update();
  sceneManager.render();
}

animate();
```

**Step 6: Verify**

```bash
npm start
```

Expected: Full UI with toolbar, viewport, properties panel, timeline. Select "H" from presets dropdown to see hydrogen atom. Click play to start simulation. Select "Abs" to see photon absorption scenario.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire up toolbar, timeline, properties panel, and scenario menu"
```

---

## Task 10: Photon Trail Integration

**Files:**
- Modify: `src/renderer/particles/ParticleManager.ts`
- Modify: `src/renderer/app.ts`

**Step 1: Add PhotonTrail to ParticleManager**

When adding a photon, create a PhotonTrail. Add an `updateTrails(time: number)` method that updates all photon trails each frame.

```typescript
import { PhotonTrail } from './PhotonTrail';

// In SceneParticle interface, add:
trail?: PhotonTrail;

// In addParticle, after creating mesh for photon:
if (type === 'photon') {
  const trail = new PhotonTrail(this.scene);
  this.particles.set(id, { data, mesh, trail });
}

// In removeParticle, dispose trail if present:
if (sp.trail) sp.trail.dispose(this.scene);

// New method:
updateTrails(time: number): void {
  for (const sp of this.particles.values()) {
    if (sp.trail && sp.data.type === 'photon' && sp.data.direction) {
      const pos = new THREE.Vector3(sp.data.position.x, sp.data.position.y, sp.data.position.z);
      const dir = new THREE.Vector3(sp.data.direction.x, sp.data.direction.y, sp.data.direction.z).normalize();
      sp.trail.update(pos, dir, time);
    }
  }
}
```

**Step 2: Call updateTrails in the animation loop**

In `app.ts`, inside `animate()` after `engine.tick()`:
```typescript
particleManager.updateTrails(engine.state.time);
```

**Step 3: Verify**

```bash
npm start
```

Load "Photon Absorption" preset and press play. Expected: Yellow photon moves toward nucleus with a trailing sine wave behind it.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate photon wave trail into particle manager and render loop"
```

---

## Task 11: Final Polish & Verification

**Files:**
- Modify: `src/main/main.ts` (window title, size)
- Various small fixes

**Step 1: Set window properties**

In `src/main/main.ts`, set the BrowserWindow options:
```typescript
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  title: 'Suigen',
  // ... existing webPreferences
});
```

**Step 2: Verify all milestone items**

Run `npm start` and check each milestone item:

1. Launch app → see 3D viewport with atom boundary sphere and axes
2. Load "Hydrogen Ground State" → see red proton + blue orbital cloud
3. Load "Photon Absorption" → press play → watch photon travel in with wave trail, get absorbed, orbital transitions from small sphere (1s) to p-shaped lobes (2p)
4. Select proton from toolbar → click in viewport → particle appears
5. Drag to rotate, scroll to zoom, shift+drag to pan
6. Play/pause buttons work, step forward/back, speed slider, time display updates

**Step 3: Fix any issues found during verification**

Address any bugs or visual issues.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish window settings and verify v1 milestone"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project scaffolding (Electron Forge + Three.js) | 7 |
| 2 | Shared types & physical constants | 3 |
| 3 | Three.js scene setup with atom boundary | 6 |
| 4 | Particle rendering (factory + manager) | 5 |
| 5 | Orbital visualization (1s, 2p) | 5 |
| 6 | Photon wave packet trail | 2 |
| 7 | Simulation engine | 2 |
| 8 | Scenario loader & preset JSONs | 3 |
| 9 | UI wiring (toolbar, timeline, properties, scenarios) | 7 |
| 10 | Photon trail integration | 4 |
| 11 | Final polish & verification | 4 |
