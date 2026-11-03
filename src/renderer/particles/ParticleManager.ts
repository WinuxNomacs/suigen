import * as THREE from 'three';
import { ParticleData, ParticleType, Vec3, OrbitalState } from '../../shared/types';
import { NUCLEUS_CLUSTER_FM, ORBITAL_MORPH_TICKS } from '../../shared/constants';
import { createParticleMesh, getMarker } from './ParticleFactory';
import { createOrbitalMesh, orbitalRadius, setOrbitalOpacity, disposeOrbitalMesh } from './OrbitalMesh';
import { PhotonTrail } from './PhotonTrail';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createParticleLabel, setLabelText, labelText } from './ParticleLabels';

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
  spawnPosition: THREE.Vector3;
  label: CSS2DObject;
  /** False when another particle's label speaks for this one (nucleons merged into "nucleus"). */
  labelShown: boolean;
}

let nextId = 1;

export class ParticleManager {
  private particles: Map<string, SceneParticle> = new Map();
  private scene: THREE.Scene;
  private labelsVisible = true;
  private selectedId: string | null = null;

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

    const mesh = createParticleMesh(type, id);
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);

    const label = createParticleLabel(data);
    label.visible = this.labelsVisible;
    mesh.add(label);

    const sp: SceneParticle = { data, mesh, label, labelShown: true, spawnPosition: mesh.position.clone() };

    if (type === 'electron' && data.orbital) {
      // A bound electron is its cloud: no marker at the nucleus, and the label sits on the cloud.
      const marker = getMarker(mesh);
      if (marker) marker.visible = false;
      this.attachOrbital(sp, data.orbital);
    }

    if (type === 'photon') {
      sp.trail = new PhotonTrail(this.scene);
    }

    this.particles.set(id, sp);
    if (id === this.selectedId) this.applySelection(sp, true);
    return data;
  }

  /** Highlights one particle (or none). Kept across rebuilds, so a rewind re-highlights it. */
  setSelected(id: string | null): void {
    if (this.selectedId) {
      const prev = this.particles.get(this.selectedId);
      if (prev) this.applySelection(prev, false);
    }
    this.selectedId = id;
    const sp = id ? this.particles.get(id) : undefined;
    if (sp) this.applySelection(sp, true);
  }

  private applySelection(sp: SceneParticle, on: boolean): void {
    sp.label.element.classList.toggle('selected', on);
    const marker = getMarker(sp.mesh);
    if (marker) {
      marker.userData.baseScale ??= marker.scale.x;
      marker.scale.setScalar(marker.userData.baseScale * (on ? 1.6 : 1));
    }
  }

  /**
   * The particles a drag on `id` moves: for a nucleon, its whole nucleus plus the electron clouds
   * centered on it, so an atom moves as one; otherwise just the particle.
   */
  getDragGroup(id: string): string[] {
    const sp = this.particles.get(id);
    if (!sp) return [];
    if (sp.data.type !== 'proton' && sp.data.type !== 'neutron') return [id];
    const group: string[] = [];
    for (const other of this.particles.values()) {
      const near = other.mesh.position.distanceTo(sp.mesh.position) <= NUCLEUS_CLUSTER_FM;
      const nucleon = other.data.type === 'proton' || other.data.type === 'neutron';
      const cloud = other.data.type === 'electron' && !!other.data.orbital;
      if (near && (nucleon || cloud)) group.push(other.data.id);
    }
    return group;
  }

  private attachOrbital(sp: SceneParticle, orbital: OrbitalState): void {
    sp.orbitalMesh = createOrbitalMesh(orbital, sp.data.effectiveCharge);
    sp.orbitalMesh.userData.particleId = sp.data.id;
    sp.orbitalMesh.position.copy(sp.mesh.position);
    this.scene.add(sp.orbitalMesh);
    // Top of the cloud: on the lobe tip for a p orbital along y, on the sphere for s.
    sp.label.position.set(0, orbitalRadius(orbital, sp.data.effectiveCharge), 0);
  }

  removeParticle(id: string): void {
    const sp = this.particles.get(id);
    if (sp) {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      (sp.mesh.material as THREE.Material).dispose();
      getMarker(sp.mesh)?.material.dispose();
      sp.label.element.remove();
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

  /** Visible markers, for click picking. */
  getMarkers(): THREE.Sprite[] {
    const markers: THREE.Sprite[] = [];
    for (const sp of this.particles.values()) {
      const m = getMarker(sp.mesh);
      if (m?.visible) markers.push(m);
    }
    return markers;
  }

  /** Electron clouds, for click picking when no marker was hit. */
  getClouds(): THREE.Object3D[] {
    const clouds: THREE.Object3D[] = [];
    for (const sp of this.particles.values()) {
      if (sp.orbitalMesh) clouds.push(sp.orbitalMesh);
    }
    return clouds;
  }

  // Crossfade the old orbital cloud into the new one, driven by simulation time in update().
  setOrbital(id: string, orbital: OrbitalState, startTime: number): void {
    const sp = this.particles.get(id);
    if (!sp || sp.data.type !== 'electron') return;
    if (sp.morph) this.removeOrbitalMesh(sp.morph.from);
    if (sp.orbitalMesh && sp.data.orbital) {
      sp.morph = {
        from: sp.orbitalMesh,
        fromRadius: orbitalRadius(sp.data.orbital, sp.data.effectiveCharge),
        toRadius: orbitalRadius(orbital, sp.data.effectiveCharge),
        startTime,
      };
    }
    sp.data.orbital = { ...orbital };
    this.attachOrbital(sp, orbital);
    setLabelText(sp.label, labelText(sp.data));
  }

  update(time: number): void {
    for (const sp of this.particles.values()) {
      if (sp.trail && sp.data.type === 'photon' && sp.data.direction) {
        const pos = new THREE.Vector3(sp.data.position.x, sp.data.position.y, sp.data.position.z);
        const dir = new THREE.Vector3(sp.data.direction.x, sp.data.direction.y, sp.data.direction.z).normalize();
        sp.trail.update(pos, dir, time, sp.data.energy, pos.distanceTo(sp.spawnPosition));
      }
      if (sp.morph && sp.orbitalMesh) {
        this.updateMorph(sp, sp.morph, sp.orbitalMesh, time);
      }
    }
    this.updateSharedLabels();
  }

  // Particles drawn at the same spot share one label: nucleons within NUCLEUS_CLUSTER_FM of each other
  // ("nucleus (2 p, 2 n)") and bound electrons in the same cloud ("2 electrons (1s)").
  private updateSharedLabels(): void {
    const nucleons = Array.from(this.particles.values()).filter(
      sp => sp.data.type === 'proton' || sp.data.type === 'neutron',
    );
    const clusterOf = new Map<SceneParticle, SceneParticle[]>();
    for (const sp of nucleons) {
      let cluster: SceneParticle[] | undefined;
      for (const other of nucleons) {
        const c = clusterOf.get(other);
        if (c && other.mesh.position.distanceTo(sp.mesh.position) <= NUCLEUS_CLUSTER_FM) {
          cluster = c;
          break;
        }
      }
      if (!cluster) cluster = [];
      cluster.push(sp);
      clusterOf.set(sp, cluster);
    }

    for (const cluster of new Set(clusterOf.values())) {
      cluster.forEach((sp, i) => {
        sp.labelShown = i === 0;
        if (i > 0) return;
        if (cluster.length === 1) {
          setLabelText(sp.label, labelText(sp.data));
        } else {
          const p = cluster.filter(c => c.data.type === 'proton').length;
          setLabelText(sp.label, `nucleus (${p} p, ${cluster.length - p} n)`);
        }
      });
    }

    const clouds = new Map<string, SceneParticle[]>();
    for (const sp of this.particles.values()) {
      const o = sp.data.orbital;
      if (sp.data.type !== 'electron' || !o) continue;
      const pos = sp.mesh.position;
      const key = `${pos.x},${pos.y},${pos.z}|${o.n},${o.l},${o.m}|${sp.data.effectiveCharge ?? 1}`;
      clouds.set(key, [...(clouds.get(key) ?? []), sp]);
    }
    for (const group of clouds.values()) {
      group.forEach((sp, i) => {
        sp.labelShown = i === 0;
        if (i > 0) return;
        const own = labelText(sp.data);
        setLabelText(sp.label, group.length === 1 ? own : own.replace('electron', `${group.length} electrons`));
      });
    }

    for (const sp of this.particles.values()) {
      sp.label.visible = this.labelsVisible && sp.labelShown;
    }
  }

  private updateMorph(sp: SceneParticle, morph: OrbitalMorph, to: THREE.Object3D, time: number): void {
    const p = THREE.MathUtils.clamp((time - morph.startTime) / ORBITAL_MORPH_TICKS, 0, 1);
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
    this.labelsVisible = visible;
    for (const sp of this.particles.values()) {
      sp.label.visible = visible && sp.labelShown;
    }
  }

  clear(): void {
    for (const [id] of this.particles) {
      this.removeParticle(id);
    }
  }
}
