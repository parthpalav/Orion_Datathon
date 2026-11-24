import { useEffect, useState } from 'react';
import type { Location } from '../../services/predictionService';
import { searchPlaces } from '../../services/placeSearch';

interface PlaceSearchProps {
    id: string;
    placeholder: string;
    location: Location | null;
    onChange: (location: Location | null) => void;
}

export default function PlaceSearch({ id, placeholder, location, onChange }: PlaceSearchProps) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [result, setResult] = useState<{ query: string; places: Location[]; error?: boolean }>();
    const query = input.trim();
    const searching = open && !location && query.length >= 3;
    const current = result?.query === query ? result : undefined;
    const places = searching ? current?.places ?? [] : [];
    const listId = `${id}-results`;

    useEffect(() => {
        if (!searching) return;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const places = await searchPlaces(query, controller.signal);
                if (!controller.signal.aborted) setResult({ query, places });
            } catch {
                if (!controller.signal.aborted) setResult({ query, places: [], error: true });
            }
        }, 350);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, searching]);

    const select = (place: Location) => {
        onChange(place);
        setInput(place.name);
        setOpen(false);
        setActive(-1);
    };

    return (
        <div className="place-search">
            <input
                id={id}
                type="text"
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={places.length > 0}
                aria-controls={places.length ? listId : undefined}
                aria-activedescendant={places[active] ? `${listId}-${active}` : undefined}
                placeholder={placeholder}
                value={location?.name ?? input}
                maxLength={256}
                onChange={(e) => {
                    setInput(e.target.value);
                    setOpen(true);
                    setActive(-1);
                    if (location) onChange(null);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => { setOpen(false); setActive(-1); }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        setOpen(false);
                        setActive(-1);
                    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && query.length >= 3 && !location) {
                        e.preventDefault();
                        setOpen(true);
                        if (places.length) {
                            const next = active < 0 ? (e.key === 'ArrowDown' ? 0 : places.length - 1)
                                : (active + (e.key === 'ArrowDown' ? 1 : -1) + places.length) % places.length;
                            setActive(next);
                            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
                        }
                    } else if (e.key === 'Enter' && !location) {
                        e.preventDefault();
                        if (places[active]) select(places[active]);
                        else setOpen(true);
                    }
                }}
            />
            {places.length > 0 && (
                <ul id={listId} className="place-search-results" role="listbox">
                    {places.map((place, index) => (
                        <li
                            id={`${listId}-${index}`}
                            key={`${place.name}-${place.coordinates.join(',')}`}
                            role="option"
                            aria-selected={active === index}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => select(place)}
                        >
                            {place.name}
                        </li>
                    ))}
                </ul>
            )}
            {searching && places.length === 0 && (
                <p className="place-search-status" role="status">
                    {!current ? 'Searching…' : current.error ? 'Search is unavailable. Try again or enter latitude, longitude.'
                        : 'No matches. Try a nearby landmark or enter latitude, longitude.'}
                </p>
            )}
        </div>
    );
}
