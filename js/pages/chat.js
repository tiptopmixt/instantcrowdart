// Chat page (#/c/CODE) — the private-lane model:
//  LEFT/bottom  = your PRIVATE thread with the AI assistant (nobody else reads it).
//  RIGHT/top    = the SHARED board everyone sees: who's here, what they want to
//                 do/create/become, the collective recap, goal and stats.
import { h, el, escapeHtml, formatRemaining, isExpired, toast, joinUrl } from '../utils.js';
import { t } from '../i18n.js';
import { aiAvatarSVG } from '../mascot.js';
import { flagsFromLangs } from '../flags.js';
import {
  getChatByCode, getMyProfile, joinChat, getMessages, getActiveProfiles,
  insertMyMessage, castVote, getVotes, insertIdea,
  recordReferrer, getOrgProfiles, updateDesire,
} from '../data.js';
import { subscribeMessages, unsubscribeMessages, subscribePresence, unsubscribePresence } from '../realtime.js';
import { adsBanner, modal, openFeedbackFlow, openAdminPanel } from '../components.js';
import { callFn } from '../supabase.js';
import { userId, nickname } from '../auth.js';
import { isAdmin } from '../config.js';
import { navigate, getQueryParam } from '../router.js';
import { requireConsent } from '../legal.js';
import { L, uiLang } from '../locale.js';
import { departments } from '../company.js';
import { renderCrowd, nicknamesFromPresence } from '../crowd.js';
import { shareCard } from '../share-card.js';

let timer = null;
let state = { chat: null, blocked: false, over: false, count: 0, myDesire: '' };

function isOver(chat) {
  return chat.status === 'closed' || (chat.status !== 'founding' && isExpired(chat.expires_at));
}

// Private lane filter: my messages + AI messages for me (or global announcements).
// Pinned recaps live on the shared board, not in the lane.
function inMyLane(m) {
  if (m.is_pinned) return false;
  if (m.user_id === userId()) return true;
  return !!m.is_ai && (m.recipient_id == null || m.recipient_id === userId());
}

