// icc-moderate: called before every message insert (claude-haiku-4-5).
// Checks insults, spam and personal data (phone, email, real names, addresses) in ANY language.
// Returns approved/rejected (+ reason in the user's language). Increments violations on reject;
// blocks the user at 3 violations. On rate-limit exhaustion returns status "queued" (never drops).
import { preflight, json } from '../_shared/cors.ts';
import { anthropicJSON, MODEL_FAST, RateLimited } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/supabase.ts';

interface Body { chat_id: string; user_id: string; content: string; nickname?: string; }
interface ModResult { approved: boolean; category: string; reason: string; }

const SYSTEM = `You are a strict but fair moderator for an anonymous group chat. Protect anonymity and safety.
REJECT a message if it contains any of:
- insults, harassment, hate speech, threats;
- spam, scams, repeated advertising, unsolicited links to sell things;
- personal data that breaks anonymity: phone numbers, email addresses, physical/postal addresses,
  or a real full name (first + last) presented as someone's identity.
Normal first-name-only nicknames and general discussion are fine. Work in ANY language.
Respond with ONLY a JSON object: {"approved": boolean, "category": short-tag, "reason": string}.
CRITICAL: the "reason" field MUST be written ENTIRELY in the user's own language (the language
code given below), no matter what language the message itself is in. Do not use English unless the
code is "en". User's language code: `;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const { chat_id, user_id, content } = (await req.json()) as Body;
    if (!chat_id || !user_id || !content) return json({ error: 'missing fields' }, 400);

    const sb = adminClient();

    // Load profile for language + current violations / block state.
    const { data: profile } = await sb
      .from('icc_profiles')
      .select('language, violations')
      .eq('chat_id', chat_id).eq('user_id', user_id)
      .maybeSingle();

    const lang = profile?.language || 'en';
    if ((profile?.violations ?? 0) >= 3) {
      return json({ status: 'rejected', blocked: true, reason: 'You are blocked from this chat.' });
    }

    let result: ModResult;
    try {
      result = await anthropicJSON<ModResult>({
        model: MODEL_FAST,
        system: SYSTEM + lang,
        messages: [{ role: 'user', content }],
        max_tokens: 200,
        temperature: 0,
      });
    } catch (e) {
      // Rate-limited after retries (or transient failure): hold the message, never drop it.
      if (e instanceof RateLimited) return json({ status: 'queued' });
      return json({ status: 'queued' }); // treat other transient errors as queued too
    }

    if (result.approved) {
      return json({ status: 'approved' });
    }

    // Rejected -> increment violations, maybe block.
    const newViolations = (profile?.violations ?? 0) + 1;
    await sb.from('icc_profiles')
      .update({ violations: newViolations })
      .eq('chat_id', chat_id).eq('user_id', user_id);

    return json({
      status: 'rejected',
      reason: result.reason || 'Message not allowed.',
      category: result.category || 'policy',
      violations: newViolations,
      blocked: newViolations >= 3,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
