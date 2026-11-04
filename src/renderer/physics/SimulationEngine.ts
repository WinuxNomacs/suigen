import { OrbitalState, ScenarioEvent, SimulationState, ParticleData, ParticleType, TimeCompression, Vec3 } from '../../shared/types';
import {
  CAPTURE_DISTANCE_FM, DEFAULT_PLAYBACK_SPEED, DEFAULT_SCENE_EXTENT_FM, ELECTRON_REST_ENERGY_EV, FS_PER_TICK,
  LIGHT_SPEED_FM_PER_TICK, NP_CAPTURE_GAMMA_EV, NUCLEON_SPACING_FM, NUCLEUS_CLUSTER_FM, SPEED_OF_LIGHT,
  SPEED_OF_LIGHT_FM_PER_FS, STEP_TICKS, THERMAL_NEUTRON_FM_PER_FS, THERMAL_NEUTRON_SPEED_M_S,
} from '../../shared/constants';
import { ParticleManager } from '../particles/ParticleManager';
import { orbitalRadius } from '../particles/OrbitalMesh';
import { findTransition, ionizationKineticEnergy } from './transitions';
import { RealTime, realTime, ticksAtRealTime } from './time';

const EXIT_MARGIN_TICKS = 1;
export const NEUTRON_APPROACH_LABEL = 'thermal neutron approach (2,200 m/s)';
export const ELECTRON_DEPARTURE_LABEL = 'freed electron leaving';
// A freed electron's departure is fast-forwarded so it appears to move at this fraction of c.
const DEPARTURE_DRAWN_SPEED = 0.5;

/** Speed (fraction of c) of an electron with kinetic energy T: γ = 1 + T/mc², β = √(1 - 1/γ²). */
export function electronSpeed(kineticEv: number): number {
  const gamma = 1 + kineticEv / ELECTRON_REST_ENERGY_EV;
  return Math.sqrt(1 - 1 / (gamma * gamma));
}

