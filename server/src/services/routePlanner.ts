import { getDirections, type LngLat, type MapboxRoute } from './mapbox';
import { FUEL_REFERENCE_KMPL, FUEL_REFERENCE_SPEED_KMH, routeFuel } from './fuel';

export interface DepartureWindow {
  start: Date;
  end: Date;
}

export interface PlannedSegment {
  coordinates: LngLat[];
  congestionLevel: number; // 0-100
  distance: number; // km
  duration: number; // minutes
}

export interface PlannedRoute {
  id: string;
  durationMin: number; // ETA used for this departure
  typicalDurationMin: number | null;
  distanceKm: number;
  fuelLitres: number;
  co2Kg: number;
  avgCongestion: number; // 0-100, distance-weighted
  segments: PlannedSegment[];
}

export interface TimelineSlot {
  hour: number; // IST hour of day
  departAt: string; // ISO
  durationMin: number; // fastest alternative at that slot
  avgSpeedKmh: number;
}

export interface RoutePlan {
  departAt: string | null; // null = leave now (live traffic)
  routes: PlannedRoute[];
  fastestId: string;
  fuelEfficientId: string;
  fuelReference: { kmPerLitre: number; speedKmh: number };
  timeline: TimelineSlot[];
  bestDeparture: TimelineSlot;
  bestDate: { date: string; departAt: string; durationMin: number } | null;
  bestInWindow: { departAt: string; minDurationMin: number; maxDurationMin: number; stepMinutes: number } | null;
}

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const MIN_LEAD_MINUTES = 5; // Mapbox depart_at must be in the future
const MIN_LEAD_MS = MIN_LEAD_MINUTES * MINUTE_MS;
export const MAX_RANGE_DAYS = 14;
export const MAX_WINDOW_HOURS = 24;

// Speed-based congestion when Mapbox has no live label. 60 km/h is taken as free flow on Mumbai arterials:
// 60+ km/h -> 0, 30 km/h -> 50, 12 km/h -> 80.
const FREE_FLOW_KMH = 60;
const LIVE_LEVEL: Record<string, number> = { low: 15, moderate: 45, heavy: 70, severe: 90 };

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const band = (level: number) => (level < 30 ? 0 : level < 60 ? 1 : level < 80 ? 2 : 3);
const etaSeconds = (route: MapboxRoute, live = false) => live ? route.duration : route.duration_typical ?? route.duration;
const fastestIndex = (routes: MapboxRoute[], live = false) =>
  routes.reduce((best, route, i) => etaSeconds(route, live) < etaSeconds(routes[best], live) ? i : best, 0);

export function earliestForecastTime(now: number): number {
  return Math.ceil((now + MIN_LEAD_MS) / MINUTE_MS) * MINUTE_MS;
}

