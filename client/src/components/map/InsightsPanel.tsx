// InsightsPanel Component - AI-powered insights dashboard
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Route, TrafficPrediction } from '../../services/predictionService';
import { formatDuration, formatDistance } from '../../utils/mapUtils';
import { animateInsightCards } from '../../utils/animationUtils';

interface InsightsPanelProps {
    prediction: TrafficPrediction | null;
    route: Route | null; // the route currently shown on the map
    theme?: 'light' | 'dark';
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({
    prediction,
    route,
    theme = 'dark',
}) => {
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (prediction && cardsRef.current.length > 0) {
            const validCards = cardsRef.current.filter(card => card !== null) as HTMLElement[];
            animateInsightCards(validCards, 0.1);
        }
    }, [prediction]);

    if (!prediction || !route) return null;

    const { insights } = prediction;

    const getCongestionColor = (level: string) => {
        switch (level) {
            case 'low': return '#10b981';
            case 'moderate': return '#f59e0b';
            case 'high': return '#f97316';
            case 'severe': return '#ef4444';
            default: return '#a0a0a0';
        }
    };

    const getCongestionIcon = (level: string) => {
        switch (level) {
            case 'low': return '🟢';
            case 'moderate': return '🟡';
            case 'high': return '🟠';
            case 'severe': return '🔴';
            default: return '⚪';
        }
    };

    const cardStyle: React.CSSProperties = {
        background: theme === 'dark' ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '0.75rem',
        padding: '1rem',
        transition: 'all 0.3s ease',
    };

    return (
        <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
                width: '100%',
            }}
        >
            {/* Header */}
            <div
                style={{
                    ...cardStyle,
                    marginBottom: '0.75rem',
                }}
            >
                <h3
                    style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: theme === 'dark' ? 'white' : '#1a1a1a',
                        marginBottom: '0.5rem',
                    }}
                >
                    Route Insights
                </h3>
                <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#a0a0a0' : '#666' }}>
                    {prediction.live ? 'Live traffic from Mapbox' : 'Mapbox typical traffic for your departure time'}
                </div>
            </div>

            {/* Optimal Date Card - Only show when date range was used */}
            {prediction.usedDateRange && prediction.optimalDate && (
                <div
                    style={{
                        ...cardStyle,
                        marginBottom: '0.75rem',
                        background: theme === 'dark' 
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 700 }}>
                            OPTIMAL DATE
                        </span>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>
                        {prediction.optimalDate}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#a0a0a0' : '#666' }}>
                        Fastest day in your range at this time
                    </div>
                </div>
            )}

            {/* Travel Time Card */}
            <div
                ref={(el) => { cardsRef.current[0] = el; }}
                style={{
                    ...cardStyle,
                    marginBottom: '0.75rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', fontWeight: 600 }}>
                        ESTIMATED TIME
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>⏱️</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: theme === 'dark' ? 'white' : '#1a1a1a' }}>
                    {formatDuration(insights.estimatedTime)}
                </div>
                <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', marginTop: '0.5rem' }}>
                    {formatDistance(route.totalDistance)}
                </div>
            </div>

            {/* Fuel Savings Card */}
            <div
                ref={(el) => { cardsRef.current[1] = el; }}
                style={{
                    ...cardStyle,
                    marginBottom: '0.75rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', fontWeight: 600 }}>
                        FUEL &amp; CO₂
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>⛽</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                    {route.fuelLitres.toFixed(2)} L
                </div>
                <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', marginTop: '0.5rem' }}>
                    ≈ {route.co2Kg.toFixed(1)} kg CO₂
                    {insights.fuelSavedLitres >= 0.01 && ` · fuel-efficient route saves ${insights.fuelSavedLitres.toFixed(2)} L`}
                </div>
            </div>

            {/* Congestion Level Card */}
            <div
                ref={(el) => { cardsRef.current[2] = el; }}
                style={{
                    ...cardStyle,
                    marginBottom: '1rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', fontWeight: 600 }}>
                        CONGESTION LEVEL
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>{getCongestionIcon(insights.congestionLevel)}</span>
                </div>
                <div
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: getCongestionColor(insights.congestionLevel),
                        textTransform: 'capitalize',
                    }}
                >
                    {insights.congestionLevel}
                </div>
                <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', marginTop: '0.5rem' }}>
                    Average along route
                </div>
            </div>

            {/* Optimal Time Card */}
            <div
                ref={(el) => { cardsRef.current[3] = el; }}
                style={{
                    ...cardStyle,
                    marginBottom: '1rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', fontWeight: 600 }}>
                        OPTIMAL DEPARTURE TIME
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>🕐</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme === 'dark' ? 'white' : '#1a1a1a' }}>
                    {prediction.optimalDepartureTime}
                </div>
                <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', marginTop: '0.5rem' }}>
                    Fastest 2-hour slot that day
                </div>
            </div>

            {/* Peak Hours Card */}
            {prediction.peakHours.length > 0 && (
            <div
                ref={(el) => { cardsRef.current[4] = el; }}
                style={{
                    ...cardStyle,
                    background: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 600 }}>
                        AVOID PEAK HOURS
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {prediction.peakHours.map((hour, index) => (
                        <div
                            key={index}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#ef4444',
                            }}
                        >
                            {hour}
                        </div>
                    ))}
                </div>
            </div>
            )}
        </motion.div>
    );
};

export default InsightsPanel;
