import { describe, expect, it } from 'vitest';
import { hydrogenRadii } from './hydrogen';
import { findTransition, energyLevel } from './transitions';
import { formatDuration, realTime } from './time';
import { FS_PER_TICK, SPEED_OF_LIGHT_FM_PER_FS, LIGHT_SPEED_FM_PER_TICK } from '../../shared/constants';

describe('hydrogen cloud radii (units of a0)', () => {
  // Reference values computed independently with the explicit radial functions (plan item 1.4).
  const table: Array<[number, number, number, number]> = [
    [1, 0, 1.0, 2.66],
    [2, 1, 4.0, 7.99],
    [3, 0, 13.07, 19.44],
    [3, 1, 12.0, 18.39],
    [4, 1, 23.58, 32.59],
  ];
  it.each(table)('n=%i l=%i: most likely %f, 90%% boundary %f', (n, l, mostLikely, outer) => {
    const r = hydrogenRadii(n, l);
    expect(r.mostLikely).toBeCloseTo(mostLikely, 1);
    expect(r.outer).toBeCloseTo(outer, 1);
  });

  it('matches exact closed forms', () => {
    expect(hydrogenRadii(1, 0).mostLikely).toBeCloseTo(1, 2); // a0
    expect(hydrogenRadii(2, 0).mostLikely).toBeCloseTo(3 + Math.sqrt(5), 2); // outer 2s peak
    expect(hydrogenRadii(2, 1).mostLikely).toBeCloseTo(4, 2); // n^2 a0 when l = n - 1
  });
});

describe('transitions', () => {
  const s1 = { n: 1, l: 0, m: 0 };
  const p2 = { n: 2, l: 1, m: 0 };

  it('uses E = -13.6 eV / n^2', () => {
    expect(energyLevel(1)).toBeCloseTo(-13.6, 6);
    expect(energyLevel(2)).toBeCloseTo(-3.4, 6);
  });

  it.each([
    [s1, 10.2, { n: 2, l: 1, m: 0 }],
    [s1, 12.09, { n: 3, l: 1, m: 0 }],
    [s1, 12.75, { n: 4, l: 1, m: 0 }],
    [p2, 1.89, { n: 3, l: 0, m: 0 }],
  ])('toolbar energy: %o + %f eV -> %o', (from, ev, to) => {
    expect(findTransition(from, ev)).toEqual(to);
  });

  it('rejects energies that match no transition', () => {
    expect(findTransition(s1, 5)).toBeNull();
    expect(findTransition(s1, 1.89)).toBeNull(); // 2p -> 3s energy, but the electron is in 1s
    expect(findTransition(s1, 10.3)).toBeNull(); // outside the 0.05 eV tolerance
  });
});

describe('real time', () => {
  it('one tick is the time light takes to cross LIGHT_SPEED_FM_PER_TICK', () => {
    expect(FS_PER_TICK).toBeCloseTo(LIGHT_SPEED_FM_PER_TICK / SPEED_OF_LIGHT_FM_PER_FS, 15);
    // 2,000,000 fm at c: 6.67 as
    expect(formatDuration(realTime(400, FS_PER_TICK, []).fs)).toBe('6.67 as');
  });

  const lifetime = [{ start: 0, end: 200, realFs: 1.6e6, label: 'average 2p lifetime' }];

  it('maps a compressed span to its real duration and marks later times approximate', () => {
    expect(realTime(0, FS_PER_TICK, lifetime)).toEqual({ fs: 0, approximate: false, activeLabel: undefined });
    const mid = realTime(100, FS_PER_TICK, lifetime);
    expect(mid.fs).toBeCloseTo(0.8e6, 6);
    expect(mid.activeLabel).toBe('average 2p lifetime');
    const after = realTime(300, FS_PER_TICK, lifetime);
    expect(after.fs).toBeCloseTo(1.6e6 + 100 * FS_PER_TICK, 6);
    expect(after.approximate).toBe(true);
    expect(after.activeLabel).toBeUndefined();
  });

  it('formats with automatic units', () => {
    expect(formatDuration(0)).toBe('0 fs');
    expect(formatDuration(1.6e6)).toBe('1.60 ns');
    expect(formatDuration(272.73)).toBe('273 fs');
    expect(formatDuration(2.6685e-4)).toBe('267 zs');
  });
});
