import { ParticleData, Scenario } from '../../shared/types';
import { getPresets, loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';

type PanelMode = 'gallery' | 'description' | 'particle';

export class InfoPanel {
  private container: HTMLElement;
  private engine: SimulationEngine;
  private mode: PanelMode = 'gallery';
  private currentScenario: Scenario | null = null;
  private showScience = false;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.container = container;
    this.engine = engine;
    this.renderGallery();
  }

  private renderGallery(): void {
    this.mode = 'gallery';
    this.currentScenario = null;
    const presets = getPresets();
    const cards = Object.entries(presets).map(([key, scenario]) => `
      <div class="scenario-card" data-scenario="${key}">
        <div class="card-name">${scenario.name}</div>
        <div class="card-title">${scenario.layman.title}</div>
        <div class="card-summary">${scenario.layman.summary}</div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <h3>Explore</h3>
      <div class="scenario-gallery">${cards}</div>
      <div class="scenario-card sandbox-card" data-scenario="sandbox">
        <div class="card-name">Sandbox</div>
        <div class="card-title">Free Exploration</div>
        <div class="card-summary">Place particles freely and watch them interact</div>
      </div>
    `;

    this.container.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = (card as HTMLElement).dataset.scenario!;
        if (key === 'sandbox') {
          this.engine.loadScenario([], []);
          this.renderDescription(null);
          return;
        }
        const scenario = loadPreset(key);
        if (scenario) {
          this.engine.loadScenario(scenario.particles, scenario.events);
          this.renderDescription(scenario);
        }
      });
    });
  }

  private renderDescription(scenario: Scenario | null): void {
    this.mode = 'description';
    this.currentScenario = scenario;
    this.showScience = false;

    if (!scenario) {
      this.container.innerHTML = `
        <button class="back-btn" id="back-to-gallery">\u2190 Scenarios</button>
        <h3>Sandbox Mode</h3>
        <p class="hint">Select a particle type from the toolbar, then click in the viewport to place it.</p>
        <p class="hint">Electrons settle around the nearest proton. Photons fly toward the nearest electron with the energy chosen under the &gamma; button.</p>
        <p class="hint">An electron absorbs a photon only if its energy exactly matches a jump to a higher orbital (10.2 eV takes 1s to 2p). Otherwise the photon passes straight through.</p>
      `;
      this.container.querySelector('#back-to-gallery')!.addEventListener('click', () => this.renderGallery());
      return;
    }

    const s = scenario.layman.sections;
    this.container.innerHTML = `
      <button class="back-btn" id="back-to-gallery">\u2190 Scenarios</button>
      <div class="desc-header">
        <div class="desc-title">${scenario.layman.title}</div>
        <div class="desc-summary">${scenario.layman.summary}</div>
      </div>
      <div class="desc-sections">
        <details open>
          <summary>What's happening</summary>
          <p>${s.whatsHappening}</p>
        </details>
        <details>
          <summary>Why it matters</summary>
          <p>${s.whyItMatters}</p>
        </details>
        <details>
          <summary>What to watch</summary>
          <p>${s.whatToWatch}</p>
        </details>
        <details>
          <summary>Fun fact</summary>
          <p>${s.funFact}</p>
        </details>
      </div>
      <button class="toggle-science" id="toggle-science">Show Science \u25BC</button>
      <div class="science-content" id="science-content" style="display:none;">
        <p class="sci-narrative">${scenario.scientific.narrative}</p>
        <div class="sci-equations">
          ${scenario.scientific.equations.map(eq => `
            <div class="equation">
              <span class="eq-label">${eq.label}:</span>
              <span class="eq-tex">${eq.tex}</span>
            </div>
          `).join('')}
        </div>
        <div class="sci-constants">
          <strong>Constants:</strong>
          <ul>${scenario.scientific.constants.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    this.container.querySelector('#back-to-gallery')!.addEventListener('click', () => this.renderGallery());
    this.container.querySelector('#toggle-science')!.addEventListener('click', () => {
      this.showScience = !this.showScience;
      const content = document.getElementById('science-content')!;
      const btn = document.getElementById('toggle-science')!;
      content.style.display = this.showScience ? 'block' : 'none';
      btn.textContent = this.showScience ? 'Hide Science \u25B2' : 'Show Science \u25BC';
    });
  }

  showParticle(p: ParticleData): void {
    this.mode = 'particle';
    const orbitalStr = p.orbital ? `n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}` : '';
    this.container.innerHTML = `
      <button class="back-btn" id="back-to-desc">\u2190 Description</button>
      <h3>Particle</h3>
      <p><strong>${p.type}</strong></p>
      <p>x: ${p.position.x.toFixed(1)} fm</p>
      <p>y: ${p.position.y.toFixed(1)} fm</p>
      <p>z: ${p.position.z.toFixed(1)} fm</p>
      <p>spin: ${p.spin}</p>
      ${orbitalStr ? `<p>orbital: ${orbitalStr}</p>` : ''}
      ${p.energy ? `<p>energy: ${p.energy} eV</p>` : ''}
    `;
    this.container.querySelector('#back-to-desc')!.addEventListener('click', () => {
      if (this.currentScenario) {
        this.renderDescription(this.currentScenario);
      } else {
        this.renderGallery();
      }
    });
  }

  clearSelection(): void {
    if (this.mode === 'particle') {
      if (this.currentScenario) {
        this.renderDescription(this.currentScenario);
      } else {
        this.renderGallery();
      }
    }
  }
}
