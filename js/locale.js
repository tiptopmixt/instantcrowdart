// App language (EN/IT/RO). The user picks it first (flag gate); stored in localStorage.
// Consent text lives in legal.js; this covers hero + the brainstorm/board/chat UI.
const KEY = 'icc_ui_lang';
const SUPPORTED = ['en', 'it', 'ro'];

export const LANGS = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'ro', flag: '🇷🇴', name: 'Română' },
];

export function detectLang() {
  const l = (navigator.language || 'en').toLowerCase();
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('ro')) return 'ro';
  return 'en';
}

export function hasLang() {
  try { return SUPPORTED.includes(localStorage.getItem(KEY)); } catch { return false; }
}
export function uiLang() {
  try { const l = localStorage.getItem(KEY); if (SUPPORTED.includes(l)) return l; } catch { /* ignore */ }
  return detectLang();
}
export function setUiLang(code) {
  if (!SUPPORTED.includes(code)) return;
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
}

const DICT = {
  en: {
    tagline: "Instant crowd chat. 24 hours. Then it's gone.",
    rule: "24 hours of a crazy run. The goal isn't to finish first — it's to finish charged up. ⚡ No money, no pressure: just a playful crowd living the moment together.",
    join: 'Jump into the crowd ⚡',
    share: 'Share', shareStory: 'Share to stories',
    board: 'What we\'re building', boardGoal: 'Goal', boardIdeas: 'Top sparks',
    boardEmpty: 'Nothing yet — throw in the first spark! ⚡', boardLive: 'LIVE',
    energy: 'Energy',
    chat: 'Chat', typeMessage: 'Type or tap a spark…', send: 'Send',
    qrIdea: '💡 Idea', qrWhatIf: '🤔 What if…', qrGoal: '🎯 Goal', qrLove: '🔥', qrYes: '👍', qrJoke: '😂',
    starterIdea: '💡 My idea: ', starterWhatIf: '🤔 What if we ', starterGoal: '🎯 I propose our goal: ',
    upvote: 'boost', langTitle: 'Choose your language', langSub: 'The assistant will also speak it with you',
    playToEnter: '▶ Play to enter', gameTitle: 'Win your way in', gameSub: 'Beat the bolt — pick one:',
    youWin: 'YOU WIN! 🎉', yourRank: 'Your rank', enterChat: 'Enter the chat ⚡',
    inviteCrew: '📤 Invite your crew', crew: 'crew', recruitedBy: 'You were recruited by',
    tiers: ['Director', 'Senior Director', 'Chief', 'Boss', 'Legend'],
    idTitle: 'Take your seat', idCreature: 'First, your creature:',
    idRoleTitle: 'Pick your position', idRoleSub: 'What role do you want in the company?',
    idTraitTitle: 'Your superpower', idTraitSub: 'Pick your strongest positive trait',
    org: 'Company forming', orgYou: 'you',
    privateLane: 'Your private chat with the assistant',
    boardPublic: 'everyone sees this',
    greet: "Hi {name}! ⚡ Welcome to the 24-hour company. What would you like to do here? Tap an area below, or tell me in your own words. (Prototyping, Production, Design, Marketing, Sales, HR, Management, Ideas…)",
    editDesire: 'Your area', editDesirePh: 'What you\'d like to do…', wantArea: "I'd like to work in:",
    assistantBusy: 'The assistant is busy — try again in a moment.',
    onlineShort: 'online',
    shareCta: 'Join my company 👉', shareBuilding: 'building for 24h',
    shareText: '⚡ Join us — a crowd building something wild in 24h, then it\'s gone 👇',
    cardTagline: 'One chat. 24 hours. Then it\'s gone.',
    proto: '⚠️ Web app built entirely with AI — even if it works, it\'s only a prototype.',
    feedback: '💬 Feedback',
    feedbackIntro: "This is an experiment — we don't know yet if this kind of chat makes sense. Leave your opinion and proposals; we'll analyze them later.",
    eyebrow: 'ONE CHAT · 24 HOURS · THEN IT\'S GONE',
    ctaEnter: 'ENTER NOW ⚡',
    goneLine: 'When the timer hits zero, everything burns.',
    peekLock: 'The crowd is talking right now',
    peekCta: 'Unlock the chat',
    overTitle: 'Everything burned.',
    labHrs: 'HRS', labMin: 'MIN', labSec: 'SEC',
    liveForever: 'FOUNDING FIRE — ALWAYS ON',
    inside: 'inside',
    customTile: '✏️ Write your own…',
    customRolePh: 'Your position…',
    customTraitPh: 'Your superpower…',
  },
  it: {
    tagline: 'Chat di folla istantanea. 24 ore. Poi sparisce.',
    rule: 'Ventiquattro ore di corsa pazza. Non conta arrivare primi — conta arrivare carichi. ⚡ Niente soldi, niente pressione: solo una folla che si diverte e vive il momento insieme.',
    join: 'Salta nella folla ⚡',
    share: 'Condividi', shareStory: 'Condividi nelle storie',
    board: 'Cosa stiamo costruendo', boardGoal: 'Obiettivo', boardIdeas: 'Idee top',
    boardEmpty: 'Ancora niente — lancia la prima scintilla! ⚡', boardLive: 'LIVE',
    energy: 'Energia',
    chat: 'Chat', typeMessage: 'Scrivi o tocca una scintilla…', send: 'Invia',
    qrIdea: '💡 Idea', qrWhatIf: '🤔 E se…', qrGoal: '🎯 Obiettivo', qrLove: '🔥', qrYes: '👍', qrJoke: '😂',
    starterIdea: '💡 La mia idea: ', starterWhatIf: '🤔 E se ', starterGoal: '🎯 Propongo il nostro obiettivo: ',
    upvote: 'spingi', langTitle: 'Scegli la tua lingua', langSub: 'L\'assistente la parlerà con te',
    playToEnter: '▶ Gioca per entrare', gameTitle: 'Vinci per entrare', gameSub: 'Batti il fulmine — scegli:',
    youWin: 'HAI VINTO! 🎉', yourRank: 'Il tuo grado', enterChat: 'Entra nella chat ⚡',
    inviteCrew: '📤 Invita la tua squadra', crew: 'squadra', recruitedBy: 'Ti ha reclutato',
    tiers: ['Direttore', 'Direttore Senior', 'Capo', 'Boss', 'Leggenda'],
    idTitle: 'Prendi il tuo posto', idCreature: 'Prima, la tua creatura:',
    idRoleTitle: 'Scegli la tua posizione', idRoleSub: 'Che ruolo vuoi nell\'azienda?',
    idTraitTitle: 'Il tuo superpotere', idTraitSub: 'Scegli la tua qualità più forte',
    org: 'Azienda in costruzione', orgYou: 'tu',
    privateLane: 'La tua chat privata con l\'assistente',
    boardPublic: 'lo vedono tutti',
    greet: 'Ciao {name}! ⚡ Benvenuto nell\'azienda delle 24 ore. Di cosa ti piacerebbe occuparti? Tocca un\'area qui sotto, o dimmelo con parole tue. (Prototipazione, Produzione, Design, Marketing, Vendite, HR, Management, Idee…)',
    editDesire: 'La tua area', editDesirePh: 'Di cosa vuoi occuparti…', wantArea: 'Vorrei occuparmi di:',
    assistantBusy: 'L\'assistente è occupato — riprova tra un attimo.',
    onlineShort: 'online',
    shareCta: 'Entra nella mia azienda 👉', shareBuilding: 'in costruzione per 24h',
    shareText: '⚡ Unisciti a noi — una folla che costruisce qualcosa in 24 ore, poi sparisce 👇',
    cardTagline: 'Una chat. 24 ore. Poi sparisce.',
    proto: '⚠️ Web app creata interamente con l\'AI — anche se funziona, è solo un prototipo.',
    feedback: '💬 Feedback',
    feedbackIntro: 'È un esperimento — non sappiamo ancora se questo tipo di chat abbia senso. Lascia il tuo parere e le tue proposte; le analizzeremo dopo.',
    eyebrow: 'UNA SOLA CHAT · 24 ORE · POI SPARISCE',
    ctaEnter: 'ENTRA ORA ⚡',
    goneLine: 'Quando il timer arriva a zero, tutto brucia.',
    peekLock: 'La folla sta parlando proprio ora',
    peekCta: 'Sblocca la chat',
    overTitle: 'Tutto è bruciato.',
    labHrs: 'ORE', labMin: 'MIN', labSec: 'SEC',
    liveForever: 'FUOCO FONDATIVO — SEMPRE ACCESO',
    inside: 'dentro',
    customTile: '✏️ Scrivi tu…',
    customRolePh: 'La tua posizione…',
    customTraitPh: 'Il tuo superpotere…',
  },
  ro: {
    tagline: 'Chat de mulțime instant. 24 de ore. Apoi dispare.',
    rule: 'Douăzeci și patru de ore de cursă nebună. Nu contează să fii primul — ci să ajungi încărcat. ⚡ Fără bani, fără presiune: doar o mulțime care se distrează și trăiește clipa împreună.',
    join: 'Sari în mulțime ⚡',
    share: 'Distribuie', shareStory: 'Distribuie în stories',
    board: 'Ce construim', boardGoal: 'Obiectiv', boardIdeas: 'Idei de top',
    boardEmpty: 'Încă nimic — aruncă prima scânteie! ⚡', boardLive: 'LIVE',
    energy: 'Energie',
    chat: 'Chat', typeMessage: 'Scrie sau atinge o scânteie…', send: 'Trimite',
    qrIdea: '💡 Idee', qrWhatIf: '🤔 Dacă…', qrGoal: '🎯 Obiectiv', qrLove: '🔥', qrYes: '👍', qrJoke: '😂',
    starterIdea: '💡 Ideea mea: ', starterWhatIf: '🤔 Dacă am ', starterGoal: '🎯 Propun obiectivul nostru: ',
    upvote: 'susține', langTitle: 'Alege limba ta', langSub: 'Asistentul o va vorbi cu tine',
    playToEnter: '▶ Joacă pentru a intra', gameTitle: 'Câștigă ca să intri', gameSub: 'Învinge fulgerul — alege:',
    youWin: 'AI CÂȘTIGAT! 🎉', yourRank: 'Rangul tău', enterChat: 'Intră în chat ⚡',
    inviteCrew: '📤 Invită-ți echipa', crew: 'echipă', recruitedBy: 'Ai fost recrutat de',
    tiers: ['Director', 'Director Senior', 'Șef', 'Boss', 'Legendă'],
    idTitle: 'Ocupă-ți locul', idCreature: 'Întâi, creatura ta:',
    idRoleTitle: 'Alege-ți poziția', idRoleSub: 'Ce rol vrei în companie?',
    idTraitTitle: 'Superputerea ta', idTraitSub: 'Alege cea mai puternică calitate pozitivă',
    org: 'Compania se formează', orgYou: 'tu',
    privateLane: 'Chatul tău privat cu asistentul',
    boardPublic: 'toată lumea vede',
    greet: 'Salut {name}! ⚡ Bine ai venit în compania de 24 de ore. Cu ce ți-ar plăcea să te ocupi? Atinge o zonă mai jos sau spune-mi cu cuvintele tale. (Prototipare, Producție, Design, Marketing, Vânzări, HR, Management, Idei…)',
    editDesire: 'Zona ta', editDesirePh: 'Cu ce ai vrea să te ocupi…', wantArea: 'Aș vrea să mă ocup de:',
    assistantBusy: 'Asistentul este ocupat — încearcă din nou într-o clipă.',
    onlineShort: 'online',
    shareCta: 'Intră în compania mea 👉', shareBuilding: 'în construcție 24h',
    shareText: '⚡ Alătură-te — o mulțime care construiește ceva în 24h, apoi dispare 👇',
    cardTagline: 'Un chat. 24 de ore. Apoi dispare.',
    proto: '⚠️ Aplicație web creată în întregime cu AI — chiar dacă funcționează, este doar un prototip.',
    feedback: '💬 Feedback',
    feedbackIntro: 'E un experiment — încă nu știm dacă acest tip de chat are sens. Lasă-ți părerea și propunerile; le vom analiza mai târziu.',
    eyebrow: 'UN SINGUR CHAT · 24 DE ORE · APOI DISPARE',
    ctaEnter: 'INTRĂ ACUM ⚡',
    goneLine: 'Când timerul ajunge la zero, totul arde.',
    peekLock: 'Mulțimea vorbește chiar acum',
    peekCta: 'Deblochează chatul',
    overTitle: 'Totul a ars.',
    labHrs: 'ORE', labMin: 'MIN', labSec: 'SEC',
    liveForever: 'FOCUL FONDATOR — MEREU APRINS',
    inside: 'înăuntru',
    customTile: '✏️ Scrie tu…',
    customRolePh: 'Poziția ta…',
    customTraitPh: 'Superputerea ta…',
  },
};

// Playful rank title from crew size (number of people you recruited).
export function rankTitle(crew = 0) {
  const tiers = (DICT[uiLang()] || DICT.en).tiers;
  const i = crew >= 10 ? 4 : crew >= 6 ? 3 : crew >= 3 ? 2 : crew >= 1 ? 1 : 0;
  return tiers[i];
}

export function L(key) {
  const d = DICT[uiLang()] || DICT.en;
  return d[key] ?? DICT.en[key] ?? key;
}

// Backwards-compatible hero() used by home.js
export function hero(key) { return L(key); }
