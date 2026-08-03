# Tabi workspace refactor

## Confirmed current architecture

- Static HTML entry point: `index.html`
- Application logic: one large classic JavaScript file, `app.js`
- Styling: layered CSS files with shared selectors rather than a component framework
- Routing: hash-like `data-page` navigation with `showPage(page)`
- State: in-memory arrays (`days`, `hotels`) persisted to `localStorage`
- External services: Google Maps links/iframe, Leaflet, Open-Meteo, Wikipedia/Wikidata image enrichment
- Seed content: the Japan 2026 trip is hard-coded in `app.js` and is also used to seed the first workspace trip

## What was added without replacing the prototype

- `workspace.js`: account → trips → days workspace model, seeded from the existing Japan trip
- `glass-workspace.css`: reusable glass panel/card/button and trip-card visual system
- `Trips` page with upcoming/archive filters, open, archive, delete and create actions
- New trip modal with dates, route and cover image
- Local profile sign-in shell and sign-out action
- Legacy `localStorage` state is copied into the active trip whenever the existing app saves

## Migration boundary

The local profile layer is intentionally a safe prototype boundary. It is not a replacement for real authentication: browser localStorage is not appropriate for secure multi-user cloud data. The Google button accepts a future `window.TABI_GOOGLE_CLIENT_ID` configuration hook; the production step should replace `workspace.js` persistence with Supabase Auth and tables for `profiles`, `trips`, `trip_days`, `itinerary_items`, `places`, `bookings`, `collections` and `notes`, protected by row-level security.

The existing Tabi pages and interaction patterns remain deployable while that backend migration is reviewed.
