import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { ParticleManager } from './particles/ParticleManager';
import { SimulationEngine } from './physics/SimulationEngine';
import { Toolbar } from './ui/Toolbar';
import { Timeline } from './ui/Timeline';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { ScenarioMenu } from './ui/ScenarioMenu';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);
const particleManager = new ParticleManager(sceneManager.scene);
const engine = new SimulationEngine(particleManager);

const toolbar = new Toolbar();
const timeline = new Timeline(engine);
const properties = new PropertiesPanel();
new ScenarioMenu(engine);

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
      if (p) properties.showParticle(p.data);
    } else {
      properties.clear();
    }
  }
});

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
