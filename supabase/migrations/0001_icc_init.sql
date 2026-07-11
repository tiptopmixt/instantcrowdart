-- ============================================================================
-- InstantCrowdChat schema. All tables prefixed icc_ to coexist with aicalendar.
-- Run this in the Supabase SQL Editor. RLS enabled on every table.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.icc_chats (
  id                uuid primary key default gen_random_uuid(),
  short_code        text unique not null,
  title             text not null,
  status            text not null default 'active'
                      check (status in ('active','extended','founding','closed')),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz,
  participant_count int not null default 0,
  current_goal      text
);

create table if not exists public.icc_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.icc_chats(id) on delete cascade,
  user_id    uuid,                       -- null for AI messages
  nickname   text,
  content    text not null,
  is_ai      boolean not null default false,
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists icc_messages_chat_idx on public.icc_messages(chat_id, created_at);

create table if not exists public.icc_profiles (
  user_id            uuid not null,
  chat_id            uuid not null references public.icc_chats(id) on delete cascade,
  nickname           text,
  onboarding_summary text,
  language           text,               -- detected language code (e.g. 'it','en')
  violations         int not null default 0,
  joined_at          timestamptz not null default now(),
  primary key (user_id, chat_id)
);
create index if not exists icc_profiles_chat_idx on public.icc_profiles(chat_id);

create table if not exists public.icc_votes (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.icc_chats(id) on delete cascade,
  type       text not null check (type in ('extend','goal','final_rating')),
  user_id    uuid not null,
  value      text not null,              -- 'yes'/'no' or '1'..'10'
  created_at timestamptz not null default now(),
  unique (chat_id, type, user_id)
);

create table if not exists public.icc_ideas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  nickname     text,
  idea_summary text not null,            -- stored in English for consistency
  ai_evaluation text,
  votes        int not null default 0,
  status       text not null default 'proposed'
                 check (status in ('proposed','adopted','rejected')),
  created_at   timestamptz not null default now()
);

create table if not exists public.icc_hall_of_fame (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  ai_summary        text,
  participant_count int,
  rating            numeric,
  achieved_goal     text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper: is the calling user a participant of a given chat?
-- ---------------------------------------------------------------------------
create or replace function public.icc_is_member(p_chat_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.icc_profiles
    where chat_id = p_chat_id and user_id = auth.uid()
  );
$$;

-- Safe upvote (SECURITY DEFINER so clients can't set arbitrary vote counts).
create or replace function public.icc_upvote_idea(p_idea_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.icc_ideas set votes = votes + 1 where id = p_idea_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.icc_chats        enable row level security;
alter table public.icc_messages     enable row level security;
alter table public.icc_profiles     enable row level security;
alter table public.icc_votes        enable row level security;
alter table public.icc_ideas        enable row level security;
alter table public.icc_hall_of_fame enable row level security;

-- chats: readable by any authenticated user; no client writes (edge fns use service role).
create policy icc_chats_select on public.icc_chats
  for select to authenticated using (true);

-- messages: read only chats you joined; insert only your own; no edits/deletes.
create policy icc_messages_select on public.icc_messages
  for select to authenticated using (public.icc_is_member(chat_id));
create policy icc_messages_insert on public.icc_messages
  for insert to authenticated
  with check (user_id = auth.uid() and is_ai = false and public.icc_is_member(chat_id));

-- profiles: read profiles of chats you joined; insert/update only your own row.
create policy icc_profiles_select on public.icc_profiles
  for select to authenticated using (public.icc_is_member(chat_id));
create policy icc_profiles_insert on public.icc_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy icc_profiles_update on public.icc_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- votes: read votes of your chats; insert/update only your own vote row.
create policy icc_votes_select on public.icc_votes
  for select to authenticated using (public.icc_is_member(chat_id));
create policy icc_votes_insert on public.icc_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy icc_votes_update on public.icc_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ideas: readable by all authenticated; insert your own; votes bumped via RPC only.
create policy icc_ideas_select on public.icc_ideas
  for select to authenticated using (true);
create policy icc_ideas_insert on public.icc_ideas
  for insert to authenticated with check (user_id = auth.uid());

-- hall of fame: public read; writes only via edge functions (service role).
create policy icc_hof_select on public.icc_hall_of_fame
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Realtime publication (so postgres_changes fire for messages)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.icc_messages;
alter publication supabase_realtime add table public.icc_votes;

-- ---------------------------------------------------------------------------
-- Seed: the founding challenge (meta: build this app together)
-- ---------------------------------------------------------------------------
insert into public.icc_chats (short_code, title, status, expires_at, current_goal)
values ('FOUND1', 'Let''s build InstantCrowdChat together', 'founding', null, null)
on conflict (short_code) do nothing;

-- Founding AI welcome message (English; the AI replies in each user's language).
insert into public.icc_messages (chat_id, user_id, nickname, content, is_ai, is_pinned)
select c.id, null, 'AI Facilitator',
  'Welcome ⚡ This whole app is a 24-hour experiment and a simple challenge. '
  || 'Everyone bets an idea — no money, ever. The creator bets first, with this very app. '
  || 'Let''s create something together that belongs to us: if it succeeds it lives on, '
  || 'if it''s useful to no one it shuts down. Propose features, criticize freely, and vote. '
  || 'I''ll speak your language — just write in it. What should we build first?',
  true, true
from public.icc_chats c
where c.short_code = 'FOUND1'
  and not exists (
    select 1 from public.icc_messages m where m.chat_id = c.id and m.is_ai = true
  );
