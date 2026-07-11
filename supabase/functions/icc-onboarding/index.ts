// icc-onboarding: private 1-to-1 AI mini-dialog on join (2-3 exchanges).
// First AI message in English, then it detects and switches to the user's language.
// On completion: saves summary + language to icc_profiles and posts a short group welcome.
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient, postAiMessage } from '../_shared/supabase.ts';

interface Turn { role: 'user' | 'assistant'; content: string; }
interface Body { chat_id: string; user_id: string; nickname: string; history: Turn[]; }

interface OnbResult {
  reply: string;          // shown to the user, in their language after turn 1
  language: string;       // detected ISO code (e.g. 'it','en')
  done: boolean;          // true when we have enough to finish
  summary: string;        // English summary of what they shared
  group_intro: string;    // short public intro (only agreed-to details)
}

const SYSTEM = `You are the friendly onboarding facilitator of InstantCrowdChat, a 24-hour anonymous
group chat where strangers turn a shared idea into something real. No money is ever involved —
people only "bet" an idea they are ready to risk.

Run a SHORT private intro: at most 2-3 exchanges. Ask, briefly and warmly:
1) their hobbies/interests, 2) what they want to bring to the group, 3) which idea they are ready to "bet".
Your VERY FIRST message must be in English. From the user's first reply, DETECT their language and
switch to it for all later replies. Keep replies to 1-2 sentences. Protect anonymity: never ask for
real name, phone, email or location.

Always respond with ONLY a JSON object, no prose, with keys:
"reply" (string, your next message to the user, in the right language),
"language" (best-guess ISO code of the user's language; "en" if unknown/first turn),
"done" (boolean: true once you have their interests + an idea, or after 3 user replies),
"summary" (English one-paragraph summary of what they shared; "" until done),
"group_intro" (a short public sentence introducing the newcomer using ONLY what they agreed to share, in English; "" until done).`;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { chat_id, user_id, nickname, history = [] } = (await req.json()) as Body;
    if (!chat_id || !user_id) return json({ error: 'missing chat_id/user_id' }, 400);

    // Count user turns to nudge completion.
    const userTurns = history.filter((h) => h.role === 'user').length;
    const messages = history.length
      ? history
      : [{ role: 'user' as const, content: '(user just joined — greet them and begin)' }];

    let result: OnbResult;
    try {
      result = await anthropicJSON<OnbResult>({
        model: MODEL_SMART,
        system: SYSTEM + (userTurns >= 3 ? '\n\nThe user has replied 3 times: set done=true now.' : ''),
        messages,
        max_tokens: 400,
        temperature: 0.6,
      });
    } catch (_e) {
      return json({ reply: 'The assistant is busy — please try again in a moment.', language: 'en', done: false });
    }

    if (result.done) {
      const sb = adminClient();
      await sb.from('icc_profiles').upsert({
        user_id,
        chat_id,
        nickname,
        onboarding_summary: result.summary || null,
        language: result.language || 'en',
      }, { onConflict: 'user_id,chat_id' });

      // Bump participant count to reflect the new member.
      await sb.from('icc_chats').update({
        participant_count: await countParticipants(sb, chat_id),
      }).eq('id', chat_id);

      if (result.group_intro) {
        await postAiMessage(sb, chat_id, `👋 ${result.group_intro}`);
      }
    }

    return json({
      reply: result.reply,
      language: result.language || 'en',
      done: !!result.done,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function countParticipants(sb: ReturnType<typeof adminClient>, chatId: string): Promise<number> {
  const { count } = await sb.from('icc_profiles').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
  return count ?? 0;
}