/** Midnight IST of the IST day containing `date`, as a UTC instant. */
export function istMidnight(date: Date): number {
  return Math.floor((date.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
}

/** `date` if it is far enough ahead, else the same IST weekday and time one week later (typical traffic repeats weekly). */
export function futureSlot(date: Date, now = Date.now()): Date {
  let t = date.getTime();
  while (t < now + MIN_LEAD_MS) t += 7 * DAY_MS;
  return new Date(t);
}

export function shapeRoute(raw: MapboxRoute, index: number, live: boolean): PlannedRoute {
  // One leg for an A-to-B request, so annotation index i spans coordinates i and i+1.
  const { speed, distance, duration, congestion = [] } = raw.legs[0].annotation;

  // Future departures: Mapbox's `duration` is unreliable (PLAN.md P1.1), so scale segment times to duration_typical.
  const etaSec = etaSeconds(raw, live);
  const annotatedSec = duration.reduce((s, d) => s + d, 0) || etaSec;
  const scale = etaSec / annotatedSec;
  const speeds = speed.map((v) => v / scale);
  const coords = raw.geometry.coordinates;

  const segments: PlannedSegment[] = [];
  let weighted = 0;
  for (let i = 0; i < distance.length; i++) {
    const kmh = speeds[i] * 3.6;
    const level = (live && LIVE_LEVEL[congestion[i]]) || Math.round(Math.min(100, Math.max(0, 100 * (1 - kmh / FREE_FLOW_KMH))));
    weighted += level * distance[i];
    const last = segments[segments.length - 1];
    // Merge consecutive pieces of the same colour band so the map draws a few dozen lines, not hundreds.
    if (last && band(last.congestionLevel) === band(level)) {
      last.coordinates.push(coords[i + 1]);
      last.distance += distance[i] / 1000;
      last.duration += (duration[i] * scale) / 60;
    } else {
      segments.push({
        coordinates: [coords[i], coords[i + 1]],
        congestionLevel: level,
        distance: distance[i] / 1000,
        duration: (duration[i] * scale) / 60,
      });
    }
  }

  const fuel = routeFuel(speeds, distance);
  return {
    id: `route-${index}`,
    durationMin: round(etaSec / 60),
    typicalDurationMin: raw.duration_typical != null ? round(raw.duration_typical / 60) : null,
    distanceKm: round(raw.distance / 1000, 2),
    fuelLitres: fuel.litres,
    co2Kg: fuel.co2Kg,
    avgCongestion: Math.round(weighted / (raw.distance || 1)),
    segments: segments.map((s) => ({ ...s, distance: round(s.distance, 3), duration: round(s.duration, 2) })),
  };
}

export async function planRoute(
  origin: LngLat,
  destination: LngLat,
  departAt?: Date,
  dateRange?: DepartureWindow,
  departureWindow?: DepartureWindow,
): Promise<RoutePlan> {
  const now = Date.now();
  const scheduledCalls = new Map<number, Promise<MapboxRoute[]>>();
  const directionsAt = (at: Date) => {
    const key = at.getTime();
    const pending = scheduledCalls.get(key);
    if (pending) return pending;
    const request = getDirections(origin, destination, at, !!departureWindow);
    scheduledCalls.set(key, request);
    return request;
  };
  const fastestAt = async (at: Date) => {
    const routes = (await directionsAt(at)).slice(0, 3);
    const best = routes[fastestIndex(routes)];
    return { at, etaSec: etaSeconds(best), distanceKm: best.distance / 1000 };
  };

  let bestInWindow: RoutePlan['bestInWindow'] = null;
  if (departureWindow) {
    const start = departureWindow.start.getTime();
    const end = departureWindow.end.getTime();
    const span = end - start;
    // shortcut: sample up to 13 departures including both bounds, use finer steps if the request budget grows.
    const stepMinutes = span <= 6 * HOUR_MS ? 30 : span <= 12 * HOUR_MS ? 60 : 120;
    const candidates = [new Date(start)];
    for (let at = start + stepMinutes * MINUTE_MS; at < end; at += stepMinutes * MINUTE_MS) {
      candidates.push(new Date(at));
    }
    if (end > start) candidates.push(new Date(end));
    const samples = await Promise.all(candidates.map(fastestAt));
    const best = samples.reduce((a, b) => b.etaSec < a.etaSec ? b : a);
    departAt = best.at;
    bestInWindow = {
      departAt: best.at.toISOString(),
      minDurationMin: round(best.etaSec / 60),
      maxDurationMin: round(Math.max(...samples.map((s) => s.etaSec)) / 60),
      stepMinutes,
    };
  }

  const live = !departureWindow && (!departAt || departAt.getTime() < now + MIN_LEAD_MS);
  const when = live ? new Date(now) : departAt!;

  const raw = (await (live ? getDirections(origin, destination) : directionsAt(when))).slice(0, 3);
  const routes = raw.map((r, i) => shapeRoute(r, i, live));
  const fastest = routes[fastestIndex(raw, live)];
  const thrifty = [...routes].sort((a, b) => a.fuelLitres - b.fuelLitres)[0];

  // 24h timeline every 2 hours on the departure's IST day.
  const dayStart = istMidnight(when);
  const timeline = await Promise.all(
    Array.from({ length: 12 }, async (_, k) => {
      const at = futureSlot(new Date(dayStart + k * 2 * 60 * 60 * 1000), now);
      const best = await fastestAt(at);
      return {
        hour: k * 2,
        departAt: at.toISOString(),
        durationMin: round(best.etaSec / 60),
        avgSpeedKmh: round(best.distanceKm / (best.etaSec / 3600)),
      };
    }),
  );
  const bestDeparture = timeline.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));

  // Best date in the range, at the requested time of day.
  let bestDate: RoutePlan['bestDate'] = null;
  if (dateRange) {
    const preferred = departAt ?? when;
    const timeOfDay = preferred.getTime() - istMidnight(preferred);
    const first = istMidnight(dateRange.start);
    const days = Math.min(MAX_RANGE_DAYS, Math.floor((istMidnight(dateRange.end) - first) / DAY_MS) + 1);
    const candidates = Array.from({ length: days }, (_, d) => new Date(first + d * DAY_MS + timeOfDay)).filter(
      (at) => at.getTime() >= now + MIN_LEAD_MS,
    );
    const results = await Promise.all(candidates.map(fastestAt));
    const top = results.reduce<(typeof results)[number] | null>((a, b) => (!a || b.etaSec < a.etaSec ? b : a), null);
    if (top) {
      bestDate = {
        date: new Date(top.at.getTime() + IST_MS).toISOString().slice(0, 10),
        departAt: top.at.toISOString(),
        durationMin: round(top.etaSec / 60),
      };
    }
  }

  return {
    departAt: live ? null : when.toISOString(),
    routes,
    fastestId: fastest.id,
    fuelEfficientId: thrifty.id,
    fuelReference: { kmPerLitre: FUEL_REFERENCE_KMPL, speedKmh: FUEL_REFERENCE_SPEED_KMH },
    timeline,
    bestDeparture,
    bestDate,
    bestInWindow,
  };
}
