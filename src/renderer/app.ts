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
engine.setOnLoad(() => {
  sceneManager.frame(engine.getExtent());
  // Scenario particle ids repeat between scenarios (s0, s1, ...), so a selection must not carry over.
  clearSelection();
});

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

function setRay(event: MouseEvent): void {
  const rect = viewport.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, sceneManager.camera);
}

// --- Selection -------------------------------------------------------------------------------

let selectedId: string | null = null;

function select(id: string): void {
  const p = particleManager.getParticle(id);
  if (!p) return;
  selectedId = id;
  particleManager.setSelected(id);
  infoPanel.showParticle(p.data, deleteSelected);
}

function clearSelection(): void {
  selectedId = null;
  particleManager.setSelected(null);
  infoPanel.clearSelection();
}

function deleteSelected(): void {
  if (!selectedId) return;
  const id = selectedId;
  clearSelection();
  engine.removeUserParticle(id);
}

infoPanel.setOnLeaveParticle(() => {
  selectedId = null;
  particleManager.setSelected(null);
});

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    clearSelection();
  }
});

// --- Dragging --------------------------------------------------------------------------------
// A drag that starts on a marker moves that particle (a nucleon moves its whole atom) in the
// horizontal plane through it. Clouds are not handles, so the camera can still be rotated.

// A click that ends a drag is not a click: ignore it if the pointer moved more than this.
const DRAG_THRESHOLD_PX = 5;
let pointerDown: { x: number; y: number } | null = null;

interface Drag {
  handleId: string;
  start: Map<string, THREE.Vector3>;
  plane: THREE.Plane;
  grab: THREE.Vector3;
  moved: boolean;
  pointerId: number;
}
let drag: Drag | null = null;

function markerUnderPointer(event: MouseEvent): string | undefined {
  setRay(event);
  const hits = raycaster.intersectObjects(particleManager.getMarkers(), false);
  return hits.length > 0 ? particleIdOf(hits[0].object) : undefined;
}

// Capture phase: runs before OrbitControls' own pointerdown on the canvas, so it can disable them.
viewport.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
  if (event.button !== 0 || toolbar.getSelectedType()) return;
  const id = markerUnderPointer(event);
  if (!id || engine.isMoving(id)) return;
  const handle = particleManager.getParticle(id)!;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -handle.data.position.y);
  const grab = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!grab) return;
  const start = new Map<string, THREE.Vector3>();
  for (const gid of particleManager.getDragGroup(id)) {
    const p = particleManager.getParticle(gid)!.data.position;
    start.set(gid, new THREE.Vector3(p.x, p.y, p.z));
  }
  drag = { handleId: id, start, plane, grab, moved: false, pointerId: event.pointerId };
  sceneManager.controls.enabled = false;
  viewport.setPointerCapture(event.pointerId);
}, { capture: true });

function dragTargets(event: PointerEvent): Map<string, THREE.Vector3> | null {
  if (!drag) return null;
  setRay(event);
  const hit = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3());
  if (!hit) return null;
  const delta = hit.sub(drag.grab);
  // Keep the dragged particle within the framed extent.
  const handleTo = drag.start.get(drag.handleId)!.clone().add(delta);
  const limit = engine.getExtent();
  if (handleTo.length() > limit) {
    handleTo.setLength(limit);
    delta.copy(handleTo).sub(drag.start.get(drag.handleId)!);
  }
  const targets = new Map<string, THREE.Vector3>();
  for (const [id, from] of drag.start) targets.set(id, from.clone().add(delta));
  return targets;
}

viewport.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.moved && pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) <= DRAG_THRESHOLD_PX) return;
  drag.moved = true;
  const targets = dragTargets(event);
  if (!targets) return;
  // Preview only; the move is recorded in the event log on release.
  for (const [id, pos] of targets) particleManager.updatePosition(id, { x: pos.x, y: pos.y, z: pos.z });
});

function endDrag(event: PointerEvent, commit: boolean): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const d = drag;
  const targets = commit && d.moved ? dragTargets(event) : null; // needs `drag` still set
  drag = null;
  sceneManager.controls.enabled = true;
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  if (!d.moved) return;
  if (targets) {
    engine.moveParticles([...targets].map(([id, p]) => ({ id, position: { x: p.x, y: p.y, z: p.z } })));
  } else {
    // Cancelled: put the previewed particles back.
    for (const [id, p] of d.start) particleManager.updatePosition(id, { x: p.x, y: p.y, z: p.z });
  }
  select(d.handleId);
}

viewport.addEventListener('pointerup', (event) => endDrag(event, true));
viewport.addEventListener('pointercancel', (event) => endDrag(event, false));

// --- Clicking --------------------------------------------------------------------------------

viewport.addEventListener('click', (event) => {
  const start = pointerDown;
  pointerDown = null;
  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX) return;

  setRay(event);
  const selectedType = toolbar.getSelectedType();

  if (selectedType) {
    // intersectPlane returns null when the ray misses the floor (e.g. clicking the sky).
    const hit = raycaster.ray.intersectPlane(placementPlane, new THREE.Vector3());
    if (hit) {
      const clicked = { x: hit.x, y: hit.y, z: hit.z };
      if (selectedType === 'neutron') {
        engine.addUserNeutron(clicked); // heads for the nearest free proton, if any
      } else {
        const { position, extra } = placementDefaults(selectedType, clicked);
        engine.addUserParticle(selectedType, position, extra);
      }
      toolbar.clearSelection();
    }
    return;
  }

  // Markers take priority over clouds, so the nucleus can be picked inside an electron cloud.
  const hits = raycaster.intersectObjects(particleManager.getMarkers(), false);
  if (hits.length === 0) hits.push(...raycaster.intersectObjects(particleManager.getClouds(), true));
  const id = hits.length > 0 ? particleIdOf(hits[0].object) : undefined;
  if (id && particleManager.getParticle(id)) {
    select(id);
  } else {
    clearSelection();
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

  // The selection ends when its particle stops existing (rewound before its spawn, absorbed, departed).
  if (selectedId && !particleManager.getParticle(selectedId)) clearSelection();

  particleManager.update(engine.state.time);
  timeline.update();
  infoPanel.update();
  sceneManager.render();
}

animate();
