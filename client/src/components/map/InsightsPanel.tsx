// InsightsPanel Component - route insights from the route planner
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { insightsFor } from '../../services/predictionService';
import type { Route, TrafficPrediction } from '../../services/predictionService';
import { formatDuration, formatDistance } from '../../utils/mapUtils';
import { animateInsightCards } from '../../utils/animationUtils';
import { mumbaiTime } from '../../utils/mumbaiTime';

interface InsightsPanelProps {
    prediction: TrafficPrediction | null;
    route: Route | null; // the route currently shown on the map
    mileage: number | null;
    onMileageChange: (kmPerLitre: number | null) => void;
    theme?: 'light' | 'dark';
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({
    prediction,
    route,
    mileage,
    onMileageChange,
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

    const insights = insightsFor(route, prediction);
    const { fuelReference, bestInWindow } = prediction;
    const referenceMileage = fuelReference?.kmPerLitre;
    const fuelScale = referenceMileage && mileage ? referenceMileage / mileage : 1;
    const fuelSaved = insights.fuelSavedLitres * fuelScale;
    const windowDeparture = bestInWindow && new Date(bestInWindow.departAt);
    const minTime = bestInWindow && formatDuration(Math.round(bestInWindow.minDurationMin));
    const maxTime = bestInWindow && formatDuration(Math.round(bestInWindow.maxDurationMin));

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

            {(windowDeparture || (prediction.usedDateRange && prediction.optimalDate)) && (
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
                            {windowDeparture ? 'BEST DEPARTURE IN YOUR RANGE' : 'OPTIMAL DATE'}
                        </span>
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>
                        {windowDeparture ? `${mumbaiTime(windowDeparture).time} IST` : prediction.optimalDate}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#a0a0a0' : '#666' }}>
                        {windowDeparture && bestInWindow ? (
                            <>
                                <div>{windowDeparture.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'short', day: 'numeric' })} · {minTime} estimated trip</div>
                                <div>Travel-time range {minTime === maxTime ? minTime : `${minTime}–${maxTime}`}</div>
                                <div>Departures sampled up to {bestInWindow.stepMinutes} min apart.</div>
                            </>
                        ) : 'Fastest day in your range at this time'}
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
                    {(route.fuelLitres * fuelScale).toFixed(2)} L
                </div>
                <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#a0a0a0' : '#666', marginTop: '0.5rem' }}>
                    ≈ {(route.co2Kg * fuelScale).toFixed(1)} kg CO₂
                    {fuelSaved >= 0.01 && ` · fuel-efficient route saves ${fuelSaved.toFixed(2)} L`}
                </div>
                {fuelReference && referenceMileage && (
                    <div style={{ fontSize: '0.8rem', color: theme === 'dark' ? '#a0a0a0' : '#555', marginTop: '0.75rem' }}>
                        <details>
                            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                Avg. {(mileage ?? referenceMileage).toFixed(1)} km/L · {mileage === null ? 'petrol reference' : 'your mileage'}
                            </summary>
                            <label style={{ display: 'block', marginTop: '0.5rem' }}>
                                Vehicle mileage (km/L)
                                <input type="range" min="1" max="100" step="0.1"
                                    value={Number((mileage ?? referenceMileage).toFixed(1))}
                                    onChange={(e) => onMileageChange(e.target.valueAsNumber)}
                                    style={{ display: 'block', width: '100%', accentColor: '#10b981' }} />
                            </label>
                            {mileage !== null && (
                                <button type="button" onClick={() => onMileageChange(null)}
                                    style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                                    Reset to {referenceMileage.toFixed(1)} km/L
                                </button>
                            )}
                        </details>
                        <p style={{ marginTop: '0.35rem' }}>
                            UK DfT petrol-car model at {fuelReference.speedKmh} km/h. Fuel estimates adjust for traffic speeds along the route.
                        </p>
                    </div>
                )}
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
            {!bestInWindow && <div
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
            </div>}

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
