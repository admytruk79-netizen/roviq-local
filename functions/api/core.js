import { createCoreAdapter } from '../../src/core/adapter.js';

export async function onRequestGet({ env }) {
  const core = createCoreAdapter(env);
  const health = await core.health();
  return Response.json({ success: true, integration: 'roviq-core', ...health }, { status: health.connected || health.mode === 'local' ? 200 : 503 });
}

export async function onRequestPost({ request, env }) {
  const core = createCoreAdapter(env);
  if (core.mode !== 'remote') return Response.json({ success:false, error:'ROVIQ Core is not configured' }, { status:503 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  try {
    if (action === 'triage') {
      if (!body.caseId || !body.symptoms) return Response.json({ success:false, error:'caseId and symptoms required' }, { status:400 });
      const result = await core.triage(body.caseId, { symptoms:body.symptoms, vehicle:body.vehicle || {}, observations:body.observations || {}, mode:body.mode || 'shadow' });
      return Response.json({ success:true, result });
    }
    if (action === 'case') {
      if (!body.caseId) return Response.json({ success:false, error:'caseId required' }, { status:400 });
      return Response.json({ success:true, result:await core.getServiceCase(body.caseId) });
    }
    return Response.json({ success:false, error:'unsupported action' }, { status:400 });
  } catch (error) {
    return Response.json({ success:false, error:error.message, core:error.data || null }, { status:error.status || 502 });
  }
}
