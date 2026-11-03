import { describe, expect, it } from 'vitest';
import { SimulationEngine } from './SimulationEngine';
import { FakeParticleManager } from '../../test/FakeParticleManager';
import { loadPreset } from '../scenarios/ScenarioLoader';
import { ScenarioEvent } from '../../shared/types';

function setup() {
  const pm = new FakeParticleManager();
  const engine = new SimulationEngine(pm.asManager());
  return { pm, engine };
}

const hydrogen = [
  { type: 'proton' as const, position: { x: 0, y: 0, z: 0 } },
  { id: 'e', type: 'electron' as const, position: { x: 0, y: 0, z: 0 }, orbital: { n: 1, l: 0, m: 0 } },
];

describe('SimulationEngine', () => {
  it('gives the same scene after rewinding and replaying', () => {
    const { pm, engine } = setup();
    const s = loadPreset('photon-absorption')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(200);
    const first = pm.snapshot();
    engine.seek(50);
    expect(pm.getParticle('e1')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });
    engine.seek(200);
    expect(pm.snapshot()).toBe(first);
    expect(pm.getParticle('e1')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
  });

  it('gives the same scene whether played frame by frame or seeked directly', () => {
    const a = setup();
    const b = setup();
    const s = loadPreset('compton-scattering')!;
    a.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    b.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    for (let i = 0; i < 300; i++) a.engine.tick(0.5);
    b.engine.seek(150);
    expect(a.pm.snapshot()).toBe(b.pm.snapshot());
  });

  it('keeps sandbox placements across rewinds and records an absorption once', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    const absorbs: ScenarioEvent[] = [];
    engine.setOnEvent(e => { if (e.action === 'absorb') absorbs.push(e); });

    engine.seek(10);
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    engine.seek(200);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
    expect(pm.getAllParticles().some(p => p.type === 'photon')).toBe(false);
    expect(absorbs).toHaveLength(1);

    engine.seek(5); // before the photon was placed
    expect(pm.getAllParticles().some(p => p.type === 'photon')).toBe(false);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });

    engine.seek(200); // replay: the photon comes back and is absorbed again, once
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
    expect(absorbs).toHaveLength(2);
  });

  it('absorbs at the exact moment the photon enters the cloud, even when seeking past it', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    const absorbs: ScenarioEvent[] = [];
    engine.setOnEvent(e => { if (e.action === 'absorb') absorbs.push(e); });
    engine.seek(10);
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    engine.seek(1000); // one jump far past the cloud
    // Enters the 1s cloud (90% radius 2.66 a0 = 140,761 fm) after 459,239 fm at 5,000 fm/tick.
    expect(absorbs).toHaveLength(1);
    expect(absorbs[0].time).toBeCloseTo(10 + (600000 - 140761) / 5000, 1);
    engine.seek(101);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });
    engine.seek(102);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
  });

  it('lets a non-matching photon pass through, then removes it once it leaves', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 5 });
    engine.seek(150); // photon at +150,000 fm, past the nucleus
    expect(pm.getAllParticles().filter(p => p.type === 'photon')).toHaveLength(1);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });
    engine.seek(400); // +1,400,000 fm: beyond 2x the default extent (846,700 fm)
    expect(pm.getAllParticles().filter(p => p.type === 'photon')).toHaveLength(0);
  });

  it('moves a massive particle at its own speed', () => {
    const { pm, engine } = setup();
    const s = loadPreset('compton-scattering')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(220); // 100 ticks after scattering
    const e2 = pm.getParticle('e2')!.data.position;
    const photon = pm.getParticle('photon2')!.data.position;
    expect(Math.hypot(e2.x, e2.y, e2.z) / Math.hypot(photon.x, photon.y, photon.z)).toBeCloseTo(0.2472, 4);
  });

  it('reports real time for the loaded scenario', () => {
    const { engine } = setup();
    const s = loadPreset('photon-emission')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(75);
    expect(engine.getRealTime().activeLabel).toBe('average 2p lifetime');
    engine.seek(150);
    expect(engine.getRealTime().fs).toBeCloseTo(1.6e6, 3);
  });
});
