const CATEGORIES = ['food', 'coffee', 'breweries', 'nature', 'culture'];
const STATUSES = ['pending', 'approved', 'rejected'];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status') || 'approved';

  if (!STATUSES.includes(status)) {
    return Response.json({ success: false, error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const params = [status];
  let where = 'status = ?';
  if (category && category !== 'all') {
    if (!CATEGORIES.includes(category)) {
      return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
    }
    where += ' AND category = ?';
    params.push(category);
  }

  // v2 databases have is_hidden; fall back cleanly while the migration is being rolled out.
  let results;
  try {
    const out = await env.DB.prepare(`SELECT * FROM places WHERE ${where} AND COALESCE(is_hidden, 0) = 0 ORDER BY is_drivers_pick DESC, created_at DESC`).bind(...params).all();
    results = out.results;
  } catch {
    const out = await env.DB.prepare(`SELECT * FROM places WHERE ${where} ORDER BY is_drivers_pick DESC, created_at DESC`).bind(...params).all();
    results = out.results;
  }
  return Response.json({ success: true, places: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = body.category;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const photoUrl = typeof body.photo_url === 'string' ? body.photo_url.trim() : '';
  const submittedBy = typeof body.submitted_by === 'string' ? body.submitted_by.trim() : '';
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!name || name.length > 120) return Response.json({ success: false, error: 'name is required and must be under 120 characters' }, { status: 400 });
  if (!CATEGORIES.includes(category)) return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ success: false, error: 'valid lat and lng are required' }, { status: 400 });
  }
  if (description.length > 800 || address.length > 300 || submittedBy.length > 80) {
    return Response.json({ success: false, error: 'one or more fields are too long' }, { status: 400 });
  }
  if (photoUrl && !/^https:\/\//i.test(photoUrl)) {
    return Response.json({ success: false, error: 'photo URL must use https' }, { status: 400 });
  }

  const possible = await env.DB.prepare(
    `SELECT id, name, address FROM places
     WHERE lower(name) = lower(?) OR (ABS(lat - ?) < 0.0015 AND ABS(lng - ?) < 0.0015)
     LIMIT 3`
  ).bind(name, lat, lng).all();
  if (possible.results?.length) {
    return Response.json({ success: false, error: 'This place may already be in ROVIQ Local.', duplicates: possible.results }, { status: 409 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO places (name, category, description, lat, lng, address, photo_url, status, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(name, category, description || null, lat, lng, address || null, photoUrl || null, submittedBy || null).run();

  return Response.json({ success: true, id: result.meta.last_row_id, status: 'pending' }, { status: 201 });
}
