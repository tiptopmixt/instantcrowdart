// Entry point: auth, routing, service worker.
import { ensureAuth } from './auth.js';
import { route, startRouter } from './router.js';
import { renderHome } from './pages/home.js';
import { renderExperiment } from './pages/experiment.js';
import { renderWall } from './pages/wall.js';
import { toast } from './utils.js';
import { languageGate } from './components.js';
import { L } from './locale.js';

const app = document.getElementById('app');

route('/', () => renderHome(app));
route('/c/:code', ({ code }) => renderExperiment(app, code));
route('/wall', () => renderWall(app));

function setBanner() {
  const b = document.getElementById('proto-banner');
  if (b) b.textContent = L('proto');
}

(async function boot() {
  // First thing: let the user choose their language (flags).
  await languageGate();
  setBanner();
  try {
    await ensureAuth();
  } catch (e) {
    console.error('Auth failed', e);
    toast('Connection problem. Check Supabase config.', 'error');
  }
  startRouter();
})();

// Register service worker (PWA). Relative path works on GitHub Pages subpaths.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((e) => console.warn('SW failed', e));
  });
}
