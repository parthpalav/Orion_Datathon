// MapContainer Component - Core Mapbox GL map display
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Route, Location } from '../../services/predictionService';
import { createRouteGeoJSON, createTrafficGeoJSON, calculateBounds } from '../../utils/mapUtils';
import { MUMBAI_CENTER } from '../../services/placeSearch';
import '../../styles/mapbox-overrides.css';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapContainerProps {
    source: Location | null;
    destination: Location | null;
    route?: Route | null;
    theme?: 'light' | 'dark';
}

function addPin(map: mapboxgl.Map, location: Location | null, endpoint: string, color: string) {
    if (!location) return;
    const marker = new mapboxgl.Marker({ color })
        .setLngLat(location.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 28 }).setText(`${endpoint}: ${location.name}`))
        .addTo(map);
    marker.getElement().setAttribute('aria-label', `${endpoint}: ${location.name}`);
    return () => { marker.remove(); };
}

function fitMap(map: mapboxgl.Map, coordinates: [number, number][]) {
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    const wide = width >= 1100;
    map.fitBounds(calculateBounds(coordinates), {
        padding: {
            top: Math.min(130, height * 0.25),
            bottom: Math.min(80, height * 0.2),
            left: wide ? 430 : 40,
            right: wide ? 400 : 40,
        },
        maxZoom: 16,
        duration: 650,
        retainPadding: false,
    });
}

const MapContainer: React.FC<MapContainerProps> = ({
    source,
    destination,
    route,
    theme = 'dark',
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    // Bumped after each theme change: setStyle wipes our sources and layers, so the route must be redrawn.
    const [styleVersion, setStyleVersion] = useState(0);
    const styleLoading = useRef(false);
    const lastFittedRoute = useRef<Route | null>(null);
    const initialStyle = useRef(theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
    const appliedStyle = useRef<string | null>(null);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        appliedStyle.current = initialStyle.current;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: initialStyle.current,
            center: MUMBAI_CENTER,
            zoom: 12,
            pitch: 45,
            bearing: 0,
            antialias: true,
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add scale control
        map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

        // Add geolocation control
        const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true,
            showAccuracyCircle: true
        });
        
        map.current.addControl(geolocateControl, 'top-right');

        map.current.on('load', () => setMapLoaded(true));
        map.current.on('style.load', () => {
            styleLoading.current = false;
            setStyleVersion((v) => v + 1);
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update map style when theme changes
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        const style = theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
        if (appliedStyle.current === style) return;
        appliedStyle.current = style;
        styleLoading.current = true;
        map.current.setStyle(style, { diff: false, localFontFamily: null, localIdeographFontFamily: 'sans-serif' });
    }, [theme, mapLoaded]);

    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded) return;
        return addPin(m, source, 'Source', '#059669');
    }, [source, mapLoaded]);

    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded) return;
        return addPin(m, destination, 'Destination', '#dc2626');
    }, [destination, mapLoaded]);

    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || route) return;
        lastFittedRoute.current = null;
        const points = [source, destination].flatMap((place) => place ? [place.coordinates] : []);
        if (points.length) fitMap(m, points);
    }, [source, destination, mapLoaded, route]);

    // Render route: a soft glow underneath, then the per-segment congestion colours on top.
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || styleLoading.current || !route) return;

        const allCoordinates = route.segments.flatMap((segment) => segment.coordinates);
        if (allCoordinates.length === 0) return;

        const clear = () => {
            for (const id of ['route-traffic', 'route-casing']) if (m.getLayer(id)) m.removeLayer(id);
            for (const id of ['route-traffic', 'route']) if (m.getSource(id)) m.removeSource(id);
        };
        clear();

        m.addSource('route', { type: 'geojson', data: createRouteGeoJSON(allCoordinates) });
        m.addSource('route-traffic', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: route.segments.map((segment) => createTrafficGeoJSON(segment.coordinates, segment.congestionLevel)),
            },
        });
        m.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': 'rgba(59, 130, 246, 0.3)', 'line-width': 12, 'line-blur': 4 },
        });
        m.addLayer({
            id: 'route-traffic',
            type: 'line',
            source: 'route-traffic',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
        });

        if (lastFittedRoute.current !== route) {
            fitMap(m, [...allCoordinates, ...[source, destination].flatMap((place) => place ? [place.coordinates] : [])]);
            lastFittedRoute.current = route;
        }

        return () => {
            if (map.current === m) clear();
        };
    }, [route, source, destination, mapLoaded, styleVersion]);

    return (
        <div
            ref={mapContainer}
            style={{
                width: '100%',
                height: '100%',
                borderRadius: '0',
            }}
        />
    );
};

export default MapContainer;
