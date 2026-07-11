// Co-creators Wall: adopted ideas with contributor nicknames (permanent).
import { h } from '../utils.js';
import { t } from '../i18n.js';
import { getIdeas, upvoteIdea } from '../data.js';
import { adsBanner, feedbackButton } from '../components.js';
import { navigate } from '../router.js';
import { toast } from '../utils.js';

export async function renderWall(root) {
  document.querySelectorAll('.icc-fab').forEach((n) => n.remove());
  const adopted = await getIdeas('adopted');
  const proposed = await getIdeas('proposed');

  root.innerHTML = '';
  const page = h('div', { class: 'icc-page icc-wall' });
  page.appendChild(h('div', { class: 'icc-topbar' }, [
    h('button', { class: 'icc-link', onclick: () => navigate('/') }, '‹ ' + t('backHome')),
    h('div', { class: 'icc-topbar-title' }, t('coCreators')),
  ]));

  page.appendChild(h('h2', { class: 'icc-h2' }, '✔ ' + t('adopted')));
  page.appendChild(h('div', { class: 'icc-cards' },
    adopted.length ? adopted.map((i) => ideaCard(i, false)) : [h('p', { class: 'icc-muted' }, '—')]));

  page.appendChild(h('h2', { class: 'icc-h2' }, t('proposed')));
  page.appendChild(h('div', { class: 'icc-cards' },
    proposed.length ? proposed.map((i) => ideaCard(i, true)) : [h('p', { class: 'icc-muted' }, '—')]));

  page.appendChild(adsBanner());
  root.appendChild(page);
  document.body.appendChild(feedbackButton());
}

function ideaCard(i, votable) {
  const votes = h('span', { class: 'icc-votes' }, '▲ ' + (i.votes ?? 0));
  const card = h('div', { class: 'icc-card' }, [
    h('div', { class: 'icc-card-badge' + (votable ? '' : ' green') }, votable ? t('proposed') : '✔ ' + t('adopted')),
    h('p', {}, i.idea_summary || ''),
    i.ai_evaluation ? h('p', { class: 'icc-muted small' }, i.ai_evaluation) : null,
    h('div', { class: 'icc-card-meta' }, [`by ${i.nickname || 'anon'} · `, votes]),
  ]);
  if (votable) {
    const btn = h('button', { class: 'icc-btn icc-btn-sm' }, '▲ ' + t('upvote'));
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error } = await upvoteIdea(i.id);
      if (!error) { i.votes = (i.votes ?? 0) + 1; votes.textContent = '▲ ' + i.votes; toast('▲', 'ok'); }
      else btn.disabled = false;
    });
    card.appendChild(btn);
  }
  return card;
}
