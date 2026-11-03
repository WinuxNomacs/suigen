import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';
import { particleIdOf } from './particles/ParticleFactory';
import { SimulationEngine } from './physics/SimulationEngine';
import { Toolbar } from './ui/Toolbar';
import { Timeline } from './ui/Timeline';
import { InfoPanel } from './ui/InfoPanel';
import { ParticleData, ParticleType, Vec3 } from '../shared/types';
import { TICKS_PER_REAL_SECOND } from '../shared/constants';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);
const particleManager = new ParticleManager(sceneManager.scene);
const engine = new SimulationEngine(particleManager);
engine.setOnLoad(() => sceneManager.frame(engine.getExtent()));

const toolbar = new Toolbar();
const timeline = new Timeline(engine);
const infoPanel = new InfoPanel(document.getElementById('info-panel')!, engine);

// Add color legend to viewport
const legend = document.createElement('div');
legend.id = 'legend';
for (const [type, color] of [['proton', '#ff4444'], ['electron', '#4488ff'], ['neutron', '#888888'], ['photon', '#ffdd44']]) {
  const item = document.createElement('div');
  item.className = 'legend-item';
  const dot = document.createElement('span');
  dot.className = 'legend-dot';
  dot.style.background = color;
  item.append(dot, ` ${type}`);
  legend.append(item);
}
viewport.appendChild(legend);

function nearest(type: ParticleType, pos: Vec3): ParticleData | undefined {
  let best: ParticleData | undefined;
  let bestDist = Infinity;
  for (const p of particleManager.getAllParticles()) {
    if (p.type !== type) continue;
    const d = Math.hypot(p.position.x - pos.x, p.position.y - pos.y, p.position.z - pos.z);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

// Sandbox defaults: electrons settle into 1s around a proton, photons aim at the atom.
function placementDefaults(type: ParticleType, pos: Vec3): { position: Vec3; extra: Partial<ParticleData> } {
  if (type === 'electron') {
    const proton = nearest('proton', pos);
    return {
      position: proton ? { ...proton.position } : pos,
      extra: { orbital: { n: 1, l: 0, m: 0 } },
    };
  }
  if (type === 'photon') {
    const target = nearest('electron', pos)?.position ?? nearest('proton', pos)?.position ?? { x: 0, y: 0, z: 0 };
    let direction = { x: target.x - pos.x, y: target.y - pos.y, z: target.z - pos.z };
    if (Math.hypot(direction.x, direction.y, direction.z) < 1e-6) direction = { x: 1, y: 0, z: 0 };
    return { position: pos, extra: { direction, energy: toolbar.getPhotonEnergy() } };
  }
  return { position: pos, extra: {} };
}

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// A click that ends a camera drag is not a click: ignore it if the pointer moved more than this.
const DRAG_THRESHOLD_PX = 5;
let pointerDown: { x: number; y: number } | null = null;
viewport.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
});

viewport.addEventListener('click', (event) => {
  const start = pointerDown;
  pointerDown = null;
  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX) return;

  const rect = viewport.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, sceneManager.camera);

  const selectedType = toolbar.getSelectedType();

  if (selectedType) {
    // intersectPlane returns null when the ray misses the floor (e.g. clicking the sky).
    const hit = raycaster.ray.intersectPlane(placementPlane, new THREE.Vector3());
    if (hit) {
      const { position, extra } = placementDefaults(selectedType, { x: hit.x, y: hit.y, z: hit.z });
      engine.addUserParticle(selectedType, position, extra);
      toolbar.clearSelection();
    }
    return;
  }

  // Markers take priority over clouds, so the nucleus can be picked inside an electron cloud.
  const hits = raycaster.intersectObjects(particleManager.getMarkers(), false);
  if (hits.length === 0) hits.push(...raycaster.intersectObjects(particleManager.getClouds(), true));
  const id = hits.length > 0 ? particleIdOf(hits[0].object) : undefined;
  const p = id ? particleManager.getParticle(id) : undefined;
  if (p) {
    infoPanel.showParticle(p.data);
  } else {
    infoPanel.clearSelection();
  }
});

// Toggle particle labels with L key (the manager keeps the setting for particles added later)
let labelsVisible = true;
document.addEventListener('keydown', (e) => {
  if (e.key === 'l' || e.key === 'L') {
    labelsVisible = !labelsVisible;
    particleManager.setLabelsVisible(labelsVisible);
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
    engine.tick(deltaSec * TICKS_PER_REAL_SECOND);
  }

  particleManager.update(engine.state.time);
  timeline.update();
  sceneManager.render();
}

animate();