export async function renderChat(root, code) {
  cleanup();
  const { chat } = await getChatByCode(code);
  if (!chat) { navigate('/'); return; }
  state.chat = chat;

  root.innerHTML = '';
  const page = h('div', { class: 'icc-page icc-chat' });

  // Top bar: back, title, countdown, clear Share button
  const countdown = h('span', { class: 'icc-mini-count', id: 'chat-countdown' },
    chat.status === 'founding' ? '∞' : formatRemaining(chat.expires_at));
  const shareBtn = h('button', { class: 'icc-share-cta', title: L('shareStory') }, ['📤 ', L('share')]);
  shareBtn.addEventListener('click', () => shareChallenge(chat));
  // Admin + Feedback as small icons in the top bar (never over the input box).
  const tools = [];
  if (isAdmin(userId())) {
    const a = h('button', { class: 'icc-tool', title: t('adminPanel') }, '⚙︎');
    a.addEventListener('click', () => openAdminPanel(chat));
    tools.push(a);
  }
  const fb = h('button', { class: 'icc-tool', title: L('feedback') }, '💬');
  fb.addEventListener('click', () => openFeedbackFlow());
  tools.push(fb);
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹'),
    h('div', { class: 'icc-topbar-title' }, chat.title),
    countdown, ...tools, shareBtn,
  ]));

  // Burning fuse: the 24h literally burn away across the top of the chat.
  page.appendChild(h('div', { class: 'icc-fuse' + (chat.status === 'founding' ? ' infinite' : '') }, [
    h('div', { class: 'icc-fuse-fill', id: 'chat-fuse' }, [h('span', { class: 'icc-fuse-spark' })]),
  ]));

  // Compact flags + crowd row
  const flagsBar = h('div', { class: 'icc-flags', id: 'chat-flags', title: t('flagsTooltip') });
  flagsBar.addEventListener('click', () => toast(t('flagsTooltip'), 'info'));
  page.appendChild(h('div', { class: 'icc-headrow' }, [
    flagsBar,
    h('div', { class: 'icc-crowd', id: 'chat-crowd' }),
  ]));

  // Vote banner slot
  page.appendChild(h('div', { id: 'chat-vote-banner' }));

  // --- Split: SHARED board + PRIVATE assistant lane ---
  const board = h('div', { class: 'icc-board', id: 'chat-board' });
  const laneWrap = h('div', { class: 'icc-lane' }, [
    h('div', { class: 'icc-lane-label' }, '🔒 ' + L('privateLane')),
    h('div', { class: 'icc-feed', id: 'chat-feed' }),
  ]);
  page.appendChild(h('div', { class: 'icc-split' }, [board, laneWrap]));
  const feed = el('#chat-feed', laneWrap);

  // Read-only banner slot
  const endedSlot = h('div', { id: 'chat-ended-slot' });
  page.appendChild(endedSlot);

  // Quick-reply sparks
  const quick = h('div', { class: 'icc-quick', id: 'chat-quick' });
  page.appendChild(quick);

  // Input bar
  const input = h('input', { class: 'icc-input', placeholder: L('typeMessage'), id: 'chat-input' });
  const sendBtn = h('button', { class: 'icc-btn', id: 'chat-send' }, L('send'));
  const inputBar = h('div', { class: 'icc-inputbar' }, [input, sendBtn]);
  page.appendChild(inputBar);
  page.appendChild(adsBanner());

  root.appendChild(page);

  buildQuickReplies(quick, chat, input, sendBtn, feed);

  const applyReadOnly = () => {
    if (state.over && el('#chat-ended-slot .icc-ended')) return;
    state.over = true;
    input.disabled = sendBtn.disabled = true;
    input.placeholder = t('readOnly');
    inputBar.classList.add('disabled');
    quick.style.display = 'none';
    endedSlot.innerHTML = '';
    endedSlot.appendChild(h('div', { class: 'icc-ended' }, [
      h('strong', {}, '🏁 ' + t('chatEndedTitle')),
      h('span', {}, t('chatEndedInfo')),
    ]));
  };

  // --- Entry: language was chosen at the gate; only consent, then straight in. ---
  let profile = await getMyProfile(chat.id);
  if (!profile) {
    const agreed = await requireConsent();
    if (!agreed) { toast(t('mustAccept'), 'info'); navigate('/'); return; }
    await joinChat(chat.id, uiLang());
    await recordReferrer(chat.id, getQueryParam('r'));
    profile = await getMyProfile(chat.id);
  }
  state.myDesire = profile?.position || '';
  if (profile && profile.violations >= 3) {
    state.blocked = true;
    toast(t('blocked'), 'error');
    input.disabled = sendBtn.disabled = true;
  }
  if (isOver(chat)) applyReadOnly();

  // Load my private lane
  const { messages } = await getMessages(chat.id);
  const lane = messages.filter(inMyLane);
  lane.forEach((m) => feed.appendChild(messageNode(m)));

  // First time here: the assistant opens with THE question (client-side greeting).
  if (!lane.length && !state.over) {
    feed.appendChild(messageNode({
      id: 'greet', is_ai: true,
      content: L('greet').replace('{name}', nickname()),
    }));
  }
  feed.scrollTop = feed.scrollHeight;

  await refreshFlags(chat.id);
  await renderBoard(chat);

  // Realtime
  subscribeMessages(chat.id, (row) => {
    if (row.is_ai || row.is_pinned) { refreshVoteBanner(chat); refreshFlags(chat.id); renderBoard(chat); }
    if (!inMyLane(row)) return;
    const existing = el(`[data-mid="${row.id}"]`, feed);
    const node = messageNode(row);
    if (existing) existing.replaceWith(node);
    else feed.appendChild(node);
    const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
    if (nearBottom) feed.scrollTop = feed.scrollHeight;
  });
  let prevCount = -1;
  subscribePresence(chat.id, (count, pstate) => {
    const nicks = nicknamesFromPresence(pstate);
    renderCrowd(el('#chat-crowd'), nicks);
    state.count = count;
    if (count !== prevCount) { prevCount = count; renderBoard(chat); }
  });

  // Countdown tick + expiry
  timer = setInterval(async () => {
    const c = el('#chat-countdown');
    if (c && chat.status !== 'founding') c.textContent = formatRemaining(chat.expires_at);
    const ff = el('#chat-fuse');
    if (ff && chat.status !== 'founding' && chat.expires_at) {
      const total = new Date(chat.expires_at).getTime() - new Date(chat.created_at).getTime();
      const left = new Date(chat.expires_at).getTime() - Date.now();
      if (total > 0) ff.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + '%';
    }
    if (chat.status !== 'founding' && !state.over && isExpired(chat.expires_at)) {
      clearInterval(timer);
      applyReadOnly();
      await callFn('icc-close-chat', { chat_id: chat.id });
      refreshVoteBanner(chat);
    }
  }, 1000);

  const submit = () => sendMessage(chat, input, sendBtn, feed);
  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  refreshVoteBanner(chat);
}

