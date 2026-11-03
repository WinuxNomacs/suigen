// Physics consistency checks for a scenario that already passed ScenarioSchema.
// Replays the event list and reports anything the engine would show that contradicts the physics.
import { OrbitalState, ParticleData, ParticleType, Scenario } from '../../shared/types';
import { ABSORPTION_TOLERANCE_EV } from '../../shared/constants';
import { energyLevel } from '../physics/transitions';

const MAX_RENDERED_N = 4;
const MAX_RENDERED_L = 1;

type ScenarioParticle = Partial<ParticleData> & { type: ParticleType };

interface Alive {
  type: ParticleType;
  orbital?: OrbitalState;
  energy?: number;
}

const fmt = (o: OrbitalState) => `${o.n}${'spdf'[o.l] ?? '?'}`;

export function checkScenarioPhysics(s: Scenario): string[] {
  const problems: string[] = [];
  const compressions = [...(s.compressions ?? [])].sort((a, b) => a.start - b.start);
  const inCompression = (t: number) => compressions.some(c => t >= c.start && t < c.end);

  for (let i = 1; i < compressions.length; i++) {
    if (compressions[i].start < compressions[i - 1].end) problems.push(`compressions overlap at tick ${compressions[i].start}`);
  }

  const checkParticle = (p: ScenarioParticle, time: number, where: string) => {
    if (p.orbital) {
      if (p.type !== 'electron') problems.push(`${where}: only electrons have orbitals`);
      if (p.orbital.n > MAX_RENDERED_N || p.orbital.l > MAX_RENDERED_L) {
        problems.push(`${where}: orbital ${fmt(p.orbital)} cannot be drawn (s and p up to n = ${MAX_RENDERED_N})`);
      }
    }
    if (p.type === 'photon' && p.speed !== undefined && p.speed !== 1) problems.push(`${where}: photons move at c`);
    if (p.type !== 'photon' && p.direction && (p.speed ?? 1) >= 1 && !inCompression(time)) {
      problems.push(`${where}: a ${p.type} cannot move at c; set speed < 1 or put its motion in a compressed span`);
    }
  };

  const alive = new Map<string, Alive>();
  s.particles.forEach((p, i) => {
    const id = p.id ?? `s${i}`;
    checkParticle(p, 0, `particle ${id}`);
    alive.set(id, { type: p.type, orbital: p.orbital, energy: p.energy });
  });

  const events = [...s.events].sort((a, b) => a.time - b.time);
  for (const e of events) {
    const where = `${e.action} at tick ${e.time}`;
    switch (e.action) {
      case 'spawn': {
        if (!e.particle) break;
        checkParticle(e.particle, e.time, where);
        if (e.particle.id) {
          if (alive.has(e.particle.id)) problems.push(`${where}: id ${e.particle.id} already exists`);
          alive.set(e.particle.id, { type: e.particle.type, orbital: e.particle.orbital, energy: e.particle.energy });
        }
        break;
      }
      case 'remove': {
        if (!e.targetId || !alive.delete(e.targetId)) problems.push(`${where}: no particle ${e.targetId}`);
        break;
      }
      case 'absorb': {
        const photon = e.photonId ? alive.get(e.photonId) : undefined;
        const electron = e.electronId ? alive.get(e.electronId) : undefined;
        if (!photon || photon.type !== 'photon') { problems.push(`${where}: no photon ${e.photonId}`); break; }
        if (!electron?.orbital) { problems.push(`${where}: no bound electron ${e.electronId}`); break; }
        if (!e.targetOrbital) break;
        problems.push(...checkTransition(where, electron.orbital, e.targetOrbital, photon.energy, 'absorb'));
        electron.orbital = e.targetOrbital;
        alive.delete(e.photonId!);
        break;
      }
      case 'emit': {
        const electron = e.electronId ? alive.get(e.electronId) : undefined;
        if (!electron?.orbital) { problems.push(`${where}: no bound electron ${e.electronId}`); break; }
        if (!e.targetOrbital || !e.particle) break;
        if (e.particle.type !== 'photon') problems.push(`${where}: an emitted particle must be a photon`);
        checkParticle(e.particle, e.time, where);
        problems.push(...checkTransition(where, electron.orbital, e.targetOrbital, e.particle.energy, 'emit'));
        electron.orbital = e.targetOrbital;
        if (e.particle.id) alive.set(e.particle.id, { type: 'photon', energy: e.particle.energy });
        break;
      }
    }
  }
  return problems;
}

function checkTransition(
  where: string,
  from: OrbitalState,
  to: OrbitalState,
  photonEnergy: number | undefined,
  kind: 'absorb' | 'emit',
): string[] {
  const problems: string[] = [];
  if (Math.abs(to.l - from.l) !== 1) problems.push(`${where}: ${fmt(from)} -> ${fmt(to)} breaks the selection rule (l must change by 1)`);
  if (kind === 'absorb' ? to.n <= from.n : to.n >= from.n) {
    problems.push(`${where}: ${kind === 'absorb' ? 'absorption must raise' : 'emission must lower'} n`);
  }
  const gap = Math.abs(energyLevel(to.n) - energyLevel(from.n));
  if (photonEnergy === undefined) {
    problems.push(`${where}: photon has no energy`);
  } else if (Math.abs(photonEnergy - gap) > ABSORPTION_TOLERANCE_EV) {
    problems.push(`${where}: photon energy ${photonEnergy} eV does not match ${fmt(from)} -> ${fmt(to)} (${gap.toFixed(3)} eV)`);
  }
  return problems;
}
