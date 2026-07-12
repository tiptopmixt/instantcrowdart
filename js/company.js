// Simple, classic company areas everyone can pick from (or type their own).
// The chosen area shows next to each person on the shared board.
import { uiLang } from './locale.js';

const DEPARTMENTS = [
  { emoji: '🔧', en: 'Prototyping', it: 'Prototipazione', ro: 'Prototipare' },
  { emoji: '🏭', en: 'Production', it: 'Produzione', ro: 'Producție' },
  { emoji: '🎨', en: 'Design', it: 'Design', ro: 'Design' },
  { emoji: '📣', en: 'Marketing', it: 'Marketing', ro: 'Marketing' },
  { emoji: '💰', en: 'Sales', it: 'Vendite', ro: 'Vânzări' },
  { emoji: '🧑', en: 'HR', it: 'HR', ro: 'HR' },
  { emoji: '📊', en: 'Management', it: 'Management', ro: 'Management' },
  { emoji: '💡', en: 'Ideas', it: 'Idee', ro: 'Idei' },
];

export function departments() {
  return DEPARTMENTS.map((d) => `${d.emoji} ${d[uiLang()] || d.en}`);
}

// Plain comma list for AI prompts / greeting examples (no emojis).
export function departmentNames() {
  return DEPARTMENTS.map((d) => d[uiLang()] || d.en).join(', ');
}
