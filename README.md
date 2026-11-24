# ORION: Mumbai traffic intelligence

ORION answers three questions for a trip in Mumbai: which route, when to leave, and what it costs in time, fuel and CO₂. It started as a datathon demo. It is being rebuilt so that every number on screen comes from a real source. Progress is tracked in [`PLAN.md`](PLAN.md).

## What is real today

| Feature | Source | Status |
|---|---|---|
| Route alternatives, distance, ETA | Mapbox Directions `driving-traffic` (live traffic for "leave now", typical traffic for later departures) | Live |
| 24-hour timeline, best departure hour, best date in a range | Mapbox typical traffic, sampled every 2 hours | Live |
| Congestion colours on the route | Mapbox live congestion labels; for future trips, segment speed against a 60 km/h free-flow reference | Live |
| Fuel and CO₂ per route | UK DfT TAG data book v1.18, Table A1.3.8 (petrol car speed–fuel curve), 2.31 kg CO₂ per litre | Live |
| Traffic news | Google News RSS, filtered to Mumbai mobility stories, keyword categories | Live |
| Corridor traffic samples (11 corridors, 39 points) | TomTom Traffic Flow, every 30 minutes via GitHub Actions | Code ready, waits on a TomTom key |
| News summaries, ATLAS assistant with tools | Gemini (free tier) | Planned (P5.2, P6) |
| Corridor heatmaps and our own model | Trained on the collected TomTom data, compared against a simple baseline | Planned (P7, needs about 3 weeks of data) |

Nothing is randomly generated. If a value has no real source, the app does not show it.

## Architecture

```
React + Vite (Firebase Hosting) ──▶ Express API (Render) ──▶ Mapbox Directions
                                          │              ──▶ Google News RSS
                                          │              ──▶ Gemini (planned)
                                          ▼
                                  MongoDB Atlas (M0)  ◀── GitHub Actions: TomTom collector every 30 min
```

- `client/`: React 19, Vite, Mapbox GL. The map page calls `POST /api/routes/plan` and renders what comes back.
- `server/`: Express and Mongoose. Route planning (`src/services/routePlanner.ts`), the Mapbox client with a Mongo cache (`src/services/mapbox.ts`), fuel (`src/services/fuel.ts`), news (`src/services/news.ts`), JWT and Google sign-in.
- `ml/`: corridor definitions (`corridors.json`) and the TomTom collector (`collect.py`). Training lands here in P7.

## Run it locally

You need Node 22 and a MongoDB connection string.

1. Copy `.env.example` to `.env` in the repo root and fill it in. Both apps read this one file. Vite only exposes `VITE_*` keys to the browser.
2. Start the API:
   ```sh
   cd server && npm install && npm run dev
   ```
3. Start the client in another terminal:
   ```sh
   cd client && npm install && npm run dev
   ```
4. Open http://localhost:5173, sign up, then open the Traffic Map.

To run the collector by hand (needs `TOMTOM_API_KEY`):
```sh
python3 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt
ml/.venv/bin/python ml/collect.py
```

Tests: `npm test` in `server/` and `client/`, and `python3 ml/test_collect.py`. CI runs all three.

## Limits worth knowing

- Mapbox's `duration` for future departures is unreliable in Mumbai, so ORION uses `duration_typical` for anything after "leave now" (see `PLAN.md`, P1.1).
- The fuel curve describes the UK petrol fleet, not Indian cars. It ranks routes fairly, but treat the litres as an estimate.
- Google News RSS allows personal, non-commercial feed-reader use. Fine for this portfolio project; revisit before any commercial use.
- Free tiers: Render sleeps after 15 idle minutes (the client pings it on load), TomTom allows 2,500 flow requests a day (the collector uses about 1,900), and GitHub pauses scheduled workflows after 60 days without repository activity.

## Deploy

- API: Render, from `render.yaml`. Set the secrets marked `sync: false` in the Render dashboard.
- Client: Firebase Hosting, from the repo root (`firebase.json` serves `client/dist`). Build with the production API URL, since `.env` holds local values:
  ```sh
  (cd client && VITE_API_URL=https://orionmaps-api.onrender.com/api npm run build) && firebase deploy --only hosting
  ```
