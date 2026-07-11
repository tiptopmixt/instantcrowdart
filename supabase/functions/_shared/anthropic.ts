// Anthropic API helper with exponential-backoff retry on rate limits (429/529).
// The key lives ONLY in the edge-function secret ANTHROPIC_API_KEY.

// Model IDs per project spec. Update here if Anthropic changes ids.
export const MODEL_FAST = 'claude-haiku-4-5';   // moderation, translation
export const MODEL_SMART = 'claude-sonnet-4-6';  // onboarding, recaps, feedback

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicMsg { role: 'user' | 'assistant'; content: string; }

export class RateLimited extends Error {}

interface CallOpts {
  model: string;
  system?: string;
  messages: AnthropicMsg[];
  max_tokens?: number;
  temperature?: number;
  maxRetries?: number;
}

// Returns the assistant text. Throws RateLimited if still limited after retries.
export async function anthropic(opts: CallOpts): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const maxRetries = opts.maxRetries ?? 4;
  let attempt = 0;

  while (true) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.max_tokens ?? 512,
        temperature: opts.temperature ?? 0.5,
        system: opts.system,
        messages: opts.messages,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data?.content?.[0]?.text ?? '').trim();
    }

    // Rate limit / overloaded -> exponential backoff with jitter.
    if ((res.status === 429 || res.status === 529) && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      const backoff = retryAfter > 0
        ? retryAfter * 1000
        : Math.min(500 * 2 ** attempt, 8000) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, backoff));
      attempt++;
      continue;
    }

    if (res.status === 429 || res.status === 529) throw new RateLimited('rate limited');

    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
}

// Convenience: ask the model to return strict JSON and parse it.
export async function anthropicJSON<T>(opts: CallOpts): Promise<T> {
  const text = await anthropic(opts);
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
