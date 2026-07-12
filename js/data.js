// Data-access helpers around Supabase tables (icc_*).
import { sb } from './supabase.js';
import { userId, nickname, position, trait } from './auth.js';

export async function getActiveChat() {
  // Prefer an active/extended/founding chat (there is only one at a time).
  const { data, error } = await sb
    .from('icc_chats')
    .select('*')
    .in('status', ['active', 'extended', 'founding'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { chat: data || null, error };
}

export async function getChatByCode(code) {
  const { data, error } = await sb
    .from('icc_chats')
    .select('*')
    .eq('short_code', code)
    .maybeSingle();
  return { chat: data || null, error };
}

export async function getMyProfile(chatId) {
  const { data } = await sb
    .from('icc_profiles')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId())
    .maybeSingle();
  return data || null;
}

// Insert a bare profile row so RLS lets the user read messages of this chat.
export async function joinChat(chatId, lang = null) {
  const row = {
    user_id: userId(),
    chat_id: chatId,
    nickname: nickname(),
    language: lang,
  };
  // Plain INSERT (no upsert): under RLS, ON CONFLICT needs the SELECT policy to
  // pass, but a brand-new user isn't a member yet → 403. If the row already
  // exists (double join), fall back to an UPDATE of our own row.
  const { error } = await sb.from('icc_profiles').insert(row);
  if (error && String(error.code) === '23505') {
    const { error: upErr } = await sb.from('icc_profiles')
      .update({ nickname: row.nickname, language: row.language })
      .eq('user_id', row.user_id).eq('chat_id', row.chat_id);
    return { error: upErr };
  }
  return { error };
}

// Referral ("crew"): record who recruited this user. Best-effort — if the
// referrer_id column isn't there yet, it silently no-ops (feature degrades gracefully).
export async function recordReferrer(chatId, referrerId) {
  if (!referrerId || referrerId === userId()) return;
  try {
    await sb.from('icc_profiles')
      .update({ referrer_id: referrerId })
      .eq('user_id', userId()).eq('chat_id', chatId)
      .is('referrer_id', null); // only set once
  } catch { /* column may not exist yet */ }
}

// Write my chosen position + trait onto my profile (best-effort; needs the org columns).
export async function updateRole(chatId) {
  if (!position() && !trait()) return;
  try {
    await sb.from('icc_profiles')
      .update({ position: position(), trait: trait() })
      .eq('user_id', userId()).eq('chat_id', chatId);
  } catch { /* columns may not exist yet */ }
}

// Save what this user would like to do/create/become (their area on the board).
// Stored in the `position` column; best-effort if the column is missing.
export async function updateDesire(chatId, desire) {
  try {
    await sb.from('icc_profiles')
      .update({ position: desire })
      .eq('user_id', userId()).eq('chat_id', chatId);
  } catch { /* column may not exist yet */ }
}

// Profiles with org fields for the live org chart. Falls back if columns are missing.
export async function getOrgProfiles(chatId) {
  let res = await sb.from('icc_profiles')
    .select('user_id, nickname, language, position, trait, referrer_id, joined_at')
    .eq('chat_id', chatId).order('joined_at', { ascending: true });
  if (res.error) {
    res = await sb.from('icc_profiles')
      .select('user_id, nickname, language, joined_at')
      .eq('chat_id', chatId).order('joined_at', { ascending: true });
  }
  return res.data || [];
}

// How many people this user recruited in a chat (they're a member, so RLS allows the read).
export async function getCrewCount(chatId) {
  try {
    const { count, error } = await sb.from('icc_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId).eq('referrer_id', userId());
    if (error) return 0;
    return count ?? 0;
  } catch { return 0; }
}

export async function getMessages(chatId, limit = 200) {
  const { data, error } = await sb
    .from('icc_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return { messages: data || [], error };
}

export async function getPinnedRecaps(chatId) {
  const { data } = await sb
    .from('icc_messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_pinned', true)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function insertMyMessage(chatId, content) {
  const row = {
    chat_id: chatId,
    user_id: userId(),
    nickname: nickname(),
    content,
    is_ai: false,
  };
  const { data, error } = await sb.from('icc_messages').insert(row).select().maybeSingle();
  return { message: data, error };
}

export async function getActiveProfiles(chatId) {
  const { data } = await sb
    .from('icc_profiles')
    .select('user_id, nickname, language')
    .eq('chat_id', chatId);
  return data || [];
}

// --- Votes ---
export async function castVote(chatId, type, value) {
  const row = { chat_id: chatId, type, user_id: userId(), value: String(value) };
  const { error } = await sb.from('icc_votes').upsert(row, { onConflict: 'chat_id,type,user_id' });
  return { error };
}

export async function getVotes(chatId, type) {
  const { data } = await sb.from('icc_votes').select('value, user_id').eq('chat_id', chatId).eq('type', type);
  return data || [];
}

// --- Ideas / Co-creators ---
export async function getIdeas(status = null) {
  let q = sb.from('icc_ideas').select('*').order('votes', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return data || [];
}

// A chat "spark": a short idea that shows up live on the Build Board.
export async function insertIdea(summary) {
  const row = { user_id: userId(), nickname: nickname(), idea_summary: summary, status: 'proposed' };
  const { error } = await sb.from('icc_ideas').insert(row);
  return { error };
}

export async function upvoteIdea(ideaId) {
  // SECURITY DEFINER rpc (see SQL) to safely increment.
  const { error } = await sb.rpc('icc_upvote_idea', { p_idea_id: ideaId });
  return { error };
}

// --- Hall of Fame ---
export async function getHallOfFame() {
  const { data } = await sb.from('icc_hall_of_fame').select('*').order('created_at', { ascending: false });
  return data || [];
}
