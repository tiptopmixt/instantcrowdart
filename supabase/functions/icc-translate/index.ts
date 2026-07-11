// icc-translate: translate a single message into the requesting user's language.
// Result is returned ONLY to that user (never broadcast). Uses claude-haiku-4-5.
import { preflight, json } from '../_shared/cors.ts';
import { anthropic, MODEL_FAST } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/supabase.ts';

interface Body { message: string; user_id: string; target_lang?: string; }

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { message, user_id, target_lang } = (await req.json()) as Body;
    if (!message || !user_id) return json({ error: 'missing message/user_id' }, 400);

    let lang = target_lang;
    if (!lang) {
      const sb = adminClient();
      const { data } = await sb.from('icc_profiles')
        .select('language').eq('user_id', user_id)
        .order('joined_at', { ascending: false }).limit(1).maybeSingle();
      lang = data?.language || 'en';
    }

    const translation = await anthropic({
      model: MODEL_FAST,
      system: `Translate the user's message into the language with code "${lang}". `
        + `Output ONLY the translation, no quotes, no notes. Preserve tone and emojis.`,
      messages: [{ role: 'user', content: message }],
      max_tokens: 400,
      temperature: 0.2,
    });

    return json({ translation, language: lang });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
