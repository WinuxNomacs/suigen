import * as THREE from 'three';
import { ParticleType } from '../../shared/types';
import {
  PARTICLE_COLORS,
  PROTON_VISUAL_RADIUS,
  NEUTRON_VISUAL_RADIUS,
  ELECTRON_VISUAL_RADIUS,
  PHOTON_VISUAL_RADIUS,
} from '../../shared/constants';

export function createParticleMesh(type: ParticleType): THREE.Mesh {
  const colorHex = PARTICLE_COLORS[type];
  const color = new THREE.Color(colorHex);

  let radius: number;
  switch (type) {
    case 'proton':   radius = PROTON_VISUAL_RADIUS; break;
    case 'neutron':  radius = NEUTRON_VISUAL_RADIUS; break;
    case 'electron': radius = ELECTRON_VISUAL_RADIUS; break;
    case 'photon':   radius = PHOTON_VISUAL_RADIUS; break;
  }

  const geometry = new THREE.SphereGeometry(radius, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  });

  const mesh = new THREE.Mesh(geometry, material);

  const spriteMat = new THREE.SpriteMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.scale.set(radius * 6, radius * 6, 1);
  mesh.add(glow);

  return mesh;
}
