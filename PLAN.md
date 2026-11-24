# ORION roadmap and progress tracker

This file is the single source of truth for the rebuild. Any agent or person picking up work reads this first.

## Status

- **Current phase:** P3 (real route intelligence). P0 and P2 agent tasks are done. P1.2 and P1.3 wait on keys.
- **Next task:** P3.4. P1.2 and P1.3 wait on keys from P0.7.
- **Blockers:** waiting on the user for P0.2 (rotate secrets), P0.4 (purge history) and P0.7 (Gemini and TomTom keys).
- **Last updated:** 2026-11-24

## How to use this file

1. Find the first unchecked task below. Skip tasks marked **USER** unless the user is present.
2. Do the task. Check its acceptance line.
3. Tick the box (`- [x]`), update the Status block, and append one line to the Session log.
4. If you deviate from the plan, add an entry under Decisions explaining why.
5. Commit after each task with a plain-English message. Never push unless the user asks.

## Goal

Turn the datathon demo into an honest, working, deployed portfolio product for Mumbai traffic, on free tiers only.

Every number shown to a user must come from a real source: Mapbox, TomTom, collected data, or a cited formula. No `Math.random`, no invented news, no invented live numbers in chat.

## Target architecture

```
React (Firebase Hosting) ──▶ Express (Render free) ──▶ Mapbox Directions / Geocoding
                                   │                 ──▶ Gemini (OpenAI-compatible endpoint)
                                   │                 ──▶ Google News RSS
                                   ▼
                           MongoDB Atlas M0  ◀── GitHub Actions cron: TomTom collector (Python)
                                   ▲         ◀── GitHub Actions weekly: train + evaluate (Python)
                                   └─ precomputed corridor profiles (hour × weekday)
```

- The Flask `ml-service/` is retired. Training runs in GitHub Actions and writes profiles to Mongo. Express serves them by lookup.
- Route intelligence lives on the server (`POST /api/routes/plan`). The client and ATLAS tools share it.
- Fuel and CO₂ come from a cited speed-based consumption curve applied per segment.

## Phases

### P0: Security and tracking

- [x] **P0.1** Create `PLAN.md`, `CLAUDE.md`, `AGENTS.md`.
  - Accept: files exist at repo root; CLAUDE.md and AGENTS.md point here.
- [ ] **P0.2 USER** Rotate leaked secrets.
  - Rotate the Featherless API key (or delete it if switching fully to Gemini).
  - Generate a new `JWT_SECRET` (`openssl rand -hex 32`) and set it in Render.
  - Delete the unused Neo4j Aura instance, or change its password.
  - Restrict the Mapbox public token to the production domains and `localhost`.
  - Accept: old values no longer work.
- [x] **P0.3** Remove secrets from tracked files. Untrack `client/.env.production`, `server/server.log`, `ml-service/ml-service.log`, `docker-build.log`. Extend `.gitignore`.
  - Accept: `git grep` finds none of the leaked values in the working tree.
- [ ] **P0.4 USER** Purge secrets from git history with `git filter-repo`, then force-push.
  - Destructive. The agent writes the exact commands; the user runs them.
  - Secrets found in history (2026-11-24 scan): two Featherless keys (`server/.env.production`, `RENDER_ENV_SETUP.md`), JWT secret, `SECRET_KEY` and Neo4j credentials (`deploy-backend.sh` and the old auth docs). A whole `venv/` was also committed at some point; removing it shrinks the repo.
  - Rotating the secrets (P0.2) matters more than this step. Anyone who cloned the repo already has the old history.
  - Commands, run from a fresh clone so a mistake can't damage your working copy:

    ```bash
    brew install git-filter-repo
    git clone https://github.com/parthpalav/Orion_Datathon.git orion-clean && cd orion-clean
    git filter-repo --invert-paths \
      --path RENDER_ENV_SETUP.md --path deploy-backend.sh \
      --path server/.env.production --path client/.env.production --path client/.env.development \
      --path AUTHENTICATION.md --path QUICKSTART.md --path SETUP_SUMMARY.md --path README_AUTH.md \
      --path DEPLOYMENT.md --path FIREBASE_DEPLOYMENT.md --path server/AUTH_TESTING.md \
      --path venv --path server/server.log --path ml-service/ml-service.log --path docker-build.log
    git remote add origin https://github.com/parthpalav/Orion_Datathon.git
    git push --force --all origin
    ```

  - After the force-push, your old local copy has diverged. Re-clone it, or run `git fetch origin && git reset --hard origin/main` in it after copying out any uncommitted work.
  - Accept: `git log -p --all | grep rc_` finds nothing.
