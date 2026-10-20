-- Server-only raw-body adapter: parse a photo-heavy JSON document exactly once.
-- Keep the existing atomic save function and its conflict semantics.
create or replace function public.orbis_save_workspace_raw(bytea)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  payload jsonb;
begin
  if octet_length($1) > 12 * 1024 * 1024 + 1024 then
    raise exception 'Workspace request is too large';
  end if;
  payload := convert_from($1, 'UTF8')::jsonb;
  if jsonb_typeof(payload->'p_snapshot') is distinct from 'array'
     or coalesce(payload->>'p_sub','') = ''
     or coalesce((payload->>'p_version')::bigint,-1) < 0 then
    raise exception 'Invalid workspace request';
  end if;
  return public.orbis_save_workspace(
    payload->>'p_sub',payload->'p_snapshot',(payload->>'p_version')::bigint
  );
end;
$function$;

revoke all on function public.orbis_save_workspace_raw(bytea) from public, anon, authenticated;
grant execute on function public.orbis_save_workspace_raw(bytea) to service_role;
notify pgrst, 'reload schema';
