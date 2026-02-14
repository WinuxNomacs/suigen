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
  spin: number;
  orbital?: OrbitalState;
  direction?: Vec3;
  energy?: number;
}

export interface ScenarioEvent {
  time: number;
  action: 'spawn' | 'absorb' | 'emit' | 'remove';
  particle?: Partial<ParticleData> & { type: ParticleType };
  photonIndex?: number;
  electronIndex?: number;
  targetOrbital?: OrbitalState;
}

export interface Scenario {
  name: string;
  description: string;
  particles: Array<Partial<ParticleData> & { type: ParticleType }>;
  events: ScenarioEvent[];
}

export interface SimulationState {
  playing: boolean;
  time: number;
  speed: number;
  particles: ParticleData[];
}
