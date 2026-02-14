import * as THREE from 'three';
import { ParticleData, ParticleType, Vec3, OrbitalState } from '../../shared/types';
import { createParticleMesh } from './ParticleFactory';
import { createOrbitalMesh } from './OrbitalMesh';

interface SceneParticle {
  data: ParticleData;
  mesh: THREE.Mesh;
  orbitalMesh?: THREE.Object3D;
}

let nextId = 1;

export class ParticleManager {
  private particles: Map<string, SceneParticle> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addParticle(type: ParticleType, position: Vec3, extra?: Partial<ParticleData>): ParticleData {
    const id = `p${nextId++}`;
    const data: ParticleData = {
      id,
      type,
      position: { ...position },
      momentum: { x: 0, y: 0, z: 0 },
      spin: type === 'photon' ? 1 : 0.5,
      ...extra,
    };

    const mesh = createParticleMesh(type);
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData.particleId = id;
    this.scene.add(mesh);

    const sp: SceneParticle = { data, mesh };

    if (type === 'electron' && data.orbital) {
      sp.orbitalMesh = createOrbitalMesh(data.orbital);
      this.scene.add(sp.orbitalMesh);
    }

    this.particles.set(id, sp);
    return data;
  }

  removeParticle(id: string): void {
    const sp = this.particles.get(id);
    if (sp) {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      (sp.mesh.material as THREE.Material).dispose();
      if (sp.orbitalMesh) {
        this.scene.remove(sp.orbitalMesh);
      }
      this.particles.delete(id);
    }
  }

  getParticle(id: string): SceneParticle | undefined {
    return this.particles.get(id);
  }

  getAllParticles(): ParticleData[] {
    return Array.from(this.particles.values()).map(sp => sp.data);
  }

  updatePosition(id: string, pos: Vec3): void {
    const sp = this.particles.get(id);
    if (sp) {
      sp.data.position = { ...pos };
      sp.mesh.position.set(pos.x, pos.y, pos.z);
    }
  }

  getMeshById(id: string): THREE.Mesh | undefined {
    return this.particles.get(id)?.mesh;
  }

  getAllMeshes(): THREE.Mesh[] {
    return Array.from(this.particles.values()).map(sp => sp.mesh);
  }

  setOrbital(id: string, orbital: OrbitalState): void {
    const sp = this.particles.get(id);
    if (!sp || sp.data.type !== 'electron') return;
    if (sp.orbitalMesh) {
      this.scene.remove(sp.orbitalMesh);
    }
    sp.data.orbital = { ...orbital };
    sp.orbitalMesh = createOrbitalMesh(orbital);
    this.scene.add(sp.orbitalMesh);
  }

  clear(): void {
    for (const [id] of this.particles) {
      this.removeParticle(id);
    }
  }
}
