// Service-role Supabase client for edge functions (bypasses RLS; server-only).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Post an AI message into a chat (server-side; bypasses the is_ai=false RLS check).
// recipientId targets a single user's private lane; null = global (recaps, announcements).
// Falls back to a global insert if the recipient_id column doesn't exist yet.
export async function postAiMessage(
  sb: ReturnType<typeof adminClient>,
  chatId: string,
  content: string,
  pinned = false,
  recipientId: string | null = null,
) {
  const row: Record<string, unknown> = {
    chat_id: chatId,
    user_id: null,
    nickname: 'AI Facilitator',
    content,
    is_ai: true,
    is_pinned: pinned,
  };
  if (recipientId) row.recipient_id = recipientId;
  let res = await sb.from('icc_messages').insert(row);
  if (res.error && recipientId) {
    delete row.recipient_id;
    res = await sb.from('icc_messages').insert(row);
  }
  return res;
}
