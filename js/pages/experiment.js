// Tile mosaic — everyone paints their OWN 8x8 tile (unlimited pixels, any color).
// Tiles auto-join into one growing picture. You can ❤️ other people's tiles.
import { h, el, toast, formatRemaining, joinUrl } from '../utils.js';
import { L, uiLang } from '../locale.js';
import { requireConsent } from '../legal.js';
import {
  getChatByCode, getMyProfile, joinChat,
  getPixels, placePixel, recolorPixel, removePixel,
  getLikes, likeTile, unlikeTile,
} from '../data.js';
import { subscribePixels, unsubscribePixels, subscribePresence, unsubscribePresence } from '../realtime.js';
import { adsBanner, openFeedbackFlow, openAdminPanel, modal } from '../components.js';
import { callFn } from '../supabase.js';
import { userId } from '../auth.js';
import { isAdmin } from '../config.js';
import { navigate } from '../router.js';

const TILE = 16; // 16x16, standard for everyone
const PALETTE = ['#111111', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#1e88e5', '#8e24aa', '#00acc1', '#ff4081', '#795548', '#9e9e9e'];

let timer = null, pollTimer = null;
let mCanvas = null, mCtx = null, mW = 0, mH = 0, dpr = 1;
const TW = 112;                   // world px per tile at scale 1 (map is pannable/zoomable)
const view = { scale: 1, ox: 0, oy: 0, ready: false };
const ptrs = new Map();           // pointerId -> {x,y}
let panStart = null, pinchStart = null, moved = false;
const tiles = new Map();          // uid -> { cells: Map<"x,y",{id,color}>, first: number }
const likeCount = new Map();      // uid -> count
const myLikes = new Set();        // uids I liked
let selectedUid = null;
let chatRef = null;

const key = (x, y) => `${x},${y}`;
function tileOf(uid) { if (!tiles.has(uid)) tiles.set(uid, { cells: new Map(), first: Date.now() }); return tiles.get(uid); }
function orderedIds() { return [...tiles.keys()].sort((a, b) => tiles.get(a).first - tiles.get(b).first); }
function mosaicCols() { return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, tiles.size)))); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export async function renderExperiment(root, code) {
  cleanup();
  const { chat } = await getChatByCode(code);
  if (!chat) { navigate('/'); return; }
  chatRef = chat;

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
  shareBtn.addEventListener('click', shareMosaic);
  const tools = [];
  const info = h('button', { class: 'icc-tool' }, 'ℹ️'); info.addEventListener('click', showRules); tools.push(info);
  if (isAdmin(userId())) { const a = h('button', { class: 'icc-tool' }, '⚙︎'); a.addEventListener('click', () => openAdminPanel(chat)); tools.push(a); }
  const fb = h('button', { class: 'icc-tool' }, '💬'); fb.addEventListener('click', () => openFeedbackFlow()); tools.push(fb);
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹'),
    h('div', { class: 'icc-topbar-title' }, '🧩 ' + (chat.title || 'Pixel Art')),
    countdown, ...tools, shareBtn,
  ]));

  page.appendChild(h('div', { class: 'icc-fuse' + (chat.expires_at ? '' : ' infinite') }, [
    h('div', { class: 'icc-fuse-fill', id: 'px-fuse' }, [h('span', { class: 'icc-fuse-spark' })]),
  ]));

  page.appendChild(h('div', { class: 'icc-px-hint' }, L('mosaicHint')));

  // Mosaic = a pannable/zoomable MAP
  mCanvas = h('canvas', { class: 'icc-map-canvas' });
  const zin = h('button', { class: 'icc-map-btn' }, '＋'); zin.addEventListener('click', () => zoomBy(1.3));
  const zout = h('button', { class: 'icc-map-btn' }, '−'); zout.addEventListener('click', () => zoomBy(1 / 1.3));
  const zfit = h('button', { class: 'icc-map-btn' }, '⤢'); zfit.addEventListener('click', () => { fitView(); drawMosaic(); });
  page.appendChild(h('div', { class: 'icc-map-wrap' }, [mCanvas, h('div', { class: 'icc-map-ctrl' }, [zin, zout, zfit])]));

  // Selection bar (like / edit for the tapped tile)
  page.appendChild(h('div', { class: 'icc-px-sel', id: 'px-sel' }));

  // Big "edit my tile" button
  const mine = h('button', { class: 'icc-btn icc-btn-xl' }, L('myTile'));
  mine.addEventListener('click', openEditor);
  page.appendChild(h('div', { style: 'text-align:center;padding:6px 0 2px' }, mine));

  page.appendChild(h('div', { class: 'icc-px-bar' }, [h('span', { id: 'px-stats', class: 'icc-muted' }, '')]));
  page.appendChild(adsBanner());
  root.appendChild(page);

  // Load data
  (await getPixels(chat.id)).forEach((p) => {
    const t = tileOf(p.user_id);
    t.cells.set(key(p.x, p.y), { id: p.id, color: p.color });
    const ts = new Date(p.created_at).getTime(); if (ts < t.first) t.first = ts;
  });
  (await getLikes(chat.id)).forEach((l) => {
    likeCount.set(l.tile_user_id, (likeCount.get(l.tile_user_id) || 0) + 1);
    if (l.liker_id === userId()) myLikes.add(l.tile_user_id);
  });

  sizeMosaic();
  window.addEventListener('resize', sizeMosaic);
  mCanvas.addEventListener('pointerdown', onPtrDown);
  mCanvas.addEventListener('pointermove', onPtrMove);
  mCanvas.addEventListener('pointerup', onPtrUp);
  mCanvas.addEventListener('pointercancel', onPtrUp);

  subscribePixels(chat.id, {
    onInsert: (p) => { applyPixel(p); drawMosaic(); },
    onUpdate: (n) => { applyPixel(n); drawMosaic(); },
    onDelete: (o) => { if (o) tiles.get(o.user_id)?.cells.delete(key(o.x, o.y)); drawMosaic(); },
  });
  subscribePresence(chat.id, (count) => updateStats(count));

  const WINDOW = 7 * 24 * 3600 * 1000;
  timer = setInterval(() => {
    if (!chat.expires_at) return;
    const c = el('#px-count'); if (c) c.textContent = formatRemaining(chat.expires_at);
    const ff = el('#px-fuse');
    if (ff) { const left = new Date(chat.expires_at).getTime() - Date.now(); ff.style.width = Math.max(0, Math.min(100, (left / WINDOW) * 100)) + '%'; }
  }, 1000);

  // Poll likes + expiry (both are low-frequency)
  pollTimer = setInterval(async () => {
    const ls = await getLikes(chat.id);
    likeCount.clear(); myLikes.clear();
    ls.forEach((l) => { likeCount.set(l.tile_user_id, (likeCount.get(l.tile_user_id) || 0) + 1); if (l.liker_id === userId()) myLikes.add(l.tile_user_id); });
    updateSelBar();
    const { chat: fresh } = await getChatByCode(chat.short_code);
    if (fresh?.expires_at && fresh.expires_at !== chat.expires_at) { chat.expires_at = fresh.expires_at; el('.icc-fuse')?.classList.remove('infinite'); }
  }, 10000);

  updateStats();
  updateSelBar();
}

