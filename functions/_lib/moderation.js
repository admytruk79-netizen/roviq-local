export async function ensureModerationSchema(env) {
  const sql = [
    `CREATE TABLE IF NOT EXISTS contributors (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT UNIQUE NOT NULL, display_name TEXT, email TEXT, role TEXT NOT NULL DEFAULT 'contributor', reputation_score INTEGER NOT NULL DEFAULT 0, submissions_count INTEGER NOT NULL DEFAULT 0, approvals_count INTEGER NOT NULL DEFAULT 0, rejections_count INTEGER NOT NULL DEFAULT 0, trusted INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS curator_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, contributor_id INTEGER NOT NULL REFERENCES contributors(id), country_code TEXT, region TEXT, city TEXT, market_slug TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS moderation_events (id INTEGER PRIMARY KEY AUTOINCREMENT, place_id INTEGER NOT NULL REFERENCES places(id), action TEXT NOT NULL, reviewer_handle TEXT, note TEXT, previous_status TEXT, new_status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS moderation_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, market_slug TEXT, city TEXT, type TEXT NOT NULL DEFAULT 'pending_submission', place_id INTEGER REFERENCES places(id), recipient_role TEXT NOT NULL DEFAULT 'curator', status TEXT NOT NULL DEFAULT 'unread', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_curator_market ON curator_assignments(market_slug, active)`,
    `CREATE INDEX IF NOT EXISTS idx_moderation_place ON moderation_events(place_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_status ON moderation_notifications(status, created_at DESC)`
  ];
  for (const statement of sql) await env.DB.prepare(statement).run();
}

export function contributorHandle(raw) {
  const value = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
  return value || 'anonymous';
}

export async function recordSubmission(env, place, handleRaw) {
  await ensureModerationSchema(env);
  const handle = contributorHandle(handleRaw);
  await env.DB.prepare(`INSERT INTO contributors (handle, submissions_count, updated_at) VALUES (?,1,?) ON CONFLICT(handle) DO UPDATE SET submissions_count=submissions_count+1, updated_at=excluded.updated_at`).bind(handle, new Date().toISOString()).run();
  await env.DB.prepare(`INSERT INTO moderation_events (place_id, action, reviewer_handle, new_status) VALUES (?, 'submitted', ?, 'pending')`).bind(place.id, handle).run();
  await env.DB.prepare(`INSERT INTO moderation_notifications (market_slug, city, place_id, recipient_role) VALUES (?, ?, ?, 'curator')`).bind(place.market_slug || null, place.city || null, place.id).run();
}

export async function updateContributorOutcome(env, handleRaw, approved) {
  const handle = contributorHandle(handleRaw);
  if (handle === 'anonymous') return;
  const approvalDelta = approved ? 1 : 0;
  const rejectionDelta = approved ? 0 : 1;
  const reputationDelta = approved ? 5 : -2;
  await env.DB.prepare(`UPDATE contributors SET approvals_count=approvals_count+?, rejections_count=rejections_count+?, reputation_score=MAX(0,reputation_score+?), trusted=CASE WHEN approvals_count + ? >= 10 AND reputation_score + ? >= 40 THEN 1 ELSE trusted END, updated_at=? WHERE handle=?`).bind(approvalDelta, rejectionDelta, reputationDelta, approvalDelta, reputationDelta, new Date().toISOString(), handle).run();
}
