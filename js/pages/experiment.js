// Pixel Art — the shared canvas experiment. Everyone gets 10 pixels to place
// anywhere (any color), can move ANY pixel (yours or others'), sees the picture
// grow live, and shares the creation. No names, no AI at the center.
import { h, el, toast, formatRemaining, joinUrl } from '../utils.js';
import { L } from '../locale.js';
import { requireConsent } from '../legal.js';
import { getChatByCode, getMyProfile, joinChat, getPixels, placePixel, movePixel, removePixel } from '../data.js';
import { subscribePixels, unsubscribePixels, subscribePresence, unsubscribePresence } from '../realtime.js';
import { adsBanner, openFeedbackFlow, openAdminPanel, modal } from '../components.js';
import { callFn } from '../supabase.js';
import { userId } from '../auth.js';
import { isAdmin } from '../config.js';
import { navigate } from '../router.js';
import { uiLang } from '../locale.js';

// The board "breathes": it starts small and lively, and grows a ring whenever it
// gets too full — so density stays comfortable with any number of players.
const BASE = 16;         // starting grid (16x16)
const MAX = 64;          // cap so cells stay tappable
const FILL_GROW = 0.5;   // grow when more than 50% of cells are colored
let gridN = BASE;
const BUDGET = 10;       // pixels per user
const FOREIGN_COOLDOWN = 8000;  // ms between moving other people's pixels
let lastForeignMove = 0;
const PALETTE = ['#111111', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#1e88e5', '#8e24aa', '#00acc1', '#ff4081', '#795548', '#9e9e9e'];

function targetGrid() {
  let g = BASE;
  while (g < MAX && pixels.size / (g * g) > FILL_GROW) g += 2;
  return g;
}
// Recompute grid size, resize if it changed, then redraw + update the bar.
function refresh(online) {
  const g = targetGrid();
  if (g !== gridN) { gridN = g; sizeCanvas(); } else { draw(); }
  updateBar(online);
}

let timer = null;
let pollTimer = null;
let ctx = null, canvasEl = null, cell = 0, dpr = 1;
const pixels = new Map();       // "x,y" -> { id, color, uid }
let selected = null;            // { id, x, y } picked up to move
let color = PALETTE[2];
let chatRef = null;

const key = (x, y) => `${x},${y}`;
function myCount() { let n = 0; for (const p of pixels.values()) if (p.uid === userId()) n++; return n; }
function budgetLeft() { return Math.max(0, BUDGET - myCount()); }

export async function renderExperiment(root, code) {
  cleanup();
  const { chat } = await getChatByCode(code);
  if (!chat) { navigate('/'); return; }
  chatRef = chat;

  // Consent + join. A NEW joiner (re)starts the 24h countdown for everyone.
  if (!(await getMyProfile(chat.id))) {
    const ok = await requireConsent();
    if (!ok) { navigate('/'); return; }
    await joinChat(chat.id, uiLang());
    const { data } = await callFn('icc-timer', { chat_id: chat.id });
    if (data?.expires_at) chat.expires_at = data.expires_at;
  }

  root.innerHTML = '';
  const page = h('div', { class: 'icc-page icc-pixelpage' });

  // Top bar
  const countdown = h('span', { class: 'icc-mini-count', id: 'px-count' },
    chat.expires_at ? formatRemaining(chat.expires_at) : '∞');
  const shareBtn = h('button', { class: 'icc-share-cta' }, ['📤 ', L('share')]);
  shareBtn.addEventListener('click', shareCanvas);
  const tools = [];
  const info = h('button', { class: 'icc-tool' }, 'ℹ️'); info.addEventListener('click', showRules); tools.push(info);
  if (isAdmin(userId())) {
    const a = h('button', { class: 'icc-tool' }, '⚙︎'); a.addEventListener('click', () => openAdminPanel(chat)); tools.push(a);
  }
  const fb = h('button', { class: 'icc-tool' }, '💬'); fb.addEventListener('click', () => openFeedbackFlow()); tools.push(fb);
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹'),
    h('div', { class: 'icc-topbar-title' }, '🟦 ' + (chat.title || 'Pixel Art')),
    countdown, ...tools, shareBtn,
  ]));

  // Fuse
  page.appendChild(h('div', { class: 'icc-fuse' + (chat.expires_at ? '' : ' infinite') }, [
    h('div', { class: 'icc-fuse-fill', id: 'px-fuse' }, [h('span', { class: 'icc-fuse-spark' })]),
  ]));

  // Positive prompt + instructions
  page.appendChild(h('div', { class: 'icc-px-theme' }, L('pixTheme')));
  page.appendChild(h('div', { class: 'icc-px-hint' }, L('pixHint')));

  // Canvas
  canvasEl = h('canvas', { class: 'icc-px-canvas' });
  page.appendChild(h('div', { class: 'icc-px-wrap' }, [canvasEl]));

  // Palette
  const pal = h('div', { class: 'icc-px-palette' }, PALETTE.map((c) => {
    const sw = h('button', { class: 'icc-px-color' + (c === color ? ' sel' : ''), style: `background:${c}` });
    sw.addEventListener('click', () => {
      color = c;
      [...pal.children].forEach((n) => n.classList.remove('sel'));
      sw.classList.add('sel');
    });
    return sw;
  }));
  page.appendChild(pal);

  // Budget / stats bar
  page.appendChild(h('div', { class: 'icc-px-bar' }, [
    h('span', { id: 'px-budget' }, ''),
    h('span', { class: 'icc-muted', id: 'px-stats' }, ''),
  ]));

  // Ideas to change the game: propose (AI chat) + see the ranking (other page)
  const propose = h('button', { class: 'icc-btn icc-btn-sm ghost' }, L('proposeChange'));
  propose.addEventListener('click', () => openFeedbackFlow());
  const rank = h('button', { class: 'icc-btn icc-btn-sm ghost' }, L('ideasRank'));
  rank.addEventListener('click', () => navigate('/wall'));
  page.appendChild(h('div', { class: 'icc-px-actions' }, [propose, rank]));

  page.appendChild(adsBanner());
  root.appendChild(page);

  // Load pixels
  (await getPixels(chat.id)).forEach((p) => pixels.set(key(p.x, p.y), { id: p.id, color: p.color, uid: p.user_id }));

  sizeCanvas();
  refresh();
  window.addEventListener('resize', sizeCanvas);
  canvasEl.addEventListener('pointerdown', onTap);

  // Realtime pixels
  subscribePixels(chat.id, {
    onInsert: (p) => { pixels.set(key(p.x, p.y), { id: p.id, color: p.color, uid: p.user_id }); refresh(); },
    onUpdate: (n, o) => {
      if (o) pixels.delete(key(o.x, o.y));
      pixels.set(key(n.x, n.y), { id: n.id, color: n.color, uid: n.user_id });
      if (selected && selected.id === n.id) selected = { id: n.id, x: n.x, y: n.y, uid: n.user_id };
      refresh();
    },
    onDelete: (o) => { if (o) pixels.delete(key(o.x, o.y)); refresh(); },
  });
  subscribePresence(chat.id, (count) => { refresh(count); });

  // Countdown + fuse (the 24h window; restarts when a new user joins).
  const WINDOW = 24 * 3600 * 1000;
  timer = setInterval(() => {
    if (!chat.expires_at) return;
    const c = el('#px-count');
    if (c) c.textContent = formatRemaining(chat.expires_at);
    const ff = el('#px-fuse');
    if (ff) {
      const left = new Date(chat.expires_at).getTime() - Date.now();
      ff.style.width = Math.max(0, Math.min(100, (left / WINDOW) * 100)) + '%';
    }
  }, 1000);

  // Pick up expires_at refreshes from other people joining (poll lightly).
  pollTimer = setInterval(async () => {
    const { chat: fresh } = await getChatByCode(chat.short_code);
    if (fresh?.expires_at && fresh.expires_at !== chat.expires_at) {
      chat.expires_at = fresh.expires_at;
      el('.icc-fuse')?.classList.remove('infinite');
    }
  }, 20000);
}

