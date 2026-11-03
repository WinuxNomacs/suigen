import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';
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
legend.innerHTML = `
  <div class="legend-item"><span class="legend-dot" style="background:#ff4444"></span> proton</div>
  <div class="legend-item"><span class="legend-dot" style="background:#4488ff"></span> electron</div>
  <div class="legend-item"><span class="legend-dot" style="background:#888888"></span> neutron</div>
  <div class="legend-item"><span class="legend-dot" style="background:#ffdd44"></span> photon</div>
`;
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
      const { position, extra } = placementDefaults(selectedType, {
        x: intersection.x,
        y: intersection.y,
        z: intersection.z,
      });
      engine.addUserParticle(selectedType, position, extra);
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

// Toggle particle labels with L key
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
