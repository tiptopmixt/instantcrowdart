// Experiment consent gate + disclaimer, available in EN / IT / RO
// (first users are English, Italian or Romanian speakers).
// Have a lawyer review for your jurisdiction before public launch.
import { h, el } from './utils.js';
import { uiLang } from './locale.js';

export const CONSENT_VERSION = 'v1';
const KEY = 'icc_consent_' + CONSENT_VERSION;

export function hasConsent() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
function saveConsent(lang) {
  try { localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), lang })); } catch { /* ignore */ }
}

// The disclaimer in three languages (kept together so they stay in sync).
const LOCALES = {
  en: {
    name: 'English',
    title: 'Before you join',
    lead: 'This is a 24-hour experiment. Please read before joining:',
    points: [
      'InstantCrowdChat is an experimental, anonymous group chat. One shared challenge runs for 24 hours, then it closes.',
      'No money is ever involved. You never pay and never receive any payment. You only share ideas you are willing to make public.',
      'If the challenge succeeds, its result and the most-supported ideas may be published (Hall of Fame / Co-creators Wall) next to your anonymous nickname. If it fails, the chat and its messages are permanently deleted.',
      'Everything you write can be read by other participants and processed by an automated AI assistant for moderation, translation and summaries. Do not share personal data (real name, phone, email, address) or anything confidential.',
      'The project is provided "as is", with no promises, guarantees or warranties of any kind. Participation is voluntary. You are NOT entitled to any compensation, ownership, equity, revenue, credit or other claim — now or in the future — even if the project later generates value. Any recognition on the Co-creators Wall is a goodwill gesture, not a contract, and grants no rights.',
      'You must be at least 16 years old (or the legal age of digital consent in your country) to take part.',
    ],
    confirm: 'I confirm I am 16+ and I accept these terms.',
    agree: 'I understand & agree',
    decline: 'Not now',
  },
  it: {
    name: 'Italiano',
    title: 'Prima di entrare',
    lead: 'Questo è un esperimento di 24 ore. Leggi prima di entrare:',
    points: [
      'InstantCrowdChat è una chat di gruppo anonima e sperimentale. C\'è un\'unica sfida condivisa che dura 24 ore, poi si chiude.',
      'Non è mai coinvolto denaro. Non paghi e non ricevi alcun pagamento. Condividi solo idee che sei disposto a rendere pubbliche.',
      'Se la sfida riesce, il risultato e le idee più sostenute possono essere pubblicati (Hall of Fame / Muro dei co-creatori) accanto al tuo nickname anonimo. Se fallisce, la chat e i suoi messaggi vengono cancellati per sempre.',
      'Tutto ciò che scrivi può essere letto dagli altri partecipanti ed elaborato da un assistente AI automatico per moderazione, traduzione e riassunti. Non condividere dati personali (nome reale, telefono, email, indirizzo) né informazioni riservate.',
      'Il progetto è fornito "così com\'è", senza promesse, garanzie o assicurazioni di alcun tipo. La partecipazione è volontaria. NON hai diritto ad alcun compenso, proprietà, quota, ricavo, credito o altra pretesa — né ora né in futuro — anche se il progetto un giorno generasse valore. Qualsiasi riconoscimento sul Muro dei co-creatori è un gesto di buona volontà, non un contratto, e non conferisce alcun diritto.',
      'Devi avere almeno 16 anni (o l\'età legale per il consenso digitale nel tuo Paese) per partecipare.',
    ],
    confirm: 'Confermo di avere 16+ anni e accetto questi termini.',
    agree: 'Ho capito e accetto',
    decline: 'Non ora',
  },
  ro: {
    name: 'Română',
    title: 'Înainte de a intra',
    lead: 'Acesta este un experiment de 24 de ore. Citește înainte de a intra:',
    points: [
      'InstantCrowdChat este un chat de grup anonim și experimental. Există o singură provocare comună care durează 24 de ore, apoi se închide.',
      'Nu sunt implicați niciodată bani. Nu plătești și nu primești nicio plată. Împărtășești doar idei pe care ești dispus să le faci publice.',
      'Dacă provocarea reușește, rezultatul și ideile cele mai susținute pot fi publicate (Hall of Fame / Zidul co-creatorilor) lângă porecla ta anonimă. Dacă eșuează, chatul și mesajele sale sunt șterse definitiv.',
      'Tot ce scrii poate fi citit de ceilalți participanți și procesat de un asistent AI automat pentru moderare, traducere și rezumate. Nu împărtăși date personale (nume real, telefon, e-mail, adresă) sau ceva confidențial.',
      'Proiectul este oferit „ca atare", fără promisiuni, garanții sau asigurări de niciun fel. Participarea este voluntară. NU ai dreptul la nicio compensație, proprietate, participație, venit, credit sau altă pretenție — nici acum, nici în viitor — chiar dacă proiectul generează valoare cândva. Orice recunoaștere pe Zidul co-creatorilor este un gest de bunăvoință, nu un contract, și nu conferă niciun drept.',
      'Trebuie să ai cel puțin 16 ani (sau vârsta legală a consimțământului digital din țara ta) pentru a participa.',
    ],
    confirm: 'Confirm că am 16+ ani și accept acești termeni.',
    agree: 'Am înțeles și accept',
    decline: 'Nu acum',
  },
};

