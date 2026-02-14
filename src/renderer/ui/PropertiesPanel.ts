import { ParticleData } from '../../shared/types';

export class PropertiesPanel {
  private content: HTMLElement;

  constructor() {
    this.content = document.getElementById('properties-content')!;
  }

  showParticle(p: ParticleData): void {
    const orbitalStr = p.orbital ? `n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}` : '';
    this.content.innerHTML = `
      <p><strong>${p.type}</strong></p>
      <p>x: ${p.position.x.toFixed(1)} fm</p>
      <p>y: ${p.position.y.toFixed(1)} fm</p>
      <p>z: ${p.position.z.toFixed(1)} fm</p>
      <p>spin: ${p.spin}</p>
      ${orbitalStr ? `<p>orbital: ${orbitalStr}</p>` : ''}
    `;
  }

  clear(): void {
    this.content.innerHTML = '<p class="hint">Select a particle</p>';
  }
}
