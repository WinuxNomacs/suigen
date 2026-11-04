import { describe, expect, it } from 'vitest';
import { speedText, spinText } from './InfoPanel';

describe('spin display', () => {
  it('shows intrinsic spin by type and m_s only when set', () => {
    expect(spinText({ type: 'photon' })).toBe('spin: 1');
    expect(spinText({ type: 'proton' })).toBe('spin: 1/2');
    expect(spinText({ type: 'electron', spin: 0.5 })).toBe('spin: 1/2, m_s = +1/2');
    expect(spinText({ type: 'electron', spin: -0.5 })).toBe('spin: 1/2, m_s = −1/2');
  });
});

describe('speed display', () => {
  it('uses c for fast particles and km/s or m/s for slow ones', () => {
    expect(speedText(1)).toBe('speed: 1 c');
    expect(speedText(0.2472)).toBe('speed: 0.247 c');
    expect(speedText(0.005459492)).toBe('speed: 1637 km/s (0.00546 c)');
    expect(speedText(2200 / 2.99792458e8)).toBe('speed: 2200 m/s');
  });
});
