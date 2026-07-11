// Supabase client (v2) loaded from CDN ESM — no build step, GitHub Pages friendly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

export const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 5 } },
});

// Thin wrapper to call an edge function and always get { data, error }.
export async function callFn(name, body) {
  try {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}
