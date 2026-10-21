-- Only the verified Edge Function may reserve Google calls. Counts contain no map content.
create table if not exists public.orbis_maps_usage (
  scope text not null,
  period text not null,
  kind text not null check(kind in ('routes','places')),
  calls integer not null default 0 check(calls>=0),
  primary key(scope,period,kind)
);
alter table public.orbis_maps_usage enable row level security;
revoke all on public.orbis_maps_usage from public, anon, authenticated;
grant select,insert,update on public.orbis_maps_usage to service_role;
create or replace function public.orbis_reserve_maps_call(p_sub text,p_kind text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare month_key text:=to_char(now() at time zone 'UTC','YYYY-MM');
 day_key text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');
 monthly integer; daily integer; total integer; personal integer;
begin
 if p_kind not in ('routes','places') or p_sub is null or length(p_sub)>250 then return false; end if;
 monthly:=case when p_kind='routes' then 500 else 300 end;
 daily:=case when p_kind='routes' then 60 else 15 end;
 -- Serialize all reservations of this SKU, including requests on different Edge instances.
 perform pg_advisory_xact_lock(hashtext('orbis-google-'||p_kind));
 select calls into total from public.orbis_maps_usage where scope='global' and period=month_key and kind=p_kind;
 select calls into personal from public.orbis_maps_usage where scope='user:'||p_sub and period=day_key and kind=p_kind;
 if coalesce(total,0)>=monthly or coalesce(personal,0)>=daily then return false; end if;
 insert into public.orbis_maps_usage(scope,period,kind,calls) values('global',month_key,p_kind,1)
 on conflict(scope,period,kind) do update set calls=public.orbis_maps_usage.calls+1;
 insert into public.orbis_maps_usage(scope,period,kind,calls) values('user:'||p_sub,day_key,p_kind,1)
 on conflict(scope,period,kind) do update set calls=public.orbis_maps_usage.calls+1;
 return true;
end; $$;
revoke all on function public.orbis_reserve_maps_call(text,text) from public, anon, authenticated;
grant execute on function public.orbis_reserve_maps_call(text,text) to service_role;
