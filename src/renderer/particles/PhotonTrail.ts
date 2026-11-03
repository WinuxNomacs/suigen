import * as THREE from 'three';
import {
  HC_EV_PM,
  TRAIL_REF_WAVELENGTH_PM,
  TRAIL_REF_DRAWN_FM,
  TRAIL_MIN_DRAWN_FM,
  TRAIL_MAX_DRAWN_FM,
} from '../../shared/constants';

// Drawn wavelength is proportional to the real one (λ = hc / E) within the clamp range, so the ratio
// between two X-ray photons (e.g. before and after Compton scattering) is shown to scale.
export function drawnWavelength(energyEv: number | undefined): number {
  if (!energyEv) return TRAIL_REF_DRAWN_FM;
  const drawn = TRAIL_REF_DRAWN_FM * (HC_EV_PM / energyEv) / TRAIL_REF_WAVELENGTH_PM;
  return THREE.MathUtils.clamp(drawn, TRAIL_MIN_DRAWN_FM, TRAIL_MAX_DRAWN_FM);
}

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

  // `traveled` caps the trail so it never extends behind the point where the photon was created.
  update(position: THREE.Vector3, direction: THREE.Vector3, time: number, energyEv?: number, traveled = Infinity): void {
    this.points = [];
    const wavelength = drawnWavelength(energyEv);
    const amplitude = 25000;
    const trailLength = Math.min(400000, traveled);
    const segments = 200;

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
