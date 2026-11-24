import mongoose from 'mongoose';

export type LngLat = [number, number];

export interface MapboxRoute {
  duration: number; // seconds; matches live traffic only for "leave now"
  duration_typical?: number; // seconds; use this for future departures (see PLAN.md P1.1)
  distance: number; // metres
  geometry: { type: 'LineString'; coordinates: LngLat[] };
  legs: {
    annotation: {
      speed: number[]; // m/s per segment
      distance: number[]; // metres per segment
      duration: number[]; // seconds per segment
      congestion: string[]; // 'unknown' for future departures
    };
  }[];
}

const LIVE_TTL_MS = 5 * 60 * 1000;
const FUTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SLOT_MS = 15 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Per-document TTL: Mongo deletes each entry once expiresAt passes.
const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  routes: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const DirectionsCache = mongoose.models.DirectionsCache || mongoose.model('DirectionsCache', cacheSchema);

export class MapboxError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Mapbox wants local time; Mumbai is fixed at +05:30 (no DST).
export function toIstString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19) + '+05:30';
}

// Preserve sub-metre endpoint accuracy so nearby places don't reuse a route to a different entrance.
export function cacheKey(origin: LngLat, destination: LngLat, departAt?: Date, exactDeparture = false): string {
  const point = ([lng, lat]: LngLat) => `${lng.toFixed(6)},${lat.toFixed(6)}`;
  if (departAt && exactDeparture) {
    return `${point(origin)};${point(destination)};exact;${toIstString(departAt)}`;
  }
  const slot = Math.floor((departAt ?? new Date()).getTime() / SLOT_MS) * SLOT_MS;
  return `${point(origin)};${point(destination)};${departAt ? 'at' : 'now'};${slot}`;
}

const cacheReady = () => mongoose.connection.readyState === 1;

/**
 * Mapbox Directions (driving-traffic) with alternatives and per-segment annotations.
 * Omit departAt for "leave now" (live traffic); pass it for a future departure.
 */
export async function getDirections(origin: LngLat, destination: LngLat, departAt?: Date, exactDeparture = false): Promise<MapboxRoute[]> {
  const key = cacheKey(origin, destination, departAt, exactDeparture);
  if (cacheReady()) {
    try {
      const hit = await DirectionsCache.findOne({ key }).lean<{ routes: MapboxRoute[] }>();
      if (hit) return hit.routes;
    } catch (error) {
      console.error('Directions cache read failed:', (error as Error).message);
    }
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new MapboxError('Routing is not configured', 503);

  const params = new URLSearchParams({
    alternatives: 'true',
    geometries: 'geojson',
    overview: 'full', // required for congestion annotations
    annotations: 'speed,distance,duration,congestion',
    access_token: token,
  });
  if (departAt) params.set('depart_at', toIstString(departAt));
  const coords = `${origin.join(',')};${destination.join(',')}`;
  const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params}`);
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; routes?: MapboxRoute[] };

  if (res.status === 422 || body.code === 'NoRoute' || body.code === 'NoSegment') {
    throw new MapboxError(body.message || 'No route found between these points', 422);
  }
  if (!res.ok || !body.routes) {
    throw new MapboxError(`Mapbox Directions failed (${res.status} ${body.code ?? ''})`, 502);
  }
  if (!body.routes.length) {
    throw new MapboxError('No route found between these points', 422);
  }

  if (cacheReady()) {
    const expiresAt = new Date(Date.now() + (departAt ? FUTURE_TTL_MS : LIVE_TTL_MS));
    DirectionsCache.updateOne({ key }, { routes: body.routes, expiresAt }, { upsert: true }).catch((error: Error) =>
      console.error('Directions cache write failed:', error.message),
    );
  }
  return body.routes;
}
