import { describe, expect, it, vi } from 'vitest';
import { getDirections } from './mapbox';
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
    expect(plan.fuelReference).toEqual({ kmPerLitre: expect.closeTo(14.7, 1), speedKmh: 50 });
    expect(plan.timeline).toHaveLength(12);
    expect(plan.bestDeparture.durationMin).toBe(10);
    expect(plan.bestDeparture.hour < 8 || plan.bestDeparture.hour > 20).toBe(true);
  });

  it('recommends the quickest sampled time within the window and returns routes for it', async () => {
    vi.mocked(getDirections).mockClear();
    const day = istMidnight(new Date(Date.now() + 2 * 86400_000));
    const start = new Date(day + (19 * 60 + 45) * 60_000);
    const end = new Date(day + (21 * 60 + 10) * 60_000);
    const plan = await planRoute([72.84, 19.11], [72.86, 19.07], undefined, undefined, { start, end });

    expect(plan.bestInWindow).toEqual({
      departAt: end.toISOString(), minDurationMin: 10, maxDurationMin: 30, stepMinutes: 30,
    });
    expect(plan.departAt).toBe(end.toISOString());
    expect(plan.routes.find((r) => r.id === plan.fastestId)?.durationMin).toBe(10);
    const requests = vi.mocked(getDirections).mock.calls;
    expect(requests.filter(([, , at]) => at?.getTime() === end.getTime())).toHaveLength(1);
    expect(requests.some(([, , at]) => at?.getTime() === start.getTime())).toBe(true);
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

  it('keeps the preferred time for a date range that starts with a live departure', async () => {
    const now = new Date('2026-11-25T03:32:27Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    try {
      const today = new Date(istMidnight(now));
      const tomorrow = new Date(today.getTime() + 86400_000);
      const plan = await planRoute([72.84, 19.11], [72.86, 19.07], new Date('2026-11-25T03:30:00Z'), {
        start: today,
        end: tomorrow,
      });
      expect(plan.departAt).toBeNull();
      expect(plan.bestDate?.departAt).toBe('2026-11-26T03:30:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
