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

  update(position: THREE.Vector3, direction: THREE.Vector3, time: number): void {
    this.points = [];
    const wavelength = 2000;
    const amplitude = 800;
    const trailLength = 20000;
    const segments = 100;

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
