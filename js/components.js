// Reusable UI components: AdSense banner, modal shell, language gate,
// terms link, admin panel, floating Feedback flow.
import { h, toast } from './utils.js';
import { t } from './i18n.js';
import { CONFIG, isAdmin } from './config.js';
import { callFn } from './supabase.js';
import { userId, nickname } from './auth.js';
import { navigate } from './router.js';
import { openTerms } from './legal.js';
import { LANGS, L, setUiLang, hasLang } from './locale.js';

// --- Google AdSense 320x50 banner (placeholder id, no popups/interstitials) ---
export function adsBanner() {
  const wrap = h('div', { class: 'icc-ads' });
  wrap.innerHTML = `
    <ins class="adsbygoogle"
         style="display:inline-block;width:320px;height:50px"
         data-ad-client="${CONFIG.ADSENSE_PUB_ID}"
         data-ad-slot="0000000000"></ins>`;
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
  return wrap;
}

// --- Generic modal shell ---
export function modal(title, contentNode, onClose) {
  const overlay = h('div', { class: 'icc-modal-overlay' });
  let closed = false;
  const close = () => { if (closed) return; closed = true; overlay.remove(); onClose?.(); };
  const box = h('div', { class: 'icc-modal' }, [
    h('div', { class: 'icc-modal-head' }, [
      h('strong', {}, title),
      h('button', { class: 'icc-x', onclick: close }, '✕'),
    ]),
    contentNode,
  ]);
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  return { overlay, close };
}

// --- Language flag gate: the very first thing the user sees. ---
export function languageGate(force = false) {
  return new Promise((resolve) => {
    if (!force && hasLang()) return resolve();
    const overlay = h('div', { class: 'icc-modal-overlay icc-lang-gate' });
    const pick = (code) => { setUiLang(code); overlay.remove(); resolve(); };
    const flags = h('div', { class: 'icc-lang-flags' }, LANGS.map((l) =>
      h('button', { class: 'icc-lang-flag', onclick: () => pick(l.code) }, [
        h('span', { class: 'icc-lang-flag-emoji' }, l.flag),
        h('span', { class: 'icc-lang-flag-name' }, l.name),
      ])));
    const box = h('div', { class: 'icc-modal icc-lang-box' }, [
      h('div', { class: 'icc-lang-logo' }, '⚡'),
      h('h2', { class: 'icc-lang-title' }, L('langTitle')),
      h('p', { class: 'icc-muted' }, L('langSub')),
      flags,
    ]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// --- Persistent "What is this? / Terms" link ---
export function termsLink() {
  const a = h('button', { class: 'icc-link icc-terms' }, t('terms'));
  a.addEventListener('click', openTerms);
  return a;
}

// --- Admin controls (test the flow, reset the 24h timer). Only for the admin user. ---
export function adminButton(chat) {
  if (!isAdmin(userId())) return null;
  const btn = h('button', { class: 'icc-admin-fab', title: t('adminPanel') }, t('admin'));
  btn.addEventListener('click', () => openAdminPanel(chat));
  return btn;
}

export function openAdminPanel(chat) {
  const rows = [];
  const act = async (label, body, after) => {
    const b = h('button', { class: 'icc-btn icc-btn-sm' }, label);
    b.addEventListener('click', async () => {
      b.disabled = true;
      const { data, error } = await callFn('icc-close-chat', { ...body, admin_user_id: userId() });
      if (error || data?.error) { toast(data?.error || t('adminForbidden'), 'error'); b.disabled = false; return; }
      toast(t('adminDone'), 'ok');
      after?.(data);
    });
    rows.push(h('div', { class: 'icc-admin-row' }, b));
  };

  act(t('adminStartTest'), { action: 'start_new', duration_minutes: 10 }, (d) => d?.short_code && navigate('/c/' + d.short_code));
  act(t('adminStart24'), { action: 'start_new', duration_minutes: 1440 }, (d) => d?.short_code && navigate('/c/' + d.short_code));
  if (chat) {
    act(t('adminResetTimer'), { action: 'set_timer', chat_id: chat.id, minutes: 1440 }, reloadSoon);
    act(t('adminSet10'), { action: 'set_timer', chat_id: chat.id, minutes: 10 }, reloadSoon);
    act(t('adminSet1h'), { action: 'set_timer', chat_id: chat.id, minutes: 60 }, reloadSoon);
    act(t('adminCloseNow'), { action: 'force_close', chat_id: chat.id }, reloadSoon);
  }
  modal(t('adminPanel'), h('div', { class: 'icc-admin' }, rows));
}

function reloadSoon() { setTimeout(() => location.reload(), 600); }

// --- Floating Feedback flow (icc-feedback) ---
export function feedbackButton() {
  const btn = h('button', { class: 'icc-fab', title: L('feedback') }, L('feedback'));
  btn.addEventListener('click', openFeedbackFlow);
  return btn;
}

export function openFeedbackFlow() {
  const log = h('div', { class: 'icc-onb-log' });
  const input = h('input', { class: 'icc-onb-input', placeholder: L('typeMessage') });
  const sendBtn = h('button', { class: 'icc-btn' }, L('send'));
  const intro = h('p', { class: 'icc-feedback-intro' }, L('feedbackIntro'));
  const body = h('div', { class: 'icc-onb' }, [
    intro, log, h('div', { class: 'icc-onb-row' }, [input, sendBtn]),
  ]);
  const m = modal(L('feedback'), body);

  let history = [];
  const addBubble = (who, text) => {
    log.appendChild(h('div', { class: 'icc-onb-bubble ' + who }, text));
    log.scrollTop = log.scrollHeight;
  };

  const step = async (userText) => {
    if (userText) { addBubble('me', userText); history.push({ role: 'user', content: userText }); }
    input.disabled = sendBtn.disabled = true;
    const { data, error } = await callFn('icc-feedback', {
      user_id: userId(), nickname: nickname(), history,
    });
    input.disabled = sendBtn.disabled = false;
    if (error || !data) { addBubble('ai', L('assistantBusy')); return; }
    if (data.reply) { addBubble('ai', data.reply); history.push({ role: 'assistant', content: data.reply }); }
    if (data.saved) {
      toast('💡 ' + (data.confirmation || 'ok'), 'ok');
      setTimeout(m.close, 1200);
    } else input.focus();
  };

  const submit = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    step(v);
  };
  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  step(null);
}
