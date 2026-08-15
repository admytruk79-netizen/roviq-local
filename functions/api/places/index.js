const CATEGORIES = ['food', 'coffee', 'breweries', 'nature', 'culture'];
const STATUSES = ['pending', 'approved', 'rejected'];

function clean(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function marketSlug(countryCode, region, city) {
  return [countryCode, region, city]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status') || 'approved';
  const countryCode = clean(url.searchParams.get('country_code'), 2).toUpperCase();
  const city = clean(url.searchParams.get('city'), 120);
  const market = clean(url.searchParams.get('market'), 180);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get('radius_km')) || 50, 1), 250);

  if (!STATUSES.includes(status)) {
    return Response.json({ success: false, error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const params = [status];
  let where = 'status = ? AND COALESCE(is_hidden, 0) = 0';
  if (category && category !== 'all') {
    if (!CATEGORIES.includes(category)) {
      return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
    }
    where += ' AND category = ?';
    params.push(category);
  }
  if (countryCode) { where += ' AND upper(COALESCE(country_code, ?)) = ?'; params.push('US', countryCode); }
  if (city) { where += ' AND lower(COALESCE(city, ?)) = lower(?)'; params.push('Portland', city); }
  if (market) { where += ' AND COALESCE(market_slug, ?) = ?'; params.push('us-or-portland', market); }

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (hasCoords) {
    const latDelta = radiusKm / 111.0;
    const lngScale = Math.max(Math.cos(lat * Math.PI / 180), 0.15);
    const lngDelta = radiusKm / (111.0 * lngScale);
    where += ' AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';
    params.push(lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta);
  }

  let results;
  try {
    const out = await env.DB.prepare(`SELECT * FROM places WHERE ${where} ORDER BY is_drivers_pick DESC, created_at DESC LIMIT 500`).bind(...params).all();
    results = out.results || [];
  } catch {
    const fallback = await env.DB.prepare('SELECT * FROM places WHERE status = ? ORDER BY is_drivers_pick DESC, created_at DESC LIMIT 500').bind(status).all();
    results = fallback.results || [];
  }

  if (hasCoords) {
    const toRad = (d) => d * Math.PI / 180;
    results = results.map((p) => {
      const dLat = toRad(Number(p.lat) - lat);
      const dLng = toRad(Number(p.lng) - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(p.lat))) * Math.sin(dLng / 2) ** 2;
      const distance_km = 6371 * 2 * Math.asin(Math.sqrt(a));
      return { ...p, distance_km };
    }).filter((p) => p.distance_km <= radiusKm)
      .sort((a, b) => (b.is_drivers_pick - a.is_drivers_pick) || (a.distance_km - b.distance_km));
  }

  return Response.json({ success: true, scope: { country_code: countryCode || null, city: city || null, market: market || null, radius_km: hasCoords ? radiusKm : null }, places: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  const name = clean(body.name, 120);
  const category = body.category;
  const description = clean(body.description, 800);
  const address = clean(body.address, 300);
  const photoUrl = clean(body.photo_url, 500);
  const submittedBy = clean(body.submitted_by, 80);
  const countryCode = clean(body.country_code, 2).toUpperCase();
  const country = clean(body.country, 120);
  const region = clean(body.region, 120);
  const city = clean(body.city, 120);
  const locality = clean(body.locality, 120);
  const postalCode = clean(body.postal_code, 32);
  const timezone = clean(body.timezone, 80);
  const market = clean(body.market_slug, 180) || marketSlug(countryCode, region, city);
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!name) return Response.json({ success: false, error: 'name is required' }, { status: 400 });
  if (!CATEGORIES.includes(category)) return Response.json({ success: false, error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ success: false, error: 'valid lat and lng are required' }, { status: 400 });
  }
  if (photoUrl && !/^https:\/\//i.test(photoUrl)) return Response.json({ success: false, error: 'photo URL must use https' }, { status: 400 });

  const possible = await env.DB.prepare(
    `SELECT id, name, address, city, country_code FROM places
     WHERE lower(name) = lower(?) OR (ABS(lat - ?) < 0.0015 AND ABS(lng - ?) < 0.0015)
     LIMIT 3`
  ).bind(name, lat, lng).all();
  if (possible.results?.length) {
    return Response.json({ success: false, error: 'This place may already be in ROVIQ Local.', duplicates: possible.results }, { status: 409 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO places (name, category, description, lat, lng, address, country_code, country, region, city, locality, postal_code, market_slug, timezone, photo_url, status, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(name, category, description || null, lat, lng, address || null, countryCode || null, country || null, region || null, city || null, locality || null, postalCode || null, market || null, timezone || null, photoUrl || null, submittedBy || null).run();

  return Response.json({ success: true, id: result.meta.last_row_id, status: 'pending', market_slug: market || null }, { status: 201 });
}
