// Ambient FX engine: a living swarm of golden embers that drifts, links up like a
// constellation and leans toward the pointer. This IS the crowd, alive on screen.
let canvas = null, ctx = null, raf = null;
let parts = [], W = 0, H = 0, DPR = 1;
const pointer = { x: -1e4, y: -1e4 };

const REDUCED = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  if (!canvas) return;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function spawn() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -0.15 - Math.random() * 0.35,          // embers drift upward
    r: 0.8 + Math.random() * 2.2,
    hue: 40 + Math.random() * 15,              // gold range
    tw: Math.random() * Math.PI * 2,           // twinkle phase
    ts: 0.02 + Math.random() * 0.04,
  };
}

function onPointer(e) { pointer.x = e.clientX; pointer.y = e.clientY; }

function loop() {
  // If the canvas got removed from the DOM (route change), shut down cleanly.
  if (!canvas || !canvas.isConnected) { stopFX(); return; }
  ctx.clearRect(0, 0, W, H);

  // links (constellation)
  ctx.lineWidth = 0.6;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 110 * 110) {
        const al = (1 - Math.sqrt(d2) / 110) * 0.22;
        ctx.strokeStyle = `rgba(255,214,0,${al.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  // embers
  for (const p of parts) {
    // gentle pull toward the pointer (the crowd "notices" you)
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 160 * 160 && d2 > 1) {
      const d = Math.sqrt(d2);
      p.vx += (dx / d) * 0.012;
      p.vy += (dy / d) * 0.012;
    }
    p.vx *= 0.985; p.vy = p.vy * 0.985 - 0.004;  // keep floating up
    p.x += p.vx; p.y += p.vy;
    p.tw += p.ts;

    if (p.y < -8 || p.x < -8 || p.x > W + 8) Object.assign(p, spawn(), { y: H + 6, x: Math.random() * W });

    const glow = 0.45 + Math.sin(p.tw) * 0.3;
    const near = d2 < 160 * 160 ? 0.35 : 0;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue}, 100%, ${62 + near * 40}%, ${(glow + near).toFixed(3)})`;
    ctx.shadowColor = 'rgba(255,214,0,.9)';
    ctx.shadowBlur = 8;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  raf = requestAnimationFrame(loop);
}

export function startFX(el) {
  if (REDUCED || !el) return;
  stopFX();
  canvas = el;
  ctx = canvas.getContext('2d');
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  const n = W < 600 ? 55 : 90;
  parts = Array.from({ length: n }, spawn);
  loop();
}

export function stopFX() {
  if (raf) cancelAnimationFrame(raf);
  raf = null; canvas = null; ctx = null; parts = [];
  window.removeEventListener('resize', resize);
  window.removeEventListener('pointermove', onPointer);
}

// Full-screen ignition flash used when the user commits to entering.
export function ignite(cb) {
  const o = document.createElement('div');
  o.className = 'icc-ignite';
  document.body.appendChild(o);
  setTimeout(() => { cb?.(); }, 420);
  setTimeout(() => o.remove(), 900);
}
