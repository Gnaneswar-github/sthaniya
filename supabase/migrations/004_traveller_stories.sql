-- Nativa: traveller stories. Anyone can share; nothing is public until the admin approves it.

create table if not exists public.stories (
  id uuid primary key,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  realm text not null default 'earth' check (realm in ('earth', 'beyond')),
  place text not null check (char_length(place) between 2 and 120),
  travelled_on text check (travelled_on is null or char_length(travelled_on) <= 40),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 20 and 4000),
  places jsonb not null default '[]'::jsonb check (jsonb_typeof(places) = 'array' and jsonb_array_length(places) <= 12),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6),
  author_name text not null check (char_length(author_name) between 1 and 60),
  author_email text check (author_email is null or (char_length(author_email) <= 254 and author_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  consent boolean not null check (consent),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  reviewed_at timestamptz,
  user_id uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists stories_status_idx on public.stories (status, created_at desc);

alter table public.stories enable row level security;

drop policy if exists "anyone can share a story" on public.stories;
create policy "anyone can share a story" on public.stories
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and decline_reason is null
    and (user_id is null or user_id = auth.uid())
    -- Photos may only point at this story's own upload folder.
    and not exists (
      select 1 from jsonb_array_elements_text(photos) as p(path)
      where p.path not like ('stories/' || id::text || '/%')
    )
  );

drop policy if exists "admin reads stories" on public.stories;
create policy "admin reads stories" on public.stories for select to authenticated using (public.is_app_admin());
drop policy if exists "admin reviews stories" on public.stories;
create policy "admin reviews stories" on public.stories for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin deletes stories" on public.stories;
create policy "admin deletes stories" on public.stories for delete to authenticated using (public.is_app_admin());

-- The public only ever sees approved stories, and never the author's email or review notes.
create or replace view public.published_stories as
  select id, created_at, realm, place, travelled_on, title, body, places, photos, author_name
  from public.stories
  where status = 'approved';
grant select on public.published_stories to anon, authenticated;

-- Is this photo part of an approved story? Used by storage policies, which can't read the table directly.
create or replace function public.story_photo_published(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from stories s where s.status = 'approved' and s.photos ? object_name);
$$;
revoke all on function public.story_photo_published(text) from public;
grant execute on function public.story_photo_published(text) to anon, authenticated;

-- Private bucket: photos are served through short-lived signed links, and only once approved.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-photos', 'story-photos', false, 6000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone uploads story photos" on storage.objects;
create policy "anyone uploads story photos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'story-photos' and (storage.foldername(name))[1] = 'stories' and array_length(storage.foldername(name), 1) = 2);

drop policy if exists "published story photos are readable" on storage.objects;
create policy "published story photos are readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'story-photos' and public.story_photo_published(name));

drop policy if exists "admin reads story photos" on storage.objects;
create policy "admin reads story photos" on storage.objects
  for select to authenticated using (bucket_id = 'story-photos' and public.is_app_admin());

drop policy if exists "admin deletes story photos" on storage.objects;
create policy "admin deletes story photos" on storage.objects
  for delete to authenticated using (bucket_id = 'story-photos' and public.is_app_admin());
