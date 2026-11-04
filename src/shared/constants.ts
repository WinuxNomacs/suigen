// CODATA 2022 values (NIST, physics.nist.gov/constants), SI units. h, e and c are exact by definition.
export const PLANCK_CONSTANT = 6.62607015e-34;
export const HBAR = 1.054571817e-34;
export const ELECTRON_CHARGE = 1.602176634e-19;
export const ELECTRON_MASS = 9.1093837139e-31;
export const PROTON_MASS = 1.67262192595e-27;
export const NEUTRON_MASS = 1.67492750056e-27;
export const DEUTERON_MASS = 3.3435837768e-27;
export const SPEED_OF_LIGHT = 2.99792458e8;
export const FINE_STRUCTURE = 7.2973525643e-3;
export const BOHR_RADIUS = 5.29177210544e-11;
export const COULOMB_CONSTANT = 8.9875517862e9;
export const EV_TO_JOULES = 1.602176634e-19;
// Rydberg energy R∞hc in eV (CODATA 2022): the binding energy for an infinitely heavy nucleus.
export const RYDBERG_ENERGY_EV = 13.60569312299;

const mc2Ev = (kg: number) => (kg * SPEED_OF_LIGHT ** 2) / EV_TO_JOULES;
// Neutron capture by a free proton at rest, n + p → d + γ: the gamma ray carries
// E = (M² - m_d²) / 2M with M = m_p + m_n (binding energy 2.2246 MeV minus the deuteron's 1.3 keV recoil).
export const ELECTRON_REST_ENERGY_EV = mc2Ev(ELECTRON_MASS); // 510,998.95 eV
export const NP_CAPTURE_GAMMA_EV = (() => {
  const M = mc2Ev(PROTON_MASS) + mc2Ev(NEUTRON_MASS);
  const md = mc2Ev(DEUTERON_MASS);
  return (M * M - md * md) / (2 * M);
})();
// A thermal neutron (room temperature, 2,200 m/s) and its kinetic energy ½mv² (0.0253 eV).
export const THERMAL_NEUTRON_SPEED_M_S = 2200;
export const THERMAL_NEUTRON_ENERGY_EV = (0.5 * NEUTRON_MASS * THERMAL_NEUTRON_SPEED_M_S ** 2) / EV_TO_JOULES;
// 1 m/s = 1e15 fm / 1e15 fs = 1 fm/fs, so 2,200 m/s is 2,200 fm per fs.
export const THERMAL_NEUTRON_FM_PER_FS = THERMAL_NEUTRON_SPEED_M_S;

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
export const DEFAULT_PLAYBACK_SPEED = 0.25; // slow enough to follow the events at first sight
export const ORBITAL_MORPH_TICKS = 50; // visual crossfade between clouds; not a physical duration

// Nucleons closer than this share one label. Nuclei are a few fm across; atoms are ~100,000 fm.
export const NUCLEUS_CLUSTER_FM = 20;
// Where a captured neutron is drawn relative to its proton (markers, not sizes; the deuteron's
// charge radius is 2.128 fm, CODATA 2022), and how close it must be for the capture to count.
export const NUCLEON_SPACING_FM = 1.5;
export const CAPTURE_DISTANCE_FM = 3;
// Validator tolerance for a capture gamma ray's energy, in eV.
export const CAPTURE_GAMMA_TOLERANCE_EV = 5;

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

// Hydrogen's ground-state binding energy: the Rydberg energy times the reduced-mass factor
// μ/m_e = 1 / (1 + m_e/m_p), because the proton is not infinitely heavy. 13.598287 eV.
export const HYDROGEN_BINDING_EV = RYDBERG_ENERGY_EV / (1 + ELECTRON_MASS / PROTON_MASS);
export const ABSORPTION_TOLERANCE_EV = 0.05;
