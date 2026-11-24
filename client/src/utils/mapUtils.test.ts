import { describe, expect, it } from 'vitest';
import { getTrafficColor } from './mapUtils';

describe('mapUtils', () => {
  it('maps congestion bands to colours', () => {
    expect(getTrafficColor(10)).toBe('#10b981');
    expect(getTrafficColor(45)).toBe('#f59e0b');
    expect(getTrafficColor(70)).toBe('#f97316');
    expect(getTrafficColor(95)).toBe('#ef4444');
  });
});
