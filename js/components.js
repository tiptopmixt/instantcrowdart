// Reusable UI components: AdSense banner, floating feedback button + flow,
// onboarding modal, and a generic modal shell.
import { h, el, toast } from './utils.js';
import { t } from './i18n.js';
import { CONFIG, isAdmin } from './config.js';
import { callFn } from './supabase.js';
import { userId, nickname, emoji, reroll, setRole } from './auth.js';
import { navigate } from './router.js';
import { openTerms } from './legal.js';
import { LANGS, L, setUiLang, hasLang, rankTitle, uiLang } from './locale.js';
import { roles, traits } from './company.js';

// --- Google AdSense 320x50 banner (placeholder id, no popups/interstitials) ---
export function adsBanner() {
  const wrap = h('div', { class: 'icc-ads' });
  // TODO: replace ADSENSE_PUB_ID with your real publisher id and create an ad unit.
  wrap.innerHTML = `
    <!-- AdSense 320x50 banner. TODO: set data-ad-client & data-ad-slot before launch. -->
    <ins class="adsbygoogle"
         style="display:inline-block;width:320px;height:50px"
         data-ad-client="${CONFIG.ADSENSE_PUB_ID}"
         data-ad-slot="0000000000"></ins>`;
  // Guard: only push if the AdSense script actually loaded.
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
  return wrap;
}

// --- Generic modal shell ---
// onClose (optional) fires once when the user dismisses via ✕ or click-outside,
// so callers awaiting a result never hang.
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

// --- Onboarding: private 1-to-1 AI mini dialog on join ---
// Returns a Promise that resolves with the detected language once done.
export function runOnboarding(chatId) {
  return new Promise((resolve) => {
    const log = h('div', { class: 'icc-onb-log' });
    const input = h('input', { class: 'icc-onb-input', placeholder: t('typeMessage') });
    const sendBtn = h('button', { class: 'icc-btn' }, t('send'));
    const body = h('div', { class: 'icc-onb' }, [
      log,
      h('div', { class: 'icc-onb-row' }, [input, sendBtn]),
    ]);
    let history = [];
    let detectedLang = null;
    // Closing early (✕ / outside) still lets the user into the chat.
    const m = modal(t('onboardingTitle'), body, () => resolve(detectedLang));

    const addBubble = (who, text) => {
      log.appendChild(h('div', { class: 'icc-onb-bubble ' + who }, text));
      log.scrollTop = log.scrollHeight;
    };

    const step = async (userText) => {
      if (userText) { addBubble('me', userText); history.push({ role: 'user', content: userText }); }
      input.disabled = sendBtn.disabled = true;
      const { data, error } = await callFn('icc-onboarding', {
        chat_id: chatId, user_id: userId(), nickname: nickname(), history,
        ui_language: uiLang(),
      });
      input.disabled = sendBtn.disabled = false;
      if (error || !data) { addBubble('ai', 'Assistant is busy, please try again.'); return; }
      if (data.language) detectedLang = data.language;
      if (data.reply) { addBubble('ai', data.reply); history.push({ role: 'assistant', content: data.reply }); }
      if (data.done) {
        input.disabled = sendBtn.disabled = true;
        setTimeout(() => { m.close(); resolve(detectedLang); }, 900);
      } else {
        input.focus();
      }
    };

    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      step(v);
    };
    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    // Kick off with the AI's first (English) message.
    step(null);
  });
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

// --- Confetti burst (pure emoji, no deps) ---
export function confetti(n = 28) {
  const layer = h('div', { class: 'icc-confetti' });
  const bits = ['⚡', '🎉', '🦊', '🐻', '🦉', '⭐', '✨', '🔥'];
  for (let i = 0; i < n; i++) {
    const s = h('span', {}, bits[Math.floor(Math.random() * bits.length)]);
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 0.3).toFixed(2) + 's';
    s.style.fontSize = (14 + Math.random() * 22) + 'px';
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2200);
}

