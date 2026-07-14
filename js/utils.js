// Small shared helpers: DOM, escaping, countdown, toast, share.
import { t } from './i18n.js';

export const el = (sel, root = document) => root.querySelector(sel);
export const els = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Countdown formatting from an expires_at ISO string (days-aware).
export function formatRemaining(expiresAt) {
  if (!expiresAt) return '∞';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export function isExpired(expiresAt) {
  return expiresAt && new Date(expiresAt).getTime() - Date.now() <= 0;
}

let toastTimer = null;
export function toast(msg, kind = 'info') {
  let box = el('#icc-toast');
  if (!box) {
    box = h('div', { id: 'icc-toast' });
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = ''), 3200);
}

// Web Share API with clipboard fallback.
export async function share({ title, text, url }) {
  const payload = { title, text, url };
  if (navigator.share) {
    try { await navigator.share(payload); return true; } catch { /* cancelled */ return false; }
  }
  const full = `${text}\n${url}`.trim();
  try {
    await navigator.clipboard.writeText(full);
    toast(t('copied'), 'ok');
    return true;
  } catch {
    toast(url, 'info');
    return false;
  }
}

export function joinUrl(code) {
  return `${location.origin}${location.pathname}#/c/${code}`;
}
