import { ParticleData, Scenario } from '../../shared/types';
import { getPresets, loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';
import { formatEnergy } from '../particles/ParticleLabels';

type PanelMode = 'gallery' | 'description' | 'particle';

// Shown with every scenario and in the sandbox. Numbers are computed; see upcoming-changes.md, Phase 1.
const GENERAL_SIMPLIFICATIONS = [
  'No forces are simulated. Particles stay where they are placed; only photons and scripted particles move, in straight lines at constant speed.',
  'Energy levels use the hydrogen formula E = -13.598 eV / n\u00b2 (corrected for the proton\u2019s finite mass). It ignores fine structure and smaller corrections, which shift the n = 2 levels by 1 to 6 \u00d7 10\u207b\u2075 eV.',
  'Only s and p clouds up to n = 4 are drawn. The outer surface holds 90% of the probability and the inner shell marks the most likely distance. The inner rings of the 2s, 3s, 3p, 4s and 4p clouds (radial nodes) are not drawn.',
  'An electron absorbs a photon within \u00b10.05 eV of a transition energy. Real absorption is about 100,000 times more selective: the 2p level\u2019s natural width is about 0.4 \u00b5eV.',
  'The change between clouds is drawn as a short crossfade; how long a transition really takes is not modeled.',
  'Photon wave trails are drawn in proportion to the real wavelength only between about 4 pm and 31 pm (X-rays). Ultraviolet and visible light have wavelengths hundreds to thousands of times larger than the atom and are drawn shorter; gamma rays are drawn longer.',
  'Particle balls are markers, not sizes: electrons have no known size, and a proton\u2019s radius is about 0.84 fm.',
  'Times are real elapsed time. \u201c\u2248\u201d means the time includes a fast-forwarded span, labeled \u201cfast-forward\u201d while it plays.',
];

// Shown in the sandbox in addition to the general list.
const SANDBOX_SIMPLIFICATIONS = [
  'Every placed electron gets a hydrogen 1s cloud (charge Z = 1), on the nearest proton or, with no proton, where you click. The number of protons does not change its cloud or levels: around a helium nucleus the real jump from 1s to 2p takes 40.8 eV, not 10.2 eV.',
  'The Pauli principle is not enforced: any number of placed electrons share the 1s cloud, where only two fit.',
  'Deleting a proton leaves its electron clouds in place; nothing frees the electrons.',
  'A photon is absorbed as it enters the cloud\u2019s 90% surface. Real absorption has no single point of impact.',
  'Ionization is not modeled: a real photon above 13.6 eV can knock the electron out of the atom.',
  'A placed neutron heads for the nearest free proton (no other proton or neutron within 20 fm) at 2,200 m/s, the speed of a room-temperature neutron. Its approach is fast-forwarded. Only one neutron approaches at a time; one placed during another approach, or with no free proton, stays where it is placed.',
  'Capture is certain here. A real slow neutron meeting a free proton is about 60 times more likely to bounce off (scattering, 20.5 barn) than to be captured (0.333 barn; NIST neutron data).',
  'Only a free proton captures a neutron; heavier captures such as n + d \u2192 tritium are real but not modeled. A neutron whose proton was moved away before it arrived stops where its approach ended.',
  'The capture gamma ray (2.22 MeV) leaves in a random direction, chosen once so rewinding replays it the same way.',
];

type Child = Node | string | null | undefined | false;

/** Builds an element. Text is always set as text, never parsed as HTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('data-')) el.dataset[k.slice(5)] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (c) el.append(c);
  }
  return el;
}

/** Intrinsic spin from the particle type, plus the projection m_s when the scenario sets it. */
export function spinText(p: Pick<ParticleData, 'type' | 'spin'>): string {
  if (p.type === 'photon') return 'spin: 1';
  if (p.spin === undefined) return 'spin: 1/2';
  return `spin: 1/2, m_s = ${p.spin > 0 ? '+' : '\u2212'}1/2`;
}

function simplifications(extra: string[] = []): HTMLElement {
  return h('details', { class: 'simplifications' },
    h('summary', {}, 'Simplifications'),
    h('ul', {}, ...[...GENERAL_SIMPLIFICATIONS, ...extra].map(t => h('li', {}, t))),
  );
}

export class InfoPanel {
  private container: HTMLElement;
  private engine: SimulationEngine;
  private mode: PanelMode = 'gallery';
  private currentScenario: Scenario | null = null;
  private onLeaveParticle?: () => void;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.container = container;
    this.engine = engine;
    this.renderGallery();
  }

  /** Called when the particle view is closed from inside the panel (back button). */
  setOnLeaveParticle(cb: () => void): void {
    this.onLeaveParticle = cb;
  }

  private show(...children: Child[]): void {
    this.container.replaceChildren(...children.filter((c): c is Node | string => !!c));
  }

  private card(key: string, name: string, title: string, summary: string, extraClass = ''): HTMLElement {
    const card = h('div', { class: `scenario-card ${extraClass}`.trim(), 'data-scenario': key },
      h('div', { class: 'card-name' }, name),
      h('div', { class: 'card-title' }, title),
      h('div', { class: 'card-summary' }, summary),
    );
    card.addEventListener('click', () => {
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
    return card;
  }

  private backButton(id: string, text: string, onClick: () => void): HTMLElement {
    const btn = h('button', { class: 'back-btn', id }, text);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private renderGallery(): void {
    this.mode = 'gallery';
    this.currentScenario = null;
    const cards = Object.entries(getPresets()).map(([key, s]) => this.card(key, s.name, s.layman.title, s.layman.summary));
    this.show(
      h('h3', {}, 'Explore'),
      h('div', { class: 'scenario-gallery' }, ...cards),
      this.card('sandbox', 'Sandbox', 'Free Exploration', 'Place particles freely and watch them interact', 'sandbox-card'),
    );
  }

  private renderDescription(scenario: Scenario | null): void {
    this.mode = 'description';
    this.currentScenario = scenario;
    const back = this.backButton('back-to-gallery', '\u2190 Scenarios', () => this.renderGallery());

    if (!scenario) {
      this.show(
        back,
        h('h3', {}, 'Sandbox Mode'),
        h('p', { class: 'hint' }, 'Select a particle type from the toolbar, then click in the viewport to place it.'),
        h('p', { class: 'hint' }, 'Electrons settle around the nearest proton. Photons fly toward the nearest electron with the energy chosen under the \u03b3 button. Neutrons head for the nearest free proton and bind to it, releasing a gamma ray.'),
        h('p', { class: 'hint' }, 'An electron absorbs a photon only if its energy matches a jump to a higher orbital (10.2 eV takes 1s to 2p). Otherwise the photon passes straight through.'),
        simplifications(SANDBOX_SIMPLIFICATIONS),
      );
      return;
    }

    const sec = scenario.layman.sections;
    const section = (title: string, text: string, open = false) => {
      const d = h('details', {}, h('summary', {}, title), h('p', {}, text));
      (d as HTMLDetailsElement).open = open;
      return d;
    };

    const science = h('div', { class: 'science-content', id: 'science-content' },
      h('p', { class: 'sci-narrative' }, scenario.scientific.narrative),
      h('div', { class: 'sci-equations' }, ...scenario.scientific.equations.map(eq =>
        h('div', { class: 'equation' },
          h('span', { class: 'eq-label' }, `${eq.label}:`),
          ' ',
          h('span', { class: 'eq-tex' }, eq.tex),
        ),
      )),
      h('div', { class: 'sci-constants' },
        h('strong', {}, 'Constants:'),
        h('ul', {}, ...scenario.scientific.constants.map(c => h('li', {}, c))),
      ),
    );
    science.style.display = 'none';

    const toggle = h('button', { class: 'toggle-science', id: 'toggle-science' }, 'Show Science \u25BC');
    toggle.addEventListener('click', () => {
      const showing = science.style.display !== 'none';
      science.style.display = showing ? 'none' : 'block';
      toggle.textContent = showing ? 'Show Science \u25BC' : 'Hide Science \u25B2';
    });

    this.show(
      back,
      h('div', { class: 'desc-header' },
        h('div', { class: 'desc-title' }, scenario.layman.title),
        h('div', { class: 'desc-summary' }, scenario.layman.summary),
      ),
      h('div', { class: 'desc-sections' },
        section("What's happening", sec.whatsHappening, true),
        section('Why it matters', sec.whyItMatters),
        section('What to watch', sec.whatToWatch),
        section('Fun fact', sec.funFact),
      ),
      toggle,
      science,
      simplifications(scenario.simplifications),
    );
  }

  showParticle(p: ParticleData, onDelete?: () => void): void {
    this.mode = 'particle';
    const line = (text: string) => h('p', {}, text);
    let del: HTMLElement | null = null;
    if (onDelete) {
      del = h('button', { class: 'delete-btn', id: 'delete-particle', title: 'Delete (Del)' }, 'Delete particle');
      del.addEventListener('click', onDelete);
    }
    this.show(
      this.backButton('back-to-desc', '\u2190 Description', () => {
        this.onLeaveParticle?.();
        if (this.currentScenario) this.renderDescription(this.currentScenario);
        else this.renderGallery();
      }),
      h('h3', {}, 'Particle'),
      h('p', {}, h('strong', {}, p.type)),
      line(`x: ${p.position.x.toFixed(1)} fm`),
      line(`y: ${p.position.y.toFixed(1)} fm`),
      line(`z: ${p.position.z.toFixed(1)} fm`),
      line(spinText(p)),
      p.orbital && line(`orbital: n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}`),
      p.energy !== undefined && line(`energy: ${formatEnergy(p.energy)}`),
      p.speed !== undefined && line(`speed: ${p.speed} c`),
      del,
      h('p', { class: 'hint' }, 'Drag a marker to move it (a nucleus moves with its electron clouds). Esc clears the selection.'),
    );
  }

  clearSelection(): void {
    if (this.mode === 'particle') {
      if (this.currentScenario) this.renderDescription(this.currentScenario);
      else this.renderGallery();
    }
  }
}
