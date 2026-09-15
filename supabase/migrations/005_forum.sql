-- Nativa: forum. Travellers ask questions and answer them; stories gain a region and topics.
-- Like stories, nothing is public until the admin approves it.

create or replace function public.forum_region_ok(value text) returns boolean
language sql immutable as $$
  select value in ('asia', 'europe', 'africa', 'middle-east', 'north-america', 'latin-america', 'caribbean', 'oceania', 'beyond')
$$;

create or replace function public.forum_themes_ok(value text[]) returns boolean
language sql immutable as $$
  select cardinality(value) <= 3
    and value <@ array['solo', 'couples', 'family', 'food', 'budget', 'trains', 'outdoors', 'culture', 'pets', 'accessible', 'first-trip', 'gear']::text[]
$$;

-- Stories: where in the world, and what kind of trip.
alter table public.stories add column if not exists region text check (region is null or public.forum_region_ok(region));
alter table public.stories add column if not exists themes text[] not null default '{}' check (public.forum_themes_ok(themes));

create or replace view public.published_stories as
  select id, created_at, realm, place, travelled_on, title, body, places, photos, author_name, region, themes
  from public.stories
  where status = 'approved';
grant select on public.published_stories to anon, authenticated;

-- Questions.
create table if not exists public.forum_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  region text not null check (public.forum_region_ok(region)),
  themes text[] not null default '{}' check (public.forum_themes_ok(themes)),
  place text check (place is null or char_length(place) between 2 and 120),
  title text not null check (char_length(title) between 8 and 160),
  body text not null default '' check (char_length(body) <= 3000),
  author_name text not null check (char_length(author_name) between 1 and 60),
  author_email text check (author_email is null or (char_length(author_email) <= 254 and author_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  reviewed_at timestamptz,
  user_id uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists forum_questions_status_idx on public.forum_questions (status, created_at desc);
alter table public.forum_questions enable row level security;

drop policy if exists "anyone can ask" on public.forum_questions;
create policy "anyone can ask" on public.forum_questions
  for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and decline_reason is null and (user_id is null or user_id = auth.uid()));
drop policy if exists "admin reads questions" on public.forum_questions;
create policy "admin reads questions" on public.forum_questions for select to authenticated using (public.is_app_admin());
drop policy if exists "admin reviews questions" on public.forum_questions;
create policy "admin reviews questions" on public.forum_questions for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin deletes questions" on public.forum_questions;
create policy "admin deletes questions" on public.forum_questions for delete to authenticated using (public.is_app_admin());

-- Replies.
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  question_id uuid not null references public.forum_questions (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 3000),
  been_there boolean not null default false,
  author_name text not null check (char_length(author_name) between 1 and 60),
  author_email text check (author_email is null or (char_length(author_email) <= 254 and author_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  reviewed_at timestamptz,
  user_id uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists forum_replies_question_idx on public.forum_replies (question_id, status, created_at);
alter table public.forum_replies enable row level security;

-- Replies may only be added to a published question. Visitors can't read the questions table, so ask a definer function.
create or replace function public.forum_question_open(question uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from forum_questions q where q.id = question and q.status = 'approved');
$$;
revoke all on function public.forum_question_open(uuid) from public;
grant execute on function public.forum_question_open(uuid) to anon, authenticated;

drop policy if exists "anyone can reply" on public.forum_replies;
create policy "anyone can reply" on public.forum_replies
  for insert to anon, authenticated
  with check (
    status = 'pending' and reviewed_at is null and decline_reason is null
    and (user_id is null or user_id = auth.uid())
    and public.forum_question_open(question_id)
  );
drop policy if exists "admin reads replies" on public.forum_replies;
create policy "admin reads replies" on public.forum_replies for select to authenticated using (public.is_app_admin());
drop policy if exists "admin reviews replies" on public.forum_replies;
create policy "admin reviews replies" on public.forum_replies for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin deletes replies" on public.forum_replies;
create policy "admin deletes replies" on public.forum_replies for delete to authenticated using (public.is_app_admin());

-- What the public sees: approved posts only, never emails or review notes.
create or replace view public.published_questions as
  select q.id, q.created_at, q.region, q.themes, q.place, q.title, q.body, q.author_name,
    (select count(*) from public.forum_replies r where r.question_id = q.id and r.status = 'approved')::int as reply_count,
    (select max(r.created_at) from public.forum_replies r where r.question_id = q.id and r.status = 'approved') as last_reply_at
  from public.forum_questions q
  where q.status = 'approved';
grant select on public.published_questions to anon, authenticated;

create or replace view public.published_replies as
  select id, created_at, question_id, body, been_there, author_name
  from public.forum_replies
  where status = 'approved';
grant select on public.published_replies to anon, authenticated;
