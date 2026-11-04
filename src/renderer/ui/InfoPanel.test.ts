import { describe, expect, it } from 'vitest';
import { spinText } from './InfoPanel';

describe('spin display', () => {
  it('shows intrinsic spin by type and m_s only when set', () => {
    expect(spinText({ type: 'photon' })).toBe('spin: 1');
    expect(spinText({ type: 'proton' })).toBe('spin: 1/2');
    expect(spinText({ type: 'electron', spin: 0.5 })).toBe('spin: 1/2, m_s = +1/2');
    expect(spinText({ type: 'electron', spin: -0.5 })).toBe('spin: 1/2, m_s = −1/2');
  });
});