const ORDER = ['en', 'it', 'ro'];

// Default to the browser language when it is one we support.
function detectLang() {
  const l = (navigator.language || 'en').toLowerCase();
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('ro')) return 'ro';
  return 'en';
}

// Language switcher row (EN | IT | RO).
function langSwitch(active, onPick) {
  const row = h('div', { class: 'icc-lang-row' });
  ORDER.forEach((code) => {
    const b = h('button', { class: 'icc-lang-btn' + (code === active ? ' active' : '') }, LOCALES[code].name);
    b.addEventListener('click', () => onPick(code));
    row.appendChild(b);
  });
  return row;
}

// Build the disclaimer body for a given language.
function buildContent(lang, withActions, handlers) {
  const L = LOCALES[lang] || LOCALES.en;
  const list = h('ul', { class: 'icc-legal-list' }, L.points.map((p) => h('li', {}, p)));
  const wrap = h('div', { class: 'icc-legal' }, [
    langSwitch(lang, handlers.onLang),
    h('p', { class: 'icc-legal-lead' }, L.lead),
    list,
  ]);

  if (withActions) {
    const check = h('input', { type: 'checkbox', id: 'icc-legal-check' });
    const agree = h('button', { class: 'icc-btn', disabled: 'true' }, L.agree);
    const decline = h('button', { class: 'icc-btn ghost' }, L.decline);
    check.addEventListener('change', () => {
      if (check.checked) agree.removeAttribute('disabled');
      else agree.setAttribute('disabled', 'true');
    });
    agree.addEventListener('click', () => { if (check.checked) { saveConsent(lang); handlers.onAccept(); } });
    decline.addEventListener('click', handlers.onDecline);
    wrap.appendChild(h('label', { class: 'icc-legal-confirm' }, [check, h('span', {}, ' ' + L.confirm)]));
    wrap.appendChild(h('div', { class: 'icc-legal-actions' }, [decline, agree]));
  }
  return wrap;
}

// Gate: resolves true if consent given (now or previously), false if declined.
export function requireConsent() {
  return new Promise((resolve) => {
    if (hasConsent()) return resolve(true);
    let lang = uiLang();
    const overlay = h('div', { class: 'icc-modal-overlay' });
    const box = h('div', { class: 'icc-modal' });
    const finish = (val) => { overlay.remove(); resolve(val); };

    const render = () => {
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'icc-modal-head' }, [h('strong', {}, LOCALES[lang].title)]));
      box.appendChild(buildContent(lang, true, {
        onAccept: () => finish(true),
        onDecline: () => finish(false),
        onLang: (code) => { lang = code; render(); },
      }));
    };
    render();
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// View-only terms (persistent "What is this? / Terms" link).
export function openTerms() {
  let lang = uiLang();
  const overlay = h('div', { class: 'icc-modal-overlay' });
  const box = h('div', { class: 'icc-modal' });
  const close = () => overlay.remove();
  const render = () => {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'icc-modal-head' }, [
      h('strong', {}, LOCALES[lang].title),
      h('button', { class: 'icc-x', onclick: close }, '✕'),
    ]));
    box.appendChild(buildContent(lang, false, { onLang: (code) => { lang = code; render(); } }));
  };
  render();
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}
