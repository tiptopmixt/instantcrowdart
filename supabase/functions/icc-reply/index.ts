// icc-reply: the private AI assistant. Each user talks ONLY with the assistant in
// their own lane; the assistant gathers what they'd like to DO / CREATE / BECOME,
// saves it to their profile (shown on the shared board) and replies privately in
// their language. The collective picture emerges on the board via icc-summarize.
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient, postAiMessage } from '../_shared/supabase.ts';

interface Body { chat_id: string; user_id?: string; }
interface ReplyResult { reply: string; contribution: string; objective: string; }

const REACTION_RX = /^[\p{Emoji}\p{Emoji_Presentation}\s+1!.👍🔥😂❤️]+$/u;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { chat_id, user_id } = (await req.json()) as Body;
    if (!chat_id) return json({ error: 'missing chat_id' }, 400);
    const sb = adminClient();

    const { data: chat } = await sb.from('icc_chats')
      .select('title, status, current_goal').eq('id', chat_id).maybeSingle();
    if (!chat || chat.status === 'closed') return json({ skipped: 'closed' });

    // Load recent messages; keep only this user's private thread when we know them.
    let { data: recent, error: selErr } = await sb.from('icc_messages')
      .select('user_id, nickname, content, is_ai, is_pinned, recipient_id, created_at')
      .eq('chat_id', chat_id).order('created_at', { ascending: false }).limit(40);
    if (selErr) { // recipient_id column not there yet — degrade to global thread
      const r2 = await sb.from('icc_messages')
        .select('user_id, nickname, content, is_ai, is_pinned, created_at')
        .eq('chat_id', chat_id).order('created_at', { ascending: false }).limit(40);
      recent = (r2.data ?? []).map((m) => ({ ...m, recipient_id: null }));
    }
    let msgs = (recent ?? []).reverse().filter((m) => !m.is_pinned);
    if (user_id) {
      msgs = msgs.filter((m) => m.user_id === user_id
        || (m.is_ai && (m.recipient_id === user_id || m.recipient_id === null)));
    }
    const last = msgs[msgs.length - 1];
    if (!last || last.is_ai) return json({ skipped: 'no user message' });

    const text = String(last.content || '').trim();
    if (text.length < 2 || REACTION_RX.test(text)) return json({ skipped: 'reaction' });

    // Throttle: if the assistant answered in this lane in the last 8s, stay quiet.
    const lastAi = [...msgs].reverse().find((m) => m.is_ai);
    if (lastAi && Date.now() - new Date(lastAi.created_at).getTime() < 8_000) {
      return json({ skipped: 'throttled' });
    }

    const { data: profile } = user_id
      ? await sb.from('icc_profiles').select('language')
          .eq('chat_id', chat_id).eq('user_id', user_id).maybeSingle()
      : { data: null };
    const lang = profile?.language || 'en';

    // The shared creation so far: the ONE objective + the top contributions.
    const { count: people } = await sb.from('icc_profiles')
      .select('*', { count: 'exact', head: true }).eq('chat_id', chat_id);
    const { data: ideas } = await sb.from('icc_ideas')
      .select('idea_summary, votes').order('votes', { ascending: false }).limit(10);
    const contribs = (ideas ?? []).map((i) => `- ${i.idea_summary} (▲${i.votes ?? 0})`).join('\n')
      || '(none yet)';

    const transcript = msgs.slice(-12)
      .map((m) => `${m.is_ai ? 'ASSISTANT' : 'YOU'}: ${m.content}`).join('\n');

    const system = `You are the AI facilitator of "${chat.title}" — a fast, playful 24-hour experiment.
The whole crowd is anonymously shaping ONE shared thing together: a single common objective/idea that
mutates in real time as people contribute. It is fully ANONYMOUS (no names) and after 24 hours it
vanishes forever. Your job is NOT to chat idly — it is to actively BUILD this one shared thing WITH
the user: react, then push them to add ONE concrete piece (an idea, a twist, a name, a rule, a word),
or to sharpen the objective. Be concrete and activating, warm and energetic. If nothing exists yet,
spark it: propose a fun, doable direction (e.g. invent a collective slogan, a mini word-game, a name,
a simple product) and ask them to add the first piece. Invite them to share the link as a call for help.

CURRENT SHARED OBJECTIVE: ${chat.current_goal || 'NOT SET YET'}
CONTRIBUTIONS SO FAR:
${contribs}

Reply to the user in their language (code ${lang}; if their message is clearly another language, use
that). Address them only as "you", never a name. Keep it SHORT: 1-3 sentences.

Respond with ONLY JSON:
{"reply": "<your short private reply>",
 "contribution": "<one concrete piece the user just added to the shared thing, 2-12 words in their language, first letter capitalized; empty string if their message added nothing concrete>",
 "objective": "<propose/refine the ONE shared objective in <=12 words, only if it's not set yet or their message clearly sharpens it; otherwise empty string>"}`;

    const result = await anthropicJSON<ReplyResult>({
      model: MODEL_SMART,
      system,
      messages: [{ role: 'user', content: transcript }],
      max_tokens: 320,
      temperature: 0.7,
    });

    // Mutate the shared board: add the contribution, and set the objective if still empty.
    if (result.contribution && result.contribution.trim() && user_id) {
      await sb.from('icc_ideas').insert({
        user_id, nickname: 'anon',
        idea_summary: result.contribution.trim().slice(0, 90), status: 'proposed',
      });
    }
    if (result.objective && result.objective.trim() && !chat.current_goal) {
      await sb.from('icc_chats').update({ current_goal: result.objective.trim().slice(0, 120) })
        .eq('id', chat_id);
    }
    if (result.reply) await postAiMessage(sb, chat_id, result.reply, false, user_id ?? null);
    return json({ replied: !!result.reply, contribution: !!result.contribution, objective: !!result.objective });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
