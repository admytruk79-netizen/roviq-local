import { requireModerator, canModeratePlace } from '../../../_lib/auth.js';

const CATEGORIES = ['food','coffee','breweries','markets','nature','scenic','culture','recreation','family','lodging','automotive','charging','services','other'];
const STATUSES = ['pending', 'approved', 'rejected'];
const TRUST_LEVELS = ['roviq', 'driver', 'community'];

export async function onRequestGet({ request, env }) {
  const { response, actor } = await requireModerator(request, env);
  if (response) return response;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const status = url.searchParams.get('status');

  let sql = 'SELECT * FROM places WHERE 1=1';
  const params = [];
  if (status && STATUSES.includes(status)) { sql += ' AND status = ?'; params.push(status); }
  if (q) {
    sql += ' AND (name LIKE ? OR address LIKE ? OR description LIKE ? OR city LIKE ? OR market_slug LIKE ?)';
    const like = `%${q}%`; params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY is_hidden ASC, is_drivers_pick DESC, COALESCE(updated_at, created_at) DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  const all = results || [];
  const places = actor.role === 'super_admin' ? all : all.filter(p => canModeratePlace(actor, p));
  return Response.json({ success: true, places, actor:{handle:actor.handle,display_name:actor.displayName||actor.handle,role:actor.role,assignments:actor.assignments||[]} });
}

export async function onRequestPost({ request, env }) {
  const { response, actor } = await requireModerator(request, env, ['super_admin']);
  if (response) return response;

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  const name = String(body.name || '').trim();
  const category = body.category;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const status = STATUSES.includes(body.status) ? body.status : 'approved';
  const trustLevel = TRUST_LEVELS.includes(body.trust_level) ? body.trust_level : 'roviq';

  if (!name) return Response.json({ success: false, error: 'name is required' }, { status: 400 });
  if (!CATEGORIES.includes(category)) return Response.json({ success: false, error: 'invalid category' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ success: false, error: 'lat and lng are required' }, { status: 400 });

  const possible = await env.DB.prepare(`SELECT id,name,address FROM places WHERE lower(name)=lower(?) OR (ABS(lat-?)<0.0015 AND ABS(lng-?)<0.0015) LIMIT 5`).bind(name,lat,lng).all();
  if (possible.results?.length && !body.allow_duplicate) return Response.json({ success:false,error:'possible duplicate',duplicates:possible.results }, {status:409});

  const now = new Date().toISOString();
  const result = await env.DB.prepare(`INSERT INTO places
      (name,category,description,lat,lng,address,photo_url,hours,is_drivers_pick,status,submitted_by,updated_at,verified_at,is_hidden,trust_level,moderation_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    name,category,body.description||null,lat,lng,body.address||null,body.photo_url||null,body.hours||null,
    body.is_drivers_pick?1:0,status,body.submitted_by||actor.handle,now,now,body.is_hidden?1:0,trustLevel,body.moderation_note||null
  ).run();
  return Response.json({ success:true,id:result.meta.last_row_id }, {status:201});
}
