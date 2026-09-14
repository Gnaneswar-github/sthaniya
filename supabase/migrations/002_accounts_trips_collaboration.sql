-- Nativa: accounts, trips synced across devices, and planning together.
-- Run once in the Supabase SQL editor. Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "people edit their own profile" on public.profiles;
create policy "people edit their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- trips
create table if not exists public.trips (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null,
  data         jsonb not null,
  pool         jsonb not null default '[]'::jsonb,
  meta         jsonb,
  -- Anyone holding this code can join as a collaborator; the owner can rotate it.
  invite_code  text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists trips_owner_idx on public.trips (owner_id, updated_at desc);

create table if not exists public.trip_members (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_members_user_idx on public.trip_members (user_id);

create table if not exists public.trip_votes (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  place_id    text not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, place_id, user_id)
);

-- Membership check used by every policy. Security definer so policies on trip_members don't
-- recurse into themselves.
create or replace function public.is_trip_member(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from trips where id = target and owner_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = target and user_id = auth.uid());
$$;

create or replace function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_trip_created on public.trips;
create trigger on_trip_created after insert on public.trips
  for each row execute function public.add_owner_membership();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

-- Join a trip from an invite link. The only way to become a member other than creating a trip.
create or replace function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join this trip';
  end if;
  select id into target from trips where invite_code = code;
  if target is null then
    raise exception 'This invite link is no longer valid';
  end if;
  insert into trip_members (trip_id, user_id, role) values (target, auth.uid(), 'editor')
  on conflict do nothing;
  return target;
end;
$$;

revoke all on function public.join_trip(text) from public;
grant execute on function public.join_trip(text) to authenticated;

-- ------------------------------------------------------------------ policies
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_votes enable row level security;

drop policy if exists "members read trips" on public.trips;
create policy "members read trips" on public.trips
  for select to authenticated using (public.is_trip_member(id));

drop policy if exists "people create their own trips" on public.trips;
create policy "people create their own trips" on public.trips
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "members edit trips" on public.trips;
create policy "members edit trips" on public.trips
  for update to authenticated using (public.is_trip_member(id)) with check (public.is_trip_member(id));

drop policy if exists "owners delete trips" on public.trips;
create policy "owners delete trips" on public.trips
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members see who else is on the trip" on public.trip_members;
create policy "members see who else is on the trip" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "people leave trips, owners remove people" on public.trip_members;
create policy "people leave trips, owners remove people" on public.trip_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

drop policy if exists "members read votes" on public.trip_votes;
create policy "members read votes" on public.trip_votes
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "members cast their own votes" on public.trip_votes;
create policy "members cast their own votes" on public.trip_votes
  for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "people change their own votes" on public.trip_votes;
create policy "people change their own votes" on public.trip_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "people withdraw their own votes" on public.trip_votes;
create policy "people withdraw their own votes" on public.trip_votes
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ realtime
-- Collaborators see each other's edits and votes live.
do $$
begin
  begin alter publication supabase_realtime add table public.trips; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trip_votes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trip_members; exception when duplicate_object then null; end;
end;
$$;
