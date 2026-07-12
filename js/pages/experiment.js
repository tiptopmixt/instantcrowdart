// Pixel Art — the shared canvas experiment. Everyone gets 10 pixels to place
// anywhere (any color), can move ANY pixel (yours or others'), sees the picture
// grow live, and shares the creation. No names, no AI at the center.
import { h, el, toast, formatRemaining, isExpired, joinUrl } from '../utils.js';
import { L } from '../locale.js';
import { requireConsent } from '../legal.js';
import { getChatByCode, getMyProfile, joinChat, getPixels, placePixel, movePixel, removePixel } from '../data.js';
import { subscribePixels, unsubscribePixels, subscribePresence, unsubscribePresence } from '../realtime.js';
import { adsBanner, openFeedbackFlow, openAdminPanel } from '../components.js';
import { userId } from '../auth.js';
import { isAdmin } from '../config.js';
import { navigate } from '../router.js';
import { uiLang } from '../locale.js';

const GRID = 24;         // 24 x 24 canvas
const BUDGET = 10;       // pixels per user
const PALETTE = ['#111111', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#1e88e5', '#8e24aa', '#00acc1', '#ff4081', '#795548', '#9e9e9e'];

let timer = null;
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

  // Consent + join (for presence). Language already chosen at the gate.
  if (!(await getMyProfile(chat.id))) {
    const ok = await requireConsent();
    if (!ok) { navigate('/'); return; }
    await joinChat(chat.id, uiLang());
  }

  root.innerHTML = '';
  const page = h('div', { class: 'icc-page icc-pixelpage' });

  // Top bar
  const countdown = h('span', { class: 'icc-mini-count', id: 'px-count' },
    chat.status === 'founding' ? '∞' : formatRemaining(chat.expires_at));
  const shareBtn = h('button', { class: 'icc-share-cta' }, ['📤 ', L('share')]);
  shareBtn.addEventListener('click', shareCanvas);
  const tools = [];
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
  page.appendChild(h('div', { class: 'icc-fuse' + (chat.status === 'founding' ? ' infinite' : '') }, [
    h('div', { class: 'icc-fuse-fill', id: 'px-fuse' }, [h('span', { class: 'icc-fuse-spark' })]),
  ]));

  // Instructions
  page.appendChild(h('div', { class: 'icc-px-hint' }, '⚡ ' + L('pixHint')));

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

  page.appendChild(adsBanner());
  root.appendChild(page);

  // Load pixels
  (await getPixels(chat.id)).forEach((p) => pixels.set(key(p.x, p.y), { id: p.id, color: p.color, uid: p.user_id }));

  sizeCanvas();
  draw();
  updateBar();
  window.addEventListener('resize', sizeCanvas);
  canvasEl.addEventListener('pointerdown', onTap);

  // Realtime pixels
  subscribePixels(chat.id, {
    onInsert: (p) => { pixels.set(key(p.x, p.y), { id: p.id, color: p.color, uid: p.user_id }); draw(); updateBar(); },
    onUpdate: (n, o) => {
      if (o) pixels.delete(key(o.x, o.y));
      pixels.set(key(n.x, n.y), { id: n.id, color: n.color, uid: n.user_id });
      if (selected && selected.id === n.id) selected = { id: n.id, x: n.x, y: n.y };
      draw(); updateBar();
    },
    onDelete: (o) => { if (o) pixels.delete(key(o.x, o.y)); draw(); updateBar(); },
  });
  subscribePresence(chat.id, (count) => { updateBar(count); });

  // Countdown + fuse
  timer = setInterval(() => {
    const c = el('#px-count');
    if (c && chat.status !== 'founding') c.textContent = formatRemaining(chat.expires_at);
    const ff = el('#px-fuse');
    if (ff && chat.status !== 'founding' && chat.expires_at) {
      const total = new Date(chat.expires_at).getTime() - new Date(chat.created_at).getTime();
      const left = new Date(chat.expires_at).getTime() - Date.now();
      if (total > 0) ff.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + '%';
    }
    if (chat.status !== 'founding' && isExpired(chat.expires_at)) { clearInterval(timer); }
  }, 1000);
}

function sizeCanvas() {
  if (!canvasEl) return;
  const disp = Math.min(canvasEl.parentElement.clientWidth, 460);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.style.width = disp + 'px';
  canvasEl.style.height = disp + 'px';
  canvasEl.width = disp * dpr;
  canvasEl.height = disp * dpr;
  cell = disp / GRID;
  ctx = canvasEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  if (!ctx) return;
  const size = GRID * cell;
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
  for (let i = 1; i < GRID; i++) {
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
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
  const here = pixels.get(key(x, y));

  if (selected) {
    if (here && here.id === selected.id) {
      // tapped the picked-up pixel again: remove it if it's mine, else just drop
      if (here.uid === userId()) { pixels.delete(key(x, y)); draw(); updateBar(); await removePixel(here.id); }
      selected = null; draw();
      return;
    }
    if (here) { selected = { id: here.id, x, y }; draw(); return; } // switch selection
    // move selected pixel to empty cell (optimistic)
    const from = selected;
    const p = pixels.get(key(from.x, from.y));
    if (p) { pixels.delete(key(from.x, from.y)); pixels.set(key(x, y), p); }
    selected = null; draw(); updateBar();
    const { error } = await movePixel(from.id, x, y);
    if (error) { toast(L('cellTaken'), 'error'); }
    return;
  }

  if (here) { selected = { id: here.id, x, y }; draw(); return; } // pick up any pixel

  // place a new pixel of my color
  if (budgetLeft() <= 0) { toast(L('pixFull'), 'info'); return; }
  const tempId = 'tmp-' + x + '-' + y;
  pixels.set(key(x, y), { id: tempId, color, uid: userId() });
  draw(); updateBar();
  const { pixel, error } = await placePixel(chatRef.id, x, y, color);
  if (error) { pixels.delete(key(x, y)); draw(); updateBar(); toast(L('cellTaken'), 'error'); }
  else if (pixel) pixels.set(key(x, y), { id: pixel.id, color: pixel.color, uid: pixel.user_id });
}

function updateBar(online) {
  const b = el('#px-budget');
  if (b) {
    const left = budgetLeft();
    b.innerHTML = `🎨 <b>${left}/${BUDGET}</b> ${L('pixLeft')}`;
  }
  const s = el('#px-stats');
  if (s) s.textContent = `${pixels.size} ${L('pixPlaced')}` + (online != null ? ` · ⚡ ${online}` : '');
}

// Share the current canvas as an image (call for help).
async function shareCanvas() {
  toast(L('shareStory') + '…', 'info');
  const S = 1080, pad = 60, board = S - pad * 2, c = board / GRID;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S + 120;
  const x = cv.getContext('2d');
  x.fillStyle = '#0d0d11'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#f4f4f2'; x.fillRect(pad, pad, board, board);
  for (const [k, p] of pixels) { const [px, py] = k.split(',').map(Number); x.fillStyle = p.color; x.fillRect(pad + px * c, pad + py * c, c, c); }
  x.textAlign = 'center'; x.fillStyle = '#FFD600'; x.font = 'bold 46px sans-serif';
  x.fillText('⚡ Pixel Art · InstantCrowdChat', S / 2, S + 40);
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

function cleanup() {
  clearInterval(timer);
  unsubscribePixels();
  unsubscribePresence();
  window.removeEventListener('resize', sizeCanvas);
  pixels.clear(); selected = null; ctx = null; canvasEl = null; chatRef = null;
  document.querySelectorAll('.icc-fab, .icc-admin-fab').forEach((n) => n.remove());
}
