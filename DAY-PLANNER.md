# Day route and nearby food

The default mode is free: Google Maps URLs provide per-leg walking, transit and driving-reference links, plus restaurant/cafe/bakery searches around a selected stop. No Google API key or billing is required. The website cannot retrieve actual street distance, departures or Google restaurant results through these URLs; users check those in Maps. The 400/500/600 m selector expresses a walking preference, not a measurement.

In the itinerary, open **当天路线 · 附近美食**, or expand a stop's actions and select its food icon. Copy a restaurant's Google Maps share link into the food panel with your own label and notes to add a Meal card to the current trip's saved library. It can then be added to the selected day without inventing an arrival time. Existing workspace persistence and authenticated sync handle these user-created records.

## Optional API connection (disabled by default)

The server module `planner-service.js` accepts only authenticated `planner-*` actions from the existing Google-verified Edge Function. Apply `maps-usage.sql` before enabling it. Set `GOOGLE_MAPS_API_KEY` as an Edge Function secret, never in GitHub Pages or browser storage. A future administrator must enable Routes API and Places API (New), restrict the key to these APIs, and configure Google Cloud quotas. No key is included in this release, and no Google billing account is created or changed.

Durable transaction-locked reservations stop outbound provider requests after **500 route calls / month globally** or **300 nearby searches / month globally**, additionally **60 / 15 per account per UTC day**. A route segment can use up to four provider calls. Reservations happen before every attempted call; failures consume a slot conservatively. Limits use UTC calendar months and protect this app only: they do not cover other apps using the same Google project, different billing cycles, or future pricing changes. Budget alerts alone are not spending caps. A failed reservation fails closed and retains free links.

API mode checks actual WALK distance against the selected threshold, prefers rail transit, then other public transit, then a DRIVE reference when no transit exists. API outages and quota failures do not silently become a taxi recommendation. Departure times are explicit, with a timezone selector (Japan UTC+09 by default). Transit is supported from 7 days before to 100 days after today.

Nearby results are limited to eight and ranked by popularity; rating and current opening fields use the Enterprise SKU. No Google photos/reviews are requested. Provider results stay in memory and are cleared on dialog close. Saving from a Google result retains only its place ID, a constructed map reference, and a label/notes authored by the user. Google rating, name, address and photo content are not persisted. Results are displayed in a separate attributed list, not placed on the app's Leaflet map. The dialog links Google Maps terms and Google's privacy policy and discloses which selected query fields are transmitted.

## Verification

`node --test tests/*.test.cjs`

Tests cover link escaping, provider references, restricted share-link import, Japan timezone conversion, walking threshold boundary, rail preference, transit-to-taxi fallback, fail-closed quotas, invalid inputs and bounded Places fields. Browser verification uses an isolated local profile/trip and checks mobile and desktop layout, saving a restaurant link, adding it to a day, persistence after reload and empty days.

## Japan transit coverage

Google Routes API excludes Japanese transit partners (https://developers.google.com/maps/faq#transit_directions_countries). An empty transit response must not imply that there is no public transport. The planner keeps the transit Maps link first and asks the traveller to check schedules before selecting the optional taxi link. Actual walking distance and nearby Places search remain available.

## Inline route maps and current location

Set a separate `GOOGLE_MAPS_EMBED_API_KEY` Edge Function secret. This is a browser-visible key: restrict it to Maps Embed API and website referrer `https://orbittraveljournal.github.io/*`. Never reuse `GOOGLE_MAPS_API_KEY`, which remains server-only. Authenticated planner status returns only the dedicated embed key. Route mode buttons load an official directions iframe inside the same card; Embed does not accept the selected departure time, so it must be checked in the map. Japanese transit display remains subject to provider coverage and must be tested.

Nearby food requests acquire fresh device location with a 15-second timeout and at most 30 seconds of cached position. No location request occurs just by opening the dialog. Permission denial clears the old center; late callbacks after close, account/trip/day changes are ignored. Coordinates are not persisted in workspaces.
