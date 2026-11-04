import { ParticleData, Scenario } from '../../shared/types';
import { getPresets, loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';
import { formatEnergy } from '../particles/ParticleLabels';
import { SPEED_OF_LIGHT } from '../../shared/constants';
import { Child, h } from './dom';
import { Tutorial, tutorialSeen } from './Tutorial';
import {
  MyScenarios, ScenarioText, buildScenario, parseScenarioText, serializeScenario, textOf,
} from '../scenarios/userScenarios';
import { openScenarioFile, saveScenarioFile } from '../files';

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
  'A photon above the binding energy (13.6 eV from 1s) that reaches a cloud frees the electron. It leaves perpendicular to the photon\u2019s path, at a random angle around it (the most likely direction for polarized light, chosen once), and its slow departure is fast-forwarded. The proton\u2019s small recoil is not drawn.',
  'A placed neutron heads for the nearest free proton (no other proton or neutron within 20 fm) at 2,200 m/s, the speed of a room-temperature neutron. Its approach is fast-forwarded. Only one neutron approaches at a time; one placed during another approach, or with no free proton, stays where it is placed.',
  'Capture is certain here. A real slow neutron meeting a free proton is about 60 times more likely to bounce off (scattering, 20.5 barn) than to be captured (0.333 barn; NIST neutron data).',
  'Only a free proton captures a neutron; heavier captures such as n + d \u2192 tritium are real but not modeled. A neutron whose proton was moved away before it arrived stops where its approach ended.',
  'The capture gamma ray (2.22 MeV) leaves in a random direction, chosen once so rewinding replays it the same way.',
];


