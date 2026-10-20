# Orbis account sync

Production endpoint: https://owpxeksiaywnacomkwog.supabase.co/functions/v1/orbis-sync

The static frontend retains Google Identity Services. The Edge Function validates Google RS256 signatures, issuer, audience, expiry and verified email. Google credentials establish a revocable random server session. Only a SHA-256 digest is stored on the server. Browser sessions persist in localStorage, renew with use for 30 days and require fresh Google authentication after a maximum of 90 days. Local email profiles never authorize cloud requests. Explicit logout clears browser credentials and revokes the server session when online.

`orbis_workspaces` stores one JSON snapshot per verified Google subject, including photos and personal flight data. Public and authenticated Data API roles have no table or RPC access. RLS has no client policies intentionally: all requests pass through the verifying Edge Function, whose service key stays in server environment variables. The advisor INFO about RLS with no policy reflects this deny-by-default design.

The first upload requires selecting the authoritative device. Version-conditional writes reject conflicts with HTTP 409. Polling runs every 30 seconds while the page is visible; changes debounce for 1.5 seconds. Unsynced edits are never silently replaced. Local versions replaced by cloud data are retained in IndexedDB and can be exported from the account panel. Backups do not include authentication credentials.

Cloud request size is limited to 12 MiB. Full local workspaces are mirrored in IndexedDB and restored before cloud comparison. This avoids localStorage image quota failures returning an older workspace after reload. Cloud metadata tracks the persisted local fingerprint separately from the uploaded fingerprint so an old cache cannot be treated as a fresh edit. Sync writes require clientVersion 2; earlier clients receive HTTP 426 instead of overwriting newer data. Cloud failures leave local edits intact and show a retry message. No credential is committed to this repository.

Validation: transactional live database checks for initial write, version increment, stale write refusal and client permission denial; live HTTP checks for unsigned/forged credentials, disallowed origins and CORS; frontend scenario tests for opt-in, account isolation, photos, conflict choices and recovery. A real Google-authorized phone-to-desktop transfer still requires the owner to select the phone version and upload it.

Place lookup uses the existing verified account session (POST action `lookup`). It searches up to five Wikidata entities with geographic claims and retrieves Commons bitmap photographs with CC BY/CC0/public-domain licensing metadata. The user confirms a candidate; blank fields receive sourced values, while manual fields and existing photos remain. Addresses without a source stay empty. Saved cards retain source and photo attribution, including when added to the itinerary. No model API or generated image is used. Upstream requests have bounded timeouts and cannot prevent manual saving.


## Private booking PDFs

The `booking-files` page stores PDFs outside workspace snapshots in the private
`orbis-booking-files` bucket. Each file is limited to 5 MiB; metadata in
`public.orbis_booking_files` is keyed by verified Google subject and trip ID.
The existing Edge authentication runs before every file operation. Browser roles
have no table grants or Storage policies; only server-side service access is used.
Open requests return a signed link valid for five minutes. File content is never
embedded in trip sharing links or localStorage. Listing refreshes when the page
opens, regains focus, or remains visible for 30 seconds; unchanged lists retain
their DOM. Trash can be restored; permanent deletion requires a second explicit
confirmation and is only accepted for trashed files. The underlying upload,
open, account/trip isolation and cleanup paths were verified against live Storage
with temporary test identities, which were revoked afterward.
