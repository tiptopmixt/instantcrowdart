// Generate an engaging shareable image card (for Instagram stories etc.) on a canvas,
// then share it via the Web Share API (files). Falls back to download + copy link.
import { L } from './locale.js';
import { toast } from './utils.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; lines++;
      line = w;
      if (maxLines && lines >= maxLines - 1) {
        // put the rest, truncate with …
        let rest = w;
        for (const w2 of words.slice(words.indexOf(w) + 1)) {
          if (ctx.measureText(rest + ' ' + w2 + '…').width > maxW) { rest += '…'; break; }
          rest += ' ' + w2;
        }
        ctx.fillText(rest, x, y); return y + lh;
      }
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

export async function buildCardBlob({ who, role, title, count, code }) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Background + glow
  ctx.fillStyle = '#0d0d11';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 720, 80, W / 2, 720, 820);
  glow.addColorStop(0, 'rgba(255,214,0,0.22)');
  glow.addColorStop(1, 'rgba(255,214,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Brand
  ctx.font = '120px sans-serif';
  ctx.fillText('⚡', W / 2, 260);
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('InstantCrowdArt', W / 2, 340);

  // Identity block: name + chosen area (localized, no avatars)
  if (who) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 82px sans-serif';
    wrap(ctx, who, W / 2, 560, W - 140, 92, 2);
  }
  if (role) {
    ctx.fillStyle = '#FFD600';
    ctx.font = 'bold 92px sans-serif';
    wrap(ctx, role, W / 2, 740, W - 120, 100, 2);
  }

  // Card: localized tagline
  let y = 1010;
  const cardH = 360;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 80, y, W - 160, cardH, 40); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,0,0.5)'; ctx.lineWidth = 3;
  roundRect(ctx, 80, y, W - 160, cardH, 40); ctx.stroke();
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('🏢 ' + String(title || '').toUpperCase().slice(0, 30), W / 2, y + 90);
  ctx.fillStyle = '#e8e8ee';
  ctx.font = '46px sans-serif';
  wrap(ctx, L('cardTagline'), W / 2, y + 180, W - 220, 60, 3);
  y += cardH + 110;

  // Stats (localized)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(`⚡ ${count || 0} ${L('inside')} · ${L('shareBuilding')}`, W / 2, y);

  // CTA (localized)
  ctx.fillStyle = '#FFD600';
  roundRect(ctx, W / 2 - 380, H - 230, 760, 120, 60); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(L('shareCta') + ' ' + (code || 'FOUND1'), W / 2, H - 155);

  return await new Promise((res) => c.toBlob(res, 'image/png', 0.92));
}

export async function shareCard(data) {
  const url = data.url;
  const who = data.who ? `${data.who}${data.role ? ' · ' + data.role : ''} — ` : '';
  const text = `${who}${L('shareText')}`;
  try {
    const blob = await buildCardBlob(data);
    const file = new File([blob], 'instantcrowdchat.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text, url });
      return true;
    }
    // Fallback: open the image so the user can save it, and copy the link.
    const objUrl = URL.createObjectURL(blob);
    window.open(objUrl, '_blank');
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(L('share') + ' → link copied', 'ok'); } catch { /* ignore */ }
    return true;
  } catch (e) {
    // Last resort: plain text share / copy.
    try {
      if (navigator.share) { await navigator.share({ text, url }); return true; }
      await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied', 'ok');
    } catch { /* ignore */ }
    return false;
  }
}
