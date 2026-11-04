import { OrbitalState, ScenarioEvent, SimulationState, ParticleData, ParticleType, TimeCompression, Vec3 } from '../../shared/types';
import { DEFAULT_SCENE_EXTENT_FM, FS_PER_TICK, LIGHT_SPEED_FM_PER_TICK, STEP_TICKS } from '../../shared/constants';
import { ParticleManager } from '../particles/ParticleManager';
import { orbitalRadius } from '../particles/OrbitalMesh';
import { findTransition } from './transitions';
import { RealTime, realTime } from './time';

const EXIT_MARGIN_TICKS = 1;

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
  private lastDepartureTime = -Infinity; // latest time removeDeparted removed a particle
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

  /** Starts playback. At the end (or at the start when playing in reverse) it starts over from the other end. */
  play(): void {
    const end = this.getDuration();
    if (this.state.speed > 0 && this.state.time >= end) this.seek(0);
    else if (this.state.speed < 0 && this.state.time <= 0) this.seek(end);
    this.state.playing = true;
  }
  /** Continues playback from where it is (after a scrub), without starting over. */
  resume(): void { this.state.playing = true; }
  pause(): void { this.state.playing = false; }
  togglePlay(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }
  /** Playback speed; negative plays in reverse. */
  setSpeed(s: number): void { this.state.speed = s; }

  stepForward(): void {
    this.seek(Math.min(this.state.time + STEP_TICKS, Math.max(this.getDuration(), this.state.time)));
  }

  stepBack(): void {
    this.seek(this.state.time - STEP_TICKS);
  }

  /** Advances playback by `deltaTicks` at the current speed and pauses on reaching either end. */
  tick(deltaTicks: number): void {
    const dt = deltaTicks * this.state.speed;
    if (dt === 0) return;
    let target = this.state.time + dt;
    const end = this.getDuration();
    if (dt > 0 && target >= end) {
      target = Math.max(end, this.state.time);
      this.pause();
    } else if (dt < 0 && target <= 0) {
      target = 0;
      this.pause();
    }
    this.seek(target);
  }

  /** Back to the start, paused. */
  reset(): void {
    this.pause();
    this.seek(0);
  }

  /**
   * Ticks until the scene stops changing: the last event, or the last moving particle leaving the
   * scene (removeDeparted), whichever is later. At least the time light takes to leave from the centre.
   * Exits get one extra tick so a particle is past the boundary, and removed, when playback stops.
   */
  getDuration(): number {
    const limit = 2 * this.extent;
    let end = limit / LIGHT_SPEED_FM_PER_TICK;
    const removedAt = new Map<string, number>();
    for (const e of this.events) {
      const id = e.action === 'remove' ? e.targetId : e.action === 'absorb' ? e.photonId : undefined;
      if (id && !removedAt.has(id)) removedAt.set(id, e.time);
    }
    const consider = (p: ScenarioParticle | undefined, spawnTime: number) => {
      if (!p?.direction) return;
      const pos = p.position ?? { x: 0, y: 0, z: 0 };
      const d = normalize(p.direction);
      // Distance s along the path where |pos + s·d| = limit, heading outward.
      const b = pos.x * d.x + pos.y * d.y + pos.z * d.z;
      const disc = b * b - (pos.x * pos.x + pos.y * pos.y + pos.z * pos.z - limit * limit);
      const s = disc >= 0 ? -b + Math.sqrt(disc) : Math.max(0, -b);
      const exit = spawnTime + s / (LIGHT_SPEED_FM_PER_TICK * (p.speed ?? 1)) + EXIT_MARGIN_TICKS;
      const removed = p.id === undefined ? undefined : removedAt.get(p.id);
      end = Math.max(end, Math.min(exit, removed ?? Infinity));
    };
    this.initialParticles.forEach(p => consider(p, 0));
    for (const e of this.events) {
      end = Math.max(end, e.time);
      if (e.action === 'spawn' || e.action === 'emit') consider(e.particle, e.time);
    }
    return end;
  }

  seek(time: number): void {
    const target = Math.max(0, time);
    if (target < this.state.time) {
      // Going back without crossing an event or a departure only moves particles along their paths,
      // so reverse playback doesn't rebuild the scene every frame.
      const lastEventTime = this.nextEventIndex > 0 ? this.events[this.nextEventIndex - 1].time : -Infinity;
      if (lastEventTime <= target && this.lastDepartureTime <= target) {
        this.moveTo(target);
        return;
      }
      this.rebuild();
    }
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

  /** Records a deletion at the current time; rewinding before it brings the particle back. */
  removeUserParticle(id: string): void {
    if (!this.particleManager.getParticle(id)) return;
    this.insertEvent({ time: this.state.time, action: 'remove', targetId: id });
    this.advanceTo(this.state.time);
  }

  /** Records new positions for static particles at the current time. Moving particles are skipped. */
  moveParticles(moves: Array<{ id: string; position: Vec3 }>): void {
    for (const { id, position } of moves) {
      if (this.isMoving(id) || !this.particleManager.getParticle(id)) continue;
      this.insertEvent({ time: this.state.time, action: 'move', targetId: id, position: { ...position } });
    }
    this.advanceTo(this.state.time);
  }

  /** True for particles whose path is fixed by a start point and direction (photons, recoils). */
  isMoving(id: string): boolean {
    return this.motions.has(id);
  }

  private rebuild(): void {
    this.particleManager.clear();
    this.motions.clear();
    this.state.time = 0;
    this.nextEventIndex = 0;
    this.lastDepartureTime = -Infinity;
    for (const p of this.initialParticles) {
      this.spawn(p, 0);
    }
  }

  // Events and photon-cloud crossings are handled in time order, so jumping straight to a later time
  // (seeking, stepping, a long frame) gives the same result as playing through it.
  private advanceTo(time: number): void {
    for (;;) {
      const nextEventTime = this.events[this.nextEventIndex]?.time ?? Infinity;
      const hit = this.nextAbsorption(this.state.time, Math.min(time, nextEventTime));
      if (hit) {
        this.moveTo(hit.time);
        this.insertEvent({
          time: hit.time,
          action: 'absorb',
          photonId: hit.photonId,
          electronId: hit.electronId,
          targetOrbital: hit.targetOrbital,
        });
        this.processEvent(this.events[this.nextEventIndex++]);
        continue;
      }
      if (nextEventTime <= time) {
        this.moveTo(nextEventTime);
        this.processEvent(this.events[this.nextEventIndex++]);
        continue;
      }
      break;
    }
    this.moveTo(time);
    this.removeDeparted();
  }

  private moveTo(time: number): void {
    this.state.time = time;
    for (const [id, m] of this.motions) {
      const d = (time - m.spawnTime) * LIGHT_SPEED_FM_PER_TICK * m.speed;
      this.particleManager.updatePosition(id, {
        x: m.origin.x + m.direction.x * d,
        y: m.origin.y + m.direction.y * d,
        z: m.origin.z + m.direction.z * d,
      });
    }
  }

  // A moving particle heading away from the origin beyond twice the framed extent has left the scene.
  // Position depends only on time, so replaying after a rewind removes it at the same moment.
  private removeDeparted(): void {
    const limit = 2 * this.extent;
    for (const [id, m] of [...this.motions]) {
      const pos = this.particleManager.getParticle(id)?.data.position;
      if (!pos) continue;
      const outward = pos.x * m.direction.x + pos.y * m.direction.y + pos.z * m.direction.z > 0;
      if (outward && Math.hypot(pos.x, pos.y, pos.z) > limit) {
        this.remove(id);
        this.lastDepartureTime = Math.max(this.lastDepartureTime, this.state.time);
      }
    }
  }

  // User-placed photons are absorbed when they enter an electron cloud with matching energy.
  // Returns the earliest such crossing in [from, to], solved exactly from the straight-line motion.
  private nextAbsorption(
    from: number,
    to: number,
  ): { time: number; photonId: string; electronId: string; targetOrbital: OrbitalState } | null {
    const electrons = this.particleManager.getAllParticles().filter(p => p.type === 'electron' && p.orbital);
    let best: { time: number; photonId: string; electronId: string; targetOrbital: OrbitalState } | null = null;

    for (const [id, m] of this.motions) {
      if (!this.interactiveIds.has(id)) continue;
      const photon = this.particleManager.getParticle(id)?.data;
      if (!photon || photon.type !== 'photon' || photon.energy === undefined) continue;
      if (this.events.some(e => e.action === 'absorb' && e.photonId === id)) continue;

      const fmPerTick = LIGHT_SPEED_FM_PER_TICK * m.speed;
      const sNow = (from - m.spawnTime) * fmPerTick; // distance travelled at `from`
      for (const electron of electrons) {
        const target = findTransition(electron.orbital!, photon.energy);
        if (!target) continue;
        const R = orbitalRadius(electron.orbital!, electron.effectiveCharge);
        // |w + u·s| = R with w = origin - centre, u = unit direction: s² + 2(u·w)s + |w|² - R² = 0
        const w = {
          x: m.origin.x - electron.position.x,
          y: m.origin.y - electron.position.y,
          z: m.origin.z - electron.position.z,
        };
        const b = m.direction.x * w.x + m.direction.y * w.y + m.direction.z * w.z;
        const c = w.x * w.x + w.y * w.y + w.z * w.z - R * R;
        let t: number | null = null;
        if (sNow * sNow + 2 * b * sNow + c < 0) {
          t = from; // already inside
        } else {
          const disc = b * b - c;
          if (disc >= 0) {
            const sEnter = -b - Math.sqrt(disc);
            if (sEnter >= sNow) t = m.spawnTime + sEnter / fmPerTick;
          }
        }
        if (t !== null && t <= to && (!best || t < best.time)) {
          best = { time: t, photonId: id, electronId: electron.id, targetOrbital: target };
        }
      }
    }
    return best;
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
      case 'move': {
        if (event.targetId && event.position && this.particleManager.getParticle(event.targetId) && !this.motions.has(event.targetId)) {
          this.particleManager.updatePosition(event.targetId, event.position);
          ids.push(event.targetId);
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
