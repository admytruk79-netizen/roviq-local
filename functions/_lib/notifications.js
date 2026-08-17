import { ensureModerationSchema } from './moderation.js';

async function ensureNotificationDeliverySchema(env) {
  await ensureModerationSchema(env);
  const alters = [
    `ALTER TABLE moderation_notifications ADD COLUMN recipient_contributor_id INTEGER`,
    `ALTER TABLE moderation_notifications ADD COLUMN recipient_email TEXT`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_status TEXT DEFAULT 'queued'`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_attempted_at TEXT`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_error TEXT`
  ];
  for (const sql of alters) {
    try { await env.DB.prepare(sql).run(); } catch {}
  }
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON moderation_notifications(recipient_contributor_id,status,created_at DESC)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_delivery ON moderation_notifications(delivery_status,created_at DESC)`).run();
}

function eq(a,b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function assignmentMatches(a, place) {
  if (a.market_slug && eq(a.market_slug, place.market_slug)) return true;
  if (a.city && eq(a.city, place.city) && (!a.region || eq(a.region, place.region)) && (!a.country_code || eq(a.country_code, place.country_code))) return true;
  if (a.region && eq(a.region, place.region) && (!a.country_code || eq(a.country_code, place.country_code))) return true;
  if (a.country_code && eq(a.country_code, place.country_code) && !a.region && !a.city && !a.market_slug) return true;
  return false;
}

async function recipientsForPlace(env, place) {
  const usersOut = await env.DB.prepare(`
    SELECT c.id,c.handle,c.display_name,c.email,c.role
    FROM contributors c
    WHERE c.role IN ('curator','regional_admin','super_admin')
  `).all();
  const users = usersOut.results || [];
  const recipients = [];
  for (const user of users) {
    if (user.role === 'super_admin') {
      recipients.push(user);
      continue;
    }
    const assignmentsOut = await env.DB.prepare(`
      SELECT country_code,region,city,market_slug
      FROM curator_assignments
      WHERE contributor_id=? AND active=1
    `).bind(user.id).all();
    if ((assignmentsOut.results || []).some(a => assignmentMatches(a, place))) recipients.push(user);
  }
  return recipients;
}

async function deliverWebhook(env, payload) {
  const url = String(env.CURATOR_NOTIFICATION_WEBHOOK_URL || '').trim();
  if (!url) return { status:'queued', error:null };
  try {
    const headers = { 'Content-Type':'application/json' };
    if (env.CURATOR_NOTIFICATION_WEBHOOK_SECRET) headers['Authorization'] = `Bearer ${env.CURATOR_NOTIFICATION_WEBHOOK_SECRET}`;
    const res = await fetch(url, { method:'POST', headers, body:JSON.stringify(payload) });
    if (!res.ok) return { status:'failed', error:`webhook ${res.status}` };
    return { status:'delivered', error:null };
  } catch (err) {
    return { status:'failed', error:String(err?.message || err).slice(0,500) };
  }
}

export async function notifyCuratorsOfSubmission(env, place) {
  await ensureNotificationDeliverySchema(env);
  const recipients = await recipientsForPlace(env, place);
  const created = [];

  // If no named curator is assigned yet, keep one operational notification for super-admin visibility.
  if (!recipients.length) {
    const result = await env.DB.prepare(`
      INSERT INTO moderation_notifications
      (market_slug,city,type,place_id,recipient_role,status,delivery_status)
      VALUES (?,?, 'pending_submission', ?, 'super_admin', 'unread', 'queued')
    `).bind(place.market_slug || null, place.city || null, place.id).run();
    created.push(result.meta.last_row_id);
    return { recipients:0, notifications:created, delivered:0 };
  }

  let delivered = 0;
  for (const user of recipients) {
    const inserted = await env.DB.prepare(`
      INSERT INTO moderation_notifications
      (market_slug,city,type,place_id,recipient_role,status,recipient_contributor_id,recipient_email,delivery_status)
      VALUES (?,?, 'pending_submission', ?, ?, 'unread', ?, ?, 'queued')
    `).bind(place.market_slug || null, place.city || null, place.id, user.role, user.id, user.email || null).run();
    const id = inserted.meta.last_row_id;
    created.push(id);

    const payload = {
      event:'roviq.local.pending_submission',
      notification_id:id,
      recipient:{ id:user.id, handle:user.handle, display_name:user.display_name || user.handle, email:user.email || null, role:user.role },
      place:{ id:place.id, name:place.name || null, category:place.category_key || place.category || null, city:place.city || null, region:place.region || null, country_code:place.country_code || null, market_slug:place.market_slug || null, lat:place.lat ?? null, lng:place.lng ?? null },
      admin_url:'/admin/'
    };
    const attempt = await deliverWebhook(env, payload);
    if (attempt.status === 'delivered') delivered += 1;
    await env.DB.prepare(`
      UPDATE moderation_notifications
      SET delivery_status=?,delivery_attempted_at=?,delivery_error=?
      WHERE id=?
    `).bind(attempt.status, new Date().toISOString(), attempt.error, id).run();
  }

  return { recipients:recipients.length, notifications:created, delivered };
}
