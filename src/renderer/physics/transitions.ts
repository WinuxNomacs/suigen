import { OrbitalState } from '../../shared/types';
import { HYDROGEN_BINDING_EV, ABSORPTION_TOLERANCE_EV, ELECTRON_MASS, PROTON_MASS } from '../../shared/constants';

const MAX_N = 4;
const MAX_RENDERED_L = 1; // only s and p shapes exist

// Bohr levels E_n = -13.598 eV / n² (reduced-mass corrected; fine structure ignored).
export function energyLevel(n: number): number {
  return -HYDROGEN_BINDING_EV / (n * n);
}

// Find an upward transition (Δl = ±1) whose energy gap matches the photon energy.
export function findTransition(orbital: OrbitalState, energyEv: number): OrbitalState | null {
  const { n, l } = orbital;
  for (let n2 = n + 1; n2 <= MAX_N; n2++) {
    const gap = energyLevel(n2) - energyLevel(n);
    if (Math.abs(gap - energyEv) > ABSORPTION_TOLERANCE_EV) continue;
    for (const l2 of [l + 1, l - 1]) {
      if (l2 >= 0 && l2 <= Math.min(MAX_RENDERED_L, n2 - 1)) {
        return { n: n2, l: l2, m: 0 };
      }
    }
  }
  return null;
}

/**
 * Kinetic energy of the electron freed from level n by a photon, or null below the threshold.
 * The excess E - |E_n| is shared by the electron and the recoiling proton in inverse proportion to their
 * masses (equal and opposite momenta): the electron gets m_p / (m_p + m_e) of it.
 */
export function ionizationKineticEnergy(photonEv: number, n: number): number | null {
  const excess = photonEv + energyLevel(n);
  return excess > 0 ? (excess * PROTON_MASS) / (PROTON_MASS + ELECTRON_MASS) : null;
}