- [x] **P0.6 USER** Create a new MongoDB Atlas M0 (free) cluster. The old cluster in `server/.env` no longer exists (its DNS returns NXDOMAIN), so login and signup cannot work.
  - Create a database user, allow network access from `0.0.0.0/0` (Render and GitHub Actions have no fixed IPs), and put the connection string in `server/.env` as `MONGO_URI`.
  - Accept: `cd server && npm run dev` logs `MongoDB connected`.
- [ ] **P0.7 USER** Get the API keys the next phases need, and put them in the root `.env`:
  - `GEMINI_API_KEY` from Google AI Studio (aistudio.google.com).
  - `TOMTOM_API_KEY` from developer.tomtom.com (free tier).
  - `MAPBOX_TOKEN`: the same `pk.` token as `VITE_MAPBOX_TOKEN` is fine.
- [x] **P0.5** Server fails fast at boot if `JWT_SECRET` or `MONGO_URI` is missing. Remove the hardcoded JWT secret fallbacks in `server/src/routes/auth.ts`.
  - Accept: starting the server without `JWT_SECRET` exits with a clear error.

### P1: Feasibility spike (go/no-go gate)

Scratch scripts only, outside `src/`. Record results under Decisions.

- [x] **P1.1** Mapbox `driving-traffic` on 3 Mumbai routes (Andheri→BKC, Thane→Lower Parel, Borivali→Churchgate).
  - Check that `annotations=congestion,speed,duration` come back.
  - Check that `depart_at` changes durations across hours and weekdays, and how far ahead it works.
  - Check whether `duration_typical` is present.
- [ ] **P1.2** TomTom `flowSegmentData` on about 10 Mumbai points.
  - Check coverage and whether `currentSpeed` differs from `freeFlowSpeed`.
- [ ] **P1.3** Gemini through its OpenAI-compatible endpoint with the existing `openai` SDK.
  - Do one tool-call round trip. Record the current free-tier model name and rate limits.
- [ ] **P1.4** Gate decision.
  - If Mapbox `depart_at` is flat in Mumbai, switch user routing to the TomTom Routing API (`departAt`, `traffic=true`) and adjust P3.
  - If both are flat, stop and report to the user.

### P2: Cleanup and foundation

- [x] **P2.1** Delete dead code, stale docs and dead scripts.
  - Code: `client/src/pages/Map.tsx`, `client/src/pages/Intro.tsx`, `client/src/three/Globe.tsx`, the unlinked `client/src/pages/Login.tsx` and its route, the duplicate `HamburgerMenu` inside `client/src/App.tsx`, and the unused `mongodb` client dependency.
  - Docs and scripts: already deleted during P0.3 (they held secrets). Remaining in P2.1: code, the `mongodb` dependency, the `firebase.json` functions block.
  - Docs (done): `AUTHENTICATION.md`, `QUICKSTART.md`, `SETUP_SUMMARY.md`, `README_AUTH.md`, `DEPLOYMENT.md`, `FIREBASE_DEPLOYMENT.md`, `ML_INTEGRATION.md`, `RENDER_ENV_SETUP.md`, `server/AUTH_TESTING.md`.
  - Scripts and config: `deploy*.sh`, `start-*.sh`, `setup-ml-service.sh`, the `firebase.json` functions block.
  - Accept: `npm run build` passes in `client/` and `server/`.
