import { requireModerator, canModeratePlace } from '../../../_lib/auth.js';

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function onRequestPatch({ request, env, params }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ success: false, error: 'invalid advisory id' }, { status: 400 });

  const advisory = await env.DB.prepare(`SELECT id,status,market_slug,city,region,country_code FROM journey_advisories WHERE id=?`).bind(id).first();
  if (!advisory) return Response.json({ success:false,error:'advisory not found' }, { status:404 });
  if (!canModeratePlace(actor, advisory)) return Response.json({ success:false,error:'not assigned to this market' }, { status:403 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  const status = String(body.status || '').toLowerCase();
  const allowed = ['pending','active','expired','rejected','withdrawn'];
  if (!allowed.includes(status)) return Response.json({ success: false, error: 'invalid status' }, { status: 400 });

  const note = clean(body.moderation_note, 800);
  const expiresAt = clean(body.expires_at, 64);
  const reviewer = actor.handle || 'curator';

  const result = await env.DB.prepare(
    `UPDATE journey_advisories
     SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
         moderation_note = ?, expires_at = COALESCE(NULLIF(?, ''), expires_at), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(status, reviewer, note || null, expiresAt, id).run();

  if (!result.meta.changes) return Response.json({ success: false, error: 'advisory not found' }, { status: 404 });
  return Response.json({ success: true, id, status, reviewed_by: reviewer });
}
