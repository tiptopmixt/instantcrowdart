// icc-close-chat: end-of-challenge lifecycle.
//  Phase 1 (status active/extended, expired): post final recap, open final rating vote,
//          set status='closed' and a 1h rating window.
//  Phase 2 (status closed, window elapsed): tally ratings. avg>=8 with >=5 voters
//          -> save to Hall of Fame, promote top ideas to 'adopted', then purge the chat.
//          Otherwise -> delete all chat data ("the experiment is over").
//  action 'start_new' (admin only): create a fresh 24h challenge (optionally from a HoF entry).
import { preflight, json } from '../_shared/cors.ts';
import { anthropic, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient, postAiMessage } from '../_shared/supabase.ts';

// Keep in sync with js/config.js ADMIN_USER_ID.
const ADMIN_USER_ID = '0daa4226-a50a-4913-b14f-acc1ede94ea9';
const RATING_WINDOW_MS = 60 * 60 * 1000; // 1h to collect final ratings
const HOF_MIN_VOTERS = 5;
const HOF_MIN_AVG = 8;

interface Body {
  chat_id?: string; action?: string; admin_user_id?: string;
  from_hof_id?: string; duration_minutes?: number; minutes?: number;
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const body = (await req.json()) as Body;
    const sb = adminClient();

    // --- Admin-only actions (test the flow, reset the timer) ---
    if (body.action === 'start_new') {
      if (body.admin_user_id !== ADMIN_USER_ID) return json({ error: 'forbidden' }, 403);
      return await startNew(sb, body.from_hof_id, body.duration_minutes);
    }
    if (body.action === 'set_timer') {
      if (body.admin_user_id !== ADMIN_USER_ID) return json({ error: 'forbidden' }, 403);
      return await setTimer(sb, body.chat_id, body.minutes ?? 1440);
    }
    if (body.action === 'force_close') {
      if (body.admin_user_id !== ADMIN_USER_ID) return json({ error: 'forbidden' }, 403);
      const { data: c } = await sb.from('icc_chats').select('*').eq('id', body.chat_id).maybeSingle();
      if (!c) return json({ error: 'chat not found' }, 404);
      return await phaseClose(sb, c);
    }

    if (!body.chat_id) return json({ error: 'missing chat_id' }, 400);
    const { data: chat } = await sb.from('icc_chats').select('*').eq('id', body.chat_id).maybeSingle();
    if (!chat) return json({ error: 'chat not found' }, 404);
    if (chat.status === 'founding') return json({ skipped: 'founding chat never auto-closes' });