- [x] **P2.2** Clean environment config.
  - One root `.env.example` for both apps (originally one per app; merged later, see Decisions).
  - Trim `render.yaml` to variables the code reads. Add `MONGO_URI`, `GEMINI_API_KEY`, `MAPBOX_SECRET_TOKEN`, `CORS_ORIGINS`.
  - Read `CORS_ORIGINS` in `server/src/index.ts`.
  - Fix `dotenv` load order so routes see env values.
  - Accept: every variable in `render.yaml` is read somewhere in `server/src`.
- [x] **P2.3** Server hardening.
  - Shared auth middleware in `server/src/middleware/auth.ts`, extracted from the inline check in `/me`.
  - `express-rate-limit` on `/api/auth/*`, `/api/chat`, `/api/news`.
  - JSON body size limit and a central error handler.
  - Accept: unauthenticated `POST /api/chat` returns 401.
- [x] **P2.4** Tests and CI.
  - `vitest` + `supertest` in `server/`, `vitest` in `client/`.
  - `.github/workflows/ci.yml` runs build and tests for both.
  - Move `@types/*` and `typescript` to devDependencies in `server/package.json`.
  - Accept: CI is green on a pushed branch. (Verified locally: `npm ci && npm run build && npm test` passes in both apps. CI runs on the user's next push.)

### P3: Real route intelligence (server-side)

- [x] **P3.1** `server/src/services/mapbox.ts`: Directions client (`driving-traffic`, alternatives, annotations, `depart_at`) with a Mongo cache keyed by rounded coordinates and departure slot (TTL 7 days).
- [x] **P3.2** `server/src/services/fuel.ts`: per-segment fuel in litres from speed and distance, using a cited speed–consumption curve. CO₂ at 2.31 kg per litre of petrol. Unit test included.
- [x] **P3.3** `POST /api/routes/plan`. It returns:
  - Up to 3 real alternatives with ETA, typical ETA, distance, per-segment congestion, fuel and CO₂.
  - "Fastest" and "most fuel-efficient" labels chosen from the real alternatives.
  - A 24h timeline sampled every 2 hours with `depart_at`, cached.
  - Best departure hour, and best date within the range (range capped at 14 days), both by minimum ETA.
- [ ] **P3.4** Rewrite `client/src/services/predictionService.ts` as a thin API client.
  - Remove all `Math.random`, hash-based confidence and hardcoded peak hours.
  - Update `MapView.tsx`, `InsightsPanel.tsx` and `TrafficTimeline.tsx` for the new response shape.
  - The timeline reads precomputed slots. Dragging it makes no network calls.
- [ ] **P3.5** UI bug fixes.
  - Redraw route layers after the theme `setStyle` in `MapContainer.tsx`.
  - Draw congestion above the base route line.
  - Show the selected route's distance in `InsightsPanel.tsx`.
  - Refresh `SearchHistory` after a save.
  - Set the `index.html` title.
  - Remove "real-time data" claims that are not true.
- Accept for P3: `curl -X POST localhost:3000/api/routes/plan` for Andheri→BKC gives different ETAs at 09:00 and 23:00. `grep -r "Math.random" client/src/services client/src/components/map` returns nothing.

### P4: Data collection (start early: data needs weeks to accumulate)

- [ ] **P4.1** Define 8–12 Mumbai corridors with 3–5 sample points each in `ml/corridors.json`. Candidates: WEH, EEH, SV Road, LBS Marg, Sion–Panvel, Bandra–Worli Sea Link, JVLR, SCLR.
- [ ] **P4.2** `ml/collect.py`: fetch TomTom `flowSegmentData` for every point and insert into Mongo `traffic_samples` as `{point_id, corridor, ts, current_speed, free_flow_speed, confidence, road_closure}`.
  - Budget: about 50 points every 30 minutes is about 2,400 requests per day. TomTom's free tier allows 2,500.
- [ ] **P4.3** `.github/workflows/collect.yml` on a `*/30` cron, with repo secrets `TOMTOM_API_KEY` and `MONGO_URI`.
  - GitHub disables scheduled workflows after 60 days without repo activity.
  - Private repos get 2,000 free Actions minutes per month. One run is about 1 minute, so 1,440 runs per month fits.
  - Accept: after 24 hours, `traffic_samples` holds about 48 samples per point.
- [ ] **P4.4** Delete `ml-service/` and `server/src/routes/ml.ts` once P3 no longer depends on them.

### P5: Real news

- [ ] **P5.1** `server/src/services/news.ts`: fetch Google News RSS for Mumbai traffic queries (no key needed), parse with `fast-xml-parser`, dedupe.
- [ ] **P5.2** One batched Gemini call classifies each item and writes a one-line summary (JSON output). Cache in Mongo for 30 minutes. If Gemini fails, return the raw headlines. Remove the hardcoded fake articles and the false "Using cached data" message.
- [ ] **P5.3** `client/src/pages/News.tsx`: link each card to its real article URL. Fix the badge colour precedence bug.
- Accept: every news card opens a real article.

### P6: ATLAS with real tools

- [ ] **P6.1** `server/src/routes/chat.ts`: use Gemini through the `openai` SDK `baseURL`. Accept a capped `messages[]` history. Require auth.
- [ ] **P6.2** Tools that reuse P3–P5 code:
  - `plan_route(origin, destination, depart_at?)` with server-side geocoding.
  - `best_departure(origin, destination, window)`.
  - `corridor_status(corridor)` from the latest `traffic_samples`.
  - `latest_news()`.
- [ ] **P6.3** New system prompt: cite tool results and never invent live numbers. Update `client/src/pages/Assistant.tsx` to send the history.
- Accept: "best time to leave Andheri for BKC tomorrow" triggers `best_departure`, and the answer matches the route planner.

### P7: ORION model (needs at least 3 weeks of P4 data)

- [ ] **P7.1** `ml/train.py`.
  - Target: congestion ratio `1 - current_speed / free_flow_speed` per point.
  - Features: point, hour, weekday, holiday flag.
  - Models: a baseline (per-point hour × weekday median) and a GradientBoosting model.
  - Split by time, never randomly.
- [ ] **P7.2** `ml/evaluate.py` writes MAE for both models to `ml/REPORT.md`. Publish GBM predictions only if they beat the baseline. Otherwise publish the median profile.
- [ ] **P7.3** Weekly `.github/workflows/train.yml` writes `corridor_profiles` (168 values per point) to Mongo. Add `GET /api/corridors` and `GET /api/corridors/:id`.
- [ ] **P7.4** Client "Corridor insights" view: hour × weekday heatmap per corridor, live status, typical vs now. ATLAS `corridor_status` uses the profiles.
- Accept: `ml/REPORT.md` shows both MAEs on a held-out final week.

### P8: Deploy and demo

- [ ] **P8.1** Render: apply the cleaned `render.yaml`, set dashboard env values, health check at `/api/health`. The client pings the backend on load because the free tier sleeps.
- [ ] **P8.2** Deploy `client/dist` to Firebase Hosting with production env. Build with `VITE_API_URL=https://orionmaps-api.onrender.com/api npm run build`, since the root `.env` holds local values.
- [ ] **P8.3** Rewrite `README.md`: what is real, architecture, local setup, data sources, limits.
- [ ] **P8.4** Write and run an end-to-end demo script on the deployed URLs: sign up → plan Andheri→BKC with a date range → timeline → corridor heatmap → ATLAS question → news.

## Verification after every phase

```bash
cd server && npm run build && npm test
cd client && npm run build && npm test
```

## Out of scope

Server-side search history sync, paid traffic APIs, native mobile, real-time push, WhatsApp and SMS.

## Decisions

- **2026-11-24** Scope: portfolio/demo-grade, Mumbai only, free tiers only.
- **2026-11-24** LLM: Gemini free API through its OpenAI-compatible endpoint, reusing the existing `openai` SDK. Note: on the Gemini free tier, Google may use prompts to improve its products. Do not send user personal data in prompts.
- **2026-11-24** Untracked `client/.env.development` as well as `.env.production`. `.gitignore` now ignores every `.env.*` except `.env.example`. Copy `client/.env.example` to `client/.env.development` for local dev.
- **2026-11-24** The server now exits if MongoDB is unreachable at boot, instead of running with every auth request hanging. Render restarts it.
- **2026-11-24** The user asked for a commit after each task, with plain-English messages (no `feat:`/`fix:` prefixes) and no pushing.
- **2026-11-24 P1.1 result (Mapbox in Mumbai): GO, with caveats.** Tested Andheri→BKC, Thane→Lower Parel and Borivali→Churchgate on `driving-traffic`.
  - `overview=full` is required when asking for `annotations=congestion`; `simplified` returns 422.
  - **Use `duration_typical` for any future departure.** It gives a clean, believable daily curve. Andheri→BKC on a Tuesday: 02:00 18.7 min, 06:00 19.1, 10:00 37.0, 14:00 32.5, 18:00 36.1, 22:00 26.1. Sunday 09:30 is 23.3 vs Tuesday 37.0. Dates 30 and 60 days out still work.
  - **Do not use `duration` for future departures.** Its curve looks shifted by about 6 hours (fastest at 08:00–10:00, slowest at 16:00–22:00), so it is probably mixing in the wrong time zone or live data. Use `duration` only for "leave now", where it matches live traffic.
  - Per-segment `congestion` is all `unknown` for future departures. It is only present for live queries, where it shows real low/moderate/heavy values. Per-segment `speed` is always present.
  - P3 plan: colour future routes from scaled segment speeds rather than `congestion`, and scale segment speeds so their total time matches `duration_typical` before computing fuel.
  - `depart_at` with no offset (local time at origin) and with `+05:30` agree within about 2 minutes. Use the explicit `+05:30` form.
  - The public `pk.` token works for Directions. The server can reuse it until a separate token is created.
- **2026-11-24** The server now reads only `server/.env` (through `server/src/config/env.ts`, imported first). The root `.env` is no longer loaded. Deleted the stray root `package.json` and `package-lock.json`.
- **2026-11-24** Renamed the planned `MAPBOX_SECRET_TOKEN` to `MAPBOX_TOKEN`, since P1.1 showed the public `pk.` token works for Directions.
- **2026-11-24** Fixed the default ports: the server defaults to 3000 and the legacy ML proxy defaults to 5001 (where Flask actually listens). The local `server/.env` sets `PORT=3001`, matching `client/.env.development`.
- **2026-11-24** P2.3: `/api/ml` stays unauthenticated until it is deleted in P4.4, because the current client calls it with `fetch` and no token. Removed its `/retrain` proxy (the Flask endpoint was broken). Auth errors no longer return internal error messages.
- **2026-11-24** P2.4: split `server/src/app.ts` (Express app, importable by tests) from `server/src/index.ts` (env check, DB connect, listen). Bumped `@types/node` to 22 because vitest 5 requires it, and set `engines.node >=22`.
- **2026-11-24** P0.6: new Atlas M0 cluster `orion` in Mumbai (AWS ap-south-1), database `orion`, user `parthspalav_db_user` (auto-created, Atlas Admin role). IP access list: the user's home IP plus `0.0.0.0/0`. Smoke test passed against it: signup, login, `/me`, and 401 on chat without a token. The test user was deleted afterwards. If the DB password is rotated, update the password inside `MONGO_URI` in `server/.env` (and in Render).
- **2026-11-24** Retire the Flask ML service. The old model trained on random synthetic San Francisco data with target leakage, so none of it is kept except the TomTom request logic.
- **2026-11-24** Merged all env files into one root `.env` (and one root `.env.example`), so each secret lives in one place. The server reads it via `server/src/config/env.ts` (`../../../.env`, same from `src` and `dist`); Vite reads it via `envDir: '..'` and exposes only `VITE_*` keys. Removed `server/.env`, `client/.env`, `client/.env.development` and `client/.env.production`. The production client build sets `VITE_API_URL` on the command line (P8.2). This supersedes the earlier per-app env entries above. To rotate the DB password, edit `MONGO_URI` in the root `.env` (and in Render).
- **2026-11-24** P3.2 fuel curve: DfT TAG data book v1.18, Table A1.3.8, petrol car (2015): L/km = a/v + b + c·v + d·v², a=0.45195, b=0.09605, c=-0.00109, d=0.000007, v clamped 10–130 km/h. Gives 6.81 L/100 km at 50 km/h, 13.1 at 10 km/h. Chosen because the planned ORNL speed table (1997 study) could not be retrieved, and TAG covers low urban speeds. It is a UK fleet curve, not an Indian one (noted in code).
- **2026-11-24** P3.3 design: `POST /api/routes/plan` requires login (rate limit 60 per 15 min) because one plan can make ~27 Mapbox calls. Body: `origin`, `destination` as `[lng, lat]`, optional `departAt` (ISO, within 60 days), optional `dateRange` (max 14 days). A `departAt` under 5 minutes ahead is treated as "leave now" (live `duration` and Mapbox congestion labels); otherwise ETAs use `duration_typical` and segment speeds are scaled to match it. Segment congestion for future trips is speed-based with 60 km/h as free flow (an explicit assumption, in code). Timeline slots already in the past move forward by whole weeks (same weekday and hour). Consecutive segments in the same colour band are merged. Live check, Andheri to BKC tomorrow: 37.0 min at 09:00, 23.4 min at 23:00, best hour 02:00 (18.5 min), best date in a 7-day range at 09:00 was Saturday 2026-11-28 (22.6 min).

## Session log

- **2026-11-24** (Claude Opus 5.5) Audited the whole repo, wrote this plan. Done: P0.1, P0.3, P0.5, and the docs/scripts part of P2.1. Wrote the P0.4 history-purge commands.
- **2026-11-24** (Claude Opus 5.5) P1.1 done: Mapbox works for Mumbai via `duration_typical`; details under Decisions.
- **2026-11-24** (Claude Opus 5.5) P2.1 done: removed dead pages, the duplicate menu, the `mongodb` client dependency and the Firebase functions block. Client build passes.
- **2026-11-24** (Claude Opus 5.5) P2.2 done: env examples, trimmed `render.yaml`, CORS from env, env loaded before routes. Found the MongoDB cluster is gone and added P0.6 and P0.7.
- **2026-11-24** (Claude Opus 5.5) P2.3 done: shared auth middleware, rate limits, body limits, error handler. The 401 check is verified by a test in P2.4.
- **2026-11-24** (Claude Opus 5.5) P2.4 done: vitest in both apps (server 4 tests, client 1), GitHub Actions CI. Phase P2 complete.
- **2026-11-24** (Claude Opus 5.5) P0.6 done with the user via the browser: new Atlas cluster, `MONGO_URI` in `server/.env`, auth smoke test passed.
- **2026-11-24** (Claude Opus 5.5) Merged env files into a single root `.env`; server boot, DB connect, both builds and tests verified.
- **2026-11-24** (Claude Opus 5.5) P3.1 done: `server/src/services/mapbox.ts` with a Mongo TTL cache (5 min live, 7 days future); live check Andheri to BKC tomorrow: 37.0 min typical at 09:00, 23.4 at 23:00.
- **2026-11-24** (Claude Opus 5.5) P3.2 done: `server/src/services/fuel.ts` (TAG A1.3.8 curve, CO₂ at 2.31 kg/L) with 4 unit tests.
- **2026-11-24** (Claude Opus 5.5) P3.3 done: `server/src/services/routePlanner.ts` and `POST /api/routes/plan`, 6 new tests, live acceptance check passed (09:00 vs 23:00 differ).
