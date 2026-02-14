import { ScenarioEvent, SimulationState, ParticleData, ParticleType, Vec3 } from '../../shared/types';
import { TIME_STEP_FS } from '../../shared/constants';
import { ParticleManager } from '../particles/ParticleManager';

export class SimulationEngine {
  state: SimulationState;
  private events: ScenarioEvent[] = [];
  private processedEventIndices: Set<number> = new Set();
  private particleManager: ParticleManager;
  private onEvent?: (event: ScenarioEvent, particleIds: string[]) => void;

  constructor(particleManager: ParticleManager) {
    this.particleManager = particleManager;
    this.state = {
      playing: false,
      time: 0,
      speed: 1,
      particles: [],
    };
  }

  loadScenario(particles: Array<Partial<ParticleData> & { type: ParticleType }>, events: ScenarioEvent[]): void {
    this.particleManager.clear();
    this.state.time = 0;
    this.state.particles = [];
    this.processedEventIndices.clear();
    this.events = [...events];

    for (const p of particles) {
      const pos = p.position || { x: 0, y: 0, z: 0 };
      const data = this.particleManager.addParticle(p.type, pos, p);
      this.state.particles.push(data);
    }
  }

  setOnEvent(cb: (event: ScenarioEvent, particleIds: string[]) => void): void {
    this.onEvent = cb;
  }

  play(): void { this.state.playing = true; }
  pause(): void { this.state.playing = false; }
  togglePlay(): void { this.state.playing = !this.state.playing; }
  setSpeed(s: number): void { this.state.speed = s; }

  stepForward(): void {
    this.tick(TIME_STEP_FS * 10);
  }

  stepBack(): void {
    this.state.time = Math.max(0, this.state.time - TIME_STEP_FS * 10);
  }

  tick(deltaFs: number): void {
    if (!this.state.playing && deltaFs === 0) return;

    const dt = deltaFs * this.state.speed;
    this.state.time += dt;

    for (let i = 0; i < this.events.length; i++) {
      if (this.processedEventIndices.has(i)) continue;
      const event = this.events[i];
      if (this.state.time >= event.time) {
        this.processedEventIndices.add(i);
        this.processEvent(event);
      }
    }

    for (const pd of this.state.particles) {
      if (pd.type === 'photon' && pd.direction) {
        const speed = 50;
        pd.position.x += pd.direction.x * speed * dt;
        pd.position.y += pd.direction.y * speed * dt;
        pd.position.z += pd.direction.z * speed * dt;
        this.particleManager.updatePosition(pd.id, pd.position);
      }
    }
  }

  private processEvent(event: ScenarioEvent): void {
    const ids: string[] = [];

    switch (event.action) {
      case 'spawn': {
        if (event.particle) {
          const pos = event.particle.position || { x: 0, y: 0, z: 0 };
          const data = this.particleManager.addParticle(event.particle.type, pos, event.particle as Partial<ParticleData>);
          this.state.particles.push(data);
          ids.push(data.id);
        }
        break;
      }
      case 'absorb': {
        if (event.photonIndex !== undefined && event.electronIndex !== undefined && event.targetOrbital) {
          const photon = this.state.particles[event.photonIndex];
          const electron = this.state.particles[event.electronIndex];
          if (photon) {
            this.particleManager.removeParticle(photon.id);
            ids.push(photon.id);
          }
          if (electron) {
            this.particleManager.setOrbital(electron.id, event.targetOrbital);
            electron.orbital = { ...event.targetOrbital };
            ids.push(electron.id);
          }
        }
        break;
      }
      case 'emit': {
        if (event.electronIndex !== undefined && event.targetOrbital && event.particle) {
          const electron = this.state.particles[event.electronIndex];
          if (electron) {
            this.particleManager.setOrbital(electron.id, event.targetOrbital);
            electron.orbital = { ...event.targetOrbital };
            ids.push(electron.id);
          }
          const pos = event.particle.position || { x: 0, y: 0, z: 0 };
          const photonData = this.particleManager.addParticle('photon', pos, event.particle as Partial<ParticleData>);
          this.state.particles.push(photonData);
          ids.push(photonData.id);
        }
        break;
      }
      case 'remove': {
        if (event.particle && event.photonIndex !== undefined) {
          const p = this.state.particles[event.photonIndex];
          if (p) {
            this.particleManager.removeParticle(p.id);
            ids.push(p.id);
          }
        }
        break;
      }
    }

    if (this.onEvent) {
      this.onEvent(event, ids);
    }
  }
}
