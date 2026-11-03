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

export const BOHR_RADIUS_FM = BOHR_RADIUS * 1e15;
// 1 m/s = 1e15 fm / 1e15 fs, so the speed of light has the same value in fm/fs.
export const SPEED_OF_LIGHT_FM_PER_FS = SPEED_OF_LIGHT;

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

// Animation time is counted in ticks. Light moves LIGHT_SPEED_FM_PER_TICK per tick, which fixes how
// ticks convert to real time (see physics/time.ts). Nothing else about a tick is physical.
export const TICKS_PER_REAL_SECOND = 100; // playback rate at speed 1
export const LIGHT_SPEED_FM_PER_TICK = 5000; // a photon crosses 2,000,000 fm in 4 s at speed 1
export const FS_PER_TICK = LIGHT_SPEED_FM_PER_TICK / SPEED_OF_LIGHT_FM_PER_FS; // ~1.668e-5 fs
export const STEP_TICKS = 10; // step forward/back buttons
export const ORBITAL_MORPH_TICKS = 50; // visual crossfade between clouds; not a physical duration

// Nucleons closer than this share one label. Nuclei are a few fm across; atoms are ~100,000 fm.
export const NUCLEUS_CLUSTER_FM = 20;

// Camera framing when no scenario sets the extent (sandbox): fits the 2p cloud's 90% surface.
export const DEFAULT_SCENE_EXTENT_FM = 8 * BOHR_RADIUS_FM;

// Photon trails: the drawn wavelength is proportional to the real wavelength, anchored so a
// 100 keV photon (12.4 pm) is drawn 60,000 fm long, then clamped to stay readable.
export const TRAIL_REF_WAVELENGTH_PM = 12.3984198;
export const TRAIL_REF_DRAWN_FM = 60000;
export const TRAIL_MIN_DRAWN_FM = 20000;
export const TRAIL_MAX_DRAWN_FM = 150000;

// hc in eV·pm, for photon wavelength from energy: λ = hc / E
export const HC_EV_PM = 1239841.98;

export const RYDBERG_EV = 13.6;
export const ABSORPTION_TOLERANCE_EV = 0.05;
