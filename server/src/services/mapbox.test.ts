import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, getDirections, toIstString, type LngLat } from './mapbox';

const andheri: LngLat = [72.8468, 19.1197];
const bkc: LngLat = [72.865, 19.066];

afterEach(() => vi.unstubAllGlobals());

describe('mapbox', () => {
  it('formats departures in Mumbai local time', () => {
    expect(toIstString(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01T09:00:00+05:30');
  });

  it('puts departures in the same 15-minute slot into one cache key', () => {
    const a = cacheKey(andheri, bkc, new Date('2026-12-01T03:31:00Z'));
    const b = cacheKey(andheri, bkc, new Date('2026-12-01T03:44:00Z'));
    const c = cacheKey(andheri, bkc, new Date('2026-12-01T03:46:00Z'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('does not reuse directions for nearby pins', () => {
    const at = new Date('2026-12-01T03:31:00Z');
    expect(cacheKey(andheri, bkc, at)).not.toBe(cacheKey([72.84681, 19.11972], bkc, at));
  });

  it('keeps exact window samples distinct within a 15-minute cache slot', () => {
    const start = new Date('2026-12-01T03:31:00Z');
    const end = new Date('2026-12-01T03:44:00Z');
    expect(cacheKey(andheri, bkc, start, true)).not.toBe(cacheKey(andheri, bkc, end, true));
  });

  it('requests driving-traffic with full overview and depart_at', async () => {
    process.env.MAPBOX_TOKEN = 'pk.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'Ok', routes: [{ duration: 1 }] })));
    vi.stubGlobal('fetch', fetchMock);
    const routes = await getDirections(andheri, bkc, new Date('2026-12-01T03:30:00Z'));
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toContain('/driving-traffic/72.8468,19.1197;72.865,19.066');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('depart_at')).toBe('2026-12-01T09:00:00+05:30');
    expect(routes).toHaveLength(1);
  });

  it('turns NoRoute into a 422', async () => {
    process.env.MAPBOX_TOKEN = 'pk.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'NoRoute', message: 'No route found' }))));
    await expect(getDirections(andheri, bkc)).rejects.toMatchObject({ status: 422 });
  });
});
