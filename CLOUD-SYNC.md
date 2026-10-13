# Orbis account sync

Production endpoint: https://owpxeksiaywnacomkwog.supabase.co/functions/v1/orbis-sync

The static frontend retains Google Identity Services. The Edge Function validates Google RS256 signatures, issuer, audience, expiry and verified email. Credentials are stored only in tab sessionStorage; local email profiles never authorize cloud requests. Reauthentication is required when the Google credential expires.

`orbis_workspaces` stores one JSON snapshot per verified Google subject, including photos and personal flight data. Public and authenticated Data API roles have no table or RPC access. RLS has no client policies intentionally: all requests pass through the verifying Edge Function, whose service key stays in server environment variables. The advisor INFO about RLS with no policy reflects this deny-by-default design.

The first upload requires selecting the authoritative device. Version-conditional writes reject conflicts with HTTP 409. Polling runs every 30 seconds while the page is visible; changes debounce for 1.5 seconds. Unsynced edits are never silently replaced. Local versions replaced by cloud data are retained in IndexedDB and can be exported from the account panel. Backups do not include authentication credentials.

Cloud request size is limited to 12 MiB. Browser storage limits still apply to local workspace copies. Cloud failures leave local edits intact and show a retry message. No credential is committed to this repository.

Validation: transactional live database checks for initial write, version increment, stale write refusal and client permission denial; live HTTP checks for unsigned/forged credentials, disallowed origins and CORS; frontend scenario tests for opt-in, account isolation, photos, conflict choices and recovery. A real Google-authorized phone-to-desktop transfer still requires the owner to select the phone version and upload it.
