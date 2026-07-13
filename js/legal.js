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
    lead: 'This is a shared pixel whiteboard. Please read before joining:',
    points: [
      'InstantCrowdArt is a shared, anonymous whiteboard. You get 10 pixels to place anywhere, in any color.',
      'You can move or change anyone\'s pixels, or build your own little picture — together the crowd draws one image that grows as more people join.',
      'It is anonymous (no names) and free — no money is ever involved.',
      'Everything is public and can be shared. The board may be reset or deleted at any time.',
      'It is an experiment/prototype, provided "as is", with no guarantees. You get no rights, ownership or claim of any kind over it.',
      'You must be at least 16 years old (or the legal age of digital consent in your country) to take part.',
    ],
    confirm: 'I confirm I am 16+ and I accept these terms.',
    agree: 'I understand & agree',
    decline: 'Not now',
  },
  it: {
    name: 'Italiano',
    title: 'Prima di entrare',
    lead: 'Questa è una lavagna di pixel condivisa. Leggi prima di entrare:',
    points: [
      'InstantCrowdArt è una lavagna condivisa e anonima. Hai 10 pixel da mettere dove vuoi, del colore che scegli.',
      'Puoi spostare o cambiare i pixel di chiunque, oppure creare la tua piccola immagine — insieme la folla disegna un\'unica immagine che cresce man mano che entrano più persone.',
      'È anonima (nessun nome) e gratuita — non è mai coinvolto denaro.',
      'Tutto è pubblico e può essere condiviso. La lavagna può essere azzerata o cancellata in qualsiasi momento.',
      'È un esperimento/prototipo, fornito "così com\'è", senza garanzie. Non acquisisci diritti, proprietà o pretese di alcun tipo su di essa.',
      'Devi avere almeno 16 anni (o l\'età legale per il consenso digitale nel tuo Paese) per partecipare.',
    ],
    confirm: 'Confermo di avere 16+ anni e accetto questi termini.',
    agree: 'Ho capito e accetto',
    decline: 'Non ora',
  },
  ro: {
    name: 'Română',
    title: 'Înainte de a intra',
    lead: 'Aceasta este o tablă de pixeli comună. Citește înainte de a intra:',
    points: [
      'InstantCrowdArt este o tablă comună și anonimă. Ai 10 pixeli de plasat oriunde, în orice culoare.',
      'Poți muta sau schimba pixelii oricui, ori să-ți creezi propria mică imagine — împreună mulțimea desenează o singură imagine care crește pe măsură ce intră mai mulți oameni.',
      'Este anonimă (fără nume) și gratuită — nu sunt implicați niciodată bani.',
      'Totul este public și poate fi distribuit. Tabla poate fi resetată sau ștearsă oricând.',
      'Este un experiment/prototip, oferit „ca atare", fără garanții. Nu dobândești niciun drept, proprietate sau pretenție asupra ei.',
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
