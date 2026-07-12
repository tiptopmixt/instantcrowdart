// The live crowd = a simple count of who's online (no animals/avatars).
import { h } from './utils.js';
import { L } from './locale.js';

// Extract nicknames from a Supabase Presence state object.
export function nicknamesFromPresence(state) {
  const out = [];
  for (const key of Object.keys(state || {})) {
    const metas = state[key];
    const nick = metas && metas[0] && metas[0].nickname;
    if (nick) out.push(nick);
  }
  return out;
}

// Render a simple "N online" indicator.
export function renderCrowd(container, nicknames) {
  if (!container) return;
  const total = (nicknames || []).length;
  container.innerHTML = '';
  container.appendChild(h('span', { class: 'icc-crowd-total' }, `⚡ ${total} ${L('onlineShort')}`));
}
