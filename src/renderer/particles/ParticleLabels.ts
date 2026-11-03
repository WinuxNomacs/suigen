import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ParticleData } from '../../shared/types';

/** Formats an energy in eV with an automatic unit, e.g. 83633.4 -> "83.6 keV". */
export function formatEnergy(ev: number): string {
  if (ev >= 1e6) return `${+(ev / 1e6).toPrecision(4)} MeV`;
  if (ev >= 1e3) return `${+(ev / 1e3).toPrecision(4)} keV`;
  return `${+ev.toPrecision(4)} eV`;
}

function labelText(p: ParticleData): string {
  if (p.type === 'electron' && p.orbital) {
    const sublabel = ['s', 'p', 'd', 'f'][p.orbital.l] || '?';
    return `electron (${p.orbital.n}${sublabel})`;
  }
  if (p.energy) {
    return `${p.type} (${formatEnergy(p.energy)})`;
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