// --- Intro flow: build your identity in the company — creature → position → trait. ---
// You take your seat in the org, then can invite your crew. Resolves 'enter' when done.
export function introGame(onInvite) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'icc-modal-overlay' });
    const box = h('div', { class: 'icc-modal icc-game' });
    const done = (v) => { overlay.remove(); resolve(v); };
    let chosenRole = '', chosenTrait = '';

    // Step 1 — your creature
    const stepCreature = () => {
      box.innerHTML = '';
      const big = h('div', { class: 'icc-creature-emoji' }, emoji());
      const name = h('div', { class: 'icc-creature-name' }, nickname());
      const rerollBtn = h('button', { class: 'icc-btn ghost' }, '🎲 Reroll');
      rerollBtn.addEventListener('click', async () => {
        rerollBtn.disabled = true;
        big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
        await reroll(); big.textContent = emoji(); name.textContent = nickname();
        rerollBtn.disabled = false;
      });
      const next = h('button', { class: 'icc-btn' }, '→');
      next.addEventListener('click', stepRole);
      box.appendChild(h('h2', { class: 'icc-game-title' }, '⚡ ' + L('idTitle')));
      box.appendChild(h('p', { class: 'icc-muted' }, L('idCreature')));
      box.appendChild(h('div', { class: 'icc-creature' }, [big, name, h('div', { class: 'icc-game-actions' }, [rerollBtn, next])]));
    };

    // Step 2 — your position in the company (or write your own)
    const stepRole = () => {
      box.innerHTML = '';
      box.appendChild(h('h2', { class: 'icc-game-title' }, L('idRoleTitle')));
      box.appendChild(h('p', { class: 'icc-muted' }, L('idRoleSub')));
      box.appendChild(pickGrid(roles(), (r) => { chosenRole = r; stepTrait(); }, L('customRolePh'), '⭐'));
    };

    // Step 3 — your strong positive trait (or write your own)
    const stepTrait = () => {
      box.innerHTML = '';
      box.appendChild(h('h2', { class: 'icc-game-title' }, L('idTraitTitle')));
      box.appendChild(h('p', { class: 'icc-muted' }, L('idTraitSub')));
      box.appendChild(pickGrid(traits(), async (tr) => {
        chosenTrait = tr; await setRole(chosenRole, chosenTrait); reveal();
      }, L('customTraitPh'), '✨'));
    };

    // Reveal — you've got your seat
    const reveal = () => {
      box.innerHTML = '';
      confetti();
      box.appendChild(h('div', { class: 'icc-game-win' }, L('youWin')));
      box.appendChild(h('div', { class: 'icc-seat' }, [
        h('div', { class: 'icc-seat-who' }, `${emoji()} ${nickname()}`),
        h('div', { class: 'icc-seat-role' }, chosenRole),
        h('div', { class: 'icc-seat-trait' }, '💪 ' + chosenTrait),
      ]));
      const enter = h('button', { class: 'icc-btn icc-btn-xl' }, L('enterChat'));
      enter.addEventListener('click', () => done('enter'));
      const invite = h('button', { class: 'icc-btn ghost' }, L('inviteCrew'));
      invite.addEventListener('click', () => onInvite?.());
      box.appendChild(h('div', { class: 'icc-game-actions' }, [invite, enter]));
    };

    stepCreature();
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// Inline free-text entry used by role/trait pickers ("write your own category").
function customInput(placeholder, onOk) {
  const wrap = h('div', { class: 'icc-custom-row' });
  const inp = h('input', { class: 'icc-onb-input', placeholder, maxlength: '40' });
  const ok = h('button', { class: 'icc-btn' }, 'OK');
  const submit = () => { const v = inp.value.trim(); if (v) onOk(v); };
  ok.addEventListener('click', submit);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  wrap.appendChild(inp); wrap.appendChild(ok);
  setTimeout(() => inp.focus(), 60);
  return wrap;
}

// Build a pick grid with a dashed "write your own" tile at the end.
function pickGrid(options, onPick, customPh, customPrefix) {
  const grid = h('div', { class: 'icc-pick-grid' });
  options.forEach((o) => {
    const b = h('button', { class: 'icc-pick' }, o);
    b.addEventListener('click', () => onPick(o));
    grid.appendChild(b);
  });
  const custom = h('button', { class: 'icc-pick custom' }, L('customTile'));
  custom.addEventListener('click', () => {
    grid.replaceWith(customInput(customPh, (v) => onPick(customPrefix + ' ' + v)));
  });
  grid.appendChild(custom);
  return grid;
}

