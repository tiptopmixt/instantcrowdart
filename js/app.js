// Entry point: auth, routing, service worker.
import { ensureAuth } from './auth.js';
import { route, startRouter } from './router.js';
import { renderHome } from './pages/home.js';
import { renderChat } from './pages/chat.js';
import { renderWall } from './pages/wall.js';
import { toast } from './utils.js';
import { languageGate } from './components.js';

const app = document.getElementById('app');

route('/', () => renderHome(app));
route('/c/:code', ({ code }) => renderChat(app, code));
route('/wall', () => renderWall(app));

(async function boot() {
  // First thing: let the user choose their language (flags).
  await languageGate();
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
