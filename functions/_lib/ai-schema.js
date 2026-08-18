let ready=false;

export async function ensureAiMaintenanceSchema(env){
  if(ready)return;
  const cols=await env.DB.prepare('PRAGMA table_info(places)').all();
  const names=new Set((cols.results||[]).map(c=>c.name));
  const additions=[
    ['website_url','TEXT'],['verification_source','TEXT'],['confidence_score','REAL'],
    ['ai_review_status',"TEXT DEFAULT 'not_reviewed'"],['suspected_change','TEXT'],['last_ai_review_at','TEXT']
  ];
  for(const [name,type] of additions){
    if(!names.has(name))await env.DB.prepare(`ALTER TABLE places ADD COLUMN ${name} ${type}`).run();
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_maintenance_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id INTEGER NOT NULL REFERENCES places(id),
    issue_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','resolved')),
    confidence REAL, priority INTEGER NOT NULL DEFAULT 50,
    source_type TEXT, source_url TEXT, current_snapshot TEXT, observed_snapshot TEXT,
    ai_result TEXT, proposed_changes TEXT, explanation TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT, reviewed_at TEXT, reviewed_by TEXT
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_maintenance_queue(status, priority DESC, created_at ASC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_queue_place ON ai_maintenance_queue(place_id, status)').run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_source_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id INTEGER NOT NULL REFERENCES places(id),
    source_type TEXT NOT NULL, source_url TEXT, payload TEXT NOT NULL,
    observed_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_observations_place ON ai_source_observations(place_id, observed_at DESC)').run();
  ready=true;
}
