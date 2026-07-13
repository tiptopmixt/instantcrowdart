// Ideas ranking: the crowd's ideas to change the game, ranked by community votes.
import { h, toast } from '../utils.js';
import { t } from '../i18n.js';
import { L } from '../locale.js';
import { getIdeas, upvoteIdea } from '../data.js';
import { adsBanner, feedbackButton } from '../components.js';
import { navigate } from '../router.js';

export async function renderWall(root) {
  document.querySelectorAll('.icc-fab').forEach((n) => n.remove());
  const ideas = (await getIdeas()).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

  root.innerHTML = '';
  const page = h('div', { class: 'icc-page icc-wall' });
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹ ' + t('backHome')),
    h('div', { class: 'icc-topbar-title' }, '🏆 ' + L('ideasTitle')),
  ]));

  page.appendChild(h('div', { class: 'icc-cards' },
    ideas.length ? ideas.map((i, n) => ideaCard(i, n + 1))
      : [h('p', { class: 'icc-muted', style: 'padding:20px;text-align:center' }, L('boardEmpty'))]));

  page.appendChild(adsBanner());
  root.appendChild(page);
  document.body.appendChild(feedbackButton());
}

function ideaCard(i, rank) {
  const votes = h('span', { class: 'icc-votes' }, '▲ ' + (i.votes ?? 0));
  const btn = h('button', { class: 'icc-btn icc-btn-sm' }, '▲ ' + t('upvote'));
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { error } = await upvoteIdea(i.id);
    if (!error) { i.votes = (i.votes ?? 0) + 1; votes.textContent = '▲ ' + i.votes; toast('▲', 'ok'); }
    else btn.disabled = false;
  });
  return h('div', { class: 'icc-card icc-idea-row' }, [
    h('div', { class: 'icc-idea-rank' }, '#' + rank),
    h('div', { class: 'icc-idea-body' }, [
      h('p', {}, i.idea_summary || ''),
      i.ai_evaluation ? h('p', { class: 'icc-muted small' }, i.ai_evaluation) : null,
    ]),
    h('div', { class: 'icc-idea-vote' }, [votes, btn]),
  ]);
}
