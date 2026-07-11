// Chat page (#/c/CODE): the single live challenge room.
// Layout: a live "Build Board" (what the crowd is creating, in real time) on top,
// and the brainstorm chat below, with quick-reply sparks to give direction.
import { h, el, escapeHtml, formatRemaining, isExpired, toast, joinUrl } from '../utils.js';
import { t } from '../i18n.js';
import { aiAvatarSVG, pulseSVG } from '../mascot.js';
import { flagsFromLangs } from '../flags.js';
import {
  getChatByCode, getMyProfile, joinChat, getMessages, getActiveProfiles,
  insertMyMessage, castVote, getVotes, getIdeas, insertIdea, upvoteIdea,
  recordReferrer, getCrewCount, updateRole, getOrgProfiles,
} from '../data.js';
import { subscribeMessages, unsubscribeMessages, subscribePresence, unsubscribePresence } from '../realtime.js';
import { adsBanner, feedbackButton, adminButton, introGame, rolePicker } from '../components.js';
import { callFn } from '../supabase.js';
import { userId, nickname, emojiOf, position, trait } from '../auth.js';
import { navigate, getQueryParam } from '../router.js';
import { requireConsent } from '../legal.js';
import { L, rankTitle, uiLang } from '../locale.js';
import { levelOf, tierName } from '../company.js';
import { renderCrowd, nicknamesFromPresence, bestiary } from '../crowd.js';
import { shareCard } from '../share-card.js';

let timer = null;
let state = { chat: null, blocked: false, over: false, crowdEmojis: '🦊🐻🦉', count: 0 };

