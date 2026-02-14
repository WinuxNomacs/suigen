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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 500000);
    this.camera.position.set(80000, 60000, 80000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xffffff, 1, 0);
    point.position.set(100000, 100000, 100000);
    this.scene.add(point);

    const boundaryGeo = new THREE.SphereGeometry(DEFAULT_ATOM_RADIUS_FM, 32, 32);
    const boundaryMat = new THREE.MeshBasicMaterial({
      color: 0x4444aa,
      transparent: true,
      opacity: 0.05,
      wireframe: true,
    });
    this.atomBoundary = new THREE.Mesh(boundaryGeo, boundaryMat);
    this.scene.add(this.atomBoundary);

    const axes = new THREE.AxesHelper(DEFAULT_ATOM_RADIUS_FM * 1.2);
    this.scene.add(axes);

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
