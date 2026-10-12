# Japan 2026

A responsive, local-first private trip planner prototype for the Japan 2026 itinerary.

## Run locally

Use any static-file server from this directory. For example, with Python:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## What is implemented

- Editorial trip dashboard with route, trip snapshot, next stop, stay and task panels
- Seeded daily itinerary for 29 October through 8 November
- Date switching, editable stop title/details, drag reordering and skip feedback
- Insert-between controls plus a context-aware quick-add form
- Responsive desktop, tablet and mobile layouts with persistent mobile navigation
- Route, saved places, stays and shared notes views

The seed data is held in `app.js`, deliberately keeping this first implementation dependency-free and easy to replace with Supabase-backed data later.

## Editable stops and timing

Each itinerary card has an Edit place control for its details, exact location,
visit duration, transport mode, opening hours, and fixed reservations. Drag or
use the arrows to move a stop. Recommendations and adjacent routes update without
overwriting scheduled times; Apply recommended times commits a complete valid plan.

Photon (OpenStreetMap) resolves locations with cached requests. Only unique exact
names are accepted automatically; use Find location to confirm ambiguous places.
Travel times are estimates based on distance, a 30% route allowance, and transport
speed, without live traffic or transit schedules. Unknown locations remain unknown.
Routes link to Google Maps for checking the actual journey. No paid API is used.

Run calculation checks with `node tests/schedule.test.cjs`.
