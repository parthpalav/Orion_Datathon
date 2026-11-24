import type { Location } from './predictionService';

export const MUMBAI_CENTER: [number, number] = [72.8777, 19.076];

const aliases: Record<string, string> = {
    bkc: 'Bandra Kurla Complex',
    csmt: 'Chhatrapati Shivaji Maharaj Terminus',
    cst: 'Chhatrapati Shivaji Maharaj Terminus',
    'mumbai airport': 'Chhatrapati Shivaji Maharaj International Airport',
    'mumbai airport terminal 1': 'CSMI Airport Terminal 1',
    'mumbai airport terminal 2': 'CSMI Airport Terminal 2',
};

interface PhotonFeature {
    geometry: { type: string; coordinates: [number, number] };
    properties: {
        name?: string;
        street?: string;
        housenumber?: string;
        district?: string;
        city?: string;
        county?: string;
        state?: string;
        postcode?: string;
        osm_key?: string;
        osm_value?: string;
    };
}

export function locationFromCoordinates(query: string): Location | null {
    const pair = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!pair) return null;
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { name: `${lat}, ${lng}`, coordinates: [lng, lat] };
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Location[]> {
    const point = locationFromCoordinates(query);
    if (point) return [point];

    const key = query.toLowerCase();
    const [lon, lat] = MUMBAI_CENTER;
    const params = new URLSearchParams({
        q: Object.hasOwn(aliases, key) ? aliases[key] : query,
        lon: String(lon),
        lat: String(lat),
        bbox: '72.67,18.85,73.32,19.50', // Mumbai, Thane and Navi Mumbai
        lang: 'en',
        limit: '8',
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new Error('Place search is temporarily unavailable.');
    const { features } = await response.json() as { features: PhotonFeature[] };
    const places = new Map<string, Location>();
    for (const { geometry, properties: p } of features) {
        const [lng, lat] = geometry.coordinates;
        if (geometry.type !== 'Point' || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const title = p.name ?? [p.housenumber, p.street].filter(Boolean).join(' ');
        if (!title) continue;
        const kind = p.osm_value?.replaceAll('_', ' ');
        const context = [...new Set([p.district, p.city ?? p.county, p.postcode].filter(Boolean))].join(', ');
        const label = kind && kind !== 'yes' && !title.toLowerCase().includes(kind)
            ? `${title} (${p.osm_key === 'railway' && kind === 'station' ? 'rail station' : kind})`
            : title;
        const name = context ? `${label}, ${context}` : label;
        places.set(`${name}|${lng.toFixed(4)},${lat.toFixed(4)}`, { name, coordinates: [lng, lat] });
    }
    return [...places.values()];
}
