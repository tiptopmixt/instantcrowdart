-- ============================================================================
-- Referral "crew": track who recruited each participant.
-- Run this once in the SQL Editor. Safe to re-run.
-- The app degrades gracefully if this isn't applied (crew count just shows 0).
-- ============================================================================

alter table public.icc_profiles
  add column if not exists referrer_id uuid,
  add column if not exists position   text,   -- chosen role in the company
  add column if not exists trait      text;   -- strong positive characteristic

create index if not exists icc_profiles_referrer_idx
  on public.icc_profiles(chat_id, referrer_id);

-- No policy change needed: users already update their own profile row
-- (icc_profiles_update: user_id = auth.uid()) and read profiles of chats they
-- joined (icc_profiles_select: membership), which is enough to count their crew.
