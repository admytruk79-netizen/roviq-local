const CATEGORIES = ['food', 'coffee', 'breweries', 'nature', 'culture'];
const STATUSES = ['pending', 'approved', 'rejected'];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status') || 'approved';

  if (!STATUSES.includes(status)) {
    return Response.json({ success: false, error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  let sql = 'SELECT * FROM places WHERE status = ?';
  const params = [status];

  if (category && category !== 'all') {
    if (!CATEGORIES.includes(category)) {
      return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
    }
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY is_drivers_pick DESC, created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return Response.json({ success: true, places: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const { name, category, description, lat, lng, address, photo_url, submitted_by } = body;

  if (!name || typeof name !== 'string') {
    return Response.json({ success: false, error: 'name is required' }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return Response.json({ success: false, error: 'lat and lng must be numbers' }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO places (name, category, description, lat, lng, address, photo_url, status, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(name, category, description || null, lat, lng, address || null, photo_url || null, submitted_by || null).run();

  return Response.json({ success: true, id: result.meta.last_row_id, status: 'pending' }, { status: 201 });
}
