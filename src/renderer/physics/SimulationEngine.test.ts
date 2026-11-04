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
    a.engine.play();
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

  it('records a deletion that rewinding undoes', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    engine.seek(50);
    engine.removeUserParticle('e');
    expect(pm.getParticle('e')).toBeUndefined();
    engine.seek(20); // before the deletion
    expect(pm.getParticle('e')).toBeDefined();
    engine.seek(80); // replay deletes it again
    expect(pm.getParticle('e')).toBeUndefined();
  });

  it('records a move that rewinding undoes, and absorbs photons at the new position', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    const at = { x: 0, y: 0, z: 300000 };
    engine.seek(10);
    engine.moveParticles([{ id: 's0', position: at }, { id: 'e', position: at }]);
    expect(pm.getParticle('e')!.data.position).toEqual(at);
    engine.seek(5);
    expect(pm.getParticle('e')!.data.position).toEqual({ x: 0, y: 0, z: 0 });
    engine.seek(10);
    expect(pm.getParticle('e')!.data.position).toEqual(at);

    // Fired along x through the old position: misses the moved atom (1s radius 140,761 fm).
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    // Fired along x through the new position: absorbed.
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 300000 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    engine.seek(150);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
    expect(pm.getAllParticles().filter(p => p.type === 'photon').map(p => p.position.z)).toEqual([0]);
  });

  it('does not move particles whose path is fixed', () => {
    const { pm, engine } = setup();
    engine.loadScenario(hydrogen, []);
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 5 });
    const id = pm.getAllParticles().find(p => p.type === 'photon')!.id;
    expect(engine.isMoving(id)).toBe(true);
    engine.moveParticles([{ id, position: { x: 0, y: 0, z: 0 } }]);
    expect(pm.getParticle(id)!.data.position.x).toBe(-600000);
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

  it('duration ends when the last moving particle leaves the scene', () => {
    const { engine } = setup();
    const load = (key: string) => {
      const s = loadPreset(key)!;
      engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
      return engine.getDuration();
    };
    // Recoil electron from the origin at 0.2472c to 2 × 450,000 fm, starting at tick 120.
    expect(load('compton-scattering')).toBeCloseTo(120 + 900000 / (5000 * 0.2472) + 1, 6); // +1 tick margin
    // Emitted photon from the origin at c, starting at tick 150.
    expect(load('photon-emission')).toBeCloseTo(150 + 900000 / 5000 + 1, 6);
    // Nothing moves after the absorption: the floor is light leaving from the centre.
    expect(load('photon-absorption')).toBeCloseTo(900000 / 5000, 6);
  });

  it('nothing changes after the duration', () => {
    const { pm, engine } = setup();
    for (const key of ['compton-scattering', 'photon-emission', 'deuterium-formation']) {
      const s = loadPreset(key)!;
      engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
      const end = engine.getDuration();
      engine.seek(end + 1e-6);
      const atEnd = pm.snapshot();
      engine.seek(end * 3);
      expect(pm.snapshot()).toBe(atEnd);
      engine.seek(end - 2); // the last exit is at end - 1 (EXIT_MARGIN_TICKS)
      expect(pm.snapshot()).not.toBe(atEnd);
    }
  });

  it('reset returns to the start and pauses', () => {
    const { pm, engine } = setup();
    const s = loadPreset('photon-absorption')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    const start = pm.snapshot();
    engine.play();
    engine.seek(200);
    engine.reset();
    expect(engine.state.time).toBe(0);
    expect(engine.state.playing).toBe(false);
    expect(pm.snapshot()).toBe(start);
  });

  it('playback pauses at the end; play there stays put until reset', () => {
    const { pm, engine } = setup();
    const s = loadPreset('photon-emission')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    const start = pm.snapshot();
    const end = engine.getDuration();
    engine.play();
    for (let i = 0; i < 100; i++) engine.tick(10);
    expect(engine.state.time).toBe(end);
    expect(engine.state.playing).toBe(false);
    expect(pm.getAllParticles().some(p => p.type === 'photon')).toBe(false); // departed by the end
    engine.play();
    expect(engine.state.time).toBe(end);
    expect(engine.state.playing).toBe(false);
    engine.setSpeed(-1); // reversing from the end works
    engine.play();
    expect(engine.state.playing).toBe(true);
    engine.reset();
    expect(engine.state.time).toBe(0);
    expect(pm.snapshot()).toBe(start);
  });

  it('play continues from the current time after pausing or changing speed', () => {
    const a = setup();
    const b = setup();
    const s = loadPreset('compton-scattering')!;
    a.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    b.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    a.engine.play();
    for (let i = 0; i < 50; i++) a.engine.tick(2); // t = 100
    a.engine.pause();
    a.engine.tick(50); // paused: no change
    a.engine.setSpeed(0.25);
    a.engine.play();
    expect(a.engine.state.time).toBe(100);
    for (let i = 0; i < 40; i++) a.engine.tick(2); // +20 at 0.25x
    a.engine.setSpeed(-0.5); // change while playing
    expect(a.engine.state.time).toBe(120);
    for (let i = 0; i < 10; i++) a.engine.tick(2); // -10
    b.engine.seek(110);
    expect(a.engine.state.time).toBeCloseTo(110, 9);
    expect(a.pm.snapshot()).toBe(b.pm.snapshot());
  });

  it('reverse playback matches seeking and stops at the start', () => {
    const a = setup();
    const b = setup();
    const s = loadPreset('compton-scattering')!;
    a.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    b.engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    a.engine.seek(800);
    a.engine.setSpeed(-2);
    a.engine.play();
    for (let i = 0; i < 175; i++) a.engine.tick(2); // 800 - 175 * 4 = 100: back across the scattering
    b.engine.seek(100);
    expect(a.pm.snapshot()).toBe(b.pm.snapshot());
    for (let i = 0; i < 100; i++) a.engine.tick(2);
    expect(a.engine.state.time).toBe(0);
    expect(a.engine.state.playing).toBe(false);
  });

  it('speed 0 holds the scene still', () => {
    const { engine } = setup();
    const s = loadPreset('photon-absorption')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(50);
    engine.setSpeed(0);
    engine.play();
    engine.tick(100);
    expect(engine.state.time).toBe(50);
  });
});
