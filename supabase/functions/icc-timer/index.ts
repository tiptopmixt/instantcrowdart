// icc-timer: (re)start the 24h countdown. Called when a NEW user joins, so the
// canvas stays alive as long as fresh people keep arriving. Keeps status 'founding'
// so the hourly cron never auto-deletes it.
import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { chat_id } = await req.json();
    if (!chat_id) return json({ error: 'missing chat_id' }, 400);
    const sb = adminClient();
    const expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await sb.from('icc_chats').update({ expires_at }).eq('id', chat_id);
    return json({ ok: true, expires_at });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
