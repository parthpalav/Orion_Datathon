// Thin client for POST /api/routes/plan. Every number here comes from the server (Mapbox + cited fuel curve).
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface Location {
    name: string;
    coordinates: [number, number]; // [lng, lat]
}

export interface DepartureWindow {
    start: Date;
    end: Date;
}

interface WindowRecommendation {
    departAt: string;
    minDurationMin: number;
    maxDurationMin: number;
    stepMinutes: number;
}

interface FuelReference {
    kmPerLitre: number;
    speedKmh: number;
}

export interface RouteSegment {
    coordinates: [number, number][];
    congestionLevel: number; // 0-100
    distance: number; // km
    duration: number; // minutes
}

export interface Route {
    id: string;
    name: string;
    segments: RouteSegment[];
    totalDistance: number; // km
    totalDuration: number; // minutes, for the chosen departure
    typicalDuration: number | null; // minutes, Mapbox typical traffic
    fuelLitres: number;
    co2Kg: number;
    avgCongestion: number; // 0-100
}

export interface TimelineData {
    hour: number; // start of a 2-hour slot, IST
    durationMin: number; // fastest alternative leaving at that hour
    avgSpeed: number; // km/h
    congestionLevel: number; // 0-100: extra time vs the best slot of the day
}

export type CongestionLabel = 'low' | 'moderate' | 'high' | 'severe';

export interface Insights {
    estimatedTime: number; // minutes
    fuelSavedLitres: number; // fastest route minus most fuel-efficient route
    congestionLevel: CongestionLabel;
}

export interface TrafficPrediction {
    live: boolean; // true = "leave now" with live traffic
    routes: Route[];
    bestRoute: Route;
    fuelEfficientRoute: Route;
    optimalDepartureTime: string; // "HH:00"
    optimalDate: string | null; // only when a date range was given
    usedDateRange: boolean;
    bestInWindow: WindowRecommendation | null;
    fuelReference?: FuelReference;
    timeline: TimelineData[];
    peakHours: string[];
    insights: Insights;
}

interface ApiRoute {
    id: string;
    durationMin: number;
    typicalDurationMin: number | null;
    distanceKm: number;
    fuelLitres: number;
    co2Kg: number;
    avgCongestion: number;
    segments: RouteSegment[];
}

interface ApiPlan {
    departAt: string | null;
    routes: ApiRoute[];
    fastestId: string;
    fuelEfficientId: string;
    timeline: { hour: number; departAt: string; durationMin: number; avgSpeedKmh: number }[];
    bestDeparture: { hour: number; durationMin: number };
    bestDate: { date: string; departAt: string; durationMin: number } | null;
    bestInWindow?: WindowRecommendation | null;
    fuelReference?: FuelReference;
}

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

export const congestionLabel = (level: number): CongestionLabel =>
    level < 30 ? 'low' : level < 60 ? 'moderate' : level < 80 ? 'high' : 'severe';

export const insightsFor = (route: Route, prediction: Pick<TrafficPrediction, 'bestRoute' | 'fuelEfficientRoute'>): Insights => ({
    estimatedTime: route.totalDuration,
    fuelSavedLitres: Math.max(0, prediction.bestRoute.fuelLitres - prediction.fuelEfficientRoute.fuelLitres),
    congestionLevel: congestionLabel(route.avgCongestion),
});

// Peak = 2-hour slots in the slowest quarter of the day's range, merged into windows like "08:00-12:00".
export const peakWindows = (timeline: TimelineData[]): string[] => {
    if (timeline.length === 0) return [];
    const durations = timeline.map((t) => t.durationMin);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    if (max - min < 1) return [];
    const cutoff = max - 0.25 * (max - min);
    const windows: [number, number][] = [];
    for (const t of timeline) {
        if (t.durationMin < cutoff) continue;
        const last = windows[windows.length - 1];
        if (last && last[1] === t.hour) last[1] = t.hour + 2;
        else windows.push([t.hour, t.hour + 2]);
    }
    return windows.map(([a, b]) => `${pad(a)}-${pad(b)}`);
};

export const toPrediction = (plan: ApiPlan, usedDateRange: boolean): TrafficPrediction => {
    const routes: Route[] = plan.routes.map((r, i) => ({
        id: r.id,
        name: r.id === plan.fastestId ? 'Fastest route' : r.id === plan.fuelEfficientId ? 'Fuel-efficient route' : `Alternative ${i + 1}`,
        segments: r.segments,
        totalDistance: r.distanceKm,
        totalDuration: r.durationMin,
        typicalDuration: r.typicalDurationMin,
        fuelLitres: r.fuelLitres,
        co2Kg: r.co2Kg,
        avgCongestion: r.avgCongestion,
    }));
    const bestRoute = routes.find((r) => r.id === plan.fastestId) ?? routes[0];
    const fuelEfficientRoute = routes.find((r) => r.id === plan.fuelEfficientId) ?? bestRoute;
    const best = plan.bestDeparture.durationMin;
    const timeline: TimelineData[] = plan.timeline.map((t) => ({
        hour: t.hour,
        durationMin: t.durationMin,
        avgSpeed: t.avgSpeedKmh,
        // 0 at the best slot of the day, 100 at twice its travel time.
        congestionLevel: Math.min(100, Math.round(100 * (t.durationMin / best - 1))),
    }));
    const optimalDate = plan.bestDate
        ? new Date(plan.bestDate.departAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'short', day: 'numeric' })
        : null;

    return {
        live: plan.departAt === null,
        routes,
        bestRoute,
        fuelEfficientRoute,
        optimalDepartureTime: pad(plan.bestDeparture.hour),
        optimalDate,
        usedDateRange,
        bestInWindow: plan.bestInWindow ?? null,
        fuelReference: plan.fuelReference,
        timeline,
        peakHours: peakWindows(timeline),
        insights: insightsFor(bestRoute, { bestRoute, fuelEfficientRoute }),
    };
};

export const predictTraffic = async (
    source: Location,
    destination: Location,
    departureTime: Date,
    dateRange?: DepartureWindow,
    departureWindow?: DepartureWindow,
): Promise<TrafficPrediction> => {
    // Auth header comes from the axios default set in AuthContext.
    const { data } = await axios.post<{ success: boolean; data: ApiPlan }>(`${API_URL}/routes/plan`, {
        origin: source.coordinates,
        destination: destination.coordinates,
        departAt: departureWindow ? undefined : departureTime.toISOString(),
        dateRange: dateRange && { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
        departureWindow: departureWindow && { start: departureWindow.start.toISOString(), end: departureWindow.end.toISOString() },
    });
    if (departureWindow && !data.data.bestInWindow) throw new Error('Departure-window forecasts are temporarily unavailable.');
    return toPrediction(data.data, !!dateRange);
};