/** Speed as a fraction of c for fast particles, in km/s or m/s for slow ones. */
export function speedText(v: number): string {
  if (v >= 0.01) return `speed: ${+v.toPrecision(3)} c`;
  const ms = v * SPEED_OF_LIGHT;
  return ms >= 1e4 ? `speed: ${+(ms / 1e3).toPrecision(4)} km/s (${+v.toPrecision(3)} c)` : `speed: ${+ms.toPrecision(4)} m/s`;
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
  private currentIsUser = false; // opened from a file or My scenarios: offers "Edit in sandbox"
  private inSandbox = false;
  private sandboxBase: Scenario | null = null; // the user scenario being edited, if any (prefills the save form)
  private galleryMessage: HTMLElement | null = null; // problems from the last file opened
  private myScenarios = new MyScenarios();
  private onLeaveParticle?: () => void;

  private tutorial: Tutorial;

  constructor(container: HTMLElement, engine: SimulationEngine) {
    this.container = container;
    this.engine = engine;
    this.tutorial = new Tutorial(
      () => engine.tutorialFacts(),
      () => this.openPreset('deuterium-formation'),
      () => { if (this.mode === 'description' && this.inSandbox) this.renderSandbox(); },
    );
    this.renderGallery();
  }

  /** Called every frame. */
  update(): void {
    this.tutorial.update();
  }

  private openPreset(key: string): void {
    const scenario = loadPreset(key);
    if (scenario) this.openScenario(scenario, false);
  }

  private openScenario(scenario: Scenario, isUser: boolean): void {
    this.tutorial.stop(false);
    this.engine.loadScenario(scenario.particles, scenario.events, scenario.compressions, scenario.extent);
    this.renderDescription(scenario, isUser);
  }

  private openSandbox(base: Scenario | null): void {
    this.sandboxBase = base;
    if (base) this.engine.loadScenario(base.particles, base.events, base.compressions, base.extent);
    else this.engine.loadScenario([], []);
    if (!base && !tutorialSeen()) this.tutorial.start(); // first visit
    this.renderSandbox();
  }

  /** Back from a particle's details: to whatever the panel showed before. */
  private renderCurrent(): void {
    if (this.inSandbox) this.renderSandbox();
    else if (this.currentScenario) this.renderDescription(this.currentScenario, this.currentIsUser);
    else this.renderGallery();
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
      if (key === 'sandbox') this.openSandbox(null);
      else this.openPreset(key);
    });
    return card;
  }

  private backButton(id: string, text: string, onClick: () => void): HTMLElement {
    const btn = h('button', { class: 'back-btn', id }, text);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private renderGallery(): void {
    this.tutorial.stop(false);
    this.mode = 'gallery';
    this.currentScenario = null;
    this.inSandbox = false;
    const cards = Object.entries(getPresets()).map(([key, s]) => this.card(key, s.name, s.layman?.title ?? s.name, s.layman?.summary ?? s.description));

    const open = h('button', { class: 'panel-btn', id: 'open-scenario-file' }, 'Open scenario file\u2026');
    open.addEventListener('click', () => void this.openFromFile());

    this.show(
      h('h3', {}, 'Explore'),
      h('div', { class: 'scenario-gallery' }, ...cards),
      this.card('sandbox', 'Sandbox', 'Free Exploration', 'Place particles freely and watch them interact', 'sandbox-card'),
      h('h3', {}, 'My scenarios'),
      this.galleryMessage,
      this.myScenarioList(),
      open,
    );
  }

  private myScenarioList(): HTMLElement {
    if (!this.myScenarios.available()) {
      return h('p', { class: 'hint' }, 'Browser storage is not available, so saved scenarios can only be reopened from their files.');
    }
    const entries = this.myScenarios.list();
    if (entries.length === 0) {
      return h('p', { class: 'hint', id: 'my-scenarios-empty' }, 'Scenarios you save from the sandbox appear here (kept in this browser on this device).');
    }
    return h('div', { class: 'scenario-gallery', id: 'my-scenarios' }, ...entries.map(entry => {
      // Stored text is checked again on every read: storage can be edited outside the app.
      const result = parseScenarioText(entry.text);
      const scenario = 'scenario' in result ? result.scenario : null;
      const del = h('button', { class: 'card-delete', title: 'Remove from My scenarios' }, '\u00d7');
      del.addEventListener('click', e => {
        e.stopPropagation();
        this.myScenarios.remove(entry.id);
        this.renderGallery();
      });
      const card = h('div', { class: 'scenario-card user-card', 'data-user-scenario': entry.id },
        del,
        h('div', { class: 'card-name' }, scenario ? scenario.name : 'Invalid scenario'),
        h('div', { class: 'card-summary' }, scenario
          ? scenario.description
          : `Fails the checks: ${'problems' in result ? result.problems[0] : ''}`),
        h('div', { class: 'card-date' }, `Saved ${new Date(entry.savedAt).toLocaleString()}`),
      );
      if (scenario) card.addEventListener('click', () => this.openScenario(scenario, true));
      return card;
    }));
  }

  private async openFromFile(): Promise<void> {
    const result = await openScenarioFile();
    if (!result.ok) {
      if (result.reason === 'canceled') return;
      this.showGalleryProblems('The file could not be opened', [
        result.reason === 'too-large' ? 'It is larger than 1 MB.' : result.message ?? 'Unknown error.',
      ]);
      return;
    }
    const parsed = parseScenarioText(result.text);
    if (!('scenario' in parsed)) {
      this.showGalleryProblems(`${result.fileName} was not loaded: it fails the checks`, parsed.problems);
      return;
    }
    this.galleryMessage = null;
    this.myScenarios.add(serializeScenario(parsed.scenario));
    this.openScenario(parsed.scenario, true);
  }

  private showGalleryProblems(title: string, problems: string[]): void {
    this.galleryMessage = h('div', { class: 'problems', id: 'open-problems' },
      h('strong', {}, title),
      h('ul', {}, ...problems.slice(0, 20).map(p => h('li', {}, p))),
      problems.length > 20 && h('p', {}, `and ${problems.length - 20} more`),
    );
    this.renderGallery();
  }

  private renderSandbox(): void {
    this.mode = 'description';
    this.currentScenario = null;
    this.inSandbox = true;
    const back = this.backButton('back-to-gallery', '\u2190 Scenarios', () => this.renderGallery());
    let tutorialArea: HTMLElement = this.tutorial.element;
    if (!this.tutorial.isActive()) {
      tutorialArea = h('button', { class: 'tutorial-open', id: 'tutorial-open' }, 'Show tutorial: make a deuteron');
      tutorialArea.addEventListener('click', () => {
        this.sandboxBase = null;
        this.engine.loadScenario([], []);
        this.tutorial.start();
        this.renderSandbox();
      });
    }
    const save = h('button', { class: 'panel-btn', id: 'save-scenario' }, 'Save as scenario\u2026');
    const formArea = h('div', { id: 'save-area' });
    save.addEventListener('click', () => formArea.replaceChildren(this.saveForm(formArea)));
    this.show(
      back,
      h('h3', {}, this.sandboxBase ? `Sandbox: editing \u201c${this.sandboxBase.name}\u201d` : 'Sandbox Mode'),
      tutorialArea,
      h('p', { class: 'hint' }, 'Select a particle type from the toolbar, then click in the viewport to place it.'),
      h('p', { class: 'hint' }, 'Electrons settle around the nearest proton. Photons fly toward the nearest electron with the energy chosen under the \u03b3 button. Neutrons head for the nearest free proton and bind to it, releasing a gamma ray.'),
      h('p', { class: 'hint' }, 'An electron absorbs a photon only if its energy matches a jump to a higher orbital (10.2 eV takes 1s to 2p). A photon with more than the binding energy (13.6 eV from 1s; try 21.2 eV) frees the electron instead. Otherwise the photon passes straight through.'),
      save,
      formArea,
      simplifications(SANDBOX_SIMPLIFICATIONS),
    );
  }

  /** Name and description are required; the plain-language and science sections are optional. */
  private saveForm(area: HTMLElement): HTMLElement {
    const start = textOf(this.sandboxBase);
    const field = (key: keyof ScenarioText, label: string, multiline: boolean, required = false) => {
      const input = multiline ? h('textarea', { rows: '3' }) as HTMLTextAreaElement : h('input', { type: 'text' }) as HTMLInputElement;
      input.id = `save-${key}`;
      input.value = start[key] ?? '';
      if (required) input.required = true;
      return { key, input, row: h('label', { class: 'form-row' }, h('span', {}, required ? `${label} (required)` : label), input) };
    };
    const fields = [
      field('name', 'Name', false, true),
      field('description', 'Description', false, true),
      field('whatsHappening', "What's happening", true),
      field('whyItMatters', 'Why it matters', true),
      field('whatToWatch', 'What to watch', true),
      field('funFact', 'Fun fact', true),
      field('science', 'Science notes', true),
    ];
    const status = h('div', { class: 'form-status', id: 'save-status' });
    const submit = h('button', { class: 'panel-btn', id: 'save-submit', type: 'submit' }, window.suigenFiles ? 'Save\u2026' : 'Download file');
    const cancel = h('button', { class: 'panel-btn', type: 'button', id: 'save-cancel' }, 'Cancel');
    cancel.addEventListener('click', () => area.replaceChildren());
    const form = h('form', { class: 'save-form', id: 'save-form' },
      ...fields.map(f => f.row),
      h('p', { class: 'hint' }, 'Saves the scene from the start: every particle, placement, move and deletion, and what happened to them.'),
      h('div', { class: 'form-actions' }, submit, cancel),
      status,
    ) as HTMLFormElement;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = Object.fromEntries(fields.map(f => [f.key, f.input.value])) as unknown as ScenarioText;
      if (!text.name.trim() || !text.description.trim()) {
        status.textContent = 'A name and a description are required.';
        return;
      }
      const scenario = buildScenario(this.engine.exportScenarioData(), text);
      const json = serializeScenario(scenario);
      const check = parseScenarioText(json); // the same checks a reopened file goes through
      if (!('scenario' in check)) {
        status.replaceChildren(h('strong', {}, 'Not saved: the scene fails the checks'), h('ul', {}, ...check.problems.map(p => h('li', {}, p))));
        return;
      }
      const kept = this.myScenarios.add(json);
      const saved = await saveScenarioFile(json, scenario.name);
      const parts: string[] = [];
      if (saved.ok) parts.push(`Saved ${saved.fileName}.`);
      else if (saved.reason === 'canceled') parts.push('No file saved.');
      else parts.push(`The file was not saved: ${saved.reason === 'too-large' ? 'larger than 1 MB' : saved.message ?? saved.reason}.`);
      parts.push(kept.ok ? 'Kept in My scenarios.' : kept.message);
      status.textContent = parts.join(' ');
      this.sandboxBase = scenario;
    });
    return form;
  }

  private renderDescription(scenario: Scenario, isUser = false): void {
    this.mode = 'description';
    this.currentScenario = scenario;
    this.currentIsUser = isUser;
    this.inSandbox = false;
    const back = this.backButton('back-to-gallery', '\u2190 Scenarios', () => this.renderGallery());

    const sec = scenario.layman?.sections ?? {};
    const section = (title: string, text: string | undefined, open = false) => {
      if (!text) return null;
      const d = h('details', {}, h('summary', {}, title), h('p', {}, text));
      (d as HTMLDetailsElement).open = open;
      return d;
    };

    let toggle: HTMLElement | null = null;
    let science: HTMLElement | null = null;
    const sci = scenario.scientific;
    if (sci) {
      science = h('div', { class: 'science-content', id: 'science-content' },
        h('p', { class: 'sci-narrative' }, sci.narrative),
        sci.equations.length > 0 && h('div', { class: 'sci-equations' }, ...sci.equations.map(eq =>
          h('div', { class: 'equation' },
            h('span', { class: 'eq-label' }, `${eq.label}:`),
            ' ',
            h('span', { class: 'eq-tex' }, eq.tex),
          ),
        )),
        sci.constants.length > 0 && h('div', { class: 'sci-constants' },
          h('strong', {}, 'Constants:'),
          h('ul', {}, ...sci.constants.map(c => h('li', {}, c))),
        ),
      );
      science.style.display = 'none';
      const content = science;
      const button = h('button', { class: 'toggle-science', id: 'toggle-science' }, 'Show Science \u25BC');
      button.addEventListener('click', () => {
        const showing = content.style.display !== 'none';
        content.style.display = showing ? 'none' : 'block';
        button.textContent = showing ? 'Show Science \u25BC' : 'Hide Science \u25B2';
      });
      toggle = button;
    }

    let edit: HTMLElement | null = null;
    if (isUser) {
      edit = h('button', { class: 'panel-btn', id: 'edit-in-sandbox' }, 'Edit in sandbox');
      edit.addEventListener('click', () => this.openSandbox(scenario));
    }

    this.show(
      back,
      h('div', { class: 'desc-header' },
        h('div', { class: 'desc-title' }, scenario.layman?.title ?? scenario.name),
        h('div', { class: 'desc-summary' }, scenario.layman?.summary ?? scenario.description),
      ),
      isUser && h('p', { class: 'hint' }, 'A user-made scenario. It passed the same checks as the built-in ones.'),
      edit,
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
        this.renderCurrent();
      }),
      h('h3', {}, 'Particle'),
      h('p', {}, h('strong', {}, p.type)),
      line(`x: ${p.position.x.toFixed(1)} fm`),
      line(`y: ${p.position.y.toFixed(1)} fm`),
      line(`z: ${p.position.z.toFixed(1)} fm`),
      line(spinText(p)),
      p.orbital && line(`orbital: n=${p.orbital.n}, l=${p.orbital.l}, m=${p.orbital.m}`),
      p.energy !== undefined && line(`energy: ${formatEnergy(p.energy)}`),
      p.speed !== undefined && line(speedText(p.speed)),
      del,
      h('p', { class: 'hint' }, 'Drag a marker to move it (a nucleus moves with its electron clouds). Esc clears the selection.'),
    );
  }

  clearSelection(): void {
    if (this.mode === 'particle') {
      this.renderCurrent();
    }
  }
}
