// Landing = the fire. A full-screen living ember swarm, a cinematic countdown,
// a frosted "peek" at the crowd talking, and one giant way in. FOMO by design.
import { h, el, joinUrl } from '../utils.js';
import { t } from '../i18n.js';
import { getActiveChat, getHallOfFame, getPixels } from '../data.js';
import { subscribePresence, unsubscribePresence } from '../realtime.js';
import {
  adsBanner, feedbackButton, adminButton, termsLink, languageGate,
} from '../components.js';
import { L, uiLang, LANGS } from '../locale.js';
import { navigate } from '../router.js';
import { isAdmin } from '../config.js';
import { userId } from '../auth.js';
import { callFn } from '../supabase.js';
import { startFX, ignite } from '../fx.js';
import { nicknamesFromPresence } from '../crowd.js';

let timer = null;
let ghostTimer = null;

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
      h('h1', { class: 'icc-mega' }, 'INSTANT CROWD ART'),
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

  // ---------- PEEK: live preview of the shared canvas ----------
  if (chat) {
    const preview = h('canvas', { class: 'icc-peek-canvas', id: 'peek-canvas' });
    const lock = h('div', { class: 'icc-peek-lock' }, [
      h('div', { class: 'icc-peek-live' }, '● LIVE'),
      h('strong', {}, L('peekLock')),
      peekButton(chat),
    ]);
    root.appendChild(h('section', { class: 'icc-peek' }, [preview, lock]));
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
    h('div', { class: 'icc-muted small', style: 'margin-top:6px' }, '© 2026 Borzin Roman · All rights reserved'),
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

    // live mini-preview of the tile mosaic
    const TILE = 16;
    const drawPreview = async () => {
      const cv = el('#peek-canvas');
      if (!cv) return;
      const px = await getPixels(chat.id);
      const byUser = new Map();
      px.forEach((p) => { if (!byUser.has(p.user_id)) byUser.set(p.user_id, []); byUser.get(p.user_id).push(p); });
      const ids = [...byUser.keys()];
      const n = Math.max(1, ids.length);
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const disp = cv.clientWidth || 300, ratio = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = disp * ratio; cv.height = disp * ratio;
      const cx = cv.getContext('2d'); cx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cx.fillStyle = '#0d0d11'; cx.fillRect(0, 0, disp, disp);
      const ts = disp / cols, cell = ts / TILE;
      ids.forEach((uid, i) => {
        const ox = (i % cols) * ts, oy = Math.floor(i / cols) * ts;
        cx.fillStyle = '#f4f4f2'; cx.fillRect(ox + 1, oy + 1, ts - 2, ts - 2);
        byUser.get(uid).forEach((p) => { cx.fillStyle = p.color; cx.fillRect(ox + p.x * cell, oy + p.y * cell, cell, cell); });
      });
    };
    drawPreview();
    ghostTimer = setInterval(drawPreview, 4000);
  }
}

// ---------- countdown ----------
function countdownBlock(chat) {
  if (!chat.expires_at) {
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
    cell('cd-d', L('labDays')),
    h('span', { class: 'colon' }, ':'),
    cell('cd-h', L('labHrs')),
    h('span', { class: 'colon' }, ':'),
    cell('cd-m', L('labMin')),
    h('span', { class: 'colon' }, ':'),
    cell('cd-s', L('labSec')),
  ]);
}

function tickCountdown(chat) {
  if (!chat.expires_at) return;
  const ms = Math.max(0, new Date(chat.expires_at).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  const set = (id, v) => { const n = el('#' + id); if (n && n.textContent !== v) n.textContent = v; };
  set('cd-d', String(Math.floor(s / 86400)));
  set('cd-h', String(Math.floor((s % 86400) / 3600)).padStart(2, '0'));
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

function enterFlow(chat) {
  ignite(() => navigate(`/c/${chat.short_code}`));
}

// ---------- ticker ----------
function updateTicker(chat, online) {
  const t = el('#home-ticker');
  if (!t) return;
  const bits = [
    `⚡ ${online} ${L('onlineShort')}`,
    `👥 ${chat.participant_count ?? 0} ${L('inside')}`,
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
