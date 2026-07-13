// icc-feedback: mediates the "Improve this app" flow.
// The AI refines the user's idea in the user's language with 1-2 follow-up questions,
// repeats the pledge in their language, then saves to icc_ideas (idea_summary in English).
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/supabase.ts';

interface Turn { role: 'user' | 'assistant'; content: string; }
interface Body { user_id: string; nickname: string; history: Turn[]; ui_language?: string; }
interface FbResult {
  reply: string;
  language: string;
  done: boolean;
  idea_summary: string;    // English (stored)
  ai_evaluation: string;   // English, short
}

function systemFor(lang: string) {
  return `You collect the crowd's ideas for how to CHANGE or improve InstantCrowdArt — a shared,
anonymous 24-hour PIXEL CANVAS where everyone gets 10 pixels to draw one picture together, then it
vanishes. Speak the user's language from the VERY FIRST message. The user's chosen language code is
"${lang}" — reply in that language (unless the user clearly writes in another, then match it).
Greet briefly and warmly, invite their idea to change the game (new colors, rules, board size, modes,
mini-games…), ask at most 1-2 short follow-ups. When the idea is clear (after 1-2 user replies) set
done=true and write a crisp English "idea_summary" (one sentence) and a short English "ai_evaluation"
(is it fun/feasible, 1-2 sentences). Never invent names. Respond with ONLY JSON:
{"reply","language","done"(bool),"idea_summary","ai_evaluation"}.`;
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { user_id, nickname, history = [], ui_language } = (await req.json()) as Body;
    if (!user_id) return json({ error: 'missing user_id' }, 400);

    const userTurns = history.filter((h) => h.role === 'user').length;
    const messages = history.length
      ? history
      : [{ role: 'user' as const, content: '(user opened the feedback flow — greet and invite their idea to change the game)' }];

    const result = await anthropicJSON<FbResult>({
      model: MODEL_SMART,
      system: systemFor(ui_language || 'en') + (userTurns >= 2 ? '\n\nThe user has replied twice: set done=true now.' : ''),
      messages,
      max_tokens: 500,
      temperature: 0.6,
    });

    let saved = false;
    if (result.done && result.idea_summary) {
      const sb = adminClient();
      await sb.from('icc_ideas').insert({
        user_id,
        nickname,
        idea_summary: result.idea_summary,
        ai_evaluation: result.ai_evaluation || null,
        status: 'proposed',
      });
      saved = true;
    }

    return json({
      reply: result.reply,
      language: result.language || 'en',
      saved,
      confirmation: saved ? (result.idea_summary || 'Idea saved') : null,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
