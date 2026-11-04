import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RAW_PRESETS, validateScenario, loadPreset } from './ScenarioLoader';
import { ScenarioSchema } from '../../shared/scenarioSchema';
import {
  DEUTERON_MASS, ELECTRON_MASS, EV_TO_JOULES, FINE_STRUCTURE, HBAR, NEUTRON_MASS, PROTON_MASS, SPEED_OF_LIGHT,
} from '../../shared/constants';
import { energyLevel } from '../physics/transitions';
import { orbitalRadius } from '../particles/OrbitalMesh';

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

  it('an impossible spin projection', () => {
    const s = clone(RAW_PRESETS['helium-atom']) as { particles: Array<Record<string, unknown>> };
    s.particles[4].spin = 1;
    expect(problemsOf(s).join()).toMatch(/spin projection must be 0.5 or -0.5/);
  });

  it('a capture with the wrong gamma energy or a bound proton', () => {
    const s = clone(RAW_PRESETS['deuterium-formation']) as { events: Array<Record<string, unknown>> };
    (s.events[0].particle as Record<string, unknown>).energy = 2224566; // binding energy, ignoring the recoil
    expect(problemsOf(s).join()).toMatch(/does not match n \+ p -> d/);
    const twice = clone(RAW_PRESETS['deuterium-formation']) as { particles: unknown[]; events: Array<Record<string, unknown>> };
    twice.particles.push({ id: 'n2', type: 'neutron', position: { x: 9, y: 0, z: 0 } });
    twice.events.push({ ...clone(twice.events[0]), time: 130, neutronId: 'n2', particle: { type: 'photon', direction: { x: 1, y: 0, z: 0 }, energy: 2223249 } });
    expect(problemsOf(twice).join()).toMatch(/only a free neutron and a free proton/);
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

const mc2Ev = (kg: number) => (kg * SPEED_OF_LIGHT ** 2) / EV_TO_JOULES;
const text = (key: string) => JSON.stringify(RAW_PRESETS[key]);

describe('numbers in scenario text', () => {
  it('Lyman-alpha photons carry the 1s-2p gap', () => {
    const gap = energyLevel(2) - energyLevel(1);
    for (const key of ['photon-absorption', 'photon-emission']) {
      const s = loadPreset(key)!;
      const photon = s.events.map(e => e.particle).find(p => p?.type === 'photon')!;
      expect(Math.abs(photon.energy! - gap)).toBeLessThan(1e-4);
    }
  });

  it('2p decay rate: A = (2/3)^8 α^5 m_e c² / ħ × μ/m_e = 6.26 × 10^8 /s', () => {
    const mu = 1 / (1 + ELECTRON_MASS / PROTON_MASS);
    const A = (2 / 3) ** 8 * FINE_STRUCTURE ** 5 * (ELECTRON_MASS * SPEED_OF_LIGHT ** 2) / HBAR * mu;
    expect(text('photon-emission')).toContain(`A₂₁ = ${(A / 1e8).toFixed(2)} × 10⁸ s⁻¹`);
    expect(1e9 / A).toBeCloseTo(1.596, 3); // ns, shown rounded as 1.6 ns
  });

  it('helium cloud radius in the text matches the drawn cloud', () => {
    const pm = orbitalRadius({ n: 1, l: 0, m: 0 }, 27 / 16) / 1000;
    expect(text('helium-atom')).toContain(`${pm.toFixed(1)} pm`);
  });

  it('deuterium gamma ray: E = (M² - m_d²) / 2M with M = m_p + m_n (deuteron recoil included)', () => {
    const M = mc2Ev(PROTON_MASS) + mc2Ev(NEUTRON_MASS);
    const md = mc2Ev(DEUTERON_MASS);
    expect(M - md).toBeCloseTo(2224566, -1); // binding energy, eV
    const s = loadPreset('deuterium-formation')!;
    const photon = s.events.map(e => e.particle).find(p => p?.type === 'photon')!;
    expect(Math.abs(photon.energy! - (M * M - md * md) / (2 * M))).toBeLessThan(2);
  });
});

describe('JSON Schema for editors', () => {
  it('is up to date (regenerate with: npm test -- -u)', async () => {
    const schema = JSON.stringify(z.toJSONSchema(ScenarioSchema), null, 2) + '\n';
    await expect(schema).toMatchFileSnapshot('../../shared/scenario.schema.json');
  });
});
