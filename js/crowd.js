// The live "crowd": group online users by their animal (10 foxes, 5 bears…).
import { ANIMALS, animalOf } from './auth.js';
import { h } from './utils.js';

const EMOJI_BY_NAME = Object.fromEntries(ANIMALS.map((a) => [a.name, a.emoji]));

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

// Count animals -> sorted [{ name, emoji, count }].
export function bestiary(nicknames) {
  const counts = {};
  for (const n of nicknames) {
    const a = animalOf(n);
    if (a && EMOJI_BY_NAME[a]) counts[a] = (counts[a] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, emoji: EMOJI_BY_NAME[name], count }))
    .sort((a, b) => b.count - a.count);
}

// Render the crowd strip into a container element.
export function renderCrowd(container, nicknames) {
  if (!container) return;
  const groups = bestiary(nicknames);
  const total = nicknames.length;
  container.innerHTML = '';
  if (!total) {
    container.appendChild(h('span', { class: 'icc-muted small' }, 'Be the first creature to arrive ⚡'));
    return;
  }
  container.appendChild(h('span', { class: 'icc-crowd-total' }, `${total} here now`));
  const strip = h('div', { class: 'icc-crowd-strip' });
  groups.forEach((g) => {
    strip.appendChild(h('span', { class: 'icc-crowd-chip', title: `${g.count} ${g.name}${g.count > 1 ? 's' : ''}` }, [
      h('span', { class: 'icc-crowd-emoji' }, g.emoji),
      h('span', { class: 'icc-crowd-count' }, '×' + g.count),
    ]));
  });
  container.appendChild(strip);
}
