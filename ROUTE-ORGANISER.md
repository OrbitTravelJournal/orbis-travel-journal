# Free geographic route organiser

The bottom-right pin opens the organiser for the active, owned trip. This release has no language model and does not call a billed routes API.

- Select a day, then optionally batch-add saved cards. New items have no invented time or duration.
- Resolve coordinates from a saved `coordinates` value, an exact latitude/longitude Google Maps query, or a user-confirmed result from the existing authenticated public-place lookup. Never choose an ambiguous candidate automatically.
- Modes are movable, fixed-position and excluded. Meals and stays default to fixed, transport and non-place entries default to excluded. The first included place defaults to fixed. Fixed/excluded rows cannot be crossed.
- Optimise great-circle distance within movable segments. Up to ten stops per segment uses dynamic programming; longer segments use nearest-neighbour and local improvements. No road distance, public-transport time, opening hours or booking feasibility is inferred.
- Preview contains before/after geographic distance, ordering and individual Google Maps transit links; users can switch to walking in Maps.
- Apply retains the original time slots, attaches confirmed coordinates and the selected modes, then uses normal account-scoped persistence and sync. No background automatic scheduling.
- An in-session undo works only when the account, trip and applied day contents still match. Changes in another day or account cannot be overwritten by an obsolete preview. Unconfirmed lookup choices are transient.

Files: `route-order.js` is a pure geographic solver; `route-assistant.js` is the UI and persistence adapter. No credentials, new tables, backend authentication changes or external packages are added.
