import { requireAdmin } from '../../../_lib/auth.js';

const EDITABLE = new Set([
  'name', 'category', 'description', 'lat', 'lng', 'address', 'photo_url', 'hours',
  'is_drivers_pick', 'status', 'submitted_by', 'is_hidden', 'trust_level', 'moderation_note'
]);
const CATEGORIES = new Set(['food', 'coffee', 'breweries', 'nature', 'culture']);
const STATUSES = new Set(['pending', 'approved', 'rejected']);
const TRUST_LEVELS = new Set(['roviq', 'driver', 'community']);

export async function onRequestPatch({ request, params, env }) {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  if (body.category && !CATEGORIES.has(body.category)) {
    return Response.json({ success: false, error: 'invalid category' }, { status: 400 });
  }
  if (body.status && !STATUSES.has(body.status)) {
    return Response.json({ success: false, error: 'invalid status' }, { status: 400 });
  }
  if (body.trust_level && !TRUST_LEVELS.has(body.trust_level)) {
    return Response.json({ success: false, error: 'invalid trust level' }, { status: 400 });
  }

  const sets = [];
  const values = [];
  for (const [key, raw] of Object.entries(body)) {
    if (!EDITABLE.has(key)) continue;
    let value = raw;
    if (key === 'lat' || key === 'lng') value = Number(raw);
    if ((key === 'lat' || key === 'lng') && !Number.isFinite(value)) {
      return Response.json({ success: false, error: `${key} must be a number` }, { status: 400 });
    }
    if (key === 'is_drivers_pick' || key === 'is_hidden') value = raw ? 1 : 0;
    sets.push(`${key} = ?`);
    values.push(value === '' ? null : value);
  }

  if (body.verify_now) {
    sets.push('verified_at = ?');
    values.push(new Date().toISOString());
  }
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());

  if (!sets.length) return Response.json({ success: false, error: 'no editable fields supplied' }, { status: 400 });

  values.push(params.id);
  const result = await env.DB.prepare(`UPDATE places SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  if (!result.meta.changes) return Response.json({ success: false, error: 'place not found' }, { status: 404 });

  return Response.json({ success: true });
}

export async function onRequestDelete({ request, params, env }) {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  const result = await env.DB.prepare('UPDATE places SET is_hidden = 1, updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), params.id).run();
  if (!result.meta.changes) return Response.json({ success: false, error: 'place not found' }, { status: 404 });
  return Response.json({ success: true, hidden: true });
}
