export type ParticleType = 'electron' | 'proton' | 'neutron' | 'photon';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalState {
  n: number;
  l: number;
  m: number;
}

export interface ParticleData {
  id: string;
  type: ParticleType;
  position: Vec3;
  momentum: Vec3;
  /** Spin projection m_s in units of \u0127, only when a scenario sets it (e.g. the two helium electrons). */
  spin?: number;
  orbital?: OrbitalState;
  direction?: Vec3;
  /** Speed as a fraction of the speed of light. Defaults to 1 (photons). */
  speed?: number;
  /** Photon energy, or kinetic energy of a free particle, in eV. */
  energy?: number;
  /** Effective nuclear charge seen by an electron; cloud sizes scale as 1/Z. Defaults to 1. */
  effectiveCharge?: number;
}

export interface ScenarioEvent {
  time: number;
  action: 'spawn' | 'absorb' | 'emit' | 'remove' | 'move' | 'capture';
  particle?: Partial<ParticleData> & { type: ParticleType };
  photonId?: string;
  electronId?: string;
  targetId?: string;
  /** `capture`: the neutron binds to the proton and `particle` (a gamma ray) is emitted. */
  neutronId?: string;
  protonId?: string;
  targetOrbital?: OrbitalState;
  /** New position for a `move` event, in fm. */
  position?: Vec3;
}

export interface LaymanDescription {
  title: string;
  summary: string;
  sections: {
    whatsHappening: string;
    whyItMatters: string;
    whatToWatch: string;
    funFact: string;
  };
}

export interface ScientificEquation {
  label: string;
  tex: string;
}

export interface ScientificDescription {
  narrative: string;
  equations: ScientificEquation[];
  constants: string[];
}

/** A span of animation ticks that stands for a real duration too long to animate. */
export interface TimeCompression {
  start: number;
  end: number;
  realFs: number;
  label: string;
}

export interface Scenario {
  name: string;
  description: string;
  layman: LaymanDescription;
  scientific: ScientificDescription;
  particles: Array<Partial<ParticleData> & { type: ParticleType }>;
  events: ScenarioEvent[];
  /** Real durations stood in for by compressed tick spans (see physics/time.ts). */
  compressions?: TimeCompression[];
  /** Scenario-specific simplifications, shown after the general list. */
  simplifications?: string[];
  /** Radius in fm the camera frames on load. */
  extent?: number;
}

export interface SimulationState {
  playing: boolean;
  time: number;
  speed: number;
  loop: boolean; // restart from the other end on reaching the end (or the start in reverse)
}