// --- Quick chips = pick your area of the company (tap to set it), plus an idea spark ---
function buildQuickReplies(container, chat, input, sendBtn, feed) {
  container.innerHTML = '';
  // Department chips: tap = "I'd like to work in X" → sets your area + tells the assistant.
  departments().forEach((dep) => {
    const b = h('button', { class: 'icc-chip' }, dep);
    b.addEventListener('click', async () => {
      state.myDesire = dep;
      await updateDesire(chat.id, dep);
      renderBoard(chat);
      input.value = `${L('wantArea')} ${dep}`;
      await sendMessage(chat, input, sendBtn, feed);
    });
    container.appendChild(b);
  });
  // Idea spark (starts a 💡 message that pins on the board).
  const idea = h('button', { class: 'icc-chip' }, L('qrIdea'));
  idea.addEventListener('click', () => { input.value = '💡 '; input.focus(); });
  container.appendChild(idea);
}

// --- SHARED board: the collective picture everyone sees ---
async function renderBoard(chat) {
  const board = el('#chat-board');
  if (!board) return;

  const { chat: fresh } = await getChatByCode(chat.short_code);
  const goal = fresh?.current_goal;
  const recap = await latestRecapText(chat.id, 220);
  const people = await getOrgProfiles(chat.id);

  board.innerHTML = '';
  board.appendChild(h('div', { class: 'icc-board-head' }, [
    h('span', { class: 'icc-live' }, '● ' + L('boardLive')),
    h('strong', {}, '🏢 ' + L('org') + ` · ${people.length}`),
    h('span', { class: 'icc-board-sub' }, '👁 ' + L('boardPublic')),
  ]));

  if (goal) {
    board.appendChild(h('div', { class: 'icc-board-goal' }, [
      h('span', { class: 'icc-board-tag' }, '🎯 ' + L('boardGoal')),
      h('span', {}, goal),
    ]));
  }

  // The collective recap = what we're building together (from everyone's private input).
  board.appendChild(h('div', { class: 'icc-board-recap' }, [
    h('span', { class: 'icc-board-tag' }, '⚡ ' + L('board')),
    h('div', {}, recap || L('boardEmpty')),
  ]));

  // Who's here and what each wants to do / create / become.
  if (people.length) {
    const org = h('div', { class: 'icc-org' });
    people.forEach((p) => org.appendChild(orgNode(p, chat)));
    board.appendChild(org);
  }
}

function orgNode(p, chat) {
  const me = p.user_id === userId();
  const desire = p.position
    ? h('span', { class: 'icc-org-role' }, p.position)
    : (me ? h('span', { class: 'icc-org-role dim' }, '＋ ' + L('editDesire')) : null);
  const node = h('div', { class: 'icc-org-node' + (me ? ' me editable' : '') }, [
    h('span', { class: 'icc-org-dot' }, '•'),
    h('span', { class: 'icc-org-name' }, (p.nickname || 'anon') + (me ? ` (${L('orgYou')})` : '')),
    desire,
  ]);
  if (me) { node.title = '✎'; node.addEventListener('click', () => editMyDesire(chat)); }
  return node;
}

