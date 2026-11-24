// MapView Page - route planner with real alternatives, timeline and insights
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import HamburgerMenu from '../components/HamburgerMenu';
import MapContainer from '../components/map/MapContainer';
import InputPanel, { type RouteRequest } from '../components/map/InputPanel';
import { mumbaiDate, mumbaiTime } from '../utils/mumbaiTime';
import { getErrorMessage } from '../utils/errorHandler';
import InsightsPanel from '../components/map/InsightsPanel';
import TrafficTimeline from '../components/map/TrafficTimeline';
import SearchHistory from '../components/map/SearchHistory';
import type {
    Location,
    TrafficPrediction,
} from '../services/predictionService';
import { predictTraffic } from '../services/predictionService';
import { saveSearch } from '../services/searchHistoryService';
import type { SearchHistoryItem } from '../services/searchHistoryService';

const MapView: React.FC = () => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [source, setSource] = useState<Location | null>(null);
    const [destination, setDestination] = useState<Location | null>(null);
    const [prediction, setPrediction] = useState<TrafficPrediction | null>(null);
    const [mileage, setMileage] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentHour, setCurrentHour] = useState(() => mumbaiTime().hour);
    const [selectedRouteType, setSelectedRouteType] = useState<'best' | 'fuel-efficient'>('best');
    const [showHistory, setShowHistory] = useState(false);
    const [historyVersion, setHistoryVersion] = useState(0);
    const [loadedTrip, setLoadedTrip] = useState<{ trip: RouteRequest; version: number }>();
    const [mobilePanel, setMobilePanel] = useState<'planner' | 'details' | null>('planner');

    const currentRoute = prediction
        ? selectedRouteType === 'best' ? prediction.bestRoute : prediction.fuelEfficientRoute
        : null;

    const handleLocationChange = (field: 'source' | 'destination', location: Location | null) => {
        (field === 'source' ? setSource : setDestination)(location);
        setPrediction(null);
        setError('');
    };

    const handlePredictionSubmit = async (trip: RouteRequest, saveToHistory = true) => {
        if (isLoading) return;
        const { source, destination, departureTime, dateRange, departureWindow } = trip;
        setIsLoading(true);
        setPrediction(null);
        setError('');

        try {
            const result = await predictTraffic(source, destination, departureTime, dateRange, departureWindow);
            setPrediction(result);
            setSelectedRouteType('best');
            const suggested = result.bestInWindow && new Date(result.bestInWindow.departAt);
            setCurrentHour(mumbaiTime(result.live ? new Date() : suggested || departureTime).hour);
            setMobilePanel(null);

            if (saveToHistory && user?.id) {
                saveSearch(user.id, source, destination, departureTime, dateRange, departureWindow);
                setHistoryVersion((v) => v + 1);
            }
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleHistoryItemClick = (item: SearchHistoryItem) => {
        if (isLoading) return;
        const now = new Date();
        const today = mumbaiDate(mumbaiTime(now).date);
        const dateRange = item.dateRange && item.dateRange.end >= today
            ? { start: item.dateRange.start < today ? today : item.dateRange.start, end: item.dateRange.end }
            : undefined;
        const departureWindow = item.departureWindow && item.departureWindow.end > now
            ? { start: item.departureWindow.start < now ? now : item.departureWindow.start, end: item.departureWindow.end }
            : undefined;
        const departureTime = departureWindow?.start ?? (dateRange
            ? mumbaiDate(mumbaiTime(dateRange.start).date, mumbaiTime(item.departureTime).time)
            : item.departureTime < now ? now : item.departureTime);
        const trip = { source: item.source, destination: item.destination, departureTime, dateRange, departureWindow };
        setSource(trip.source);
        setDestination(trip.destination);
        setMobilePanel('planner');
        setLoadedTrip((previous) => ({ trip, version: (previous?.version ?? 0) + 1 }));
        setShowHistory(false);
        void handlePredictionSubmit(trip, false);
    };

    return (
        <div
            data-map-panel={mobilePanel ?? 'none'}
            style={{
                width: '100vw',
                height: '100dvh',
                position: 'relative',
                overflow: 'hidden',
                background: theme === 'dark' ? '#000' : '#fff',
                transition: 'background 0.5s ease',
            }}
        >
            {/* Map Container - Base Layer */}
            <MapContainer
                source={source}
                destination={destination}
                route={currentRoute}
                theme={theme}
            />

            {/* Top Bar - Controls & User Info */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: theme === 'dark' 
                        ? 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 100,
                }}
            >
                {/* Left Side - User Info & Logout */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <HamburgerMenu style={{ position: 'relative', top: 0, left: 0 }} />
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginRight: '1rem',
                        }}
                    >
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '0.05em',
                        }}>
                            ORION
                        </div>
                        <div className="map-view-tagline" style={{
                            fontSize: '0.75rem',
                            color: theme === 'dark' ? '#888' : '#666',
                            borderLeft: `2px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
                            paddingLeft: '0.75rem',
                            fontWeight: 500,
                        }}>
                            AI Traffic Intelligence
                        </div>
                    </motion.div>

                    {/* User Info */}
                    {user && (
                        <motion.div
                            className="map-view-user"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '2rem',
                                background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                color: theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                            }}
                        >
                            {user.fullName || user.email}
                        </motion.div>
                    )}

                    {/* Home Button */}
                    <motion.button
                        onClick={() => navigate('/')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '2rem',
                            background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                            cursor: 'pointer',
                            color: theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        Home
                    </motion.button>
                </div>

                {/* Right Side - Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {user?.id && (
                        <motion.button
                            onClick={() => setShowHistory(!showHistory)}
                            disabled={isLoading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '2rem',
                                background: showHistory
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: showHistory ? 'white' : theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                boxShadow: showHistory ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                                transition: 'all 0.3s ease',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            History
                        </motion.button>
                    )}
                </div>
            </div>

            <div className="map-view-panel-controls">
                <button type="button" aria-controls="route-planner" aria-expanded={mobilePanel === 'planner'}
                    onClick={() => setMobilePanel(mobilePanel === 'planner' ? null : 'planner')}>Planner</button>
                {prediction && (
                    <button type="button" aria-controls="route-details" aria-expanded={mobilePanel === 'details'}
                        onClick={() => setMobilePanel(mobilePanel === 'details' ? null : 'details')}>Trip details</button>
                )}
            </div>

            {/* Left Sidebar - Input Panel */}
            <InputPanel
                key={loadedTrip?.version ?? 0}
                source={source}
                destination={destination}
                onLocationChange={handleLocationChange}
                onSubmit={handlePredictionSubmit}
                initialTrip={loadedTrip?.trip}
                error={error}
                isLoading={isLoading}
                theme={theme}
            />

            {/* Right Sidebar - Search History */}
            {user?.id && (
                <SearchHistory
                    key={`${user.id}:${historyVersion}`}
                    userId={user.id}
                    onSelectSearch={handleHistoryItemClick}
                    theme={theme}
                    isVisible={showHistory}
                />
            )}

            {/* Route Type Selector - Top Center */}
            {prediction && (
                <motion.div
                    className="map-view-route-choices"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                        position: 'fixed',
                        top: '5.5rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '0.5rem',
                        background: theme === 'dark' ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '1rem',
                        padding: '0.5rem',
                        boxShadow: theme === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                        zIndex: 90,
                    }}
                >
                    <motion.button
                        onClick={() => setSelectedRouteType('best')}
                        aria-pressed={selectedRouteType === 'best'}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: selectedRouteType === 'best'
                                ? 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)'
                                : 'transparent',
                            color: selectedRouteType === 'best' ? 'white' : theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '0.875rem',
                        }}
                    >
                        Fastest Route
                    </motion.button>
                    <motion.button
                        onClick={() => setSelectedRouteType('fuel-efficient')}
                        aria-pressed={selectedRouteType === 'fuel-efficient'}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: selectedRouteType === 'fuel-efficient'
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'transparent',
                            color: selectedRouteType === 'fuel-efficient' ? 'white' : theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '0.875rem',
                        }}
                    >
                        Fuel Efficient
                    </motion.button>
                </motion.div>
            )}

            {/* Right Sidebar - Insights & Timeline */}
            <div
                id="route-details"
                className="map-view-details"
                style={{
                    position: 'fixed',
                    top: '5rem',
                    right: 0,
                    bottom: 0,
                    width: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1rem',
                    overflowY: 'auto',
                    pointerEvents: 'none',
                    zIndex: 80,
                }}
            >
                {/* Insights Panel */}
                {prediction && currentRoute && (
                    <div style={{ pointerEvents: 'auto' }}>
                        <InsightsPanel
                            prediction={prediction}
                            route={currentRoute}
                            mileage={mileage}
                            onMileageChange={setMileage}
                            theme={theme}
                        />
                    </div>
                )}

                {/* Traffic Timeline */}
                {prediction && (
                    <div style={{ pointerEvents: 'auto' }}>
                        <TrafficTimeline
                            timeline={prediction.timeline}
                            currentHour={currentHour}
                            onHourChange={setCurrentHour}
                            theme={theme}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapView;
