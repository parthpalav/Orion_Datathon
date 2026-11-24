import { describe, expect, it } from 'vitest';
import { litresPerKm, routeFuel } from './fuel';

describe('fuel', () => {
  it('matches the TAG formula at 50 km/h (6.81 L/100 km)', () => {
    expect(litresPerKm(50) * 100).toBeCloseTo(6.81, 2);
  });

  it('uses more fuel in crawling traffic than at steady city speed', () => {
    expect(litresPerKm(10)).toBeGreaterThan(litresPerKm(50));
  });

  it('clamps speeds below 10 km/h, including stopped segments', () => {
    expect(litresPerKm(0)).toBe(litresPerKm(10));
    expect(litresPerKm(3)).toBe(litresPerKm(10));
  });

  it('sums segments and converts to CO₂ at 2.31 kg/L', () => {
    const { litres, co2Kg } = routeFuel([50 / 3.6, 50 / 3.6], [500, 500]);
    expect(litres).toBeCloseTo(litresPerKm(50), 10);
    expect(co2Kg).toBeCloseTo(litres * 2.31, 10);
  });
});
