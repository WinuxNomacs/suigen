import { ParticleData, Scenario } from '../../shared/types';
import { getPresets, loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';
import { formatEnergy } from '../particles/ParticleLabels';

type PanelMode = 'gallery' | 'description' | 'particle';

// Shown with every scenario and in the sandbox. Numbers are computed; see upcoming-changes.md, Phase 1.
const GENERAL_SIMPLIFICATIONS = [
  'No forces are simulated. Particles stay where they are placed; only photons and scripted particles move, in straight lines at constant speed.',
  'Energy levels use the hydrogen formula E = -13.6 eV / n\u00b2, which ignores fine structure and other small corrections (1 to 6 \u00d7 10\u207b\u2075 eV at n = 2).',
  'Only s and p clouds up to n = 4 are drawn. The outer surface holds 90% of the probability and the inner shell marks the most likely distance. The inner rings of the 2s, 3s, 3p, 4s and 4p clouds (radial nodes) are not drawn.',
  'An electron absorbs a photon within \u00b10.05 eV of a transition energy. Real absorption is about 100,000 times more selective: the 2p level\u2019s natural width is about 0.4 \u00b5eV.',
  'The change between clouds is drawn as a short crossfade; how long a transition really takes is not modeled.',
  'Photon wave trails are drawn in proportion to the real wavelength only between about 4 pm and 31 pm (X-rays). Ultraviolet and visible light have wavelengths hundreds to thousands of times larger than the atom and are drawn shorter; gamma rays are drawn longer.',
  'Particle balls are markers, not sizes: electrons have no known size, and a proton\u2019s radius is about 0.84 fm.',
  'Times are real elapsed time. \u201c\u2248\u201d means the time includes a fast-forwarded span, labeled \u201cfast-forward\u201d while it plays.',
];

function simplificationsHtml(extra: string[] = []): string {
  const items = [...GENERAL_SIMPLIFICATIONS, ...extra].map(s => `<li>${s}</li>`).join('');
  return `<details class="simplifications"><summary>Simplifications</summary><ul>${items}</ul></details>`;
}

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
          this.engine.loadScenario(scenario.particles, scenario.events, scenario.compressions, scenario.extent);
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
        <p class="hint">An electron absorbs a photon only if its energy matches a jump to a higher orbital (10.2 eV takes 1s to 2p). Otherwise the photon passes straight through.</p>
        ${simplificationsHtml()}
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
      ${simplificationsHtml(scenario.simplifications)}
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
      ${p.energy ? `<p>energy: ${formatEnergy(p.energy)}</p>` : ''}
      ${p.speed !== undefined ? `<p>speed: ${p.speed} c</p>` : ''}
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
