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
