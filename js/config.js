// InstantCrowdChat — global configuration
// NOTE: Only the Supabase URL + anon (public) key belong in the frontend.
// The anon key is safe to expose (RLS protects data). The Anthropic key lives
// ONLY in Supabase Edge Function secrets and is never referenced here.

export const CONFIG = {
  // Supabase project (shared with the existing aicalendar app; ICC uses icc_* tables)
  SUPABASE_URL: 'https://vhwjygrokfvaydkufxqk.supabase.co',

  // anon/public key (same project as aicalendar; safe to expose — RLS protects data).
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod2p5Z3Jva2Z2YXlka3VmeHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQwOTcsImV4cCI6MjA5NTU4MDA5N30.t5Ba5AoKctOOkXm3EPkKFnkako7viT22wM0WpmhX09Y',

  // Hardcoded admin user id (Supabase auth uid) allowed to start a new challenge.
  // TODO: replace with your real anonymous/admin user id after first sign-in.
  // No in-app admin: everyone is equal. Challenges are managed server-side (CLI/API).
  ADMIN_USER_ID: '',

  // The founding chat short code (seeded in SQL).
  FOUNDING_CODE: 'FOUND1',

  // Google AdSense publisher id (placeholder — replace before going live).
  ADSENSE_PUB_ID: 'ca-pub-XXXXXXXX',

  // Recap cadence hints (client only triggers server checks; server owns the truth).
  SUMMARIZE_EVERY_MESSAGES: 15,
};

// Small helper: is the current session the admin?
export function isAdmin(userId) {
  return !!userId && userId === CONFIG.ADMIN_USER_ID;
}