// Tap your own row → rewrite what you'd like to do/create/become (evolves anytime).
function editMyDesire(chat) {
  const input = h('input', { class: 'icc-onb-input', placeholder: L('editDesirePh'), maxlength: '60', value: state.myDesire || '' });
  const ok = h('button', { class: 'icc-btn' }, 'OK');
  const body = h('div', { class: 'icc-custom-row', style: 'padding:16px' }, [input, ok]);
  const m = modal(L('editDesire'), body);
  const save = async () => {
    const v = input.value.trim();
    if (!v) return;
    m.close();
    state.myDesire = v;
    await updateDesire(chat.id, v);
    renderBoard(chat);
    toast('✅ ' + v, 'ok');
  };
  ok.addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  setTimeout(() => input.focus(), 60);
}

async function sendMessage(chat, input, sendBtn, feed) {
  if (state.over) { toast(t('chatEndedTitle'), 'info'); return; }
  if (state.blocked) { toast(t('blocked'), 'error'); return; }
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  sendBtn.disabled = true;

  const { data, error } = await callFn('icc-moderate', {
    chat_id: chat.id, user_id: userId(), content, nickname: nickname(),
  });
  sendBtn.disabled = false;

  if (error) { toast(t('messageQueued'), 'info'); input.value = content; return; }
  if (data?.status === 'queued') { toast(t('messageQueued'), 'info'); return; }
  if (data?.status === 'rejected') {
    toast((data.reason ? '⛔ ' + data.reason : t('rejected')), 'error');
    if (data.blocked) { state.blocked = true; input.disabled = sendBtn.disabled = true; }
    return;
  }

  const { error: insErr } = await insertMyMessage(chat.id, content);
  if (insErr) { toast('Send failed', 'error'); input.value = content; return; }

  // A message starting with 💡 becomes a spark on the shared board.
  if (content.startsWith('💡')) {
    const summary = content.replace(/^💡\s*/, '').replace(/^[^:]{0,40}:\s*/, '').trim() || content.replace(/^💡\s*/, '');
    await insertIdea(summary);
    renderBoard(chat);
  }

  // The private assistant answers in MY lane (server decides; fire-and-forget).
  callFn('icc-reply', { chat_id: chat.id, user_id: userId() }).then(() => {
    // The assistant may have extracted my desire — refresh the shared board.
    setTimeout(() => { refreshMyDesire(chat); }, 800);
  });

  maybeTriggerRecap(chat.id);
}

async function refreshMyDesire(chat) {
  const p = await getMyProfile(chat.id);
  if (p && p.position && p.position !== state.myDesire) {
    state.myDesire = p.position;
    renderBoard(chat);
  }
}

async function maybeTriggerRecap(chatId) {
  const feed = el('#chat-feed');
  const count = feed ? feed.querySelectorAll('.icc-msg').length : 0;
  const every = count < 30 ? 8 : 15;
  if (count > 0 && count % every === 0) callFn('icc-summarize', { chat_id: chatId });
}

function messageNode(m) {
  const mine = m.user_id === userId();
  const cls = 'icc-msg' + (m.is_ai ? ' ai' : mine ? ' mine' : '') + (m.is_pinned ? ' pinned' : '');
  const node = h('div', { class: cls, 'data-mid': m.id });

  if (m.is_ai) node.appendChild(h('div', { class: 'icc-msg-avatar', html: aiAvatarSVG(30) }));

  const bubble = h('div', { class: 'icc-bubble' });
  if (!mine) bubble.appendChild(h('div', { class: 'icc-msg-nick' }, m.is_ai ? t('aiName') : (m.nickname || 'anon')));
  bubble.appendChild(h('div', { class: 'icc-msg-text', html: escapeHtml(m.content).replace(/\n/g, '<br>') }));

  const actions = h('div', { class: 'icc-msg-actions' });
  const trBtn = h('button', { class: 'icc-icon-btn', title: t('translate') }, '🌐');
  trBtn.addEventListener('click', () => translateMessage(m, bubble));
  actions.appendChild(trBtn);
  bubble.appendChild(actions);

  node.appendChild(bubble);
  return node;
}

async function translateMessage(m, bubble) {
  if (el('.icc-translation', bubble)) return;
  const { data, error } = await callFn('icc-translate', { message: m.content, user_id: userId() });
  if (error || !data?.translation) { toast('Translation unavailable', 'error'); return; }
  bubble.appendChild(h('div', { class: 'icc-translation' }, '🌐 ' + data.translation));
}