function isOver(chat) {
  return chat.status === 'closed' || (chat.status !== 'founding' && isExpired(chat.expires_at));
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
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹'),
    h('div', { class: 'icc-topbar-title' }, chat.title),
    countdown, shareBtn,
  ]));

  // Burning fuse: the 24h literally burn away across the top of the chat.
  page.appendChild(h('div', { class: 'icc-fuse' + (chat.status === 'founding' ? ' infinite' : '') }, [
    h('div', { class: 'icc-fuse-fill', id: 'chat-fuse' }, [h('span', { class: 'icc-fuse-spark' })]),
  ]));

  // Compact flags + crowd row
  const flagsBar = h('div', { class: 'icc-flags', id: 'chat-flags', title: t('flagsTooltip') });
  flagsBar.addEventListener('click', () => toast(t('flagsTooltip'), 'info'));
  page.appendChild(h('div', { class: 'icc-headrow' }, [
    h('span', { class: 'icc-rank-badge', id: 'chat-rank' }),
    flagsBar,
    h('div', { class: 'icc-crowd', id: 'chat-crowd' }),
  ]));

  // Vote banner slot
  page.appendChild(h('div', { id: 'chat-vote-banner' }));

  // --- Split: live Build Board (top) + chat feed (bottom) ---
  const board = h('div', { class: 'icc-board', id: 'chat-board' });
  const feed = h('div', { class: 'icc-feed', id: 'chat-feed' });
  page.appendChild(h('div', { class: 'icc-split' }, [board, feed]));

  // Read-only banner slot
  const endedSlot = h('div', { id: 'chat-ended-slot' });
  page.appendChild(endedSlot);

  // Quick-reply sparks (give direction to the brainstorm)
  const quick = h('div', { class: 'icc-quick', id: 'chat-quick' });
  page.appendChild(quick);

  // Input bar
  const input = h('input', { class: 'icc-input', placeholder: L('typeMessage'), id: 'chat-input' });
  const sendBtn = h('button', { class: 'icc-btn', id: 'chat-send' }, L('send'));
  const inputBar = h('div', { class: 'icc-inputbar' }, [input, sendBtn]);
  page.appendChild(inputBar);
  page.appendChild(adsBanner());

  root.appendChild(page);
  document.body.appendChild(feedbackButton());
  const adminFab = adminButton(chat);
  if (adminFab) document.body.appendChild(adminFab);

  // Quick sparks: starters pre-fill+focus (direction), reactions send immediately.
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

  // --- Consent + creature + onboarding before joining ---
  let profile = await getMyProfile(chat.id);
  if (!profile) {
    const agreed = await requireConsent();
    if (!agreed) { toast(t('mustAccept'), 'info'); navigate('/'); return; }
    // Build identity (creature + position + trait) if not done yet (e.g. arrived via link).
    if (!position()) { try { await introGame(() => shareChallenge(chat)); } catch { /* skip */ } }
    await joinChat(chat.id, uiLang());
    await recordReferrer(chat.id, getQueryParam('r')); // who invited me -> their crew
    await updateRole(chat.id);                          // save my position + trait for the org chart
    profile = await getMyProfile(chat.id);
  }
  refreshRank(chat.id);
  if (profile && profile.violations >= 3) {
    state.blocked = true;
    toast(t('blocked'), 'error');
    input.disabled = sendBtn.disabled = true;
  }
  if (isOver(chat)) applyReadOnly();

  // Load messages
  const { messages } = await getMessages(chat.id);
  messages.forEach((m) => feed.appendChild(messageNode(m)));
  feed.scrollTop = feed.scrollHeight;

  await refreshFlags(chat.id);
  await renderBoard(chat);

  // Realtime
  subscribeMessages(chat.id, (row) => {
    const existing = el(`[data-mid="${row.id}"]`, feed);
    const node = messageNode(row);
    if (existing) existing.replaceWith(node);
    else feed.appendChild(node);
    const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
    if (nearBottom) feed.scrollTop = feed.scrollHeight;
    if (row.is_ai || row.is_pinned) { refreshVoteBanner(chat); refreshFlags(chat.id); renderBoard(chat); }
  });
  let prevCount = -1;
  subscribePresence(chat.id, (count, pstate) => {
    const o = el('#chat-online'); if (o) o.textContent = String(count);
    const nicks = nicknamesFromPresence(pstate);
    renderCrowd(el('#chat-crowd'), nicks);
    state.count = count;
    state.crowdEmojis = bestiary(nicks).slice(0, 4).map((g) => g.emoji).join('') || '🦊🐻🦉';
    if (count !== prevCount) { prevCount = count; renderBoard(chat); refreshRank(chat.id); } // someone joined/left → org grows
  });

  // Countdown tick + expiry
  timer = setInterval(async () => {
    const c = el('#chat-countdown');
    if (c && chat.status !== 'founding') c.textContent = formatRemaining(chat.expires_at);
    // fuse burns down in real time
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

// --- Quick-reply sparks ---
function buildQuickReplies(container, chat, input, sendBtn, feed) {
  const starter = (text) => () => { input.value = text; input.focus(); };
  const react = (text) => async () => { input.value = text; await sendMessage(chat, input, sendBtn, feed); };

  const chips = [
    { label: L('qrIdea'), on: starter(L('starterIdea')) },
    { label: L('qrWhatIf'), on: starter(L('starterWhatIf')) },
    { label: L('qrGoal'), on: starter(L('starterGoal')) },
    { label: L('qrLove'), on: react('🔥') },
    { label: L('qrYes'), on: react('👍') },
    { label: L('qrJoke'), on: react('😂') },
    { label: '+24h', on: () => proposeExtension(chat) },
  ];
  container.innerHTML = '';
  chips.forEach((c) => {
    const b = h('button', { class: 'icc-chip' }, c.label);
    b.addEventListener('click', c.on);
    container.appendChild(b);
  });
}

// --- Live Build Board = the company org chart forming in real time ---
async function renderBoard(chat) {
  const board = el('#chat-board');
  if (!board) return;

  const { chat: fresh } = await getChatByCode(chat.short_code);
  const goal = fresh?.current_goal;
  const recap = await latestRecapText(chat.id, 200);
  const people = await getOrgProfiles(chat.id);

  board.innerHTML = '';
  board.appendChild(h('div', { class: 'icc-board-head' }, [
    h('span', { class: 'icc-live' }, '● ' + L('boardLive')),
    h('strong', {}, '🏢 ' + L('org') + ` · ${people.length}`),
  ]));

  if (goal) {
    board.appendChild(h('div', { class: 'icc-board-goal' }, [
      h('span', { class: 'icc-board-tag' }, '🎯 ' + L('boardGoal')),
      h('span', {}, goal),
    ]));
  }

  // Order the org chart by the LEVEL of each person's chosen role (not by who invited whom).
  const groups = new Map();
  people.forEach((p) => {
    const lvl = levelOf(p.position);
    if (!groups.has(lvl)) groups.set(lvl, []);
    groups.get(lvl).push(p);
  });
  const org = h('div', { class: 'icc-org' });
  [0, 1, 2, 3].forEach((lvl) => {
    const arr = groups.get(lvl);
    if (!arr || !arr.length) return;
    org.appendChild(h('div', { class: 'icc-org-tier' }, tierName(lvl)));
    arr.forEach((p) => org.appendChild(orgNode(p, chat)));
  });
  board.appendChild(people.length ? org : h('div', { class: 'icc-board-recap' }, L('boardEmpty')));

  // Company vision = latest AI recap (small, secondary)
  if (recap) {
    board.appendChild(h('div', { class: 'icc-board-recap' }, [
      h('span', { class: 'icc-board-tag' }, '⚡ ' + L('board')), h('div', {}, recap),
    ]));
  }
}

function orgNode(p, chat) {
  const me = p.user_id === userId();
  const roleTag = p.position
    ? h('span', { class: 'icc-org-role' }, p.position)
    : (me ? h('span', { class: 'icc-org-role dim' }, '＋ role') : null);
  const node = h('div', { class: 'icc-org-node' + (me ? ' me editable' : '') }, [
    h('span', { class: 'icc-org-emoji' }, emojiOf(p.nickname)),
    h('span', { class: 'icc-org-name' }, (p.nickname || 'anon') + (me ? ` (${L('orgYou')})` : '')),
    roleTag,
  ]);
  // Your own node is tappable to change your role anytime — roles evolve over the 24h.
  if (me) { node.title = '✎'; node.addEventListener('click', () => changeMyRole(chat)); }
  return node;
}

async function changeMyRole(chat) {
  const picked = await rolePicker();
  if (!picked) return;
  await updateRole(chat.id);           // save new position/trait to my profile
  renderBoard(chat);                   // re-sort the org by the new level
  toast('✅ ' + (picked.position || ''), 'ok');
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

  // A message starting with 💡 becomes a live "spark" on the Build Board.
  if (content.startsWith('💡')) {
    const summary = content.replace(/^💡\s*/, '').replace(/^[^:]{0,40}:\s*/, '').trim() || content.replace(/^💡\s*/, '');
    await insertIdea(summary);
    renderBoard(chat);
  }

  // Wake the AI facilitator (server decides whether to speak; fire-and-forget).
  callFn('icc-reply', { chat_id: chat.id });

  maybeTriggerRecap(chat.id);
}

async function maybeTriggerRecap(chatId) {
  const feed = el('#chat-feed');
  const count = feed ? feed.querySelectorAll('.icc-msg').length : 0;
  // Early on, recap sooner so the Build Board shows the community evolving fast.
  const every = count < 30 ? 8 : 15;
  if (count > 0 && count % every === 0) callFn('icc-summarize', { chat_id: chatId });
}

function messageNode(m) {
  const mine = m.user_id === userId();
  const cls = 'icc-msg' + (m.is_ai ? ' ai' : mine ? ' mine' : '') + (m.is_pinned ? ' pinned' : '');
  const node = h('div', { class: cls, 'data-mid': m.id });

  if (m.is_ai) node.appendChild(h('div', { class: 'icc-msg-avatar', html: aiAvatarSVG(30) }));
  else if (!mine) node.appendChild(h('div', { class: 'icc-msg-avatar icc-emoji-avatar' }, emojiOf(m.nickname)));

  const bubble = h('div', { class: 'icc-bubble' });
  if (!mine) bubble.appendChild(h('div', { class: 'icc-msg-nick' }, m.is_ai ? t('aiName') : `${emojiOf(m.nickname)} ${m.nickname || 'anon'}`));
  if (m.is_pinned) bubble.appendChild(h('div', { class: 'icc-pin-label' }, '📌 ' + t('recapLabel')));
  bubble.appendChild(h('div', { class: 'icc-msg-text', html: escapeHtml(m.content).replace(/\n/g, '<br>') }));

  const actions = h('div', { class: 'icc-msg-actions' });
  const trBtn = h('button', { class: 'icc-icon-btn', title: t('translate') }, '🌐');
  trBtn.addEventListener('click', () => translateMessage(m, bubble));
  actions.appendChild(trBtn);
  if (m.is_pinned) {
    const shBtn = h('button', { class: 'icc-icon-btn', title: t('shareRecap') }, '📤');
    shBtn.addEventListener('click', () => shareChallenge(state.chat));
    actions.appendChild(shBtn);
  }
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

async function refreshRank(chatId) {
  const crew = await getCrewCount(chatId);
  const badge = el('#chat-rank');
  if (badge) badge.textContent = `👑 ${rankTitle(crew)}` + (crew ? ` · ${crew} ${L('crew')}` : '');
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
  toast('⚡ +24h proposed', 'ok');
}

// --- Share (image card for Instagram stories) ---
async function shareChallenge(chat) {
  toast(L('shareStory') + '…', 'info');
  const recap = await latestRecapText(chat.id, 220);
  await shareCard({
    who: `${emojiOf(nickname())} ${nickname()}`,
    role: position(),
    trait: trait(),
    title: chat.title,
    recap,
    crowdEmojis: state.crowdEmojis,
    count: state.count || chat.participant_count || 0,
    code: chat.short_code,
    url: joinUrl(chat.short_code) + '?r=' + (userId() || ''), // shares recruit into my crew
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
  state = { chat: null, blocked: false, over: false, crowdEmojis: '🦊🐻🦉', count: 0 };
  els('.icc-fab').forEach((n) => n.remove());
  els('.icc-admin-fab').forEach((n) => n.remove());
}
function els(sel) { return [...document.querySelectorAll(sel)]; }
