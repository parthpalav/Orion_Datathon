import { describe, expect, it } from 'vitest';
import { peakWindows, toPrediction, type TimelineData } from './predictionService';

const slot = (hour: number, durationMin: number): TimelineData => ({ hour, durationMin, avgSpeed: 20, congestionLevel: 0 });

describe('predictionService', () => {
  it('merges the slowest quarter of slots into peak windows', () => {
    const timeline = [slot(0, 20), slot(2, 18), slot(8, 36), slot(10, 37), slot(12, 30), slot(18, 35)];
    expect(peakWindows(timeline)).toEqual(['08:00-12:00', '18:00-20:00']);
  });

  it('reports no peaks when the day is flat', () => {
    expect(peakWindows([slot(0, 20), slot(2, 20.5)])).toEqual([]);
  });

  it('maps the server plan, labels routes and scores slots against the best one', () => {
    const route = (id: string, durationMin: number, fuelLitres: number) => ({
      id, durationMin, typicalDurationMin: durationMin, distanceKm: 11, fuelLitres, co2Kg: fuelLitres * 2.31, avgCongestion: 40, segments: [],
    });
    const p = toPrediction({
      departAt: '2026-11-25T03:30:00.000Z',
      routes: [route('route-0', 37, 1.2), route('route-1', 39, 1.0)],
      fastestId: 'route-0',
      fuelEfficientId: 'route-1',
      timeline: [
        { hour: 2, departAt: '', durationMin: 18.5, avgSpeedKmh: 35 },
        { hour: 10, departAt: '', durationMin: 37, avgSpeedKmh: 18 },
      ],
      bestDeparture: { hour: 2, durationMin: 18.5 },
      bestDate: null,
    }, false);
    expect(p.bestRoute.id).toBe('route-0');
    expect(p.fuelEfficientRoute.id).toBe('route-1');
    expect(p.optimalDepartureTime).toBe('02:00');
    expect(p.timeline.map((t) => t.congestionLevel)).toEqual([0, 100]);
    expect(p.insights.fuelSavedLitres).toBeCloseTo(0.2);
    expect(p.live).toBe(false);
  });
});
