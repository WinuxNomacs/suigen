import { describe, expect, it } from 'vitest';
import { SPEED_POSITION_MAX, SPEED_STOPS, STEPS_PER_SEGMENT, formatSpeed, positionToSpeed, speedToPosition } from './speed';

describe('playback speed slider', () => {
  it('lands exactly on each stop', () => {
    SPEED_STOPS.forEach((speed, i) => expect(positionToSpeed(i * STEPS_PER_SEGMENT)).toBe(speed));
    expect(positionToSpeed(0)).toBe(-10);
    expect(positionToSpeed(SPEED_POSITION_MAX)).toBe(2);
  });

  it('has 0.05x steps between -2x and 2x', () => {
    expect(positionToSpeed(81)).toBe(0.05);
    expect(positionToSpeed(87)).toBe(0.35);
    expect(positionToSpeed(79)).toBe(-0.05);
    expect(positionToSpeed(110)).toBe(1.5);
    expect(positionToSpeed(50)).toBe(-1.5);
  });

  it('round-trips every position', () => {
    for (let p = 0; p <= SPEED_POSITION_MAX; p++) expect(speedToPosition(positionToSpeed(p))).toBe(p);
  });

  it('formats without trailing zeros', () => {
    expect(formatSpeed(1)).toBe('1x');
    expect(formatSpeed(0.35)).toBe('0.35x');
    expect(formatSpeed(-7.5)).toBe('-7.5x');
  });
});
