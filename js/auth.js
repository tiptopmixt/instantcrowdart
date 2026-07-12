// Anonymous auth + a neutral random nickname (no animals/avatars).
import { sb } from './supabase.js';

const ADJ = ['Blue', 'Red', 'Green', 'Gold', 'Silver', 'Swift', 'Calm', 'Bright', 'Bold', 'Wild', 'Lucky', 'Cosmic'];
const NOUN = ['Nova', 'Spark', 'Pixel', 'Comet', 'Vortex', 'Ember', 'Bolt', 'Flux', 'Echo', 'Prism', 'Drift', 'Wave'];

export function randomNickname() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10..99
  return `${a} ${n} ${num}`;
}

let _user = null;

export async function ensureAuth() {
  if (_user) return _user;
  let { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }
  _user = session.user;
  if (!_user.user_metadata || !_user.user_metadata.nickname) {
    await setNickname(randomNickname());
  }
  return _user;
}

export async function setNickname(nick) {
  const { data, error } = await sb.auth.updateUser({ data: { nickname: nick } });
  if (!error && data?.user) _user = data.user;
  return nickname();
}

export function currentUser() { return _user; }
export function nickname() { return _user?.user_metadata?.nickname || 'Guest'; }
export function userId() { return _user?.id || null; }
