-- ============================================================================
-- Enforce read-only after a challenge ends (server-side, not just in the UI).
-- Run this in the SQL Editor after 0001. Safe to run even if 0001 was already applied.
-- ============================================================================

-- True only while the chat is live: active/extended/founding AND not past expiry.
create or replace function public.icc_can_post(p_chat_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.icc_chats c
    where c.id = p_chat_id
      and c.status in ('active','extended','founding')
      and (c.expires_at is null or c.expires_at > now())
  );
$$;

-- Replace the message-insert policy to also require the chat to be live.
-- After 24h (or when closed) nobody can insert new messages — the chat is a read-only recap.
drop policy if exists icc_messages_insert on public.icc_messages;
create policy icc_messages_insert on public.icc_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_ai = false
    and public.icc_is_member(chat_id)
    and public.icc_can_post(chat_id)
  );

-- Voting stays allowed while the chat exists (final rating happens after close),
-- so icc_votes policies are intentionally left unchanged.
