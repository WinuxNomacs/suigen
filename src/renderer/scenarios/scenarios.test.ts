import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RAW_PRESETS, validateScenario, loadPreset } from './ScenarioLoader';
import { ScenarioSchema } from '../../shared/scenarioSchema';
import { ELECTRON_MASS, EV_TO_JOULES, SPEED_OF_LIGHT } from '../../shared/constants';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const problemsOf = (raw: unknown) => {
  const r = validateScenario(raw);
  return 'problems' in r ? r.problems : [];
};

describe('bundled scenarios', () => {
  it.each(Object.keys(RAW_PRESETS))('%s is valid', key => {
    expect(problemsOf(RAW_PRESETS[key])).toEqual([]);
  });
});

describe('scenario validation catches mistakes', () => {
  const absorption = RAW_PRESETS['photon-absorption'] as { events: Array<Record<string, unknown>> };

  it('a misspelled key', () => {
    const s = clone(RAW_PRESETS['hydrogen-ground-state']) as Record<string, unknown>;
    s.particels = [];
    expect(problemsOf(s).join()).toMatch(/particels/);
  });

  it('a photon energy that matches no transition', () => {
    const s = clone(absorption);
    (s.events[0].particle as Record<string, unknown>).energy = 11;
    expect(problemsOf(s).join()).toMatch(/does not match 1s -> 2p/);
  });

  it('a transition that breaks the selection rule', () => {
    const s = clone(absorption);
    s.events[1].targetOrbital = { n: 2, l: 0, m: 0 };
    expect(problemsOf(s).join()).toMatch(/selection rule/);
  });

  it('an event that refers to a missing particle', () => {
    const s = clone(RAW_PRESETS['compton-scattering']) as { events: Array<Record<string, unknown>> };
    s.events[1].targetId = 'nobody';
    expect(problemsOf(s).join()).toMatch(/no particle nobody/);
  });

  it('a move event for a missing or moving particle', () => {
    const s = clone(RAW_PRESETS['photon-absorption']) as { events: Array<Record<string, unknown>> };
    s.events.push({ time: 5, action: 'move', targetId: 'photon1', position: { x: 0, y: 0, z: 0 } });
    s.events.push({ time: 6, action: 'move', targetId: 'ghost', position: { x: 0, y: 0, z: 0 } });
    const problems = problemsOf(s).join();
    expect(problems).toMatch(/photon1 is moving/);
    expect(problems).toMatch(/no particle ghost/);
  });

  it('accepts a valid move event', () => {
    const s = clone(RAW_PRESETS['hydrogen-ground-state']) as { events: Array<Record<string, unknown>> };
    s.events.push({ time: 5, action: 'move', targetId: 's0', position: { x: 1, y: 0, z: 0 } });
    expect(problemsOf(s)).toEqual([]);
  });

  it('a massive particle moving at c outside a compressed span', () => {
    const s = clone(RAW_PRESETS['deuterium-formation']) as Record<string, unknown>;
    delete s.compressions;
    expect(problemsOf(s).join()).toMatch(/neutron cannot move at c/);
  });
});

describe('Compton scenario physics', () => {
  const s = loadPreset('compton-scattering')!;
  const spawned = (id: string) => s.events.find(e => e.action === 'spawn' && e.particle?.id === id)!.particle!;
  const mc2 = (ELECTRON_MASS * SPEED_OF_LIGHT ** 2) / EV_TO_JOULES; // 510,998.95 eV
  const E = spawned('photon1').energy!;
  const scattered = spawned('photon2');
  const electron = spawned('e2');
  const theta = Math.PI / 2; // photon1 along +x, photon2 along +y

  it('scattered photon energy follows the Compton formula', () => {
    const expected = E / (1 + (E / mc2) * (1 - Math.cos(theta)));
    expect(Math.abs(scattered.energy! - expected) / expected).toBeLessThan(1e-3);
  });

  it('conserves energy and momentum', () => {
    const T = electron.energy!;
    expect(Math.abs(E - scattered.energy! - T) / T).toBeLessThan(1e-3);
    // Momentum in eV/c: incoming photon (E, 0) = scattered photon (0, E') + electron p·(cos φ, sin φ)
    const p = Math.sqrt(T * T + 2 * T * mc2);
    const d = electron.direction!;
    const len = Math.hypot(d.x, d.y, d.z);
    expect(Math.abs((p * d.x) / len - E) / E).toBeLessThan(1e-3);
    expect(Math.abs((p * d.y) / len + scattered.energy!) / scattered.energy!).toBeLessThan(1e-3);
  });

  it('electron speed matches its kinetic energy', () => {
    const gamma = 1 + electron.energy! / mc2;
    expect(electron.speed!).toBeCloseTo(Math.sqrt(1 - 1 / gamma ** 2), 3);
  });
});

describe('JSON Schema for editors', () => {
  it('is up to date (regenerate with: npm test -- -u)', async () => {
    const schema = JSON.stringify(z.toJSONSchema(ScenarioSchema), null, 2) + '\n';
    await expect(schema).toMatchFileSnapshot('../../shared/scenario.schema.json');
  });
});
