import * as THREE from 'three';
import { ParticleData, ParticleType, Vec3, OrbitalState } from '../../shared/types';
import { createParticleMesh } from './ParticleFactory';
import { createOrbitalMesh } from './OrbitalMesh';
import { PhotonTrail } from './PhotonTrail';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createParticleLabel, updateLabelText } from './ParticleLabels';

interface SceneParticle {
  data: ParticleData;
  mesh: THREE.Mesh;
  orbitalMesh?: THREE.Object3D;
  trail?: PhotonTrail;
  label?: CSS2DObject;
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

    const label = createParticleLabel(data);
    mesh.add(label);
    sp.label = label;

    if (type === 'electron' && data.orbital) {
      sp.orbitalMesh = createOrbitalMesh(data.orbital);
      this.scene.add(sp.orbitalMesh);
    }

    if (type === 'photon') {
      sp.trail = new PhotonTrail(this.scene);
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
      if (sp.trail) sp.trail.dispose(this.scene);
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
    if (sp.label) updateLabelText(sp.label, sp.data);
  }

  updateTrails(time: number): void {
    for (const sp of this.particles.values()) {
      if (sp.trail && sp.data.type === 'photon' && sp.data.direction) {
        const pos = new THREE.Vector3(sp.data.position.x, sp.data.position.y, sp.data.position.z);
        const dir = new THREE.Vector3(sp.data.direction.x, sp.data.direction.y, sp.data.direction.z).normalize();
        sp.trail.update(pos, dir, time);
      }
    }
  }

  setLabelsVisible(visible: boolean): void {
    for (const sp of this.particles.values()) {
      if (sp.label) {
        sp.label.visible = visible;
      }
    }
  }

  clear(): void {
    for (const [id] of this.particles) {
      this.removeParticle(id);
    }
  }
}
