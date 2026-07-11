// icc-summarize: pinned recap generator (every ~15 messages or 2 hours).
// - stats_only=true  -> returns {msg_per_hour, ideas_per_hour} for the live pulse.
// - otherwise        -> posts a pinned recap in the group's dominant language (with a short
//   English version when mixed). Proposes a group goal + opens a goal vote when a shared
//   desire emerges; tallies open goal votes and adopts the goal at >=65% yes.
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient, postAiMessage } from '../_shared/supabase.ts';

interface Body { chat_id: string; stats_only?: boolean; }
interface RecapResult {
  dominant_language: string;
  mixed: boolean;
  recap: string;           // in dominant language
  recap_en: string;        // short English version (only when mixed)
  propose_goal: boolean;
  goal: string;            // English goal text when propose_goal
}

const GOAL_THRESHOLD = 0.65;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { chat_id, stats_only } = (await req.json()) as Body;
    if (!chat_id) return json({ error: 'missing chat_id' }, 400);
    const sb = adminClient();

    // Extension vote tally runs on every call (cheap, no AI).
    await tallyExtension(sb, chat_id);

    // --- Live stats (cheap; no AI) ---
    const sinceHour = new Date(Date.now() - 3600_000).toISOString();
    const { count: msgCount } = await sb.from('icc_messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chat_id).gte('created_at', sinceHour);
    const { count: ideaCount } = await sb.from('icc_ideas')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceHour);

    if (stats_only) {
      return json({ msg_per_hour: msgCount ?? 0, ideas_per_hour: ideaCount ?? 0 });
    }

    // --- Tally any open goal vote first ---
    const goalOutcome = await tallyGoal(sb, chat_id);

    // --- Build recap context ---
    const { data: chat } = await sb.from('icc_chats').select('*').eq('id', chat_id).maybeSingle();
    const { data: recent } = await sb.from('icc_messages')
      .select('nickname, content, is_ai')
      .eq('chat_id', chat_id).order('created_at', { ascending: false }).limit(40);
    const { data: profiles } = await sb.from('icc_profiles')
      .select('nickname, language, onboarding_summary').eq('chat_id', chat_id);

    const langs = (profiles ?? []).map((p) => p.language).filter(Boolean) as string[];
    const dominant = mode(langs) || 'en';
    const conversation = (recent ?? []).reverse()
      .map((m) => `${m.is_ai ? 'AI' : m.nickname}: ${m.content}`).join('\n');
    const intros = (profiles ?? [])
      .map((p) => `- ${p.nickname} (${p.language}): ${p.onboarding_summary ?? ''}`).join('\n');

    const hasGoal = !!chat?.current_goal;
    const system = `You are the facilitator of InstantCrowdChat writing a PINNED recap for the group.
Dominant language code: ${dominant}. Number of distinct languages: ${new Set(langs).size}.
${hasGoal
  ? `A group goal is already set: "${chat!.current_goal}". Write in COORDINATOR mode: who does what, concrete next steps, progress.`
  : `No goal yet. If a clear shared desire has emerged, propose it as the group goal and invite a vote.`}
Write the recap in the dominant language. If the group is mixed-language, also give a SHORT English version.
Be concise, warm, energetic. Cover: who is here, main topics, emerging common desires, current progress.
Respond with ONLY JSON: {"dominant_language","mixed"(bool),"recap","recap_en","propose_goal"(bool),"goal"}.`;

    const result = await anthropicJSON<RecapResult>({
      model: MODEL_SMART,
      system,
      messages: [{ role: 'user', content: `PARTICIPANTS:\n${intros}\n\nRECENT MESSAGES:\n${conversation}` }],
      max_tokens: 700,
      temperature: 0.5,
    });

    let body = result.recap;
    if (result.mixed && result.recap_en) body += `\n\n— EN —\n${result.recap_en}`;
    if (!hasGoal && result.propose_goal && result.goal) {
      body += `\n\nGOAL PROPOSAL: ${result.goal}\nVote 👍 to adopt it (needs 65%).`;
    }

    await postAiMessage(sb, chat_id, body, true);

    return json({ ok: true, dominant_language: dominant, goal_adopted: goalOutcome.adopted, goal: goalOutcome.goal });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const EXTEND_THRESHOLD = 0.65;

// Any participant can propose +24h. Passes at >=65% yes of participants, once per 24h period.
async function tallyExtension(sb: ReturnType<typeof adminClient>, chatId: string) {
  const { data: chat } = await sb.from('icc_chats')
    .select('status, expires_at').eq('id', chatId).maybeSingle();
  if (!chat || !['active', 'extended'].includes(chat.status)) return;

  const { data: votes } = await sb.from('icc_votes').select('value').eq('chat_id', chatId).eq('type', 'extend');
  if (!votes || !votes.length) return;
  const { count: participants } = await sb.from('icc_profiles')
    .select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
  const yes = votes.filter((v) => v.value === 'yes').length;
  const total = participants ?? votes.length;
  if (total > 0 && yes / total >= EXTEND_THRESHOLD) {
    const base = chat.expires_at ? new Date(chat.expires_at).getTime() : Date.now();
    const newExpiry = new Date(Math.max(base, Date.now()) + 24 * 3600 * 1000).toISOString();
    await sb.from('icc_chats').update({ status: 'extended', expires_at: newExpiry }).eq('id', chatId);
    // Clear the extend votes so it can only pass once per period.
    await sb.from('icc_votes').delete().eq('chat_id', chatId).eq('type', 'extend');
    await postAiMessage(sb, chatId, '⏳ The group voted to extend: +24 hours added. Keep going!');
  }
}

function mode(arr: string[]): string | null {
  if (!arr.length) return null;
  const m: Record<string, number> = {};
  let best = arr[0], bestN = 0;
  for (const x of arr) { m[x] = (m[x] || 0) + 1; if (m[x] > bestN) { bestN = m[x]; best = x; } }
  return best;
}

// If an open goal vote reaches >=65% yes of participants, adopt it into current_goal.
async function tallyGoal(sb: ReturnType<typeof adminClient>, chatId: string) {
  const { data: chat } = await sb.from('icc_chats').select('current_goal').eq('id', chatId).maybeSingle();
  if (chat?.current_goal) return { adopted: false, goal: chat.current_goal };

  const { data: votes } = await sb.from('icc_votes').select('value').eq('chat_id', chatId).eq('type', 'goal');
  if (!votes || !votes.length) return { adopted: false, goal: null };
  const { count: participants } = await sb.from('icc_profiles')
    .select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
  const yes = votes.filter((v) => v.value === 'yes').length;
  const total = participants ?? votes.length;
  if (total > 0 && yes / total >= GOAL_THRESHOLD) {
    // Extract the most recent proposed goal from the latest pinned recap.
    const { data: pinned } = await sb.from('icc_messages')
      .select('content').eq('chat_id', chatId).eq('is_pinned', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const m = pinned?.content?.match(/GOAL PROPOSAL:\s*(.+)/);
    const goal = m ? m[1].trim() : 'Shared group goal';
    await sb.from('icc_chats').update({ current_goal: goal }).eq('id', chatId);
    await postAiMessage(sb, chatId, `🎯 Goal adopted by vote: ${goal}. Let's coordinate!`);
    return { adopted: true, goal };
  }
  return { adopted: false, goal: null };
}
