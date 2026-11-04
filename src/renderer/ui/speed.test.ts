import { describe, expect, it } from 'vitest';
import {
  SPEED_POSITION_MAX, SPEED_STOPS, STEPS_PER_SEGMENT, formatSpeed, formatStop, positionToSpeed, speedToPosition,
} from './speed';

describe('playback speed slider', () => {
  it('has the requested stops, each landed on exactly', () => {
    expect(SPEED_STOPS).toEqual([-2, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2]);
    SPEED_STOPS.forEach((speed, i) => expect(positionToSpeed(i * STEPS_PER_SEGMENT)).toBe(speed));
    expect(positionToSpeed(0)).toBe(-2);
    expect(positionToSpeed(SPEED_POSITION_MAX)).toBe(2);
    expect(speedToPosition(1)).toBe(70); // default, matches index.html
  });

  it('steps 0.025x near 0 and 0.1x between 1x and 2x', () => {
    expect(positionToSpeed(41)).toBe(0.025);
    expect(positionToSpeed(39)).toBe(-0.025);
    expect(positionToSpeed(45)).toBe(0.125);
    expect(positionToSpeed(71)).toBe(1.1);
    expect(positionToSpeed(9)).toBe(-1.1);
  });

  it('round-trips every position', () => {
    for (let p = 0; p <= SPEED_POSITION_MAX; p++) expect(speedToPosition(positionToSpeed(p))).toBe(p);
  });

  it('every readout fits the fixed-width button (7 characters, styles.css #speed-value)', () => {
    const longest = Math.max(...Array.from({ length: SPEED_POSITION_MAX + 1 }, (_, p) => formatSpeed(positionToSpeed(p)).length));
    expect(longest).toBe(7);
  });

  it('formats readout and stop labels', () => {
    expect(formatSpeed(1)).toBe('1x');
    expect(formatSpeed(0.025)).toBe('0.025x');
    expect(formatSpeed(-0.125)).toBe('-0.125x');
    expect(SPEED_STOPS.map(formatStop)).toEqual(['-2x', '-1x', '-.5x', '-.25x', '0', '.25x', '.5x', '1x', '2x']);
  });
});
