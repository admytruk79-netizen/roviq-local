import { isAdminAuthed, unauthorized } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!isAdminAuthed(request, env)) return unauthorized();
  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || 'pending').toLowerCase();
  const allowed = ['pending','active','expired','rejected','withdrawn'];
  if (!allowed.includes(status)) return Response.json({ success: false, error: 'invalid status' }, { status: 400 });
  try {
    const out = await env.DB.prepare('SELECT * FROM journey_advisories WHERE status = ? ORDER BY created_at ASC LIMIT 500').bind(status).all();
    return Response.json({ success: true, advisories: out.results || [] });
  } catch {
    return Response.json({ success: true, advisories: [], available: false });
  }
}
