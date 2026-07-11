// The "company" everyone builds together. You invite anyone — they choose what to be.
// The org chart is ordered by the LEVEL of the chosen role (not by who invited whom).
// Localized (EN/IT/RO). Feeds the live org chart and the share card.
import { uiLang } from './locale.js';

// lvl: 0 = top (investors, bosses, co-founders) … 3 = crew. Emojis are unique per role.
const ROLES = [
  { emoji: '💰', lvl: 0, en: 'Investor', it: 'Investitore', ro: 'Investitor' },
  { emoji: '👑', lvl: 0, en: 'Big Boss', it: 'Grande Capo', ro: 'Șef Mare' },
  { emoji: '🤝', lvl: 0, en: 'Co-founder', it: 'Co-fondatore', ro: 'Co-fondator' },
  { emoji: '🔭', lvl: 1, en: 'Visionary', it: 'Visionario', ro: 'Vizionar' },
  { emoji: '💡', lvl: 1, en: 'Head of Ideas', it: 'Capo delle Idee', ro: 'Șef de Idei' },
  { emoji: '🏛️', lvl: 1, en: 'Department Head', it: 'Capo Reparto', ro: 'Șef de Departament' },
  { emoji: '🎨', lvl: 2, en: 'Designer', it: 'Designer', ro: 'Designer' },
  { emoji: '🛠️', lvl: 2, en: 'Builder', it: 'Costruttore', ro: 'Constructor' },
  { emoji: '📈', lvl: 2, en: 'Growth Lead', it: 'Capo Crescita', ro: 'Lider de Creștere' },
  { emoji: '✍️', lvl: 2, en: 'Storyteller', it: 'Narratore', ro: 'Povestitor' },
  { emoji: '🎉', lvl: 2, en: 'Chief of Fun', it: 'Capo del Divertimento', ro: 'Șef de Distracție' },
  { emoji: '📣', lvl: 3, en: 'Hype Officer', it: 'Responsabile Hype', ro: 'Ofițer de Hype' },
  { emoji: '🔗', lvl: 3, en: 'Connector', it: 'Connettore', ro: 'Conector' },
  { emoji: '🧭', lvl: 3, en: 'Explorer', it: 'Esploratore', ro: 'Explorator' },
];

const TIERS = [
  { en: 'Top', it: 'Vertice', ro: 'Vârf' },
  { en: 'Leads', it: 'Responsabili', ro: 'Lideri' },
  { en: 'Makers', it: 'Creatori', ro: 'Creatori' },
  { en: 'Crew', it: 'Squadra', ro: 'Echipă' },
];

const TRAITS = [
  { emoji: '⚡', en: 'Unstoppable energy', it: 'Energia inarrestabile', ro: 'Energie de neoprit' },
  { emoji: '☀️', en: 'Endless optimism', it: 'Ottimismo infinito', ro: 'Optimism nesfârșit' },
  { emoji: '🚀', en: 'Big dreamer', it: 'Grande sognatore', ro: 'Mare visător' },
  { emoji: '🧲', en: 'Team glue', it: 'Collante del team', ro: 'Liantul echipei' },
  { emoji: '🔥', en: 'Fearless', it: 'Senza paura', ro: 'Neînfricat' },
  { emoji: '🌟', en: 'Good vibes only', it: 'Solo buone vibrazioni', ro: 'Numai vibrații bune' },
  { emoji: '🏆', en: 'Born to win', it: 'Nato per vincere', ro: 'Născut să câștige' },
  { emoji: '🫶', en: "Everyone's ally", it: 'Alleato di tutti', ro: 'Aliatul tuturor' },
];

const label = (o) => `${o.emoji} ${o[uiLang()] || o.en}`;

export function roles() { return ROLES.map(label); }
export function traits() { return TRAITS.map(label); }

// Level (0..3) of a stored position string (matched by its leading emoji). Default: crew.
export function levelOf(position) {
  if (!position) return 3;
  if (position.startsWith('⭐')) return 2;   // custom self-written roles join the Makers tier
  const r = ROLES.find((x) => position.startsWith(x.emoji));
  return r ? r.lvl : 3;
}

export function tierName(lvl) {
  const t = TIERS[lvl] || TIERS[3];
  return t[uiLang()] || t.en;
}
