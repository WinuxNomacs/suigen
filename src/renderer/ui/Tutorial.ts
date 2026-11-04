// Sandbox tutorial: guides the user through making a proton and a neutron form a deuteron.
// Steps advance from what actually happens in the scene (see TutorialFacts), not from clicks on the card.
import { h } from './dom';
import { formatEnergy } from '../particles/ParticleLabels';
import { NP_CAPTURE_GAMMA_EV } from '../../shared/constants';

export interface TutorialFacts {
  protons: number;
  neutronsAtRest: number;
  capturesRecorded: number; // capture events in the log (a neutron is on its way, or has arrived)
  capturesHappened: number; // capture events already played
}

export type TutorialStep = 'proton' | 'neutron' | 'play' | 'done';
const ORDER: TutorialStep[] = ['proton', 'neutron', 'play', 'done'];

/** Next step. Steps only move forward, so rewinding after a step doesn't undo it. */
export function nextStep(step: TutorialStep, f: TutorialFacts): TutorialStep {
  let target: TutorialStep = 'proton';
  if (f.capturesHappened > 0) target = 'done';
  else if (f.capturesRecorded > 0) target = 'play';
  else if (f.protons > 0) target = 'neutron';
  return ORDER.indexOf(target) > ORDER.indexOf(step) ? target : step;
}

const STORAGE_KEY = 'suigen.tutorialSeen';

/** True when the tutorial has been finished or skipped before. Storage can be unavailable: then show it. */
export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Not remembered: the tutorial shows again next time.
  }
}

const TARGETS: Partial<Record<TutorialStep, string>> = {
  proton: '[data-type="proton"]',
  neutron: '[data-type="neutron"]',
  play: '#btn-play',
};

export class Tutorial {
  readonly element: HTMLElement;
  private step: TutorialStep = 'proton';
  private active = false;
  private atRestHint = false;
  private highlighted: Element | null = null;

  constructor(
    private readFacts: () => TutorialFacts,
    private openDeuteriumScenario: () => void,
    private onClose: () => void,
  ) {
    this.element = h('div', { class: 'tutorial', id: 'tutorial' });
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    this.active = true;
    this.step = 'proton';
    this.atRestHint = false;
    this.render();
  }

  /** Ends the tutorial (skip, done, or leaving the sandbox) and remembers that it was seen. */
  stop(remember = true): void {
    if (remember) markSeen();
    this.active = false;
    this.highlight(null);
    this.element.replaceChildren();
  }

  /** Called every frame while the sandbox is open. */
  update(): void {
    if (!this.active) return;
    const f = this.readFacts();
    const step = nextStep(this.step, f);
    const atRestHint = step === 'neutron' && f.neutronsAtRest > 0;
    if (step !== this.step || atRestHint !== this.atRestHint) {
      this.step = step;
      this.atRestHint = atRestHint;
      this.render();
    }
  }

  private highlight(selector: string | undefined | null): void {
    this.highlighted?.classList.remove('tutorial-target');
    this.highlighted = selector ? document.querySelector(selector) : null;
    this.highlighted?.classList.add('tutorial-target');
  }

  private render(): void {
    this.highlight(TARGETS[this.step]);
    const skip = h('button', { class: 'tutorial-skip', id: 'tutorial-skip', title: 'Close the tutorial' }, 'Skip');
    skip.addEventListener('click', () => this.close());
    const n = ORDER.indexOf(this.step) + 1;

    const body: Node[] = [];
    switch (this.step) {
      case 'proton':
        body.push(h('p', {}, 'Click the p⁺ button in the toolbar, then click the floor of the scene to place a proton.'));
        break;
      case 'neutron':
        body.push(h('p', {}, 'Now click the n⁰ button, then click the floor away from the proton. The neutron will head for the proton.'));
        if (this.atRestHint) {
          body.push(h('p', { class: 'tutorial-hint' }, 'A neutron is sitting still: neutrons only head for a proton with no other proton or neutron within 20 fm. Select it and press Delete, then place one farther away.'));
        }
        break;
      case 'play':
        body.push(h('p', {}, 'Press ▶ to play. A real slow neutron would take tens to hundreds of femtoseconds to cross this distance, so its approach is fast-forwarded: the timeline says so while it happens.'));
        break;
      case 'done': {
        body.push(h('p', {}, `The neutron and proton bound into a deuteron, the nucleus of heavy hydrogen. The binding energy left as a ${formatEnergy(NP_CAPTURE_GAMMA_EV)} gamma-ray photon, the yellow trail. Press ⏮ and ▶ to watch it again.`));
        const open = h('button', { class: 'tutorial-action', id: 'tutorial-open-deuterium' }, 'See the Deuterium Formation scenario');
        open.addEventListener('click', () => {
          this.close();
          this.openDeuteriumScenario();
        });
        const done = h('button', { class: 'tutorial-action', id: 'tutorial-done' }, 'Done');
        done.addEventListener('click', () => this.close());
        body.push(h('div', { class: 'tutorial-actions' }, open, done));
        break;
      }
    }

    this.element.replaceChildren(
      h('div', { class: 'tutorial-header' },
        h('strong', {}, this.step === 'done' ? 'Tutorial: done' : `Tutorial: make a deuteron (step ${n} of 3)`),
        skip,
      ),
      ...body,
    );
  }

  private close(): void {
    this.stop();
    this.onClose();
  }
}
