const TYPES = ['access','road','parking','seasonal','closure','pedestrian','official'];

function clean(value, max = 160) {
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
  const market = clean(url.searchParams.get('market'), 180);
  const placeId = Number(url.searchParams.get('place_id'));
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get('radius_km')) || 100, 1), 250);

  const params = [];
  let where = "status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)";
  if (market) { where += ' AND market_slug = ?'; params.push(market); }
  if (Number.isInteger(placeId) && placeId > 0) { where += ' AND place_id = ?'; params.push(placeId); }

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (hasCoords) {
    const latDelta = radiusKm / 111.0;
    const lngScale = Math.max(Math.cos(lat * Math.PI / 180), 0.15);
    const lngDelta = radiusKm / (111.0 * lngScale);
    where += ' AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';
    params.push(lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta);
  }

  try {
    const out = await env.DB.prepare(`SELECT id, place_id, market_slug, city, country_code, lat, lng, address, advisory_type, title, description, source_name, source_url, starts_at, expires_at, reviewed_at, created_at FROM journey_advisories WHERE ${where} ORDER BY created_at DESC LIMIT 200`).bind(...params).all();
    let advisories = out.results || [];
    if (hasCoords) {
      const toRad = (d) => d * Math.PI / 180;
      advisories = advisories.map((a) => {
        if (!Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lng))) return { ...a, distance_km: null };
        const dLat = toRad(Number(a.lat) - lat);
        const dLng = toRad(Number(a.lng) - lng);
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(a.lat))) * Math.sin(dLng / 2) ** 2;
        return { ...a, distance_km: 6371 * 2 * Math.asin(Math.sqrt(x)) };
      }).filter((a) => a.distance_km == null || a.distance_km <= radiusKm);
    }
    return Response.json({ success: true, advisories });
  } catch {
    return Response.json({ success: true, advisories: [], available: false });
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 }); }

  const type = clean(body.advisory_type, 32).toLowerCase();
  const title = clean(body.title, 140);
  const description = clean(body.description, 1200);
  const address = clean(body.address, 300);
  const sourceName = clean(body.source_name, 180);
  const sourceUrl = clean(body.source_url, 500);
  const photoUrl = clean(body.photo_url, 500);
  const submittedBy = clean(body.submitted_by, 100);
  const countryCode = clean(body.country_code, 2).toUpperCase();
  const region = clean(body.region, 120);
  const city = clean(body.city, 120);
  const market = clean(body.market_slug, 180) || marketSlug(countryCode, region, city);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const placeId = Number(body.place_id);

  if (!TYPES.includes(type)) return Response.json({ success: false, error: `advisory_type must be one of ${TYPES.join(', ')}` }, { status: 400 });
  if (!title || !description) return Response.json({ success: false, error: 'title and description are required' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ success: false, error: 'valid lat and lng are required' }, { status: 400 });
  }
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) return Response.json({ success: false, error: 'source URL must use https' }, { status: 400 });
  if (photoUrl && !/^https:\/\//i.test(photoUrl)) return Response.json({ success: false, error: 'photo URL must use https' }, { status: 400 });

  try {
    const result = await env.DB.prepare(
      `INSERT INTO journey_advisories (place_id, market_slug, city, country_code, lat, lng, address, advisory_type, title, description, source_name, source_url, photo_url, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(Number.isInteger(placeId) && placeId > 0 ? placeId : null, market || null, city || null, countryCode || null, lat, lng, address || null, type, title, description, sourceName || null, sourceUrl || null, photoUrl || null, submittedBy || null).run();

    return Response.json({ success: true, id: result.meta.last_row_id, status: 'pending', market_slug: market || null }, { status: 201 });
  } catch (err) {
    console.error('advisory submission failed', err);
    return Response.json({ success: false, error: 'Journey Advisories are not enabled in the production database yet.' }, { status: 503 });
  }
}
