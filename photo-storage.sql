-- Photos and migration recovery snapshots are private; access goes through
-- the existing verified Google session in the Edge Function.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('orbis-trip-photos','orbis-trip-photos',false,8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif']),
       ('orbis-workspace-backups','orbis-workspace-backups',false,16777216,
        array['application/json'])
on conflict (id) do nothing;
-- Intentionally no browser Storage policies or grants are added.
