// Original mascot: a friendly stylized lightning-bolt character with simple eyes.
// Not Pikachu / not an animal / no red cheeks. Yellow primary with red/green/azure accents.
// All returned as inline SVG strings so they can be dropped anywhere.

// Full mascot (logo + hero). size = pixel side.
export function mascotSVG(size = 96) {
  return `
  <svg class="icc-mascot" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="InstantCrowdArt lightning mascot" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFE24D"/>
        <stop offset="1" stop-color="#FFD600"/>
      </linearGradient>
    </defs>
    <!-- soft glow -->
    <circle cx="60" cy="60" r="52" fill="#FFD600" opacity="0.12"/>
    <!-- bolt body -->
    <path d="M70 12 L34 66 H54 L48 108 L92 46 H68 L82 12 Z"
          fill="url(#boltGrad)" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
    <!-- eyes -->
    <circle cx="58" cy="52" r="6.5" fill="#111"/>
    <circle cx="74" cy="48" r="6.5" fill="#111"/>
    <circle cx="60" cy="50" r="2.2" fill="#fff"/>
    <circle cx="76" cy="46" r="2.2" fill="#fff"/>
    <!-- smile -->
    <path d="M56 64 q9 8 18 0" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
    <!-- accent sparks -->
    <circle cx="24" cy="34" r="3" fill="#FF5252"/>
    <circle cx="98" cy="78" r="3" fill="#69F0AE"/>
    <circle cx="30" cy="92" r="3" fill="#40C4FF"/>
  </svg>`;
}

// Compact avatar for AI messages.
export function aiAvatarSVG(size = 32) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="19" fill="#1c1c22" stroke="#FFD600" stroke-width="2"/>
    <path d="M24 6 L11 24 H19 L16 34 L30 16 H22 L27 6 Z" fill="#FFD600" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="19" cy="18" r="2.3" fill="#111"/>
    <circle cx="25" cy="16" r="2.3" fill="#111"/>
  </svg>`;
}

// Lightning pulse indicator for "creation speed". intensity 0..1 drives glow speed.
export function pulseSVG(intensity = 0.3) {
  const dur = (2.4 - Math.min(intensity, 1) * 2).toFixed(2); // faster with more activity
  return `
  <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4 L10 24 H18 L15 36 L30 15 H21 L26 4 Z" fill="#FFD600" stroke="#111" stroke-width="1.5" stroke-linejoin="round">
      <animate attributeName="opacity" values="0.45;1;0.45" dur="${dur}s" repeatCount="indefinite"/>
    </path>
  </svg>`;
}
