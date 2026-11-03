import * as THREE from 'three';
import { ParticleType } from '../../shared/types';
import {
  PARTICLE_COLORS,
  PROTON_VISUAL_RADIUS,
  NEUTRON_VISUAL_RADIUS,
  ELECTRON_VISUAL_RADIUS,
  PHOTON_VISUAL_RADIUS,
} from '../../shared/constants';

// Marker size as a fraction of the viewport height. With sizeAttenuation off, a sprite of scale s
// covers s / (2 tan(fov/2)) of the viewport height; at the 60 deg fov that is about 0.87 s.
const MARKER_SCALE: Record<ParticleType, number> = {
  proton: 0.016,
  neutron: 0.016,
  electron: 0.012,
  photon: 0.012,
};

let markerTexture: THREE.Texture | undefined;

// A soft round dot, shared by all markers and tinted per particle.
function getMarkerTexture(): THREE.Texture {
  if (markerTexture) return markerTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  markerTexture = new THREE.CanvasTexture(canvas);
  markerTexture.colorSpace = THREE.SRGBColorSpace;
  return markerTexture;
}

/**
 * A particle is a sphere at its marker radius (visible when zoomed in to femtometers) plus a marker
 * sprite that keeps a fixed size on screen, so it can be seen and clicked from any distance.
 */
export function createParticleMesh(type: ParticleType, id: string): THREE.Mesh {
  const color = new THREE.Color(PARTICLE_COLORS[type]);

  let radius: number;
  switch (type) {
    case 'proton':   radius = PROTON_VISUAL_RADIUS; break;
    case 'neutron':  radius = NEUTRON_VISUAL_RADIUS; break;
    case 'electron': radius = ELECTRON_VISUAL_RADIUS; break;
    case 'photon':   radius = PHOTON_VISUAL_RADIUS; break;
  }

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 16), material);
  mesh.userData.particleId = id;

  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getMarkerTexture(),
    color,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
  }));
  marker.scale.setScalar(MARKER_SCALE[type]);
  marker.userData.particleId = id;
  marker.name = 'marker';
  mesh.add(marker);

  return mesh;
}

export function getMarker(mesh: THREE.Mesh): THREE.Sprite | undefined {
  return mesh.getObjectByName('marker') as THREE.Sprite | undefined;
}

/** Walks up from a raycast hit to the object that carries a particle id. */
export function particleIdOf(obj: THREE.Object3D | null): string | undefined {
  for (let o = obj; o; o = o.parent) {
    if (typeof o.userData.particleId === 'string') return o.userData.particleId;
  }
  return undefined;
}
