-- The browser has no direct database access. Only the Google-verifying Edge Function uses this table.
create table public.orbis_workspaces (
  google_sub text primary key,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'array'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.orbis_workspaces enable row level security;
revoke all on public.orbis_workspaces from public, anon, authenticated;
grant select, insert, update on public.orbis_workspaces to service_role;
create function public.orbis_save_workspace(p_sub text, p_snapshot jsonb, p_version bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_version = 0 then
    insert into public.orbis_workspaces (google_sub, snapshot)
    values (p_sub, p_snapshot) on conflict (google_sub) do nothing
    returning jsonb_build_object('version',version,'updatedAt',updated_at) into result;
  else
    update public.orbis_workspaces set snapshot=p_snapshot, version=version+1, updated_at=now()
    where google_sub=p_sub and version=p_version
    returning jsonb_build_object('version',version,'updatedAt',updated_at) into result;
  end if;
  return result;
end;
$$;
revoke all on function public.orbis_save_workspace(text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.orbis_save_workspace(text,jsonb,bigint) to service_role;
