import { ScenarioEvent, SimulationState, ParticleData, ParticleType, TimeCompression, Vec3 } from '../../shared/types';
import { DEFAULT_SCENE_EXTENT_FM, FS_PER_TICK, LIGHT_SPEED_FM_PER_TICK, STEP_TICKS } from '../../shared/constants';
import { ParticleManager } from '../particles/ParticleManager';
import { orbitalRadius } from '../particles/OrbitalMesh';
import { findTransition } from './transitions';
import { RealTime, realTime } from './time';

type ScenarioParticle = Partial<ParticleData> & { type: ParticleType };

interface Motion {
  origin: Vec3;
  direction: Vec3;
  speed: number; // fraction of c
  spawnTime: number;
}

let nextUserId = 1;

// Scene state is a pure function of (initial particles, event log, time):
// seeking backward rebuilds from scratch and replays events up to the target time.
export class SimulationEngine {
  state: SimulationState;
  private initialParticles: ScenarioParticle[] = [];
  private events: ScenarioEvent[] = [];
  private compressions: TimeCompression[] = [];
  private extent = DEFAULT_SCENE_EXTENT_FM;
  private nextEventIndex = 0;
  private motions: Map<string, Motion> = new Map();
  private interactiveIds: Set<string> = new Set();
  private particleManager: ParticleManager;
  private onEvent?: (event: ScenarioEvent, particleIds: string[]) => void;
  private onLoad?: () => void;

  constructor(particleManager: ParticleManager) {
    this.particleManager = particleManager;
    this.state = {
      playing: false,
      time: 0,
      speed: 1,
    };
  }

  loadScenario(
    particles: ScenarioParticle[],
    events: ScenarioEvent[],
    compressions: TimeCompression[] = [],
    extent = DEFAULT_SCENE_EXTENT_FM,
  ): void {
    this.initialParticles = particles.map((p, i) => ({ ...p, id: p.id ?? `s${i}` }));
    this.events = [...events].sort((a, b) => a.time - b.time);
    this.compressions = compressions;
    this.extent = extent;
    this.interactiveIds.clear();
    this.rebuild();
    this.advanceTo(0);
    this.onLoad?.();
  }

  setOnLoad(cb: () => void): void {
    this.onLoad = cb;
  }

  /** Radius in fm the camera should frame for the loaded scenario. */
  getExtent(): number {
    return this.extent;
  }

  getRealTime(): RealTime {
    return realTime(this.state.time, FS_PER_TICK, this.compressions);
  }

  setOnEvent(cb: (event: ScenarioEvent, particleIds: string[]) => void): void {
    this.onEvent = cb;
  }

  play(): void { this.state.playing = true; }
  pause(): void { this.state.playing = false; }
  togglePlay(): void { this.state.playing = !this.state.playing; }
  setSpeed(s: number): void { this.state.speed = s; }

  stepForward(): void {
    this.advanceTo(this.state.time + STEP_TICKS);
  }

  stepBack(): void {
    this.seek(this.state.time - STEP_TICKS);
  }

  tick(deltaFs: number): void {
    this.advanceTo(this.state.time + deltaFs * this.state.speed);
  }

  seek(time: number): void {
    const target = Math.max(0, time);
    if (target < this.state.time) this.rebuild();
    this.advanceTo(target);
  }

  // Record a user placement as a spawn event so it survives seeking.
  addUserParticle(type: ParticleType, position: Vec3, extra?: Partial<ParticleData>): void {
    const id = `u${nextUserId++}`;
    this.interactiveIds.add(id);
    const event: ScenarioEvent = {
      time: this.state.time,
      action: 'spawn',
      particle: { ...extra, type, id, position: { ...position } },
    };
    this.insertEvent(event);
    this.advanceTo(this.state.time);
  }

  private rebuild(): void {
    this.particleManager.clear();
    this.motions.clear();
    this.state.time = 0;
    this.nextEventIndex = 0;
    for (const p of this.initialParticles) {
      this.spawn(p, 0);
    }
  }

