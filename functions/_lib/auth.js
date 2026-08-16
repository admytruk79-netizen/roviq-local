export function isAdminAuthed(request, env) {
  return Boolean(env.ADMIN_PASSCODE) && request.headers.get('X-Admin-Passcode') === env.ADMIN_PASSCODE;
}

export function unauthorized(message = 'unauthorized') {
  return Response.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = 'forbidden') {
  return Response.json({ success: false, error: message }, { status: 403 });
}

// Backward-compatible shared-passcode guard for older admin endpoints.
export function requireAdmin(request, env) {
  return isAdminAuthed(request, env) ? null : unauthorized();
}

export async function ensureCuratorAuthSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS curator_credentials (
    contributor_id INTEGER PRIMARY KEY REFERENCES contributors(id),
    token_hash TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_curator_credentials_active ON curator_credentials(active)`).run();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  return (request.headers.get('X-Curator-Token') || '').trim();
}

export async function authenticateModerator(request, env) {
  // Existing ADMIN_PASSCODE remains a super-admin escape hatch during migration.
  if (isAdminAuthed(request, env)) {
    return { authenticated: true, legacy: true, contributorId: null, handle: 'admin', role: 'super_admin', assignments: [] };
  }

  await ensureCuratorAuthSchema(env);
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await env.DB.prepare(`
    SELECT c.id, c.handle, c.display_name, c.email, c.role
    FROM curator_credentials cc
    JOIN contributors c ON c.id = cc.contributor_id
    WHERE cc.token_hash = ? AND cc.active = 1
  `).bind(tokenHash).first();
  if (!user) return null;

  await env.DB.prepare(`UPDATE curator_credentials SET last_used_at=? WHERE contributor_id=?`)
    .bind(new Date().toISOString(), user.id).run();
  const assignmentOut = await env.DB.prepare(`
    SELECT country_code, region, city, market_slug
    FROM curator_assignments
    WHERE contributor_id=? AND active=1
  `).bind(user.id).all();

  return {
    authenticated: true,
    legacy: false,
    contributorId: user.id,
    handle: user.handle,
    displayName: user.display_name || user.handle,
    email: user.email || null,
    role: user.role || 'curator',
    assignments: assignmentOut.results || []
  };
}

export async function requireModerator(request, env, allowedRoles = ['curator','regional_admin','super_admin']) {
  const actor = await authenticateModerator(request, env);
  if (!actor) return { response: unauthorized(), actor: null };
  if (!allowedRoles.includes(actor.role)) return { response: forbidden('insufficient role'), actor };
  return { response: null, actor };
}

export function canModeratePlace(actor, place) {
  if (!actor) return false;
  if (actor.role === 'super_admin') return true;
  const assignments = actor.assignments || [];
  if (!assignments.length) return false;
  const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  return assignments.some(a => {
    if (a.market_slug && eq(a.market_slug, place.market_slug)) return true;
    if (a.city && eq(a.city, place.city) && (!a.region || eq(a.region, place.region)) && (!a.country_code || eq(a.country_code, place.country_code))) return true;
    if (a.region && eq(a.region, place.region) && (!a.country_code || eq(a.country_code, place.country_code))) return true;
    if (a.country_code && eq(a.country_code, place.country_code) && !a.region && !a.city && !a.market_slug) return true;
    return false;
  });
}

export async function hashCuratorToken(token) {
  return sha256(token);
}
