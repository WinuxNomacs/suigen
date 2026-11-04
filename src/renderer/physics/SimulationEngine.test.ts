import { describe, expect, it } from 'vitest';
import { ELECTRON_DEPARTURE_LABEL, NEUTRON_APPROACH_LABEL, SimulationEngine, electronSpeed } from './SimulationEngine';
import { FakeParticleManager } from '../../test/FakeParticleManager';
import { loadPreset } from '../scenarios/ScenarioLoader';
import { buildScenario, parseScenarioText, serializeScenario } from '../scenarios/userScenarios';
import { ScenarioEvent } from '../../shared/types';
import { NP_CAPTURE_GAMMA_EV, NUCLEON_SPACING_FM, SPEED_OF_LIGHT_FM_PER_FS } from '../../shared/constants';
import { ionizationKineticEnergy } from './transitions';

// Tests below set speed and loop explicitly; the app defaults (0.25x, loop on) have their own test.
function setup() {
  const pm = new FakeParticleManager();
  const engine = new SimulationEngine(pm.asManager());
  engine.setSpeed(1);
  engine.setLoop(false);
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

    // Fired along x 600,000 fm from the moved atom: misses it, even after the absorption grows the cloud
    // to 2p (radius 422,800 fm), where 10.2 eV would ionize it (n = 2 binding energy 3.4 eV).
    engine.addUserParticle('photon', { x: -600000, y: 0, z: -300000 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    // Fired along x through the new position: absorbed.
    engine.addUserParticle('photon', { x: -600000, y: 0, z: 300000 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.2 });
    engine.seek(150);
    expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 2, l: 1, m: 0 });
    expect(pm.getAllParticles().filter(p => p.type === 'photon').map(p => p.position.z)).toEqual([-300000]);
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
    expect(load('compton-scattering')).toBeCloseTo(120 + 900000 / (5000 * 0.2472) + 1, 4); // +1 tick margin
    // Emitted photon from the origin at c, starting at tick 150.
    expect(load('photon-emission')).toBeCloseTo(150 + 900000 / 5000 + 1, 4);
    // Nothing moves after the absorption: the floor is light leaving from the centre.
    expect(load('photon-absorption')).toBeCloseTo(900000 / 5000, 4);
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

  it('defaults to 0.25x with loop on', () => {
    const engine = new SimulationEngine(new FakeParticleManager().asManager());
    expect(engine.state.speed).toBe(0.25);
    expect(engine.state.loop).toBe(true);
  });

  it('loop restarts from the start at the end and keeps playing', () => {
    const { pm, engine } = setup();
    const s = loadPreset('photon-absorption')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    const start = pm.snapshot();
    const end = engine.getDuration();
    engine.setLoop(true);
    engine.play();
    for (let t = 0; t + 10 < end; t += 10) engine.tick(10);
    engine.tick(10); // crosses the end
    expect(engine.state.time).toBe(0);
    expect(engine.state.playing).toBe(true);
    expect(pm.snapshot()).toBe(start);
    engine.tick(30);
    expect(engine.state.time).toBe(30);
  });

  it('loop in reverse wraps from the start to the end', () => {
    const { engine } = setup();
    const s = loadPreset('photon-emission')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.setLoop(true);
    engine.setSpeed(-1);
    engine.seek(5);
    engine.play();
    engine.tick(10);
    expect(engine.state.time).toBe(engine.getDuration());
    expect(engine.state.playing).toBe(true);
  });

  it('play at the end starts over when loop is on', () => {
    const { engine } = setup();
    const s = loadPreset('photon-emission')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(engine.getDuration());
    engine.setLoop(true);
    engine.play();
    expect(engine.state.time).toBe(0);
    expect(engine.state.playing).toBe(true);
  });

  describe('sandbox neutron capture', () => {
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const sandbox = () => {
      const t = setup();
      t.engine.loadScenario([], []);
      t.engine.addUserParticle('proton', at(0));
      return t;
    };
    const photons = (pm: FakeParticleManager) => pm.getAllParticles().filter(p => p.type === 'photon');
    const neutrons = (pm: FakeParticleManager) => pm.getAllParticles().filter(p => p.type === 'neutron');

    it('a neutron heads for a free proton, binds, and emits the capture gamma', () => {
      const { pm, engine } = sandbox();
      expect(engine.addUserNeutron(at(200000))).toBe(true);
      const arrival = (200000 - NUCLEON_SPACING_FM) / 5000;
      engine.seek(arrival / 2);
      expect(engine.getRealTime().activeLabel).toBe(NEUTRON_APPROACH_LABEL);
      expect(neutrons(pm)[0].position.x).toBeCloseTo(100000 + NUCLEON_SPACING_FM / 2, 3);
      engine.seek(arrival + 1);
      expect(neutrons(pm)[0].position.x).toBeCloseTo(NUCLEON_SPACING_FM, 6);
      expect(photons(pm)).toHaveLength(1);
      expect(photons(pm)[0].energy).toBe(NP_CAPTURE_GAMMA_EV);
      // 199,998.5 fm at 2,200 m/s (= 2,200 fm/fs) took 90.9 fs; then 1 tick of light travel.
      expect(engine.getRealTime().fs).toBeCloseTo((200000 - NUCLEON_SPACING_FM) / 2200 + 1 * (5000 / 2.99792458e8), 6);
      expect(engine.getRealTime().approximate).toBe(true);
    });

    it('rewinding before the capture brings back the moving neutron; replay matches', () => {
      const { pm, engine } = sandbox();
      engine.addUserNeutron(at(-150000));
      engine.seek(100);
      const after = pm.snapshot();
      engine.seek(10);
      expect(photons(pm)).toHaveLength(0);
      engine.seek(100);
      expect(pm.snapshot()).toBe(after);
    });

    it('a second neutron during an approach, or with no free proton, stays at rest', () => {
      const { pm, engine } = sandbox();
      engine.addUserNeutron(at(200000));
      expect(engine.addUserNeutron(at(0.5 * 200000 + 50000))).toBe(false); // overlaps the first approach
      engine.seek(100);
      expect(engine.addUserNeutron(at(300000))).toBe(false); // the proton is now a deuteron
      expect(neutrons(pm).filter(n => engine.isMoving(n.id))).toHaveLength(0);
      expect(photons(pm)).toHaveLength(1);
    });

    it('deleting the neutron mid-approach ends the fast-forward there and nothing is captured', () => {
      const { pm, engine } = sandbox();
      engine.addUserNeutron(at(200000));
      engine.seek(10);
      const id = neutrons(pm)[0].id;
      engine.removeUserParticle(id);
      engine.seek(100);
      expect(photons(pm)).toHaveLength(0);
      // 10 ticks of the approach stood for 10/39.9997 of its real time.
      expect(engine.getRealTime().fs).toBeCloseTo(((200000 - NUCLEON_SPACING_FM) / 2200) * (10 / ((200000 - NUCLEON_SPACING_FM) / 5000)) + 90 * (5000 / 2.99792458e8), 6);
    });

    it('a neutron whose proton was moved stops where its approach ended, with no gamma', () => {
      const { pm, engine } = sandbox();
      engine.addUserNeutron(at(200000));
      engine.seek(5);
      const proton = pm.getAllParticles().find(p => p.type === 'proton')!;
      engine.moveParticles([{ id: proton.id, position: { x: 0, y: 0, z: 100000 } }]);
      engine.seek(100);
      expect(photons(pm)).toHaveLength(0);
      expect(neutrons(pm)[0].position.x).toBeCloseTo(NUCLEON_SPACING_FM, 6);
      expect(engine.isMoving(neutrons(pm)[0].id)).toBe(false);
    });
  });

  it('reports tutorial facts', () => {
    const { engine } = setup();
    engine.loadScenario([], []);
    expect(engine.tutorialFacts()).toEqual({ protons: 0, neutronsAtRest: 0, capturesRecorded: 0, capturesHappened: 0 });
    engine.addUserNeutron({ x: 5, y: 0, z: 0 }); // no proton yet: at rest
    expect(engine.tutorialFacts().neutronsAtRest).toBe(1);
    engine.addUserParticle('proton', { x: 300000, y: 0, z: 0 }); // the resting neutron is far: proton is free
    engine.addUserNeutron({ x: 300000, y: 0, z: 100000 });
    expect(engine.tutorialFacts()).toEqual({ protons: 1, neutronsAtRest: 1, capturesRecorded: 1, capturesHappened: 0 });
    engine.seek(100);
    expect(engine.tutorialFacts()).toEqual({ protons: 1, neutronsAtRest: 1, capturesRecorded: 1, capturesHappened: 1 });
  });

  it('the deuterium preset captures through the same rule', () => {
    const { pm, engine } = setup();
    const s = loadPreset('deuterium-formation')!;
    engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
    engine.seek(121);
    const n = pm.getAllParticles().find(p => p.type === 'neutron')!;
    expect(n.position).toEqual({ x: 1.5, y: 0, z: 0 });
    expect(pm.getAllParticles().filter(p => p.type === 'photon')).toHaveLength(1);
  });

  describe('ionization', () => {
    it('the scenario frees the electron, which leaves at its real speed through the fast-forward', () => {
      const { pm, engine } = setup();
      const s = loadPreset('hydrogen-ionization')!;
      engine.loadScenario(s.particles, s.events, s.compressions, s.extent);
      engine.seek(79);
      expect(pm.getParticle('e1')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });
      engine.seek(180); // halfway through the departure span
      const e = pm.getParticle('e1')!.data;
      expect(e.orbital).toBeUndefined();
      expect(e.position.y).toBeCloseTo(250000, 0); // 0.5 × 500,000 fm
      expect(engine.getRealTime().activeLabel).toBe('freed electron leaving (1,637 km/s)');
      engine.seek(282);
      expect(pm.getParticle('e1')).toBeUndefined(); // left the scene
      engine.seek(100);
      expect(pm.getParticle('e1')!.data.orbital).toBeUndefined();
      engine.seek(10);
      expect(pm.getParticle('e1')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 }); // rewind restores the atom
    });

    it('a sandbox photon above the threshold ionizes, perpendicular to its path, with a fast-forward', () => {
      const { pm, engine } = setup();
      engine.loadScenario(hydrogen, []);
      engine.addUserParticle('photon', { x: -400000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 21.218 });
      engine.seek(70);
      const e = pm.getParticle('e')!.data;
      expect(e.orbital).toBeUndefined();
      const T = ionizationKineticEnergy(21.218, 1)!;
      expect(e.energy).toBeCloseTo(T, 9);
      expect(e.speed).toBeCloseTo(electronSpeed(T), 12);
      expect(engine.getRealTime().activeLabel).toBe(ELECTRON_DEPARTURE_LABEL);
      // Moving away from the nucleus, perpendicular to x (the photon's path).
      engine.seek(80);
      const p = pm.getParticle('e')!.data.position;
      expect(Math.abs(p.x)).toBeLessThan(1e-6 * Math.hypot(p.y, p.z));
      expect(Math.hypot(p.y, p.z)).toBeGreaterThan(1000);
      // The departure span stands for the real crossing time at that speed.
      const before = pm.snapshot();
      engine.seek(5);
      engine.seek(80);
      expect(pm.snapshot()).toBe(before);
    });

    it('a photon below the threshold that matches no transition passes through', () => {
      const { pm, engine } = setup();
      engine.loadScenario(hydrogen, []);
      engine.addUserParticle('photon', { x: -400000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 5 });
      engine.seek(200);
      expect(pm.getParticle('e')!.data.orbital).toEqual({ n: 1, l: 0, m: 0 });
    });

    it('positions follow real time: a speed-v particle covers v·Δt across a compressed span', () => {
      const { pm, engine } = setup();
      const v = 1e-4;
      engine.loadScenario(
        [{ id: 'm', type: 'electron', position: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, speed: v }],
        [],
        [{ start: 10, end: 20, realFs: 1, label: 'x' }],
        1e9,
      );
      engine.seek(30);
      const fs = engine.getRealTime().fs;
      expect(pm.getParticle('m')!.data.position.x).toBeCloseTo(v * SPEED_OF_LIGHT_FM_PER_FS * fs, 6);
    });
  });

  describe('export and reopen', () => {
    it('a sandbox scene saved and reopened replays the same, and passes the checks', () => {
      const a = setup();
      a.engine.loadScenario([], []);
      a.engine.addUserParticle('proton', { x: 0, y: 0, z: 0 });
      a.engine.addUserParticle('electron', { x: 0, y: 0, z: 0 }, { orbital: { n: 1, l: 0, m: 0 } });
      a.engine.addUserParticle('photon', { x: -400000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 10.1987 });
      a.engine.addUserParticle('proton', { x: 0, y: 0, z: 500000 });
      a.engine.addUserNeutron({ x: 200000, y: 0, z: 500000 });
      a.engine.seek(30);
      const atom2 = a.pm.getAllParticles().find(p => p.type === 'proton' && p.position.z === 500000)!;
      a.engine.moveParticles([{ id: atom2.id, position: { x: 0, y: 0, z: 500000 } }]);
      a.engine.seek(150);
      a.engine.addUserParticle('photon', { x: -400000, y: 0, z: 0 }, { direction: { x: 1, y: 0, z: 0 }, energy: 21.218 });
      a.engine.seek(400);
      const final = a.pm.snapshot();

      const json = serializeScenario(buildScenario(a.engine.exportScenarioData(), { name: 'Round trip', description: 'All actions' }));
      const parsed = parseScenarioText(json);
      expect(parsed).toMatchObject({ ok: true });
      if (!('scenario' in parsed)) return;
      const actions = parsed.scenario.events.map(e => e.action);
      expect(actions).toEqual(expect.arrayContaining(['spawn', 'absorb', 'capture', 'move', 'ionize']));

      const b = setup();
      b.engine.loadScenario(parsed.scenario.particles, parsed.scenario.events, parsed.scenario.compressions, parsed.scenario.extent);
      b.engine.seek(400);
      expect(b.pm.snapshot()).toBe(final);
      expect(b.engine.getRealTime().fs).toBeCloseTo(a.engine.getRealTime().fs, 9);
    });

    it('new placements after reopening do not reuse ids from the file', () => {
      const { pm, engine } = setup();
      engine.loadScenario([], [{ time: 0, action: 'spawn', particle: { id: 'u999', type: 'proton', position: { x: 0, y: 0, z: 0 } } }]);
      engine.addUserParticle('proton', { x: 100, y: 0, z: 0 });
      const ids = pm.getAllParticles().map(p => p.id);
      expect(new Set(ids).size).toBe(2);
      expect(ids).toContain('u1000');
    });
  });
});