function sizeCanvas() {
  if (!canvasEl) return;
  const disp = Math.min(canvasEl.parentElement.clientWidth, 460);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.style.width = disp + 'px';
  canvasEl.style.height = disp + 'px';
  canvasEl.width = disp * dpr;
  canvasEl.height = disp * dpr;
  cell = disp / gridN;
  ctx = canvasEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  if (!ctx) return;
  const size = gridN * cell;
  ctx.clearRect(0, 0, size, size);
  // white board
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, size, size);
  // pixels
  for (const [k, p] of pixels) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillStyle = p.color;
    ctx.fillRect(x * cell, y * cell, cell, cell);
    if (p.uid === userId()) { // always see yours
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
  }
  // grid lines
  ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
  for (let i = 1; i < gridN; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
  }
  // selected (picked-up) pixel ring
  if (selected) {
    ctx.strokeStyle = '#FFD600'; ctx.lineWidth = 3;
    ctx.strokeRect(selected.x * cell + 1.5, selected.y * cell + 1.5, cell - 3, cell - 3);
  }
}

async function onTap(e) {
  const rect = canvasEl.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cell);
  const y = Math.floor((e.clientY - rect.top) / cell);
  if (x < 0 || y < 0 || x >= gridN || y >= gridN) return;
  const here = pixels.get(key(x, y));

  if (selected) {
    if (here && here.id === selected.id) {
      // tapped the picked-up pixel again: remove it if it's mine, else just drop
      if (here.uid === userId()) { pixels.delete(key(x, y)); refresh(); await removePixel(here.id); }
      selected = null; draw();
      return;
    }
    if (here) { selected = { id: here.id, x, y, uid: here.uid }; draw(); return; } // switch selection
    // Moving someone else's pixel is allowed but rate-limited (build, don't grief).
    if (selected.uid !== userId()) {
      const wait = FOREIGN_COOLDOWN - (Date.now() - lastForeignMove);
      if (wait > 0) { toast(L('moveWait').replace('{s}', Math.ceil(wait / 1000)), 'info'); return; }
      lastForeignMove = Date.now();
    }
    // move selected pixel to empty cell (optimistic)
    const from = selected;
    const p = pixels.get(key(from.x, from.y));
    if (p) { pixels.delete(key(from.x, from.y)); pixels.set(key(x, y), p); }
    selected = null; refresh();
    const { error } = await movePixel(from.id, x, y);
    if (error) { toast(L('cellTaken'), 'error'); }
    return;
  }

  if (here) { selected = { id: here.id, x, y, uid: here.uid }; draw(); return; } // pick up any pixel

  // place a new pixel of my color
  if (budgetLeft() <= 0) { toast(L('pixFull'), 'info'); return; }
  const tempId = 'tmp-' + x + '-' + y;
  pixels.set(key(x, y), { id: tempId, color, uid: userId() });
  refresh();
  const { pixel, error } = await placePixel(chatRef.id, x, y, color);
  if (error) { pixels.delete(key(x, y)); refresh(); toast(L('cellTaken'), 'error'); }
  else if (pixel) pixels.set(key(x, y), { id: pixel.id, color: pixel.color, uid: pixel.user_id });
}