function applyPixel(p) {
  const t = tileOf(p.user_id);
  t.cells.set(key(p.x, p.y), { id: p.id, color: p.color });
  const ts = new Date(p.created_at || Date.now()).getTime(); if (ts < t.first) t.first = ts;
}

function sizeMosaic() {
  if (!mCanvas) return;
  const w = mCanvas.parentElement.clientWidth;
  const h = mCanvas.parentElement.clientHeight || Math.round(window.innerHeight * 0.5);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  mCanvas.style.width = w + 'px'; mCanvas.style.height = h + 'px';
  mCanvas.width = w * dpr; mCanvas.height = h * dpr;
  mCtx = mCanvas.getContext('2d'); mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mW = w; mH = h;
  if (!view.ready) fitView();
  drawMosaic();
}

// Fit the whole mosaic into the viewport (used on load and by the ⤢ button).
function fitView() {
  const cols = mosaicCols();
  const rows = Math.max(1, Math.ceil(Math.max(1, tiles.size) / cols));
  const worldW = cols * TW, worldH = rows * TW;
  view.scale = clamp(Math.min(mW / worldW, mH / worldH) * 0.92, 0.15, 4);
  view.ox = (mW - worldW * view.scale) / 2;
  view.oy = (mH - worldH * view.scale) / 2;
  view.ready = true;
}

