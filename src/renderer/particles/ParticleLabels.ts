import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ParticleData } from '../../shared/types';

/** Formats an energy in eV with an automatic unit, e.g. 83633.4 -> "83.6 keV". */
export function formatEnergy(ev: number): string {
  if (ev >= 1e6) return `${+(ev / 1e6).toPrecision(4)} MeV`;
  if (ev >= 1e3) return `${+(ev / 1e3).toPrecision(4)} keV`;
  return `${+ev.toPrecision(4)} eV`;
}

export function labelText(p: ParticleData): string {
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
  return label;
}

/** Sets the text only when it changes, so per-frame calls don't touch the DOM. */
export function setLabelText(label: CSS2DObject, text: string): void {
  if (label.element.textContent !== text) label.element.textContent = text;
}
