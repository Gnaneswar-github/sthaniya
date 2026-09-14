-- Nativa: visitor feedback, readable only by the site admin.

create table if not exists public.app_admins (
  email text primary key
);
-- No policies: nobody can read or change the admin list through the API.
alter table public.app_admins enable row level security;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated;

insert into public.app_admins (email) values ('gnaneswarparameshwaran@gmail.com') on conflict do nothing;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feeling smallint check (feeling between 1 and 5),
  topic text not null check (topic in ('idea', 'bug', 'love', 'other')),
  message text not null check (char_length(message) between 3 and 1000),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  page text check (page is null or char_length(page) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'done'))
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback
  for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = auth.uid()));

drop policy if exists "admin reads feedback" on public.feedback;
create policy "admin reads feedback" on public.feedback
  for select to authenticated using (public.is_app_admin());

drop policy if exists "admin updates feedback" on public.feedback;
create policy "admin updates feedback" on public.feedback
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admin deletes feedback" on public.feedback;
create policy "admin deletes feedback" on public.feedback
  for delete to authenticated using (public.is_app_admin());