function drawMosaic() {
  if (!mCtx) return;
  mCtx.clearRect(0, 0, mW, mH);
  mCtx.fillStyle = '#0d0d11'; mCtx.fillRect(0, 0, mW, mH);
  const ids = orderedIds();
  const cols = mosaicCols();
  const s = view.scale, size = TW * s, cell = size / TILE;
  ids.forEach((uid, i) => {
    const wx = (i % cols) * TW, wy = Math.floor(i / cols) * TW;
    const sx = wx * s + view.ox, sy = wy * s + view.oy;
    if (sx > mW || sy > mH || sx + size < 0 || sy + size < 0) return; // cull off-screen
    mCtx.fillStyle = '#f4f4f2'; mCtx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
    for (const [k, px] of tiles.get(uid).cells) { const [x, y] = k.split(',').map(Number); mCtx.fillStyle = px.color; mCtx.fillRect(sx + x * cell, sy + y * cell, cell + 0.5, cell + 0.5); }
    if (uid === selectedUid) { mCtx.strokeStyle = '#FFD600'; mCtx.lineWidth = 3; mCtx.strokeRect(sx + 1.5, sy + 1.5, size - 3, size - 3); }
    else if (uid === userId()) { mCtx.strokeStyle = 'rgba(255,214,0,.7)'; mCtx.lineWidth = 2; mCtx.strokeRect(sx + 1, sy + 1, size - 2, size - 2); }
  });
  updateStats();
}

// --- Map navigation: pan (drag) + pinch-zoom, tap to select a tile ---
function pinchInfo() {
  const [a, b] = [...ptrs.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}
function onPtrDown(e) {
  mCanvas.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { panStart = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }; moved = false; }
  else if (ptrs.size === 2) { const p = pinchInfo(); pinchStart = { ...p, scale: view.scale, ox: view.ox, oy: view.oy }; }
}
function onPtrMove(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2 && pinchStart) {
    const p = pinchInfo();
    const k = clamp(pinchStart.scale * (p.dist / pinchStart.dist), 0.12, 6);
    const wx = (pinchStart.cx - pinchStart.ox) / pinchStart.scale;
    const wy = (pinchStart.cy - pinchStart.oy) / pinchStart.scale;
    view.scale = k; view.ox = p.cx - wx * k; view.oy = p.cy - wy * k;
    drawMosaic();
  } else if (panStart) {
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    view.ox = panStart.ox + dx; view.oy = panStart.oy + dy;
    drawMosaic();
  }
}
function onPtrUp(e) {
  const had = ptrs.get(e.pointerId);
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchStart = null;
  if (ptrs.size === 0) {
    if (!moved && had) selectAt(had.x, had.y);
    panStart = null;
  } else if (ptrs.size === 1) {
    const [only] = [...ptrs.values()]; panStart = { x: only.x, y: only.y, ox: view.ox, oy: view.oy };
  }
}
function selectAt(clientX, clientY) {
  const rect = mCanvas.getBoundingClientRect();
  const wx = (clientX - rect.left - view.ox) / view.scale;
  const wy = (clientY - rect.top - view.oy) / view.scale;
  const cols = mosaicCols();
  const col = Math.floor(wx / TW), row = Math.floor(wy / TW);
  if (col < 0 || row < 0 || col >= cols) { selectedUid = null; drawMosaic(); updateSelBar(); return; }
  const i = row * cols + col;
  const ids = orderedIds();
  selectedUid = (i >= 0 && i < ids.length) ? ids[i] : null;
  drawMosaic(); updateSelBar();
}
function zoomBy(f) {
  const k = clamp(view.scale * f, 0.12, 6);
  const cx = mW / 2, cy = mH / 2;
  const wx = (cx - view.ox) / view.scale, wy = (cy - view.oy) / view.scale;
  view.scale = k; view.ox = cx - wx * k; view.oy = cy - wy * k;
  drawMosaic();
}

