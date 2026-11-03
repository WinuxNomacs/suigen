import * as THREE from 'three';
import { ParticleData, ParticleType, Vec3, OrbitalState } from '../../shared/types';
import { ORBITAL_MORPH_FS } from '../../shared/constants';
import { createParticleMesh } from './ParticleFactory';
import { createOrbitalMesh, orbitalRadius, setOrbitalOpacity, disposeOrbitalMesh } from './OrbitalMesh';
import { PhotonTrail } from './PhotonTrail';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createParticleLabel, updateLabelText } from './ParticleLabels';

interface OrbitalMorph {
  from: THREE.Object3D;
  fromRadius: number;
  toRadius: number;
  startTime: number;
}

interface SceneParticle {
  data: ParticleData;
  mesh: THREE.Mesh;
  orbitalMesh?: THREE.Object3D;
  morph?: OrbitalMorph;
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
    const id = extra?.id ?? `p${nextId++}`;
    const data: ParticleData = {
      type,
      momentum: { x: 0, y: 0, z: 0 },
      spin: type === 'photon' ? 1 : 0.5,
      ...extra,
      id,
      position: { ...position },
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
      sp.orbitalMesh.position.copy(mesh.position);
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
      if (sp.label) sp.label.element.remove();
      if (sp.orbitalMesh) this.removeOrbitalMesh(sp.orbitalMesh);
      if (sp.morph) this.removeOrbitalMesh(sp.morph.from);
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
      sp.orbitalMesh?.position.copy(sp.mesh.position);
      sp.morph?.from.position.copy(sp.mesh.position);
    }
  }

  getMeshById(id: string): THREE.Mesh | undefined {
    return this.particles.get(id)?.mesh;
  }

  getAllMeshes(): THREE.Mesh[] {
    return Array.from(this.particles.values()).map(sp => sp.mesh);
  }

  // Crossfade the old orbital cloud into the new one, driven by simulation time in update().
  setOrbital(id: string, orbital: OrbitalState, startTime: number): void {
    const sp = this.particles.get(id);
    if (!sp || sp.data.type !== 'electron') return;
    if (sp.morph) this.removeOrbitalMesh(sp.morph.from);
    if (sp.orbitalMesh && sp.data.orbital) {
      sp.morph = {
        from: sp.orbitalMesh,
        fromRadius: orbitalRadius(sp.data.orbital),
        toRadius: orbitalRadius(orbital),
        startTime,
      };
    }
    sp.data.orbital = { ...orbital };
    sp.orbitalMesh = createOrbitalMesh(orbital);
    sp.orbitalMesh.position.copy(sp.mesh.position);
    this.scene.add(sp.orbitalMesh);
    if (sp.label) updateLabelText(sp.label, sp.data);
  }

  update(time: number): void {
    for (const sp of this.particles.values()) {
      if (sp.trail && sp.data.type === 'photon' && sp.data.direction) {
        const pos = new THREE.Vector3(sp.data.position.x, sp.data.position.y, sp.data.position.z);
        const dir = new THREE.Vector3(sp.data.direction.x, sp.data.direction.y, sp.data.direction.z).normalize();
        sp.trail.update(pos, dir, time);
      }
      if (sp.morph && sp.orbitalMesh) {
        this.updateMorph(sp, sp.morph, sp.orbitalMesh, time);
      }
    }
  }

  private updateMorph(sp: SceneParticle, morph: OrbitalMorph, to: THREE.Object3D, time: number): void {
    const p = THREE.MathUtils.clamp((time - morph.startTime) / ORBITAL_MORPH_FS, 0, 1);
    if (p >= 1) {
      this.removeOrbitalMesh(morph.from);
      sp.morph = undefined;
      setOrbitalOpacity(to, 1);
      to.scale.setScalar(1);
      return;
    }
    const ratio = morph.toRadius / morph.fromRadius;
    setOrbitalOpacity(morph.from, 1 - p);
    morph.from.scale.setScalar(THREE.MathUtils.lerp(1, ratio, p));
    setOrbitalOpacity(to, p);
    to.scale.setScalar(THREE.MathUtils.lerp(1 / ratio, 1, p));
  }

  private removeOrbitalMesh(group: THREE.Object3D): void {
    this.scene.remove(group);
    disposeOrbitalMesh(group);
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
