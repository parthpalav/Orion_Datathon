# Agent instructions for ORION

- Read `PLAN.md` first. Work on the next unchecked task in order. Skip tasks marked **USER** unless the user is present.
- Right after finishing a task: tick its box in `PLAN.md`, update the Status block, and append one line to the Session log (date, model, tasks done).
- If you change the plan, record why under Decisions in `PLAN.md`.
- Commit after each finished task with a plain-English message (no `feat:`/`fix:` prefixes). Never push unless the user asks in the current message. Never add AI attribution to commits.
- Never commit secrets. Real values go in `.env` files, which are gitignored. Only `.env.example` files are tracked.
- Every number shown to users must come from a real source (Mapbox, TomTom, collected data, or a cited formula). No `Math.random` in product logic.
