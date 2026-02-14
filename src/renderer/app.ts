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
