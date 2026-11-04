// Converts animation ticks to real (physical) time.
//
// Outside compressed segments, one tick is the time light takes to cross LIGHT_SPEED_FM_PER_TICK,
// so real time is exact for anything moving at a known speed. A compressed segment stands in for a
// span that would be far too long to animate (an excited-state lifetime, a slow neutron's approach):
// the whole segment maps to `realFs`, and every time from then on is marked approximate.

import type { TimeCompression } from '../../shared/types';

export interface RealTime {
  fs: number;
  approximate: boolean; // a compressed segment has started at or before this time
  activeLabel?: string; // set while inside a compressed segment
}

export function realTime(ticks: number, fsPerTick: number, compressions: TimeCompression[]): RealTime {
  const sorted = [...compressions].sort((a, b) => a.start - b.start);
  let fs = 0;
  let cursor = 0;
  let approximate = false;

  for (const c of sorted) {
    if (ticks <= c.start) break;
    fs += (c.start - cursor) * fsPerTick;
    approximate = true;
    if (ticks < c.end) {
      fs += ((ticks - c.start) / (c.end - c.start)) * c.realFs;
      return { fs, approximate, activeLabel: c.label };
    }
    fs += c.realFs;
    cursor = c.end;
  }

  fs += (ticks - cursor) * fsPerTick;
  return { fs, approximate };
}

/** Inverse of realTime: the tick at which `fs` femtoseconds of real time have passed. */
export function ticksAtRealTime(fs: number, fsPerTick: number, compressions: TimeCompression[]): number {
  const sorted = [...compressions].sort((a, b) => a.start - b.start);
  let cursorTicks = 0;
  let cursorFs = 0;
  for (const c of sorted) {
    const gapFs = (c.start - cursorTicks) * fsPerTick;
    if (fs <= cursorFs + gapFs) return cursorTicks + (fs - cursorFs) / fsPerTick;
    cursorFs += gapFs;
    if (fs <= cursorFs + c.realFs) return c.start + ((fs - cursorFs) / c.realFs) * (c.end - c.start);
    cursorFs += c.realFs;
    cursorTicks = c.end;
  }
  return cursorTicks + (fs - cursorFs) / fsPerTick;
}

const UNITS: Array<[string, number]> = [
  ['ns', 1e6],
  ['ps', 1e3],
  ['fs', 1],
  ['as', 1e-3],
  ['zs', 1e-6],
];

/** Formats a duration in femtoseconds with an automatic unit and 3 significant figures. */
export function formatDuration(fs: number): string {
  if (fs <= 0) return '0 fs';
  for (const [unit, scale] of UNITS) {
    if (fs >= scale) return `${(fs / scale).toPrecision(3)} ${unit}`;
  }
  return `${(fs / 1e-6).toPrecision(3)} zs`;
}
