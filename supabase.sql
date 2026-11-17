-- Einmalig im Supabase SQL Editor ausführen.
-- Die Tabellen sind für den öffentlichen Schlüssel gesperrt.
-- Lesen und Schreiben geht nur über die zwei Funktionen und nur mit dem richtigen Reisecode.

create table if not exists sc_trips (
  code text primary key,
  created_at timestamptz not null default now()
);

create table if not exists sc_items (
  trip text not null references sc_trips(code) on delete cascade,
  id text not null,
  data jsonb,
  ts bigint not null,
  deleted boolean not null default false,
  server_at timestamptz not null default clock_timestamp(),
  primary key (trip, id)
);

alter table sc_trips enable row level security;
alter table sc_items enable row level security;
revoke all on sc_trips, sc_items from anon, authenticated;

create or replace function sc_pull(p_code text, p_since timestamptz)
returns table (id text, data jsonb, ts bigint, deleted boolean, server_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sc_trips t where t.code = p_code) then
    raise exception 'unknown trip';
  end if;
  return query
    select i.id, i.data, i.ts, i.deleted, i.server_at
    from sc_items i
    where i.trip = p_code and i.server_at > p_since - interval '10 seconds';
end $$;

create or replace function sc_push(p_code text, p_items jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare it jsonb; n integer := 0;
begin
  if not exists (select 1 from sc_trips t where t.code = p_code) then
    raise exception 'unknown trip';
  end if;
  if jsonb_array_length(p_items) > 1000 then
    raise exception 'too many items';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into sc_items as s (trip, id, data, ts, deleted, server_at)
    values (p_code, it->>'id', it->'data', (it->>'ts')::bigint, coalesce((it->>'deleted')::boolean, false), clock_timestamp())
    on conflict (trip, id) do update
      set data = excluded.data, ts = excluded.ts, deleted = excluded.deleted, server_at = clock_timestamp()
      where s.ts < excluded.ts;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function sc_pull(text, timestamptz) from public;
revoke all on function sc_push(text, jsonb) from public;
grant execute on function sc_pull(text, timestamptz) to anon;
grant execute on function sc_push(text, jsonb) to anon;

-- Euren geheimen Reisecode eintragen (lang und zufällig, nirgends öffentlich posten):
insert into sc_trips (code) values ('HIER_EUER_REISECODE') on conflict do nothing;
