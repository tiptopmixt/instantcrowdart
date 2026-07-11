// Anonymous auth + friendly random "creature" nickname stored in user metadata.
import { sb } from './supabase.js';

const ADJ = ['Blue', 'Red', 'Green', 'Gold', 'Silver', 'Swift', 'Calm', 'Bright', 'Bold', 'Wild', 'Lucky', 'Cosmic'];

// Animals with distinct emojis so the live "crowd" can group them (10 foxes, 5 bears…).
export const ANIMALS = [
  { name: 'Fox', emoji: '🦊' }, { name: 'Owl', emoji: '🦉' }, { name: 'Wolf', emoji: '🐺' },
  { name: 'Bear', emoji: '🐻' }, { name: 'Panda', emoji: '🐼' }, { name: 'Whale', emoji: '🐋' },
  { name: 'Koala', emoji: '🐨' }, { name: 'Tiger', emoji: '🐯' }, { name: 'Frog', emoji: '🐸' },
  { name: 'Otter', emoji: '🦦' }, { name: 'Cat', emoji: '🐱' }, { name: 'Eagle', emoji: '🦅' },
  { name: 'Unicorn', emoji: '🦄' }, { name: 'Monkey', emoji: '🐵' }, { name: 'Penguin', emoji: '🐧' },
  { name: 'Dragon', emoji: '🐲' }, { name: 'Hedgehog', emoji: '🦔' }, { name: 'Dolphin', emoji: '🐬' },
];

const EMOJI_BY_NAME = Object.fromEntries(ANIMALS.map((a) => [a.name, a.emoji]));

export function randomNickname() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10..99
  return `${a} ${animal.name} ${num}`;
}

// Parse the animal name out of a nickname like "Blue Fox 42".
export function animalOf(nick) {
  if (!nick) return null;
  const parts = String(nick).split(' ');
  return parts.length >= 2 ? parts[1] : null;
}
export function emojiOf(nick) {
  return EMOJI_BY_NAME[animalOf(nick)] || '⚡';
}

let _user = null;

// Ensure there is an anonymous session with a nickname. Returns the user.
export async function ensureAuth() {
  if (_user) return _user;

  let { data: { session } } = await sb.auth.getSession();

  if (!session) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }

  _user = session.user;

  // Assign nickname once, on first sign-in.
  if (!_user.user_metadata || !_user.user_metadata.nickname) {
    await setNickname(randomNickname());
  }

  return _user;
}

// Re-roll into a brand-new random creature (fun "choose your profile" mechanic).
export async function reroll() {
  return setNickname(randomNickname());
}

export async function setNickname(nick) {
  const { data, error } = await sb.auth.updateUser({ data: { nickname: nick } });
  if (!error && data?.user) _user = data.user;
  return nickname();
}

// Company seat: chosen position + a strong positive trait.
export async function setRole(position, trait) {
  const { data, error } = await sb.auth.updateUser({ data: { position, trait } });
  if (!error && data?.user) _user = data.user;
}
export function position() { return _user?.user_metadata?.position || ''; }
export function trait() { return _user?.user_metadata?.trait || ''; }

export function currentUser() { return _user; }
export function nickname() { return _user?.user_metadata?.nickname || 'Guest'; }
export function emoji() { return emojiOf(nickname()); }
export function userId() { return _user?.id || null; }
