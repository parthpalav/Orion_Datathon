// MapContainer Component - Core Mapbox GL map display
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Route } from '../../services/predictionService';
import { createRouteGeoJSON, createTrafficGeoJSON, calculateBounds } from '../../utils/mapUtils';
import '../../styles/mapbox-overrides.css';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapContainerProps {
    sourceLocation?: [number, number];
    destinationLocation?: [number, number];
    route?: Route | null;
    theme?: 'light' | 'dark';
    onMapLoad?: (map: mapboxgl.Map) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
    sourceLocation,
    destinationLocation,
    route,
    theme = 'dark',
    onMapLoad,
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    // Bumped after each theme change: setStyle wipes our sources and layers, so the route must be redrawn.
    const [styleVersion, setStyleVersion] = useState(0);
    const appliedStyle = useRef<string | null>(null);
    const sourceMarker = useRef<mapboxgl.Marker | null>(null);
    const destMarker = useRef<mapboxgl.Marker | null>(null);
    // const userLocationMarker = useRef<mapboxgl.Marker | null>(null);
    // const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
            center: [72.8777, 19.076], // Mumbai
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

        // Get user's location on map load and center map
        map.current.on('load', () => {
            setMapLoaded(true);
            if (onMapLoad && map.current) {
                onMapLoad(map.current);
            }
            
            // Trigger geolocation
            geolocateControl.trigger();
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
        if (appliedStyle.current === null) {
            appliedStyle.current = style; // the map was created with this style
            return;
        }
        if (appliedStyle.current === style) return;
        appliedStyle.current = style;
        map.current.once('style.load', () => setStyleVersion((v) => v + 1));
        map.current.setStyle(style);
    }, [theme, mapLoaded]);

    // Add source marker
    useEffect(() => {
        if (!map.current || !mapLoaded || !sourceLocation) return;

        // Remove existing marker
        if (sourceMarker.current) {
            sourceMarker.current.remove();
        }

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'custom-marker marker-source';
        el.innerHTML = '📍';

        sourceMarker.current = new mapboxgl.Marker(el)
            .setLngLat(sourceLocation)
            .setPopup(
                new mapboxgl.Popup({ offset: 25 })
                    .setHTML('<h3 style="margin: 0 0 8px 0; font-weight: 600;">Source Location</h3>')
            )
            .addTo(map.current);

        return () => {
            if (sourceMarker.current) {
                sourceMarker.current.remove();
            }
        };
    }, [sourceLocation, mapLoaded]);

    // Add destination marker
    useEffect(() => {
        if (!map.current || !mapLoaded || !destinationLocation) return;

        // Remove existing marker
        if (destMarker.current) {
            destMarker.current.remove();
        }

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'custom-marker marker-destination';
        el.innerHTML = '🎯';

        destMarker.current = new mapboxgl.Marker(el)
            .setLngLat(destinationLocation)
            .setPopup(
                new mapboxgl.Popup({ offset: 25 })
                    .setHTML('<h3 style="margin: 0 0 8px 0; font-weight: 600;">Destination</h3>')
            )
            .addTo(map.current);

        return () => {
            if (destMarker.current) {
                destMarker.current.remove();
            }
        };
    }, [destinationLocation, mapLoaded]);

    // Render route: a soft glow underneath, then the per-segment congestion colours on top.
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || !route) return;

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

        if (styleVersion === 0 || !m.getBounds()?.contains(allCoordinates[0])) {
            m.fitBounds(calculateBounds(allCoordinates), {
                padding: { top: 100, bottom: 100, left: 400, right: 100 },
                duration: 1500,
                essential: true,
            });
        }

        return () => {
            if (map.current) clear();
        };
    }, [route, mapLoaded, styleVersion]);

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
