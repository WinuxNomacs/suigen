import * as THREE from 'three';
import { OrbitalState } from '../../shared/types';
import { BOHR_RADIUS_FM } from '../../shared/constants';

export function orbitalRadius(orbital: OrbitalState): number {
  return orbital.n * orbital.n * BOHR_RADIUS_FM * 0.4;
}

export function createOrbitalMesh(orbital: OrbitalState): THREE.Object3D {
  const { l, m } = orbital;
  const group = new THREE.Group();

  const scale = orbitalRadius(orbital);

  if (l === 0) {
    const geo = new THREE.SphereGeometry(scale, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(geo, mat));

    const innerGeo = new THREE.SphereGeometry(scale * 0.5, 24, 24);
    const innerMat = mat.clone();
    innerMat.opacity = 0.08;
    group.add(new THREE.Mesh(innerGeo, innerMat));
  } else if (l === 1) {
    const lobeMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (const sign of [1, -1]) {
      const lobeGeo = new THREE.SphereGeometry(scale * 0.6, 24, 24);
      const lobe = new THREE.Mesh(lobeGeo, lobeMat.clone());

      if (m === 0) {
        lobe.position.set(0, sign * scale * 0.5, 0);
        lobe.scale.set(0.6, 1.2, 0.6);
      } else if (Math.abs(m) === 1) {
        if (m === 1) {
          lobe.position.set(sign * scale * 0.5, 0, 0);
          lobe.scale.set(1.2, 0.6, 0.6);
        } else {
          lobe.position.set(0, 0, sign * scale * 0.5);
          lobe.scale.set(0.6, 0.6, 1.2);
        }
      }
      group.add(lobe);
    }
  }

  group.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshBasicMaterial;
      mat.userData.baseOpacity = mat.opacity;
    }
  });

  return group;
}

export function setOrbitalOpacity(group: THREE.Object3D, factor: number): void {
  group.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshBasicMaterial;
      mat.opacity = mat.userData.baseOpacity * factor;
    }
  });
}

export function disposeOrbitalMesh(group: THREE.Object3D): void {
  group.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}