function updateBar(online) {
  const b = el('#px-budget');
  if (b) {
    const left = budgetLeft();
    b.innerHTML = `🎨 <b>${left}/${BUDGET}</b> ${L('pixLeft')}`;
  }
  const s = el('#px-stats');
  if (s) {
    const on = online != null ? online : (Number((s.dataset.on) || 0));
    if (online != null) s.dataset.on = String(online);
    s.textContent = `${gridN}×${gridN} · ${pixels.size} ${L('pixPlaced')}` + (on ? ` · ⚡ ${on}` : '');
  }
}

// Share the current canvas as an image (call for help).
async function shareCanvas() {
  toast(L('shareStory') + '…', 'info');
  const S = 1080, pad = 60, board = S - pad * 2, c = board / gridN;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S + 120;
  const x = cv.getContext('2d');
  x.fillStyle = '#0d0d11'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#f4f4f2'; x.fillRect(pad, pad, board, board);
  for (const [k, p] of pixels) { const [px, py] = k.split(',').map(Number); x.fillStyle = p.color; x.fillRect(pad + px * c, pad + py * c, c, c); }
  x.textAlign = 'center'; x.fillStyle = '#FFD600'; x.font = 'bold 46px sans-serif';
  x.fillText('⚡ Pixel Art · InstantCrowdArt', S / 2, S + 40);
  x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif';
  x.fillText(L('shareCta') + ' ' + (chatRef.short_code || 'FOUND1'), S / 2, S + 95);

  const url = joinUrl(chatRef.short_code) + '?r=' + (userId() || '');
  const text = L('shareText');
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  try {
    const file = new File([blob], 'pixelart.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, url }); return; }
    window.open(URL.createObjectURL(blob), '_blank');
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(L('copied'), 'ok'); } catch { /* ignore */ }
  } catch { /* cancelled */ }
}

// Info: current game rules + a shortcut to propose changing them.
function showRules() {
  const list = h('ul', { class: 'icc-legal-list' }, L('rules').map((r) => h('li', {}, r)));
  const cta = h('button', { class: 'icc-btn' }, L('proposeChange'));
  const m = modal('ℹ️ ' + L('rulesTitle'), h('div', { class: 'icc-legal' }, [
    list,
    h('p', { class: 'icc-muted small', style: 'margin-top:12px' }, L('rulesCta')),
    h('div', { style: 'padding:8px 0 4px' }, cta),
  ]));
  cta.addEventListener('click', () => { m.close(); openFeedbackFlow(); });
}

function cleanup() {
  clearInterval(timer);
  clearInterval(pollTimer);
  unsubscribePixels();
  unsubscribePresence();
  window.removeEventListener('resize', sizeCanvas);
  pixels.clear(); selected = null; ctx = null; canvasEl = null; chatRef = null;
  document.querySelectorAll('.icc-fab, .icc-admin-fab').forEach((n) => n.remove());
}
