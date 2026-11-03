// Stands in for ParticleManager in engine tests: same data behavior, no Three.js scene or DOM.
import { OrbitalState, ParticleData, ParticleType, Vec3 } from '../shared/types';
import type { ParticleManager } from '../renderer/particles/ParticleManager';

export class FakeParticleManager {
  private particles = new Map<string, { data: ParticleData }>();
  private nextId = 1;

  addParticle(type: ParticleType, position: Vec3, extra?: Partial<ParticleData>): ParticleData {
    const id = extra?.id ?? `f${this.nextId++}`;
    const data: ParticleData = {
      type,
      momentum: { x: 0, y: 0, z: 0 },
      spin: type === 'photon' ? 1 : 0.5,
      ...extra,
      id,
      position: { ...position },
    };
    this.particles.set(id, { data });
    return data;
  }
  removeParticle(id: string): void { this.particles.delete(id); }
  getParticle(id: string): { data: ParticleData } | undefined { return this.particles.get(id); }
  getAllParticles(): ParticleData[] { return [...this.particles.values()].map(p => p.data); }
  updatePosition(id: string, pos: Vec3): void {
    const p = this.particles.get(id);
    if (p) p.data.position = { ...pos };
  }
  setOrbital(id: string, orbital: OrbitalState): void {
    const p = this.particles.get(id);
    if (p) p.data.orbital = { ...orbital };
  }
  clear(): void { this.particles.clear(); }

  /** Sorted, rounded view of the scene for equality checks. */
  snapshot(): string {
    return JSON.stringify(
      this.getAllParticles()
        .map(p => ({
          id: p.id,
          type: p.type,
          x: Math.round(p.position.x),
          y: Math.round(p.position.y),
          z: Math.round(p.position.z),
          orbital: p.orbital,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  }

  asManager(): ParticleManager {
    return this as unknown as ParticleManager;
  }
}
