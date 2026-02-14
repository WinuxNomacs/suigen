import { SceneManager } from './scene/SceneManager';

const viewport = document.getElementById('viewport')!;
const sceneManager = new SceneManager(viewport);

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
