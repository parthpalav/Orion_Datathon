import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './placeSearch';

afterEach(() => vi.unstubAllGlobals());

describe('Mumbai place search', () => {
    it('looks up local abbreviations and preserves the selected point', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            features: [{
                geometry: { type: 'Point', coordinates: [72.8667381, 19.0635842] },
                properties: { name: 'Bandra Kurla Complex', district: 'Bandra', osm_value: 'suburb' },
            }],
        })));
        vi.stubGlobal('fetch', fetchMock);
        const found = await searchPlaces('BKC', new AbortController().signal);
        const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
        expect(params.get('q')).toBe('Bandra Kurla Complex');
        expect(params.get('bbox')).toBeTruthy();
        expect(found).toEqual([{
            name: 'Bandra Kurla Complex (suburb), Bandra',
            coordinates: [72.8667381, 19.0635842],
        }]);
    });

    it('accepts latitude, longitude and converts it to Mapbox coordinate order without a request', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(await searchPlaces('19.076, 72.8777', new AbortController().signal)).toEqual([
            { name: '19.076, 72.8777', coordinates: [72.8777, 19.076] },
        ]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