type Hit = { time: number; photonId: string; electronId: string } & (
  { kind: 'absorb'; targetOrbital: OrbitalState } | { kind: 'ionize'; kineticEv: number }
);

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
  private fastForwards: Map<string, TimeCompression> = new Map(); // sandbox particle id -> its fast-forward span
  private particleManager: ParticleManager;
  private onEvent?: (event: ScenarioEvent, particleIds: string[]) => void;
  private onLoad?: () => void;

  constructor(particleManager: ParticleManager) {
    this.particleManager = particleManager;
    this.state = {
      playing: false,
      time: 0,
      speed: DEFAULT_PLAYBACK_SPEED,
      loop: true,
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
    this.compressions = compressions.map(c => ({ ...c })); // sandbox approaches are added to this list
    this.extent = extent;
    this.interactiveIds.clear();
    this.fastForwards.clear();
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

  // Positions follow real time: a particle at speed v has moved v·Δt, where Δt includes any fast-forwarded
  // spans. So inside a compressed span everything moves at its real speed, just shown faster.
  private fsAt(ticks: number): number {
    return realTime(ticks, FS_PER_TICK, this.compressions).fs;
  }

  private ticksAt(fs: number): number {
    return ticksAtRealTime(fs, FS_PER_TICK, this.compressions);
  }

  private distanceAt(m: Motion, ticks: number): number {
    return m.speed * SPEED_OF_LIGHT_FM_PER_FS * (this.fsAt(ticks) - this.fsAt(m.spawnTime));
  }

  /** The tick at which a particle spawned at `spawnTime` with `speed` has travelled `s` fm. */
  private ticksAtDistance(spawnTime: number, speed: number, s: number): number {
    return this.ticksAt(this.fsAt(spawnTime) + s / (speed * SPEED_OF_LIGHT_FM_PER_FS));
  }

  setOnEvent(cb: (event: ScenarioEvent, particleIds: string[]) => void): void {
    this.onEvent = cb;
  }

  /**
   * Continues playback from the current time. Only at the end (or at the start when the speed is
   * negative) does it move the playhead: with loop on it starts over from the other end; with loop off
   * there is nothing to play, so it stays paused.
   */
  play(): void {
    const end = this.getDuration();
    const atEnd = this.state.speed > 0 && this.state.time >= end;
    const atStart = this.state.speed < 0 && this.state.time <= 0;
    if (atEnd || atStart) {
      if (!this.state.loop) return;
      this.seek(atEnd ? 0 : end);
    }
    this.state.playing = true;
  }

  setLoop(loop: boolean): void { this.state.loop = loop; }
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

  /** Advances playback by `deltaTicks` at the current speed and pauses on reaching either end. No-op while paused. */
  tick(deltaTicks: number): void {
    if (!this.state.playing) return;
    const dt = deltaTicks * this.state.speed;
    if (dt === 0) return;
    let target = this.state.time + dt;
    const end = this.getDuration();
    if (dt > 0 && target >= end) {
      if (this.state.loop) target = 0;
      else {
        target = Math.max(end, this.state.time);
        this.pause();
      }
    } else if (dt < 0 && target <= 0) {
      if (this.state.loop) target = end;
      else {
        target = 0;
        this.pause();
      }
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
      const id = e.action === 'remove' ? e.targetId
        : e.action === 'absorb' || e.action === 'ionize' ? e.photonId
        : e.action === 'capture' ? e.neutronId : undefined;
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
      const exit = this.ticksAtDistance(spawnTime, p.speed ?? 1, s) + EXIT_MARGIN_TICKS;
      const removed = p.id === undefined ? undefined : removedAt.get(p.id);
      end = Math.max(end, Math.min(exit, removed ?? Infinity));
    };
    this.initialParticles.forEach(p => consider(p, 0));
    for (const e of this.events) {
      end = Math.max(end, e.time);
      if (e.action === 'spawn' || e.action === 'emit' || e.action === 'capture' || e.action === 'ionize') consider(e.particle, e.time);
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

  /** Counts for the sandbox tutorial. */
  tutorialFacts(): { protons: number; neutronsAtRest: number; capturesRecorded: number; capturesHappened: number } {
    const all = this.particleManager.getAllParticles();
    const captures = this.events.map((e, i) => ({ e, i })).filter(({ e }) => e.action === 'capture');
    return {
      protons: all.filter(p => p.type === 'proton').length,
      neutronsAtRest: all.filter(p => p.type === 'neutron' && !this.motions.has(p.id)
        && !captures.some(({ e, i }) => i < this.nextEventIndex && e.neutronId === p.id)).length,
      capturesRecorded: captures.length,
      capturesHappened: captures.filter(({ i }) => i < this.nextEventIndex).length,
    };
  }

  /** Protons with no other nucleon within NUCLEUS_CLUSTER_FM: they can capture a neutron. */
  freeProtons(exceptId?: string): ParticleData[] {
    const all = this.particleManager.getAllParticles();
    const nucleons = all.filter(p => (p.type === 'proton' || p.type === 'neutron') && p.id !== exceptId);
    return nucleons.filter(p => p.type === 'proton'
      && !nucleons.some(o => o !== p && distance(o.position, p.position) <= NUCLEUS_CLUSTER_FM));
  }

  /**
   * Places a sandbox neutron. With a free proton available it heads for the nearest one at thermal
   * speed (the approach is a fast-forwarded span) and a capture event is recorded for its arrival.
   * Returns false when it was placed at rest instead: no free proton, or another approach overlaps.
   */
  addUserNeutron(position: Vec3): boolean {
    const t = this.state.time;
    const target = this.freeProtons()
      .map(p => ({ p, d: distance(p.position, position) }))
      .sort((a, b) => a.d - b.d)[0];
    const travel = target ? Math.max(0, target.d - NUCLEON_SPACING_FM) : 0;
    const arrival = t + travel / LIGHT_SPEED_FM_PER_TICK;
    if (!target || this.compressions.some(c => c.start < arrival && t < c.end)) {
      this.addUserParticle('neutron', position);
      return false;
    }

    const id = `u${nextUserId++}`;
    this.interactiveIds.add(id);
    const toward = {
      x: target.p.position.x - position.x,
      y: target.p.position.y - position.y,
      z: target.p.position.z - position.z,
    };
    const neutron: ScenarioParticle = { type: 'neutron', id, position: { ...position } };
    if (travel > 0) {
      neutron.direction = normalize(toward);
      neutron.speed = THERMAL_NEUTRON_SPEED_M_S / SPEED_OF_LIGHT;
      // The approach takes as many ticks as light would need, inside a span that stands for its real time.
      const span = { start: t, end: arrival, realFs: travel / THERMAL_NEUTRON_FM_PER_FS, label: NEUTRON_APPROACH_LABEL };
      this.compressions.push(span);
      this.fastForwards.set(id, span);
    }
    this.insertEvent({ time: t, action: 'spawn', particle: neutron });
    this.insertSorted({
      time: arrival,
      action: 'capture',
      neutronId: id,
      protonId: target.p.id,
      particle: {
        type: 'photon',
        id: `${id}g`,
        position: { ...target.p.position },
        direction: randomDirection(), // random in reality; chosen once so replays match
        energy: NP_CAPTURE_GAMMA_EV,
      },
    });
    this.advanceTo(t);
    return true;
  }

  /** Records a deletion at the current time; rewinding before it brings the particle back. */
  removeUserParticle(id: string): void {
    if (!this.particleManager.getParticle(id)) return;
    // Deleting a neutron mid-approach ends its fast-forward there, keeping the same real speed.
    const span = this.fastForwards.get(id);
    const t = this.state.time;
    if (span && t < span.end) {
      if (t <= span.start) this.compressions.splice(this.compressions.indexOf(span), 1);
      else {
        span.realFs *= (t - span.start) / (span.end - span.start);
        span.end = t;
      }
      this.fastForwards.delete(id);
    }
    this.insertEvent({ time: t, action: 'remove', targetId: id });
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
        this.insertEvent(hit.kind === 'absorb'
          ? { time: hit.time, action: 'absorb', photonId: hit.photonId, electronId: hit.electronId, targetOrbital: hit.targetOrbital }
          : this.ionizeEvent(hit));
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
      const d = this.distanceAt(m, time);
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

  // User-placed photons that reach an electron cloud are absorbed when their energy matches a transition,
  // or ionize the atom when it exceeds the binding energy (hydrogen-like electrons, Z = 1, only).
  // Returns the earliest such crossing in [from, to], solved exactly from the straight-line motion.
  private nextAbsorption(from: number, to: number): Hit | null {
    const electrons = this.particleManager.getAllParticles().filter(p => p.type === 'electron' && p.orbital);
    let best: Hit | null = null;

    for (const [id, m] of this.motions) {
      if (!this.interactiveIds.has(id)) continue;
      const photon = this.particleManager.getParticle(id)?.data;
      if (!photon || photon.type !== 'photon' || photon.energy === undefined) continue;
      if (this.events.some(e => (e.action === 'absorb' || e.action === 'ionize') && e.photonId === id)) continue;

      const sNow = this.distanceAt(m, from); // distance travelled at `from`
      for (const electron of electrons) {
        const orbital = electron.orbital!;
        const target = findTransition(orbital, photon.energy);
        const kinetic = target || (electron.effectiveCharge ?? 1) !== 1 ? null : ionizationKineticEnergy(photon.energy, orbital.n);
        const ionizes = kinetic !== null;
        if (!target && !ionizes) continue;
        const R = orbitalRadius(orbital, electron.effectiveCharge);
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
            if (sEnter >= sNow) t = this.ticksAtDistance(m.spawnTime, m.speed, sEnter);
          }
        }
        if (t !== null && t <= to && (!best || t < best.time)) {
          best = target
            ? { time: t, photonId: id, electronId: electron.id, kind: 'absorb', targetOrbital: target }
            : { time: t, photonId: id, electronId: electron.id, kind: 'ionize', kineticEv: kinetic! };
        }
      }
    }
    return best;
  }

  /**
   * A sandbox ionization: the electron leaves perpendicular to the photon's path (along the light's
   * polarization, its most likely direction) at a random angle around it, chosen once. Its slow departure
   * becomes a fast-forwarded span unless another span overlaps it.
   */
  private ionizeEvent(hit: Hit & { kind: 'ionize' }): ScenarioEvent {
    const electron = this.particleManager.getParticle(hit.electronId)!.data;
    const along = this.motions.get(hit.photonId)!.direction;
    let dir = randomDirection();
    const dot = dir.x * along.x + dir.y * along.y + dir.z * along.z;
    dir = normalize({ x: dir.x - dot * along.x, y: dir.y - dot * along.y, z: dir.z - dot * along.z });
    const speed = electronSpeed(hit.kineticEv);

    // Distance from the atom to where the electron leaves the scene (|pos + s·dir| = 2 × extent).
    const limit = 2 * this.extent;
    const p = electron.position;
    const b = p.x * dir.x + p.y * dir.y + p.z * dir.z;
    const exitS = -b + Math.sqrt(Math.max(0, b * b - (p.x * p.x + p.y * p.y + p.z * p.z - limit * limit)));
    const end = hit.time + exitS / (LIGHT_SPEED_FM_PER_TICK * DEPARTURE_DRAWN_SPEED);
    if (exitS > 0 && !this.compressions.some(c => c.start < end && hit.time < c.end)) {
      const span = { start: hit.time, end, realFs: exitS / (speed * SPEED_OF_LIGHT_FM_PER_FS), label: ELECTRON_DEPARTURE_LABEL };
      this.compressions.push(span);
      this.fastForwards.set(hit.electronId, span);
    }
    return {
      time: hit.time,
      action: 'ionize',
      photonId: hit.photonId,
      electronId: hit.electronId,
      particle: { type: 'electron', id: hit.electronId, position: { ...p }, direction: dir, speed, energy: hit.kineticEv },
    };
  }

  // Pending events are all later than the playhead, so the current time slots in next.
  private insertEvent(event: ScenarioEvent): void {
    this.events.splice(this.nextEventIndex, 0, event);
  }

  // A future event goes after every pending event at or before its time.
  private insertSorted(event: ScenarioEvent): void {
    let i = this.nextEventIndex;
    while (i < this.events.length && this.events[i].time <= event.time) i++;
    this.events.splice(i, 0, event);
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
      case 'ionize': {
        const electron = event.electronId ? this.particleManager.getParticle(event.electronId)?.data : undefined;
        if (!electron || !event.particle) break;
        if (event.photonId && this.particleManager.getParticle(event.photonId)) {
          this.remove(event.photonId);
          ids.push(event.photonId);
        }
        // The bound electron (its cloud) is replaced by a free one leaving from where the atom is.
        const from = { ...electron.position };
        this.remove(electron.id);
        ids.push(this.spawn({ ...event.particle, type: 'electron', id: electron.id, position: from, orbital: undefined }, event.time).id);
        break;
      }
      case 'capture': {
        const neutron = event.neutronId ? this.particleManager.getParticle(event.neutronId)?.data : undefined;
        const proton = event.protonId ? this.particleManager.getParticle(event.protonId)?.data : undefined;
        if (!neutron || !proton || !event.particle) break;
        const motion = this.motions.get(neutron.id);
        this.motions.delete(neutron.id); // the approach ends here either way
        ids.push(neutron.id);
        // Captured only if it reached a proton that is still free; otherwise (the proton was moved or
        // took another neutron) it stops where its approach ended.
        const reached = distance(neutron.position, proton.position) <= NUCLEON_SPACING_FM + CAPTURE_DISTANCE_FM;
        if (!reached || !this.freeProtons(neutron.id).some(p => p.id === proton.id)) break;
        const dir = motion?.direction ?? normalize({
          x: neutron.position.x - proton.position.x,
          y: neutron.position.y - proton.position.y,
          z: neutron.position.z - proton.position.z,
        });
        const side = motion ? -1 : 1; // stay on the side it came from
        this.particleManager.updatePosition(neutron.id, {
          x: proton.position.x + side * dir.x * NUCLEON_SPACING_FM,
          y: proton.position.y + side * dir.y * NUCLEON_SPACING_FM,
          z: proton.position.z + side * dir.z * NUCLEON_SPACING_FM,
        });
        ids.push(this.spawn({ ...event.particle, type: 'photon', position: { ...proton.position } }, event.time).id);
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

/** Uniform over the sphere. */
function randomDirection(): Vec3 {
  const z = 2 * Math.random() - 1;
  const phi = 2 * Math.PI * Math.random();
  const r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(phi), y: z, z: r * Math.sin(phi) };
}
