-- Sthānīya recommendation store.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists recommendations (
  id            text primary key,
  name          text        not null,
  destination   text        not null,
  tag           text        not null check (tag in ('tourist_essential', 'local_favourite', 'hidden_gem')),
  category      text        not null check (category in ('food','cafe','temple','sight','museum','market','outdoors')),
  price_band    text        not null check (price_band in ('free','low','mid','high')),
  duration_minutes int      not null,
  -- Null where OpenStreetMap had no trustworthy match; never filled with a guess.
  lat           double precision,
  lng           double precision,
  interests     text[]      not null default '{}',
  window_start  text        not null,
  window_end    text        not null,
  vibe          text        not null,
  description   text        not null,
  why_it_fits   jsonb       not null default '{}',
  evidence_source text      not null,
  -- A city shipping is gated on this being true for all of its rows (PRD §9).
  verified      boolean     not null default false,
  priority      int         not null default 5,
  created_at    timestamptz not null default now()
);

create index if not exists recommendations_destination_idx on recommendations (lower(destination));

alter table recommendations enable row level security;

-- The app reads with the publishable key and never writes; edits happen in the dashboard.
drop policy if exists "public read" on recommendations;
create policy "public read" on recommendations for select using (true);
