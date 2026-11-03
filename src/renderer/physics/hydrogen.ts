// Radial probability of hydrogen-like orbitals, used to size the electron clouds.
// Distances are in Bohr radii (a0) for Z = 1; for effective charge Z they scale as 1/Z.
//
// R_nl(r) ∝ ρ^l · e^(-ρ/2) · L_{n-l-1}^{2l+1}(ρ),  ρ = 2r/n  (generalized Laguerre L)
// P(r) = r² · R_nl(r)²  is the probability density of finding the electron at distance r.

export interface OrbitalRadii {
  /** Distance where P(r) peaks: where the electron is most likely found. */
  mostLikely: number;
  /** Distance that encloses 90% of the probability: the drawn cloud surface. */
  outer: number;
}

function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  let prev = 1;
  let curr = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const next = ((2 * i + 1 + alpha - x) * curr - (i + alpha) * prev) / (i + 1);
    prev = curr;
    curr = next;
  }
  return curr;
}

function radialDensity(n: number, l: number, r: number): number {
  const rho = (2 * r) / n;
  const R = rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
  return r * r * R * R;
}

const cache = new Map<string, OrbitalRadii>();

/** Radii in units of a0 for Z = 1. Integrates P(r) numerically out to where it is negligible. */
export function hydrogenRadii(n: number, l: number): OrbitalRadii {
  const key = `${n},${l}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rMax = 10 * n * n + 20; // P(r) decays as e^(-2r/n); beyond this it is < 1e-12 of the peak
  const steps = 200_000;
  const dr = rMax / steps;
  const density = new Float64Array(steps);
  let total = 0;
  let peak = 0;
  let mostLikely = 0;
  for (let i = 0; i < steps; i++) {
    const r = (i + 0.5) * dr;
    const p = radialDensity(n, l, r);
    density[i] = p;
    total += p;
    if (p > peak) {
      peak = p;
      mostLikely = r;
    }
  }

  let cumulative = 0;
  let outer = rMax;
  for (let i = 0; i < steps; i++) {
    cumulative += density[i];
    if (cumulative >= 0.9 * total) {
      outer = (i + 1) * dr;
      break;
    }
  }

  const radii = { mostLikely, outer };
  cache.set(key, radii);
  return radii;
}
