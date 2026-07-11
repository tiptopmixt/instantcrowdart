// Landing = the fire. A full-screen living ember swarm, a cinematic countdown,
// a frosted "peek" at the crowd talking, and one giant way in. FOMO by design.
import { h, el, joinUrl } from '../utils.js';
import { t } from '../i18n.js';
import { getActiveChat, getHallOfFame } from '../data.js';
import { subscribePresence, unsubscribePresence } from '../realtime.js';
import {
  adsBanner, feedbackButton, adminButton, termsLink, languageGate, introGame,
} from '../components.js';
import { L, uiLang, LANGS } from '../locale.js';
import { navigate } from '../router.js';
import { isAdmin } from '../config.js';
import { userId, nickname, position, trait, emojiOf } from '../auth.js';
import { callFn } from '../supabase.js';
import { shareCard } from '../share-card.js';
import { startFX, ignite } from '../fx.js';
import { nicknamesFromPresence, bestiary } from '../crowd.js';

let timer = null;
let ghostTimer = null;

const PLAYED_KEY = 'icc_played';
const played = () => { try { return !!localStorage.getItem(PLAYED_KEY); } catch { return false; } };
const markPlayed = () => { try { localStorage.setItem(PLAYED_KEY, '1'); } catch { /* ignore */ } };

function inviteUrl(code) { return joinUrl(code) + '?r=' + (userId() || ''); }
async function inviteCrew(chat) {
  await shareCard({
    who: `${emojiOf(nickname())} ${nickname()}`, role: position(), trait: trait(),
    title: chat.title, recap: chat.current_goal || '',
    crowdEmojis: '🦊🐻🦉', count: chat.participant_count || 0,
    code: chat.short_code, url: inviteUrl(chat.short_code),
  });
}

export async function renderHome(root) {
  unsubscribePresence();
  clearInterval(timer);
  clearInterval(ghostTimer);
  document.querySelectorAll('.icc-fab, .icc-admin-fab').forEach((n) => n.remove());

  const { chat } = await getActiveChat();
  const hof = await getHallOfFame();

  root.innerHTML = '';

  // ---------- HERO ----------
  const fx = h('canvas', { class: 'icc-fx' });
  const hero = h('section', { class: 'icc-hero2' }, [fx]);

  if (chat) {
    const content = h('div', { class: 'icc-hero2-content' }, [
      h('div', { class: 'icc-eyebrow' }, L('eyebrow')),
      h('h1', { class: 'icc-mega' }, 'INSTANT CROWD CHAT'),
      countdownBlock(chat),
      ctaBlock(chat),
      h('p', { class: 'icc-gone' }, L('goneLine')),
      h('div', { class: 'icc-ticker' }, [h('div', { class: 'icc-ticker-inner', id: 'home-ticker' })]),
    ]);
    hero.appendChild(content);
  } else {
    hero.appendChild(h('div', { class: 'icc-hero2-content' }, [
      h('div', { class: 'icc-eyebrow' }, L('eyebrow')),
      h('h1', { class: 'icc-mega ashes' }, L('overTitle')),
      isAdmin(userId()) ? adminStartButton() : null,
    ]));
  }
  root.appendChild(hero);

  // ---------- PEEK (the crowd behind frosted glass) ----------
  if (chat) {
    const stream = h('div', { class: 'icc-peek-stream', id: 'peek-stream' });
    const lock = h('div', { class: 'icc-peek-lock' }, [
      h('div', { class: 'icc-peek-live' }, '● LIVE'),
      h('strong', {}, L('peekLock')),
      peekButton(chat),
    ]);
    root.appendChild(h('section', { class: 'icc-peek' }, [stream, lock]));
  }

  // ---------- HALL OF FAME (minimal) ----------
  if (hof.length) {
    root.appendChild(h('section', { class: 'icc-below' },
      hof.slice(0, 4).map((r) => h('div', { class: 'icc-card icc-hof' }, [
        h('div', { class: 'icc-card-badge' }, '★ ' + (r.rating ?? '')),
        h('h3', {}, r.title || ''),
        h('p', { class: 'icc-muted' }, r.ai_summary || ''),
      ]))));
  }

  // ---------- FOOTER ----------
  const curFlag = (LANGS.find((l) => l.code === uiLang()) || LANGS[0]).flag;
  const langChip = h('button', { class: 'icc-link' }, curFlag + ' ▾');
  langChip.addEventListener('click', async () => { await languageGate(true); location.reload(); });
  root.appendChild(h('div', { class: 'icc-footer' }, [
    langChip, termsLink(),
    h('span', { class: 'icc-muted small' }, t('footerLine')),
  ]));
  root.appendChild(adsBanner());

  document.body.appendChild(feedbackButton());
  const admin = adminButton(chat);
  if (admin) document.body.appendChild(admin);

  // ---------- LIVE WIRES ----------
  startFX(fx);

  if (chat) {
    // countdown tick
    timer = setInterval(() => tickCountdown(chat), 100);

    // presence -> ticker
    subscribePresence(chat.id, (count, state) => {
      const nicks = nicknamesFromPresence(state);
      updateTicker(chat, count, nicks);
    });
    updateTicker(chat, 0, []);

    // ghost bubbles rate follows real activity
    let rate = 4000;
    callFn('icc-summarize', { chat_id: chat.id, stats_only: true }).then(({ data }) => {
      const mph = data?.msg_per_hour || 0;
      rate = mph > 30 ? 1200 : mph > 10 ? 2200 : mph > 2 ? 3200 : 4500;
    });
    const spawnGhost = () => {
      const s = el('#peek-stream');
      if (!s) return;
      const g = h('div', {
        class: 'icc-ghost' + (Math.random() > 0.5 ? ' right' : ''),
        style: `width:${35 + Math.random() * 45}%`,
      });
      s.appendChild(g);
      setTimeout(() => g.remove(), 7000);
      if (s.children.length > 10) s.firstChild?.remove();
    };
    ghostTimer = setInterval(() => spawnGhost(), 900);
    setTimeout(() => { clearInterval(ghostTimer); ghostTimer = setInterval(spawnGhost, rate / 2); }, 3000);
  }
}

