import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { DEFAULT_SCENE_EXTENT_FM } from '../../shared/constants';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  controls: OrbitControls;
  private container: HTMLElement;
  private axes: THREE.AxesHelper;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    // Directional, so lighting does not depend on the scene's scale.
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(1, 1, 1);
    this.scene.add(sun);

    // Unit length, scaled to the framed extent in frame().
    this.axes = new THREE.AxesHelper(1);
    this.scene.add(this.axes);

    this.frame(DEFAULT_SCENE_EXTENT_FM);

    window.addEventListener('resize', () => this.onResize());
  }

  /** Points the camera at the origin from far enough away to see a sphere of `extent` fm. */
  frame(extent: number): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const distance = (extent / Math.sin(halfFov)) * 1.1;
    this.camera.position.set(1, 0.75, 1).normalize().multiplyScalar(distance);
    this.camera.near = distance / 1e5; // lets you zoom in close to the nucleus
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.axes.scale.setScalar(extent * 1.2);
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}
