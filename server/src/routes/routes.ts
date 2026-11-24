import { NextFunction, Request, Response, Router } from 'express';
import { MAX_RANGE_DAYS, planRoute } from '../services/routePlanner';
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

// POST /api/routes/plan  { origin: [lng, lat], destination: [lng, lat], departAt?: ISO, dateRange?: { start, end } }
router.post('/plan', async (req: Request, res: Response, next: NextFunction) => {
  const { origin, destination, departAt, dateRange } = req.body ?? {};
  const bad = (message: string) => res.status(400).json({ success: false, message });

  if (!isLngLat(origin) || !isLngLat(destination)) return bad('origin and destination must be [lng, lat]');

  let when: Date | undefined;
  if (departAt !== undefined) {
    const d = parseDate(departAt);
    if (!d) return bad('departAt must be an ISO date-time');
    if (d.getTime() > Date.now() + MAX_AHEAD_MS) return bad('departAt must be within 60 days');
    when = d;
  }

  let range: { start: Date; end: Date } | undefined;
  if (dateRange !== undefined) {
    const start = parseDate(dateRange?.start);
    const end = parseDate(dateRange?.end);
    if (!start || !end || end < start) return bad('dateRange needs valid start and end, with end on or after start');
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) return bad(`dateRange is capped at ${MAX_RANGE_DAYS} days`);
    if (end.getTime() > Date.now() + MAX_AHEAD_MS) return bad('dateRange must end within 60 days');
    range = { start, end };
  }

  try {
    res.json({ success: true, data: await planRoute(origin, destination, when, range) });
  } catch (error) {
    next(error);
  }
});

export default router;