function updateSelBar() {
  const bar = el('#px-sel'); if (!bar) return;
  bar.innerHTML = '';
  if (!selectedUid) { bar.appendChild(h('span', { class: 'icc-muted small' }, L('mosaicHint'))); return; }
  const mine = selectedUid === userId();
  const count = likeCount.get(selectedUid) || 0;
  const liked = myLikes.has(selectedUid);
  bar.appendChild(h('span', { class: 'icc-sel-info' }, `❤️ ${count} ${L('tileLikes')}`));
  if (mine) {
    const b = h('button', { class: 'icc-btn icc-btn-sm' }, L('myTile'));
    b.addEventListener('click', openEditor); bar.appendChild(b);
  } else {
    const b = h('button', { class: 'icc-btn icc-btn-sm' + (liked ? ' ghost' : '') }, liked ? '💔' : '❤️ Like');
    b.addEventListener('click', async () => {
      b.disabled = true;
      if (liked) { await unlikeTile(chatRef.id, selectedUid); myLikes.delete(selectedUid); likeCount.set(selectedUid, Math.max(0, count - 1)); }
      else { await likeTile(chatRef.id, selectedUid); myLikes.add(selectedUid); likeCount.set(selectedUid, count + 1); }
      updateSelBar();
    });
    bar.appendChild(b);
  }
}

function updateStats(online) {
  const s = el('#px-stats'); if (!s) return;
  if (online != null) s.dataset.on = String(online);
  const on = Number(s.dataset.on || 0);
  s.textContent = `${tiles.size} ${L('tilesCount')}` + (on ? ` · ⚡ ${on}` : '');
}

// ---------- Tile editor ----------
function openEditor() {
  const t = tileOf(userId());
  let color = PALETTE[2], erase = false;
  const cv = h('canvas', { class: 'icc-ed-canvas' });
  const palette = h('div', { class: 'icc-px-palette' });
  const swatches = [];
  PALETTE.forEach((c) => {
    const sw = h('button', { class: 'icc-px-color' + (c === color ? ' sel' : ''), style: `background:${c}` });
    sw.addEventListener('click', () => { color = c; erase = false; swatches.forEach((n) => n.classList.remove('sel')); sw.classList.add('sel'); eraserBtn.classList.remove('sel'); });
    swatches.push(sw); palette.appendChild(sw);
  });
  const eraserBtn = h('button', { class: 'icc-px-color icc-eraser' }, '🩹');
  eraserBtn.addEventListener('click', () => { erase = true; swatches.forEach((n) => n.classList.remove('sel')); eraserBtn.classList.add('sel'); });
  palette.appendChild(eraserBtn);

  const body = h('div', { class: 'icc-editor' }, [h('div', { class: 'icc-ed-wrap' }, [cv]), palette]);
  const onClose = () => { window.removeEventListener('resize', sizeEd); drawMosaic(); };
  const m = modal('🎨 ' + L('editorTitle'), body, onClose);
  m.overlay.querySelector('.icc-modal-head strong').after(h('button', { class: 'icc-btn icc-btn-sm icc-ed-done' }, L('editDone')));
  m.overlay.querySelector('.icc-ed-done')?.addEventListener('click', m.close);

  let ectx, ecell, edisp;
  const sizeEd = () => {
    // Adapt to the smartphone display (fits width and height).
    const avail = Math.min(m.overlay.querySelector('.icc-modal').clientWidth - 32, window.innerHeight * 0.52, 380);
    edisp = Math.max(160, avail);
    const r = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = edisp + 'px'; cv.style.height = edisp + 'px';
    cv.width = edisp * r; cv.height = edisp * r;
    ectx = cv.getContext('2d'); ectx.setTransform(r, 0, 0, r, 0, 0);
    ecell = edisp / TILE; drawEd();
  };
  const drawEd = () => {
    ectx.clearRect(0, 0, edisp, edisp);
    ectx.fillStyle = '#f4f4f2'; ectx.fillRect(0, 0, edisp, edisp);
    for (const [k, px] of t.cells) { const [x, y] = k.split(',').map(Number); ectx.fillStyle = px.color; ectx.fillRect(x * ecell, y * ecell, ecell, ecell); }
    ectx.strokeStyle = 'rgba(0,0,0,.12)'; ectx.lineWidth = 1;
    for (let i = 1; i < TILE; i++) { ectx.beginPath(); ectx.moveTo(i * ecell, 0); ectx.lineTo(i * ecell, edisp); ectx.stroke(); ectx.beginPath(); ectx.moveTo(0, i * ecell); ectx.lineTo(edisp, i * ecell); ectx.stroke(); }
  };
  const tap = async (e) => {
    const rect = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / ecell), y = Math.floor((e.clientY - rect.top) / ecell);
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const k = key(x, y), existing = t.cells.get(k);
    if (erase || (existing && existing.color === color)) {
      if (existing) { t.cells.delete(k); drawEd(); drawMosaic(); await removePixel(existing.id); }
      return;
    }
    if (existing) { existing.color = color; drawEd(); drawMosaic(); await recolorPixel(existing.id, color); return; }
    const tmp = { id: 'tmp', color }; t.cells.set(k, tmp); drawEd(); drawMosaic();
    const { pixel, error } = await placePixel(chatRef.id, x, y, color);
    if (error) { t.cells.delete(k); drawEd(); drawMosaic(); }
    else if (pixel) t.cells.set(k, { id: pixel.id, color: pixel.color });
  };
  cv.addEventListener('pointerdown', tap);
  window.addEventListener('resize', sizeEd);
  setTimeout(sizeEd, 30);
}

