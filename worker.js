import * as places from './functions/api/places/index.js';
import * as place from './functions/api/places/[id].js';
import * as placeView from './functions/api/places/[id]/view.js';
import * as advisories from './functions/api/advisories/index.js';
import * as config from './functions/api/config.js';
import * as health from './functions/api/health.js';
import * as geocode from './functions/api/geocode.js';
import * as me from './functions/api/me.js';
import * as adminQueue from './functions/api/admin/queue.js';
import * as adminModerate from './functions/api/admin/moderate.js';
import * as adminActivity from './functions/api/admin/activity.js';
import * as adminPlaces from './functions/api/admin/places/index.js';
import * as adminPlace from './functions/api/admin/places/[id].js';
import * as adminAdvisories from './functions/api/admin/advisories/index.js';
import * as adminAdvisory from './functions/api/admin/advisories/[id].js';
import * as adminCurators from './functions/api/admin/curators.js';
import * as adminAiMaintenance from './functions/api/admin/ai-maintenance.js';
import * as staleSubmissions from './functions/api/cron/stale-submissions.js';
import * as aiMaintenance from './functions/api/cron/ai-maintenance.js';

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

async function assetResponse(request, env, path) {
  const response = await env.ASSETS.fetch(request);
  if (!response || response.status >= 400) return response;
  const headers = new Headers(response.headers);
  const isMutable = path === '/' || path.startsWith('/admin') || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css');
  if (isMutable) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
    if (path === '/api/me') return run(me, request, env);
    if (path === '/api/admin/queue') return run(adminQueue, request, env);
    if (path === '/api/admin/moderate') return run(adminModerate, request, env);
    if (path === '/api/admin/activity') return run(adminActivity, request, env);
    if (path === '/api/admin/places') return run(adminPlaces, request, env);
    if (path === '/api/admin/advisories') return run(adminAdvisories, request, env);
    if (path === '/api/admin/curators') return run(adminCurators, request, env);
    if (path === '/api/admin/ai-maintenance') return run(adminAiMaintenance, request, env);
    if (path === '/api/cron/stale-submissions') return run(staleSubmissions, request, env);
    if (path === '/api/cron/ai-maintenance') return run(aiMaintenance, request, env);

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

    return assetResponse(request, env, path);
  },

  async scheduled(controller, env, ctx) {
    const staleRequest = new Request('https://roviq-local2.internal/api/cron/stale-submissions', { method: 'GET' });
    ctx.waitUntil(staleSubmissions.onRequestGet({ request: staleRequest, env }).then(async (response) => {
      if (!response.ok) console.error('ROVIQ Local stale-submission cron failed', response.status, await response.text());
    }).catch((error) => console.error('ROVIQ Local stale-submission cron error', error)));

    const hour = new Date(controller.scheduledTime || Date.now()).getUTCHours();
    if (hour % 6 === 0) {
      const headers = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};
      const aiRequest = new Request('https://roviq-local2.internal/api/cron/ai-maintenance', { method: 'GET', headers });
      ctx.waitUntil(aiMaintenance.onRequestGet({ request: aiRequest, env }).then(async (response) => {
        if (!response.ok) console.error('ROVIQ Local AI maintenance cron failed', response.status, await response.text());
      }).catch((error) => console.error('ROVIQ Local AI maintenance cron error', error)));
    }
  }
};