  private advanceTo(time: number): void {
    this.state.time = time;

    while (this.nextEventIndex < this.events.length && this.events[this.nextEventIndex].time <= time) {
      this.processEvent(this.events[this.nextEventIndex++]);
    }

    for (const [id, m] of this.motions) {
      const d = (time - m.spawnTime) * LIGHT_SPEED_FM_PER_TICK * m.speed;
      this.particleManager.updatePosition(id, {
        x: m.origin.x + m.direction.x * d,
        y: m.origin.y + m.direction.y * d,
        z: m.origin.z + m.direction.z * d,
      });
    }

    this.removeDeparted();
    this.checkAbsorptions();
  }

  // A moving particle heading away from the origin beyond twice the framed extent has left the scene.
  // Position depends only on time, so replaying after a rewind removes it at the same moment.
  private removeDeparted(): void {
    const limit = 2 * this.extent;
    for (const [id, m] of [...this.motions]) {
      const pos = this.particleManager.getParticle(id)?.data.position;
      if (!pos) continue;
      const outward = pos.x * m.direction.x + pos.y * m.direction.y + pos.z * m.direction.z > 0;
      if (outward && Math.hypot(pos.x, pos.y, pos.z) > limit) this.remove(id);
    }
  }

  // User-placed photons are absorbed when they enter an electron cloud with matching energy.
  private checkAbsorptions(): void {
    const electrons = this.particleManager.getAllParticles().filter(p => p.type === 'electron' && p.orbital);
    for (const id of this.motions.keys()) {
      if (!this.interactiveIds.has(id)) continue;
      const photon = this.particleManager.getParticle(id)?.data;
      if (!photon || photon.type !== 'photon' || photon.energy === undefined) continue;
      if (this.events.some(e => e.action === 'absorb' && e.photonId === id)) continue;

      for (const electron of electrons) {
        if (distance(photon.position, electron.position) >= orbitalRadius(electron.orbital!, electron.effectiveCharge)) continue;
        const target = findTransition(electron.orbital!, photon.energy);
        if (!target) continue;
        this.insertEvent({
          time: this.state.time,
          action: 'absorb',
          photonId: id,
          electronId: electron.id,
          targetOrbital: target,
        });
        this.processEvent(this.events[this.nextEventIndex++]);
        break;
      }
    }
  }

  // Pending events are all later than the playhead, so the current time slots in next.
  private insertEvent(event: ScenarioEvent): void {
    this.events.splice(this.nextEventIndex, 0, event);
  }

  private spawn(p: ScenarioParticle, time: number): ParticleData {
    const pos = p.position || { x: 0, y: 0, z: 0 };
    const data = this.particleManager.addParticle(p.type, pos, p);
    if (p.direction) {
      this.motions.set(data.id, {
        origin: { ...pos },
        direction: normalize(p.direction),
        speed: p.speed ?? 1,
        spawnTime: time,
      });
    }
    return data;
  }

  private remove(id: string): void {
    this.particleManager.removeParticle(id);
    this.motions.delete(id);
  }

  private processEvent(event: ScenarioEvent): void {
    const ids: string[] = [];

    switch (event.action) {
      case 'spawn': {
        if (event.particle) {
          ids.push(this.spawn(event.particle, event.time).id);
        }
        break;
      }
      case 'absorb': {
        if (event.photonId && event.electronId && event.targetOrbital) {
          if (this.particleManager.getParticle(event.photonId)) {
            this.remove(event.photonId);
            ids.push(event.photonId);
          }
          if (this.particleManager.getParticle(event.electronId)) {
            this.particleManager.setOrbital(event.electronId, event.targetOrbital, event.time);
            ids.push(event.electronId);
          }
        }
        break;
      }
      case 'emit': {
        if (event.electronId && event.targetOrbital && event.particle) {
          if (this.particleManager.getParticle(event.electronId)) {
            this.particleManager.setOrbital(event.electronId, event.targetOrbital, event.time);
            ids.push(event.electronId);
          }
          ids.push(this.spawn({ ...event.particle, type: 'photon' }, event.time).id);
        }
        break;
      }
      case 'remove': {
        if (event.targetId && this.particleManager.getParticle(event.targetId)) {
          this.remove(event.targetId);
          ids.push(event.targetId);
        }
        break;
      }
    }

    if (this.onEvent) {
      this.onEvent(event, ids);
    }
  }
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