    if (chat.status === 'active' || chat.status === 'extended') {
      return await phaseClose(sb, chat);
    }
    if (chat.status === 'closed') {
      return await phaseFinalize(sb, chat);
    }
    return json({ skipped: chat.status });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// --- Phase 1: final recap + open rating ---
async function phaseClose(sb: ReturnType<typeof adminClient>, chat: any) {
  const { data: recent } = await sb.from('icc_messages')
    .select('nickname, content, is_ai').eq('chat_id', chat.id)
    .order('created_at', { ascending: false }).limit(60);
  const convo = (recent ?? []).reverse().map((m) => `${m.is_ai ? 'AI' : m.nickname}: ${m.content}`).join('\n');

  let recap = 'The 24 hours are up. Thank you all for building together. ';
  try {
    recap = await anthropic({
      model: MODEL_SMART,
      system: `Write a warm final recap of this 24-hour challenge: what the group achieved, the shared idea,
who contributed. 4-6 sentences. Then invite everyone to rate the result 1-10.
Goal was: ${chat.current_goal || '(none set)'}.`,
      messages: [{ role: 'user', content: convo || '(quiet chat)' }],
      max_tokens: 500,
    });
  } catch (_e) { /* fall back to default recap */ }

  await postAiMessage(sb, chat.id, `🏁 ${recap}\n\n⭐ Rate the result from 1 to 10.`, true);
  await sb.from('icc_chats').update({
    status: 'closed',
    expires_at: new Date(Date.now() + RATING_WINDOW_MS).toISOString(),
  }).eq('id', chat.id);

  return json({ ok: true, phase: 'closed', rating_open: true });
}

// --- Phase 2: tally + Hall of Fame or delete ---
async function phaseFinalize(sb: ReturnType<typeof adminClient>, chat: any) {
  // Wait until the rating window has actually elapsed.
  if (chat.expires_at && new Date(chat.expires_at).getTime() > Date.now()) {
    return json({ waiting: true, until: chat.expires_at });
  }

  const { data: ratings } = await sb.from('icc_votes')
    .select('value').eq('chat_id', chat.id).eq('type', 'final_rating');
  const nums = (ratings ?? []).map((r) => Number(r.value)).filter((n) => n >= 1 && n <= 10);
  const voters = nums.length;
  const avg = voters ? nums.reduce((a, b) => a + b, 0) / voters : 0;
  const success = voters >= HOF_MIN_VOTERS && avg >= HOF_MIN_AVG;

  const { count: participants } = await sb.from('icc_profiles')
    .select('*', { count: 'exact', head: true }).eq('chat_id', chat.id);

  if (success) {
    let summary = chat.current_goal || chat.title;
    try {
      const { data: recent } = await sb.from('icc_messages')
        .select('content').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(40);
      summary = await anthropic({
        model: MODEL_SMART,
        system: 'In 2-3 sentences, summarize what this successful 24h challenge produced, for a Hall of Fame card.',
        messages: [{ role: 'user', content: (recent ?? []).map((m) => m.content).join('\n') }],
        max_tokens: 300,
      });
    } catch (_e) { /* keep fallback summary */ }

    await sb.from('icc_hall_of_fame').insert({
      title: chat.title,
      ai_summary: summary,
      participant_count: participants ?? 0,
      rating: Number(avg.toFixed(2)),
      achieved_goal: chat.current_goal || null,
    });

    // Promote the most-upvoted proposed ideas to 'adopted' (Co-creators Wall).
    const { data: topIdeas } = await sb.from('icc_ideas')
      .select('id, votes').eq('status', 'proposed').order('votes', { ascending: false }).limit(5);
    for (const it of topIdeas ?? []) {
      if ((it.votes ?? 0) > 0) await sb.from('icc_ideas').update({ status: 'adopted' }).eq('id', it.id);
    }
  }

  // Purge chat data either way (HoF + adopted ideas persist independently).
  await sb.from('icc_votes').delete().eq('chat_id', chat.id);
  await sb.from('icc_messages').delete().eq('chat_id', chat.id);
  await sb.from('icc_profiles').delete().eq('chat_id', chat.id);
  await sb.from('icc_chats').delete().eq('id', chat.id);

  return json({ ok: true, phase: 'finalized', success, voters, avg: Number(avg.toFixed(2)) });
}

// --- Admin: reset/shorten the timer of an existing chat (for testing) ---
async function setTimer(sb: ReturnType<typeof adminClient>, chatId: string | undefined, minutes: number) {
  if (!chatId) return json({ error: 'missing chat_id' }, 400);
  const expires_at = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  // Reactivate the chat so the timer is live (unless it is the founding chat).
  const { data: chat } = await sb.from('icc_chats').select('status').eq('id', chatId).maybeSingle();
  const status = chat?.status === 'founding' ? 'founding' : 'active';
  const { error } = await sb.from('icc_chats').update({ status, expires_at }).eq('id', chatId);
  if (error) return json({ error: String(error.message) }, 500);
  return json({ ok: true, expires_at, minutes });
}

// --- Admin: start a new challenge (default 24h; shorter for testing) ---
async function startNew(sb: ReturnType<typeof adminClient>, fromHofId?: string, durationMinutes?: number) {
  let title = 'New 24-hour challenge';
  let goal: string | null = null;
  if (fromHofId) {
    const { data: hof } = await sb.from('icc_hall_of_fame').select('*').eq('id', fromHofId).maybeSingle();
    if (hof) { title = `Next: ${hof.title}`; goal = hof.achieved_goal; }
  }
  const minutes = durationMinutes && durationMinutes > 0 ? durationMinutes : 1440;
  if (minutes < 1440) title = `TEST challenge (${minutes} min)`;

  const short_code = randomCode();
  const expires_at = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const { data, error } = await sb.from('icc_chats').insert({
    short_code, title, status: 'active', expires_at, current_goal: goal,
  }).select().maybeSingle();
  if (error) return json({ error: String(error.message) }, 500);

  await postAiMessage(sb, data.id,
    `⚡ A new 24-hour challenge begins! ${goal ? `Building on: ${goal}. ` : ''}`
    + `Everyone bets an idea — no money. What should we make real together?`, true);

  return json({ ok: true, short_code, chat_id: data.id });
}

function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
