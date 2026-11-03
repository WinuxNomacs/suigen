import * as THREE from 'three';
import { OrbitalState } from '../../shared/types';
import { BOHR_RADIUS_FM } from '../../shared/constants';
import { hydrogenRadii } from '../physics/hydrogen';

/**
 * Cloud radii in fm, measured from the nucleus. `outer` encloses 90% of the probability (the drawn
 * surface); `mostLikely` is the peak of the radial probability (the inner shell).
 */
export function orbitalRadii(orbital: OrbitalState, effectiveCharge = 1): { mostLikely: number; outer: number } {
  const r = hydrogenRadii(orbital.n, orbital.l);
  const scale = BOHR_RADIUS_FM / effectiveCharge;
  return { mostLikely: r.mostLikely * scale, outer: r.outer * scale };
}

export function orbitalRadius(orbital: OrbitalState, effectiveCharge = 1): number {
  return orbitalRadii(orbital, effectiveCharge).outer;
}

function cloudMaterial(opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// A p lobe pair along one axis, each lobe reaching from the nucleus out to `radius`.
function addLobes(group: THREE.Group, m: number, radius: number, opacity: number): void {
  for (const sign of [1, -1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(radius / 2, 24, 24), cloudMaterial(opacity));
    const offset = sign * radius / 2;
    if (m === 1) {
      lobe.position.set(offset, 0, 0);
      lobe.scale.set(1, 0.6, 0.6);
    } else if (m === -1) {
      lobe.position.set(0, 0, offset);
      lobe.scale.set(0.6, 0.6, 1);
    } else {
      lobe.position.set(0, offset, 0);
      lobe.scale.set(0.6, 1, 0.6);
    }
    group.add(lobe);
  }
}

export function createOrbitalMesh(orbital: OrbitalState, effectiveCharge = 1): THREE.Object3D {
  const { l, m } = orbital;
  const group = new THREE.Group();
  const { mostLikely, outer } = orbitalRadii(orbital, effectiveCharge);

  if (l === 0) {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(outer, 32, 32), cloudMaterial(0.12)));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(mostLikely, 24, 24), cloudMaterial(0.08)));
  } else if (l === 1) {
    addLobes(group, m, outer, 0.12);
    addLobes(group, m, mostLikely, 0.08);
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
