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
    tagline: "Instant crowd art. 24 hours. Then it's gone.",
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
    greet: "Hi! ⚡ Welcome to the 24-hour company. It's anonymous — no names. What would you like to do here? Tap an area below, or tell me in your own words.",
    user: 'User',
    editDesire: 'Your area', editDesirePh: 'What you\'d like to do…', wantArea: "I'd like to work in:",
    assistantBusy: 'The assistant is busy — try again in a moment.',
    onlineShort: 'online',
    shareCta: 'Help us 👉', shareBuilding: 'to shape in 24h',
    shareText: '⚡ HELP! In 24h a crowd is shaping ONE idea — then it vanishes forever. I need your mind. Jump in 👇',
    cardTagline: 'One idea. 24 hours. Then it\'s gone. Help shape it.',
    objBoard: 'The shared objective', objTodo: 'Not defined yet — throw the first spark ⚡',
    stateTodo: 'to define', stateDev: 'taking shape', stateSet: 'defined',
    contribs: 'Contributions', building: 'shaping it together',
    qrObjective: '🎯 Objective', qrHelp: '❓ How can I help?',
    starterObjective: '🎯 I propose the objective: ', starterHelp: 'How can I contribute right now?',
    pixLeft: 'pixels left', pixFull: 'You used all your pixels — invite others to add more! ⚡',
    pixHint: 'Tap the canvas to add a pixel · tap your own to remove it', cellTaken: 'Cell already taken',
    pixPlaced: 'pixels placed', pixColor: 'Pick a color',
    moveWait: 'You can move someone else\'s pixel again in {s}s', pixTheme: 'Let\'s draw something beautiful together ⚡',
    proposeChange: '💡 Change the game', ideasRank: '🏆 Ideas ranking', ideasTitle: 'Ideas to change the game',
    proto: '⚠️ Web app built entirely with AI — even if it works, it\'s just an experiment, so feel free to test it.',
    feedback: '💬 Feedback',
    feedbackIntro: "This is an experiment — we don't know yet if this kind of chat makes sense. Leave your opinion and proposals; we'll analyze them later.",
    eyebrow: 'ONE CANVAS · 24 HOURS · THEN IT\'S GONE',
    ctaEnter: 'ENTER NOW ⚡',
    goneLine: 'When the timer hits zero, the canvas vanishes.',
    peekLock: 'The canvas is filling up right now',
    peekCta: 'Enter the canvas',
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
    greet: 'Ciao! ⚡ Benvenuto nell\'azienda delle 24 ore. È anonima — nessun nome. Di cosa ti piacerebbe occuparti? Tocca un\'area qui sotto, o dimmelo con parole tue.',
    user: 'Utente',
    editDesire: 'La tua area', editDesirePh: 'Di cosa vuoi occuparti…', wantArea: 'Vorrei occuparmi di:',
    assistantBusy: 'L\'assistente è occupato — riprova tra un attimo.',
    onlineShort: 'online',
    shareCta: 'Aiutaci 👉', shareBuilding: 'da plasmare in 24h',
    shareText: '⚡ AIUTO! In 24 ore una folla sta plasmando UN\'idea — poi sparisce per sempre. Mi serve la tua mente. Entra 👇',
    cardTagline: 'Un\'idea. 24 ore. Poi sparisce. Aiuta a plasmarla.',
    objBoard: 'L\'obiettivo comune', objTodo: 'Ancora da definire — lancia la prima scintilla ⚡',
    stateTodo: 'da definire', stateDev: 'prende forma', stateSet: 'definito',
    contribs: 'Contributi', building: 'lo stanno plasmando insieme',
    qrObjective: '🎯 Obiettivo', qrHelp: '❓ Come aiuto?',
    starterObjective: '🎯 Propongo l\'obiettivo: ', starterHelp: 'Come posso contribuire adesso?',
    pixLeft: 'pixel rimasti', pixFull: 'Hai usato tutti i tuoi pixel — invita altri per aggiungerne! ⚡',
    pixHint: 'Tocca la tela per aggiungere un pixel · tocca i tuoi per rimuoverli', cellTaken: 'Cella già occupata',
    pixPlaced: 'pixel piazzati', pixColor: 'Scegli un colore',
    moveWait: 'Puoi spostare di nuovo un pixel altrui tra {s}s', pixTheme: 'Disegniamo insieme qualcosa di bello ⚡',
    proposeChange: '💡 Cambia il gioco', ideasRank: '🏆 Classifica idee', ideasTitle: 'Idee per cambiare il gioco',
    proto: '⚠️ Web app creata interamente con l\'AI — anche se funziona, è solo un esperimento, perciò potete testarla tranquillamente.',
    feedback: '💬 Feedback',
    feedbackIntro: 'È un esperimento — non sappiamo ancora se questo tipo di chat abbia senso. Lascia il tuo parere e le tue proposte; le analizzeremo dopo.',
    eyebrow: 'UNA TELA · 24 ORE · POI SPARISCE',
    ctaEnter: 'ENTRA ORA ⚡',
    goneLine: 'Quando il timer arriva a zero, la tela sparisce.',
    peekLock: 'La tela si sta riempiendo proprio ora',
    peekCta: 'Entra nella tela',
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
    greet: 'Salut! ⚡ Bine ai venit în compania de 24 de ore. Este anonimă — fără nume. Cu ce ți-ar plăcea să te ocupi? Atinge o zonă mai jos sau spune-mi cu cuvintele tale.',
    user: 'Utilizator',
    editDesire: 'Zona ta', editDesirePh: 'Cu ce ai vrea să te ocupi…', wantArea: 'Aș vrea să mă ocup de:',
    assistantBusy: 'Asistentul este ocupat — încearcă din nou într-o clipă.',
    onlineShort: 'online',
    shareCta: 'Ajută-ne 👉', shareBuilding: 'de modelat în 24h',
    shareText: '⚡ AJUTOR! În 24h o mulțime modelează O idee — apoi dispare. Am nevoie de mintea ta. Intră 👇',
    cardTagline: 'O idee. 24 de ore. Apoi dispare. Ajută s-o modelezi.',
    objBoard: 'Obiectivul comun', objTodo: 'Încă nedefinit — aruncă prima scânteie ⚡',
    stateTodo: 'de definit', stateDev: 'prinde contur', stateSet: 'definit',
    contribs: 'Contribuții', building: 'îl modelează împreună',
    qrObjective: '🎯 Obiectiv', qrHelp: '❓ Cum ajut?',
    starterObjective: '🎯 Propun obiectivul: ', starterHelp: 'Cum pot contribui acum?',
    pixLeft: 'pixeli rămași', pixFull: 'Ai folosit toți pixelii — invită pe alții! ⚡',
    pixHint: 'Atinge pânza pentru a adăuga un pixel · atinge-i pe ai tăi pentru a-i șterge', cellTaken: 'Celulă ocupată',
    pixPlaced: 'pixeli plasați', pixColor: 'Alege o culoare',
    moveWait: 'Poți muta din nou un pixel al altcuiva peste {s}s', pixTheme: 'Să desenăm împreună ceva frumos ⚡',
    proposeChange: '💡 Schimbă jocul', ideasRank: '🏆 Clasament idei', ideasTitle: 'Idei pentru a schimba jocul',
    proto: '⚠️ Aplicație web creată în întregime cu AI — chiar dacă funcționează, este doar un experiment, așa că puteți testa liniștiți.',
    feedback: '💬 Feedback',
    feedbackIntro: 'E un experiment — încă nu știm dacă acest tip de chat are sens. Lasă-ți părerea și propunerile; le vom analiza mai târziu.',
    eyebrow: 'O PÂNZĂ · 24 DE ORE · APOI DISPARE',
    ctaEnter: 'INTRĂ ACUM ⚡',
    goneLine: 'Când timerul ajunge la zero, pânza dispare.',
    peekLock: 'Pânza se umple chiar acum',
    peekCta: 'Intră pe pânză',
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