async function refreshFlags(chatId) {
  const profiles = await getActiveProfiles(chatId);
  const langs = profiles.map((p) => p.language).filter(Boolean);
  const flags = flagsFromLangs(langs);
  const bar = el('#chat-flags');
  if (!bar) return;
  const have = new Set([...bar.children].map((c) => c.dataset.flag));
  bar.innerHTML = '';
  flags.forEach(({ lang, flag }) => {
    bar.appendChild(h('span', { class: 'icc-flag' + (have.has(flag) ? '' : ' icc-flag-new'), 'data-flag': flag, title: lang }, flag));
  });
  if (!flags.length) bar.appendChild(h('span', { class: 'icc-muted' }, '🏳️'));
}

// --- Voting UI ---
async function refreshVoteBanner(chat) {
  const banner = el('#chat-vote-banner');
  if (!banner) return;
  const finalR = await getVotes(chat.id, 'final_rating');
  banner.innerHTML = '';
  if (chat.status === 'closed' || finalR.length) { banner.appendChild(ratingBanner(chat)); return; }
  if (chat.current_goal == null) {
    const { messages } = await getMessages(chat.id, 50);
    const proposed = messages.filter((m) => m.is_pinned && /GOAL PROPOSAL:/.test(m.content)).pop();
    const goalVotes = await getVotes(chat.id, 'goal');
    if (proposed || goalVotes.length) {
      const label = proposed ? (proposed.content.match(/GOAL PROPOSAL:\s*(.+)/)?.[1] || t('goalVote')) : t('goalVote');
      banner.appendChild(yesNoBanner(chat, 'goal', '🎯 ' + label));
    }
  }
}

function yesNoBanner(chat, type, label) {
  const yes = h('button', { class: 'icc-btn icc-btn-sm' }, t('voteYes'));
  const no = h('button', { class: 'icc-btn icc-btn-sm ghost' }, t('voteNo'));
  yes.addEventListener('click', async () => { await castVote(chat.id, type, 'yes'); toast('✔', 'ok'); });
  no.addEventListener('click', async () => { await castVote(chat.id, type, 'no'); toast('✔', 'ok'); });
  return h('div', { class: 'icc-vote-banner' }, [h('span', {}, label), yes, no]);
}

function ratingBanner(chat) {
  const box = h('div', { class: 'icc-vote-banner' }, [h('span', {}, t('finalRating'))]);
  for (let i = 1; i <= 10; i++) {
    const b = h('button', { class: 'icc-rate' }, String(i));
    b.addEventListener('click', async () => { await castVote(chat.id, 'final_rating', i); toast('★ ' + i, 'ok'); });
    box.appendChild(b);
  }
  return box;
}

async function proposeExtension(chat) {
  await castVote(chat.id, 'extend', 'yes');
  const banner = el('#chat-vote-banner');
  if (banner && !el('.icc-vote-banner', banner)) banner.appendChild(yesNoBanner(chat, 'extend', t('proposeExtension')));
  toast('⚡ +24h', 'ok');
}

// --- Share (image card for Instagram stories) ---
async function shareChallenge(chat) {
  toast(L('shareStory') + '…', 'info');
  await shareCard({
    who: nickname(),
    role: state.myDesire || '',
    title: chat.title,
    count: state.count || chat.participant_count || 0,
    code: chat.short_code,
    url: joinUrl(chat.short_code) + '?r=' + (userId() || ''),
  });
}

async function latestRecapText(chatId, len = 180) {
  const { messages } = await getMessages(chatId, 50);
  const pinned = messages.filter((m) => m.is_pinned);
  const last = pinned[pinned.length - 1];
  if (!last) return '';
  return last.content.replace(/GOAL PROPOSAL:.*/s, '').replace(/\n+/g, ' ').trim().slice(0, len);
}

function cleanup() {
  clearInterval(timer);
  unsubscribeMessages();
  unsubscribePresence();
  state = { chat: null, blocked: false, over: false, count: 0, myDesire: '' };
  els('.icc-fab').forEach((n) => n.remove());
  els('.icc-admin-fab').forEach((n) => n.remove());
}
function els(sel) { return [...document.querySelectorAll(sel)]; }
