// icc-admin-reset: one-off maintenance — wipe all chat data for a clean slate,
// keeping only the founding chat (emptied). Protected by a fixed owner id.
import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

const OWNER_ID = 'a4069912-2c8a-49f3-96d6-047d2adf8b2d';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { admin_user_id } = await req.json();
    if (admin_user_id !== OWNER_ID) return json({ error: 'forbidden' }, 403);
    const sb = adminClient();

    const nonEmpty = '00000000-0000-0000-0000-000000000000';
    await sb.from('icc_pixels').delete().neq('id', nonEmpty);
    await sb.from('icc_votes').delete().neq('id', nonEmpty);
    await sb.from('icc_ideas').delete().neq('id', nonEmpty);
    await sb.from('icc_messages').delete().neq('id', nonEmpty);
    await sb.from('icc_profiles').delete().neq('chat_id', nonEmpty);
    // Remove test challenges; keep the founding fire.
    await sb.from('icc_chats').delete().neq('short_code', 'FOUND1');
    // Reset the founding chat's counter.
    await sb.from('icc_chats').update({ participant_count: 0, current_goal: null })
      .eq('short_code', 'FOUND1');

    const { count: profiles } = await sb.from('icc_profiles').select('*', { count: 'exact', head: true });
    const { count: messages } = await sb.from('icc_messages').select('*', { count: 'exact', head: true });
    const { count: chats } = await sb.from('icc_chats').select('*', { count: 'exact', head: true });
    return json({ ok: true, remaining: { profiles, messages, chats } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