// ---------- Share the mosaic as an image ----------
async function shareMosaic() {
  toast(L('shareStory') + '…', 'info');
  const ids = orderedIds();
  const n = Math.max(1, ids.length);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const S = 1080, pad = 40, board = S - pad * 2, ts = board / cols, cell = ts / TILE;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S + 130;
  const x = cv.getContext('2d');
  x.fillStyle = '#0d0d11'; x.fillRect(0, 0, cv.width, cv.height);
  ids.forEach((uid, i) => {
    const ox = pad + (i % cols) * ts, oy = pad + Math.floor(i / cols) * ts;
    x.fillStyle = '#f4f4f2'; x.fillRect(ox + 1, oy + 1, ts - 2, ts - 2);
    for (const [k, px] of tiles.get(uid).cells) { const [cx, cy] = k.split(',').map(Number); x.fillStyle = px.color; x.fillRect(ox + cx * cell, oy + cy * cell, cell, cell); }
  });
  x.textAlign = 'center'; x.fillStyle = '#FFD600'; x.font = 'bold 46px sans-serif';
  x.fillText('🧩 ' + (chatRef.title || 'Pixel Art') + ' · InstantCrowdArt', S / 2, S + 44);
  x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif';
  x.fillText(L('shareCta') + ' ' + (chatRef.short_code || 'FOUND1'), S / 2, S + 100);

  const url = joinUrl(chatRef.short_code) + '?r=' + (userId() || '');
  const text = L('shareText');
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  try {
    const file = new File([blob], 'mosaic.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, url }); return; }
    window.open(URL.createObjectURL(blob), '_blank');
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(L('copied'), 'ok'); } catch { /* ignore */ }
  } catch { /* cancelled */ }
}

// ---------- Rules ----------
function showRules() {
  const list = h('ul', { class: 'icc-legal-list' }, L('rules').map((r) => h('li', {}, r)));
  const cta = h('button', { class: 'icc-btn' }, L('proposeChange'));
  const m = modal('ℹ️ ' + L('rulesTitle'), h('div', { class: 'icc-legal' }, [
    list, h('p', { class: 'icc-muted small', style: 'margin-top:12px' }, L('rulesCta')),
    h('div', { style: 'padding:8px 0 4px' }, cta),
  ]));
  cta.addEventListener('click', () => { m.close(); openFeedbackFlow(); });
}

function cleanup() {
  clearInterval(timer); clearInterval(pollTimer);
  unsubscribePixels(); unsubscribePresence();
  window.removeEventListener('resize', sizeMosaic);
  tiles.clear(); likeCount.clear(); myLikes.clear(); selectedUid = null;
  mCtx = null; mCanvas = null; chatRef = null;
  document.querySelectorAll('.icc-fab, .icc-admin-fab').forEach((n) => n.remove());
}
