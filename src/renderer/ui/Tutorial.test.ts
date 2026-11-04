import { describe, expect, it } from 'vitest';
import { nextStep, TutorialFacts } from './Tutorial';

const facts = (f: Partial<TutorialFacts>): TutorialFacts => ({ protons: 0, neutronsAtRest: 0, capturesRecorded: 0, capturesHappened: 0, ...f });

describe('tutorial steps', () => {
  it('advance with what happens in the scene', () => {
    expect(nextStep('proton', facts({}))).toBe('proton');
    expect(nextStep('proton', facts({ protons: 1 }))).toBe('neutron');
    expect(nextStep('neutron', facts({ protons: 1, neutronsAtRest: 1 }))).toBe('neutron'); // neutron at rest: no capture coming
    expect(nextStep('neutron', facts({ protons: 1, capturesRecorded: 1 }))).toBe('play');
    expect(nextStep('play', facts({ protons: 1, capturesRecorded: 1, capturesHappened: 1 }))).toBe('done');
  });

  it('never go back (rewinding or deleting after a step)', () => {
    expect(nextStep('neutron', facts({ protons: 0 }))).toBe('neutron');
    expect(nextStep('done', facts({ protons: 1, capturesRecorded: 1 }))).toBe('done');
  });

  it('can skip ahead when the user is faster than the card', () => {
    expect(nextStep('proton', facts({ protons: 1, capturesRecorded: 1, capturesHappened: 1 }))).toBe('done');
  });
});
