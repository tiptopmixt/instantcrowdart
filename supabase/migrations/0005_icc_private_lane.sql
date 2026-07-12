-- ============================================================================
-- Private lane model: each user talks ONLY with the AI assistant.
-- Left pane = private thread (own messages + AI replies addressed to you).
-- Right board = the collective picture (pinned recaps, org chart) everyone sees.
-- Run once in the SQL Editor. Safe to re-run.
-- ============================================================================

-- AI replies can now be addressed to a single user.
alter table public.icc_messages
  add column if not exists recipient_id uuid;

-- Read policy: you see YOUR OWN messages, AI messages addressed TO YOU,
-- and global AI messages (recipient_id null: recaps, announcements).
-- Other users' raw messages are no longer readable — real privacy, not client-side.
drop policy if exists icc_messages_select on public.icc_messages;
create policy icc_messages_select on public.icc_messages
  for select to authenticated using (
    public.icc_is_member(chat_id)
    and (
      user_id = auth.uid()
      or (is_ai and (recipient_id is null or recipient_id = auth.uid()))
    )
  );
