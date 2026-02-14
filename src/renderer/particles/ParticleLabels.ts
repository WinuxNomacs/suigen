import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ParticleData } from '../../shared/types';

function labelText(p: ParticleData): string {
  if (p.type === 'electron' && p.orbital) {
    const sublabel = ['s', 'p', 'd', 'f'][p.orbital.l] || '?';
    return `electron (${p.orbital.n}${sublabel})`;
  }
  if (p.type === 'photon' && p.energy) {
    return `photon (${p.energy} eV)`;
  }
  return p.type;
}

export function createParticleLabel(p: ParticleData): CSS2DObject {
  const div = document.createElement('div');
  div.className = 'particle-label';
  div.textContent = labelText(p);
  const label = new CSS2DObject(div);
  label.position.set(0, 5, 0); // offset above particle
  return label;
}

export function updateLabelText(label: CSS2DObject, p: ParticleData): void {
  (label.element as HTMLDivElement).textContent = labelText(p);
}