// ---------- countdown ----------
function countdownBlock(chat) {
  if (chat.status === 'founding' || !chat.expires_at) {
    return h('div', { class: 'icc-forever' }, [
      h('span', { class: 'icc-forever-flame' }, '∞'),
      h('span', { class: 'icc-forever-lab' }, L('liveForever')),
    ]);
  }
  const cell = (id, lab) => h('div', { class: 'cell' }, [
    h('div', { class: 'digits', id }, '--'),
    h('div', { class: 'lab' }, lab),
  ]);
  return h('div', { class: 'icc-count2' }, [
    cell('cd-h', L('labHrs')),
    h('span', { class: 'colon' }, ':'),
    cell('cd-m', L('labMin')),
    h('span', { class: 'colon' }, ':'),
    cell('cd-s', L('labSec')),
  ]);
}

function tickCountdown(chat) {
  if (chat.status === 'founding' || !chat.expires_at) return;
  const ms = Math.max(0, new Date(chat.expires_at).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  const set = (id, v) => { const n = el('#' + id); if (n && n.textContent !== v) n.textContent = v; };
  set('cd-h', String(Math.floor(s / 3600)).padStart(2, '0'));
  set('cd-m', String(Math.floor((s % 3600) / 60)).padStart(2, '0'));
  set('cd-s', String(s % 60).padStart(2, '0'));
}

// ---------- CTA ----------
function ctaBlock(chat) {
  const btn = h('button', { class: 'icc-cta' }, L('ctaEnter'));
  btn.addEventListener('click', () => enterFlow(chat));
  return btn;
}
function peekButton(chat) {
  const b = h('button', { class: 'icc-btn icc-btn-sm' }, '🔓 ' + L('peekCta'));
  b.addEventListener('click', () => enterFlow(chat));
  return b;
}

async function enterFlow(chat) {
  if (!played()) {
    await introGame(() => inviteCrew(chat));
    markPlayed();
  }
  ignite(() => navigate(`/c/${chat.short_code}`));
}

// ---------- ticker ----------
function updateTicker(chat, online, nicks) {
  const t = el('#home-ticker');
  if (!t) return;
  const groups = bestiary(nicks).slice(0, 5)
    .map((g) => `${g.emoji}×${g.count}`).join(' ');
  const bits = [
    `⚡ ${online} online`,
    `👥 ${chat.participant_count ?? 0} ${L('inside')}`,
    groups || '🦊 🐻 🦉',
    `🏷️ ${chat.title}`,
  ];
  const line = bits.join('  ·  ') + '  ·  ';
  t.textContent = line + line + line;
}

function adminStartButton() {
  const btn = h('button', { class: 'icc-btn' }, '⚡ Restart');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { data, error } = await callFn('icc-close-chat', { action: 'start_new', admin_user_id: userId() });
    if (!error && data?.short_code) navigate(`/c/${data.short_code}`);
    else btn.disabled = false;
  });
  return btn;
}
