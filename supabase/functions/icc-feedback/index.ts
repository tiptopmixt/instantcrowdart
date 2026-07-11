// icc-feedback: mediates the "Improve this app" flow.
// The AI refines the user's idea in the user's language with 1-2 follow-up questions,
// repeats the pledge in their language, then saves to icc_ideas (idea_summary in English).
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_SMART } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/supabase.ts';

interface Turn { role: 'user' | 'assistant'; content: string; }
interface Body { user_id: string; nickname: string; history: Turn[]; }
interface FbResult {
  reply: string;
  language: string;
  done: boolean;
  idea_summary: string;    // English
  ai_evaluation: string;   // English, short
}

const PLEDGE = `This is an experiment. If your idea is adopted, your contribution stays recognized `
  + `on the Co-creators Wall. If one day this project generates value, those who built it with us `
  + `will be the first to be involved. This is a goodwill statement, not a contract: it gives you `
  + `no rights, ownership or claim of any kind.`;

const SYSTEM = `You help users improve InstantCrowdChat. Refine the user's idea with at most 1-2 focused
follow-up questions, in the USER'S OWN LANGUAGE (detect it from their first message; first turn may be English).
Early in the flow, restate this pledge in the user's language: "${PLEDGE}"
When the idea is clear enough (after 1-2 user replies), set done=true, write a crisp English "idea_summary"
(one sentence) and a short English "ai_evaluation" (feasibility / value, 1-2 sentences).
Respond with ONLY JSON: {"reply","language","done"(bool),"idea_summary","ai_evaluation"}.`;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { user_id, nickname, history = [] } = (await req.json()) as Body;
    if (!user_id) return json({ error: 'missing user_id' }, 400);

    const userTurns = history.filter((h) => h.role === 'user').length;
    const messages = history.length
      ? history
      : [{ role: 'user' as const, content: '(user opened the Improve-this-app flow — greet and invite their idea)' }];

    const result = await anthropicJSON<FbResult>({
      model: MODEL_SMART,
      system: SYSTEM + (userTurns >= 2 ? '\n\nThe user has replied twice: set done=true now.' : ''),
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
