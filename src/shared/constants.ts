export const PLANCK_CONSTANT = 6.62607015e-34;
export const HBAR = 1.054571817e-34;
export const ELECTRON_CHARGE = 1.602176634e-19;
export const ELECTRON_MASS = 9.1093837015e-31;
export const PROTON_MASS = 1.67262192369e-27;
export const NEUTRON_MASS = 1.67492749804e-27;
export const SPEED_OF_LIGHT = 2.99792458e8;
export const FINE_STRUCTURE = 7.2973525693e-3;
export const BOHR_RADIUS = 5.29177210903e-11;
export const COULOMB_CONSTANT = 8.9875517923e9;
export const EV_TO_JOULES = 1.602176634e-19;

export const FM_PER_UNIT = 1;
export const BOHR_RADIUS_FM = BOHR_RADIUS * 1e15;

export const PROTON_VISUAL_RADIUS = 3;
export const NEUTRON_VISUAL_RADIUS = 3;
export const ELECTRON_VISUAL_RADIUS = 1.5;
export const PHOTON_VISUAL_RADIUS = 1;

export const PARTICLE_COLORS = {
  electron: 0x4488ff,
  proton: 0xff4444,
  neutron: 0x888888,
  photon: 0xffdd44,
} as const;

export const DEFAULT_ATOM_RADIUS_FM = 53000;

export const DEFAULT_SPEED = 1;
export const TIME_STEP_FS = 0.1;
