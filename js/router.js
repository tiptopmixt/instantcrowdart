// Minimal hash router so it works on GitHub Pages with no server config.
// Routes: #/ (home), #/c/CODE (chat), #/wall (co-creators wall)

const routes = [];

export function route(pattern, handler) {
  // pattern like '/c/:code' -> regex
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  }) + '$');
  routes.push({ rx, keys, handler });
}

export function navigate(path) {
  if (location.hash !== '#' + path) location.hash = '#' + path;
  else resolve();
}

let _query = {};
export function getQueryParam(k) { return _query[k] || null; }

export function resolve() {
  const raw = (location.hash || '#/').slice(1) || '/';
  const [path, qs] = raw.split('?');
  _query = {};
  if (qs) for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k) _query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return r.handler(params);
    }
  }
  // default -> home
  if (routes[0]) routes[0].handler({});
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
