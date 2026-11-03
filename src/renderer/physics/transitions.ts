import { OrbitalState } from '../../shared/types';
import { RYDBERG_EV, ABSORPTION_TOLERANCE_EV } from '../../shared/constants';

const MAX_N = 4;
const MAX_RENDERED_L = 1; // only s and p shapes exist

export function energyLevel(n: number): number {
  return -RYDBERG_EV / (n * n);
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
