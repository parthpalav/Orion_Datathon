import { describe, expect, it, vi } from 'vitest';
import type { MapboxRoute } from './mapbox';

// Fake route: two equal segments of `km` each. `typicalMin` is the ETA Mapbox would report for future departures.
const fake = (typicalMin: number, km = 1): MapboxRoute => ({
  duration: 999,
  duration_typical: typicalMin * 60,
  distance: 2000 * km,
  geometry: { type: 'LineString', coordinates: [[72.84, 19.11], [72.85, 19.1], [72.86, 19.07]] },
  legs: [{
    annotation: {
      speed: [30 / 3.6, 30 / 3.6],
      distance: [1000 * km, 1000 * km],
      duration: [120 * km, 120 * km],
      congestion: ['unknown', 'unknown'],
    },
  }],
});

const IST = 5.5 * 3600 * 1000;
vi.mock('./mapbox', () => ({
  // Alternatives: route 0 is faster; route 1 is slower but shorter, so it burns less fuel.
  getDirections: vi.fn(async (_o: unknown, _d: unknown, at?: Date) => {
    const istHour = at ? new Date(at.getTime() + IST).getUTCHours() : 9;
    const rush = istHour >= 8 && istHour <= 20 ? 20 : 0;
    return [fake(10 + rush), fake(12 + rush, 0.8)];
  }),
}));

const { planRoute, futureSlot, istMidnight, shapeRoute } = await import('./routePlanner');

describe('routePlanner', () => {
  it('scales segment times so they add up to duration_typical', () => {
    const r = shapeRoute(fake(8), 0, false);
    expect(r.durationMin).toBe(8);
    expect(r.segments.reduce((s, x) => s + x.duration, 0)).toBeCloseTo(8, 1);
  });

  it('moves past slots forward by whole weeks', () => {
    const now = Date.UTC(2026, 10, 24, 12);
    const past = new Date(now - 3600_000);
    expect(futureSlot(past, now).getTime()).toBe(past.getTime() + 7 * 86400_000);
  });

  it('labels the fastest and the most fuel-efficient real alternatives', async () => {
    const departAt = new Date(istMidnight(new Date(Date.now() + 2 * 86400_000)) + 3 * 3600_000); // 03:00 IST
    const plan = await planRoute([72.84, 19.11], [72.86, 19.07], departAt);
    expect(plan.routes).toHaveLength(2);
    expect(plan.fastestId).toBe('route-0');
    expect(plan.fuelEfficientId).toBe('route-1');
    expect(plan.timeline).toHaveLength(12);
    expect(plan.bestDeparture.durationMin).toBe(10);
    expect(plan.bestDeparture.hour < 8 || plan.bestDeparture.hour > 20).toBe(true);
  });

  it('finds the best date in a range at the requested time of day', async () => {
    const day = istMidnight(new Date(Date.now() + 2 * 86400_000));
    const plan = await planRoute([72.84, 19.11], [72.86, 19.07], new Date(day + 9 * 3600_000), {
      start: new Date(day),
      end: new Date(day + 3 * 86400_000),
    });
    expect(plan.bestDate?.durationMin).toBe(30);
    expect(plan.bestDate?.departAt).toBe(new Date(day + 9 * 3600_000).toISOString());
  });
});
