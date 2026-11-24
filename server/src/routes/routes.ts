import { NextFunction, Request, Response, Router } from 'express';
import { earliestForecastTime, istMidnight, MAX_RANGE_DAYS, MAX_WINDOW_HOURS, MIN_LEAD_MINUTES, planRoute } from '../services/routePlanner';
import type { DepartureWindow } from '../services/routePlanner';
import type { LngLat } from '../services/mapbox';

const router = Router();
const MAX_AHEAD_MS = 60 * 24 * 60 * 60 * 1000; // P1.1: Mapbox typical durations checked up to 60 days out

const isLngLat = (v: unknown): v is LngLat =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === 'number' &&
  typeof v[1] === 'number' &&
  Math.abs(v[0]) <= 180 &&
  Math.abs(v[1]) <= 90;

const parseDate = (v: unknown) => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

router.post('/plan', async (req: Request, res: Response, next: NextFunction) => {
  const { origin, destination, departAt, dateRange, departureWindow } = req.body ?? {};
  const bad = (message: string) => res.status(400).json({ success: false, message });
  const now = Date.now();

  if (!isLngLat(origin) || !isLngLat(destination)) return bad('origin and destination must be [lng, lat]');

  let window: DepartureWindow | undefined;
  if (departureWindow !== undefined) {
    if (departAt !== undefined || dateRange !== undefined) return bad('Choose a departure window on its own');
    const start = parseDate(departureWindow?.start);
    const end = parseDate(departureWindow?.end);
    if (!start || !end || end <= start) return bad('Choose an end time after the start time');
    if (end.getTime() - start.getTime() > MAX_WINDOW_HOURS * 60 * 60 * 1000) return bad(`Choose a window of up to ${MAX_WINDOW_HOURS} hours`);
    if (end.getTime() > now + MAX_AHEAD_MS) return bad('The departure window must end within 60 days');
    const earliest = earliestForecastTime(now);
    if (end.getTime() < earliest) return bad(`Choose a window that ends at least ${MIN_LEAD_MINUTES} minutes from now`);
    window = { start: new Date(Math.max(start.getTime(), earliest)), end };
  }

  let when: Date | undefined;
  if (departAt !== undefined) {
    const d = parseDate(departAt);
    if (!d) return bad('departAt must be an ISO date-time');
    if (d.getTime() > now + MAX_AHEAD_MS) return bad('departAt must be within 60 days');
    when = d;
  }

  let range: DepartureWindow | undefined;
  if (dateRange !== undefined) {
    const start = parseDate(dateRange?.start);
    const end = parseDate(dateRange?.end);
    if (!start || !end || end < start) return bad('dateRange needs valid start and end, with end on or after start');
    if (istMidnight(end) - istMidnight(start) >= MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) return bad(`Choose a range of up to ${MAX_RANGE_DAYS} days, including the start and end dates`);
    if (end.getTime() > now + MAX_AHEAD_MS) return bad('dateRange must end within 60 days');
    range = { start, end };
  }

  try {
    res.json({ success: true, data: await planRoute(origin, destination, when, range, window) });
  } catch (error) {
    next(error);
  }
});

export default router;
