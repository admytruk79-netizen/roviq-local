import * as places from './functions/api/places/index.js';
import * as place from './functions/api/places/[id].js';
import * as placeView from './functions/api/places/[id]/view.js';
import * as advisories from './functions/api/advisories/index.js';
import * as config from './functions/api/config.js';
import * as health from './functions/api/health.js';
import * as geocode from './functions/api/geocode.js';
import * as adminQueue from './functions/api/admin/queue.js';
import * as adminPlaces from './functions/api/admin/places/index.js';
import * as adminPlace from './functions/api/admin/places/[id].js';
import * as adminAdvisories from './functions/api/admin/advisories/index.js';
import * as adminAdvisory from './functions/api/admin/advisories/[id].js';
import * as staleSubmissions from './functions/api/cron/stale-submissions.js';

function methodHandler(module, method) {
  const name = `onRequest${method.charAt(0)}${method.slice(1).toLowerCase()}`;
  return module[name];
}

async function run(module, request, env, params = {}) {
  const handler = methodHandler(module, request.method);
  if (!handler) {
    return Response.json({ success: false, error: 'method not allowed' }, {
      status: 405,
      headers: { Allow: Object.keys(module).filter((k) => k.startsWith('onRequest')).map((k) => k.slice(9).toUpperCase()).join(', ') }
    });
  }
  return handler({ request, env, params });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/api/config') return run(config, request, env);
    if (path === '/api/health') return run(health, request, env);
    if (path === '/api/geocode') return run(geocode, request, env);
    if (path === '/api/places') return run(places, request, env);
    if (path === '/api/advisories') return run(advisories, request, env);
    if (path === '/api/admin/queue') return run(adminQueue, request, env);
    if (path === '/api/admin/places') return run(adminPlaces, request, env);
    if (path === '/api/admin/advisories') return run(adminAdvisories, request, env);
    if (path === '/api/cron/stale-submissions') return run(staleSubmissions, request, env);

    let match = path.match(/^\/api\/places\/(\d+)\/view$/);
    if (match) return run(placeView, request, env, { id: match[1] });

    match = path.match(/^\/api\/places\/(\d+)$/);
    if (match) return run(place, request, env, { id: match[1] });

    match = path.match(/^\/api\/admin\/places\/(\d+)$/);
    if (match) return run(adminPlace, request, env, { id: match[1] });

    match = path.match(/^\/api\/admin\/advisories\/(\d+)$/);
    if (match) return run(adminAdvisory, request, env, { id: match[1] });

    if (path.startsWith('/api/')) {
      return Response.json({ success: false, error: 'not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const request = new Request('https://roviq-local2.internal/api/cron/stale-submissions', { method: 'GET' });
    ctx.waitUntil(staleSubmissions.onRequestGet({ request, env }).then(async (response) => {
      if (!response.ok) console.error('ROVIQ Local stale-submission cron failed', response.status, await response.text());
    }).catch((error) => console.error('ROVIQ Local stale-submission cron error', error)));
  }
};
