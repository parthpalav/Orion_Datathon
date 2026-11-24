// InputPanel Component - AI Dashboard-style input interface
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { DepartureWindow, Location } from '../../services/predictionService';
import { mumbaiDate, mumbaiTime } from '../../utils/mumbaiTime';
import PlaceSearch from './PlaceSearch';

export interface RouteRequest {
    source: Location;
    destination: Location;
    departureTime: Date;
    dateRange?: DepartureWindow;
    departureWindow?: DepartureWindow;
}

type DepartureMode = 'time' | 'window' | 'date-range';
const DAY_MS = 24 * 60 * 60 * 1000;

interface InputPanelProps {
    source: Location | null;
    destination: Location | null;
    onLocationChange: (field: 'source' | 'destination', location: Location | null) => void;
    onSubmit: (data: RouteRequest) => void;
    initialTrip?: RouteRequest;
    error?: string;
    isLoading?: boolean;
    theme?: 'light' | 'dark';
}

const InputPanel: React.FC<InputPanelProps> = ({
    source,
    destination,
    onLocationChange,
    onSubmit,
    initialTrip,
    error,
    isLoading = false,
    theme = 'dark',
}) => {
    const [now, setNow] = useState(() => mumbaiTime());
    const [departureDate, setDepartureDate] = useState(() => initialTrip ? mumbaiTime(initialTrip.departureTime).date : null);
    const [departureTime, setDepartureTime] = useState(() => initialTrip ? mumbaiTime(initialTrip.departureTime).time : null);
    const [departureMode, setDepartureMode] = useState<DepartureMode>(() =>
        initialTrip?.departureWindow ? 'window' : initialTrip?.dateRange ? 'date-range' : 'time',
    );
    const [windowStart, setWindowStart] = useState(() => initialTrip?.departureWindow ? mumbaiTime(initialTrip.departureWindow.start).time : null);
    const [windowEnd, setWindowEnd] = useState(() => initialTrip?.departureWindow ? mumbaiTime(initialTrip.departureWindow.end).time : '');
    const [dateRangeStart, setDateRangeStart] = useState(() => initialTrip?.dateRange ? mumbaiTime(initialTrip.dateRange.start).date : null);
    const [dateRangeEnd, setDateRangeEnd] = useState(() => initialTrip?.dateRange ? mumbaiTime(initialTrip.dateRange.end).date : '');
    const [formError, setFormError] = useState('');
    const [locating, setLocating] = useState(false);
    const mounted = useRef(false);
    const useDateRange = departureMode === 'date-range';
    const useWindow = departureMode === 'window';
    const startDate = dateRangeStart ?? now.date;
    const overnight = !!windowEnd && windowEnd < (windowStart ?? now.time);

    useEffect(() => {
        mounted.current = true;
        const timer = window.setInterval(() => {
            const current = mumbaiTime();
            setNow((previous) => previous.date === current.date && previous.time === current.time ? previous : current);
        }, 1000);
        return () => {
            mounted.current = false;
            window.clearInterval(timer);
        };
    }, []);

    const locate = (field: 'source' | 'destination') => {
        setFormError('');
        if (!navigator.geolocation) {
            setFormError('Current location is unavailable in this browser.');
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (!mounted.current) return;
                onLocationChange(field, { name: 'Current location', coordinates: [coords.longitude, coords.latitude] });
                setLocating(false);
            },
            () => {
                if (!mounted.current) return;
                setFormError('Could not get your current location. Allow location access or search for a place.');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        if (!source || !destination) {
            setFormError('Select a search result for the source and destination.');
            return;
        }
        if (source.coordinates.every((value, i) => value === destination.coordinates[i])) {
            setFormError('Choose different locations for the source and destination.');
            return;
        }

        const current = mumbaiTime();
        const date = useDateRange ? dateRangeStart ?? current.date : departureDate ?? current.date;
        if (useWindow) {
            const start = mumbaiDate(date, windowStart ?? current.time);
            const sameDayEnd = mumbaiDate(date, windowEnd);
            if (start.getTime() === sameDayEnd.getTime()) {
                setFormError('Choose different start and end times.');
                return;
            }
            const end = sameDayEnd < start ? new Date(sameDayEnd.getTime() + DAY_MS) : sameDayEnd;
            if (end <= new Date()) {
                setFormError('Choose an end time in the future.');
                return;
            }
            onSubmit({ source, destination, departureTime: start, departureWindow: { start, end } });
            return;
        }

        const when = !useDateRange && departureDate === null && departureTime === null
            ? new Date()
            : mumbaiDate(date, departureTime ?? current.time);
        if (!useDateRange && when < mumbaiDate(current.date, current.time)) {
            setFormError('Choose a departure time from now onward.');
            return;
        }
        const dateRange = useDateRange ? { start: mumbaiDate(date), end: mumbaiDate(dateRangeEnd) } : undefined;
        onSubmit({ source, destination, departureTime: when, dateRange });
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.75rem 1rem',
        fontSize: '0.95rem',
        background: theme === 'dark' ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.6)',
        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '0.5rem',
        color: theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
        outline: 'none',
        transition: 'all 0.3s ease',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: theme === 'dark' ? '#a0a0a0' : '#666',
        marginBottom: '0.5rem',
    };

    return (
        <motion.div
            id="route-planner"
            className="map-view-planner"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
                position: 'absolute',
                top: '5rem',
                left: '2rem',
                width: 'min(380px, calc(100% - 4rem))',
                maxHeight: 'calc(100% - 6rem)',
                overflowY: 'auto',
                background: theme === 'dark' ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '1.5rem',
                padding: '2rem',
                boxShadow: theme === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
            }}
        >
            <h2
                style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: theme === 'dark' ? 'white' : '#1a1a1a',
                    marginBottom: '0.25rem',
                }}
            >
                Traffic Intelligence
            </h2>
            <p
                style={{
                    fontSize: '0.75rem',
                    color: theme === 'dark' ? '#a0a0a0' : '#666',
                    marginBottom: '1.5rem',
                }}
            >
                Route alternatives, travel times and fuel for any departure
            </p>

            <form onSubmit={handleSubmit}>
                <fieldset disabled={isLoading || locating} style={{ minWidth: 0 }}>
                    {/* Source Location */}
                    <div style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 100 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label htmlFor="source" style={{ ...labelStyle, marginBottom: 0 }}>Source Location</label>
                            <motion.button
                                type="button"
                                onClick={() => locate('source')}
                                aria-label="Use current location as source"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Current
                            </motion.button>
                        </div>
                        <PlaceSearch
                            id="source"
                            placeholder="Search Mumbai places or coordinates"
                            location={source}
                            onChange={(location) => {
                                setFormError('');
                                onLocationChange('source', location);
                            }}
                        />
                    </div>

                    {/* Destination Location */}
                    <div style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 99 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label htmlFor="destination" style={{ ...labelStyle, marginBottom: 0 }}>Destination</label>
                            <motion.button
                                type="button"
                                onClick={() => locate('destination')}
                                aria-label="Use current location as destination"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Current
                            </motion.button>
                        </div>
                        <PlaceSearch
                            id="destination"
                            placeholder="Search Mumbai places or coordinates"
                            location={destination}
                            onChange={(location) => {
                                setFormError('');
                                onLocationChange('destination', location);
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="departureMode" style={labelStyle}>Departure options</label>
                        <select
                            id="departureMode"
                            value={departureMode}
                            onChange={(e) => {
                                setDepartureMode(e.target.value as DepartureMode);
                                setFormError('');
                            }}
                            style={inputStyle}
                        >
                            <option value="time">Specific time</option>
                            <option value="window">Time range</option>
                            <option value="date-range">Date range</option>
                        </select>
                    </div>

                    {/* Date Range Inputs */}
                    {useDateRange && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ marginBottom: '1.5rem' }}
                        >
                            <div style={{ marginBottom: '1rem' }}>
                                <label htmlFor="dateRangeStart" style={labelStyle}>
                                    Range Start Date
                                </label>
                                <input
                                    id="dateRangeStart"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setDateRangeStart(e.target.value)}
                                    required={useDateRange}
                                    style={inputStyle}
                                    min={now.date}
                                />
                            </div>
                            <div>
                                <label htmlFor="dateRangeEnd" style={labelStyle}>
                                    Range End Date
                                </label>
                                <input
                                    id="dateRangeEnd"
                                    type="date"
                                    value={dateRangeEnd}
                                    onChange={(e) => setDateRangeEnd(e.target.value)}
                                    required={useDateRange}
                                    style={inputStyle}
                                    min={startDate}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Departure Date */}
                    {!useDateRange && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label htmlFor="departureDate" style={labelStyle}>
                                Departure Date
                            </label>
                            <input
                                id="departureDate"
                                type="date"
                                value={departureDate ?? now.date}
                                onChange={(e) => setDepartureDate(e.target.value)}
                                required
                                style={inputStyle}
                                min={now.date}
                            />
                        </div>
                    )}

                    {useWindow ? (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <div>
                                    <label htmlFor="windowStart" style={labelStyle}>Start time (IST)</label>
                                    <input id="windowStart" type="time" value={windowStart ?? now.time}
                                        onChange={(e) => setWindowStart(e.target.value)} required style={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="windowEnd" style={labelStyle}>End time (IST)</label>
                                    <input id="windowEnd" type="time" value={windowEnd}
                                        onChange={(e) => setWindowEnd(e.target.value)} required style={inputStyle} />
                                </div>
                            </div>
                            {overnight && <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>The range ends the next day.</p>}
                        </div>
                    ) : (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label htmlFor="departureTime" style={labelStyle}>
                                {useDateRange ? 'Preferred Time (IST)' : 'Departure Time (IST)'}
                            </label>
                            <input
                                id="departureTime"
                                type="time"
                                value={departureTime ?? now.time}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {(formError || error) && (
                        <p role="alert" style={{ color: theme === 'dark' ? '#fca5a5' : '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            {formError || error}
                        </p>
                    )}
                    {locating && <p role="status" style={{ marginBottom: '1rem' }}>Getting your location…</p>}

                    {/* Submit Button */}
                    <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: isLoading ? 1 : 1.02 }}
                        whileTap={{ scale: isLoading ? 1 : 0.98 }}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: isLoading
                                ? 'rgba(100, 100, 100, 0.5)'
                                : 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
                            border: 'none',
                            borderRadius: '0.75rem',
                            color: 'white',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            boxShadow: isLoading ? 'none' : '0 4px 20px rgba(59, 130, 246, 0.4)',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                    }}
                                />
                                Analyzing Traffic...
                            </span>
                        ) : (
                            'Predict Traffic'
                        )}
                    </motion.button>
                </fieldset>
            </form>

            {/* Info */}
            <div
                style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
            >
                <p style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#a0a0a0' : '#666', margin: 0 }}>
                    💡 Travel times use Mapbox traffic data: live for "leave now", typical traffic for later departures. Fuel and CO₂ use the UK DfT speed–fuel curve.
                    Place search uses <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>OpenStreetMap</a> data.
                </p>
            </div>
        </motion.div>
    );
};

export default InputPanel;