// --- Role picker: change your position + trait anytime (roles evolve over the 24h). ---
// Resolves { position, trait } (saved to metadata) or null if cancelled.
export function rolePicker() {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'icc-modal-overlay' });
    const box = h('div', { class: 'icc-modal icc-game' });
    const close = (v) => { overlay.remove(); resolve(v); };
    let chosenRole = '';

    const head = (title) => h('div', { class: 'icc-modal-head' }, [
      h('strong', {}, title), h('button', { class: 'icc-x', onclick: () => close(null) }, '✕'),
    ]);
    const stepRole = () => {
      box.innerHTML = '';
      box.appendChild(head(L('idRoleTitle')));
      box.appendChild(pickGrid(roles(), (r) => { chosenRole = r; stepTrait(); }, L('customRolePh'), '⭐'));
    };
    const stepTrait = () => {
      box.innerHTML = '';
      box.appendChild(head(L('idTraitTitle')));
      box.appendChild(pickGrid(traits(), async (tr) => {
        await setRole(chosenRole, tr); close({ position: chosenRole, trait: tr });
      }, L('customTraitPh'), '✨'));
    };
    stepRole();
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// --- Creature picker: choose (or re-roll) your animal before joining. Fun onboarding. ---
// Any way of closing (join, ✕, click-outside) resolves with the current creature so the
// join flow never hangs.
export function creaturePicker() {
  return new Promise((resolve) => {
    const big = h('div', { class: 'icc-creature-emoji' }, emoji());
    const name = h('div', { class: 'icc-creature-name' }, nickname());
    const rerollBtn = h('button', { class: 'icc-btn ghost' }, '🎲 Reroll');
    const joinBtn = h('button', { class: 'icc-btn' }, 'Join as this creature ⚡');

    const overlay = h('div', { class: 'icc-modal-overlay' });
    let done = false;
    const finish = () => { if (done) return; done = true; overlay.remove(); resolve(nickname()); };

    rerollBtn.addEventListener('click', async () => {
      rerollBtn.disabled = true;
      big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
      await reroll();
      big.textContent = emoji();
      name.textContent = nickname();
      rerollBtn.disabled = false;
    });
    joinBtn.addEventListener('click', finish);

    const box = h('div', { class: 'icc-modal' }, [
      h('div', { class: 'icc-modal-head' }, [
        h('strong', {}, 'Meet your creature'),
        h('button', { class: 'icc-x', onclick: finish }, '✕'),
      ]),
      h('div', { class: 'icc-creature' }, [
        h('p', { class: 'icc-creature-lead' }, 'This is you in the crowd. Roll until you love it!'),
        big, name,
        h('div', { class: 'icc-creature-actions' }, [rerollBtn, joinBtn]),
      ]),
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
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

  // Start challenges (work anywhere).
  act(t('adminStartTest'), { action: 'start_new', duration_minutes: 10 }, (d) => d?.short_code && navigate('/c/' + d.short_code));
  act(t('adminStart24'), { action: 'start_new', duration_minutes: 1440 }, (d) => d?.short_code && navigate('/c/' + d.short_code));

  // Timer controls for the current chat (only when a chat is in context).
  if (chat) {
    act(t('adminResetTimer'), { action: 'set_timer', chat_id: chat.id, minutes: 1440 }, reloadSoon);
    act(t('adminSet10'), { action: 'set_timer', chat_id: chat.id, minutes: 10 }, reloadSoon);
    act(t('adminSet1h'), { action: 'set_timer', chat_id: chat.id, minutes: 60 }, reloadSoon);
    act(t('adminCloseNow'), { action: 'force_close', chat_id: chat.id }, reloadSoon);
  }

  modal(t('adminPanel'), h('div', { class: 'icc-admin' }, rows));
}

function reloadSoon() { setTimeout(() => location.reload(), 600); }

// --- Floating "Improve this app" feedback flow (icc-feedback) ---
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
  const pledge = h('p', { class: 'icc-pledge' }, t('pledge'));
  const body = h('div', { class: 'icc-onb' }, [
    intro, pledge, log, h('div', { class: 'icc-onb-row' }, [input, sendBtn]),
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
    if (error || !data) { addBubble('ai', 'Assistant is busy, please try again.'); return; }
    if (data.reply) { addBubble('ai', data.reply); history.push({ role: 'assistant', content: data.reply }); }
    if (data.saved) {
      toast('💡 ' + (data.confirmation || 'Idea saved'), 'ok');
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
