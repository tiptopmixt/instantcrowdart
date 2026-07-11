// Map detected language codes to a representative flag emoji for the flags bar.
// (Language → country is inherently approximate; used only as a friendly signal.)
const LANG_FLAG = {
  en: '🇬🇧', it: '🇮🇹', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', pt: '🇵🇹', 'pt-br': '🇧🇷',
  nl: '🇳🇱', ru: '🇷🇺', uk: '🇺🇦', pl: '🇵🇱', tr: '🇹🇷', ar: '🇸🇦', he: '🇮🇱',
  hi: '🇮🇳', bn: '🇧🇩', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', 'zh-tw': '🇹🇼', th: '🇹🇭',
  vi: '🇻🇳', id: '🇮🇩', ms: '🇲🇾', sv: '🇸🇪', no: '🇳🇴', da: '🇩🇰', fi: '🇫🇮',
  el: '🇬🇷', cs: '🇨🇿', ro: '🇷🇴', hu: '🇭🇺', fa: '🇮🇷', sw: '🇰🇪',
};

export function flagFor(lang) {
  if (!lang) return '🏳️';
  const key = String(lang).toLowerCase();
  return LANG_FLAG[key] || LANG_FLAG[key.split('-')[0]] || '🏳️';
}

// Given an array of language codes, return unique flags preserving first-seen order.
export function flagsFromLangs(langs) {
  const seen = new Set();
  const out = [];
  for (const l of langs) {
    const f = flagFor(l);
    if (!seen.has(f)) { seen.add(f); out.push({ lang: l, flag: f }); }
  }
  return out;
}
