import { requireModerator, hashCuratorToken, ensureCuratorAuthSchema } from '../../_lib/auth.js';
import { ensureModerationSchema } from '../../_lib/moderation.js';

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'rql_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
  const { response, actor } = await requireModerator(request, env, ['super_admin']);
  if (response) return response;
  await ensureModerationSchema(env);
  await ensureCuratorAuthSchema(env);
  const out = await env.DB.prepare(`
    SELECT c.id,c.handle,c.display_name,c.email,c.role,c.trusted,
           cc.active AS credential_active,cc.created_at,cc.last_used_at
    FROM contributors c
    LEFT JOIN curator_credentials cc ON cc.contributor_id=c.id
    WHERE c.role IN ('curator','regional_admin','super_admin')
    ORDER BY c.role DESC,c.handle ASC
  `).all();
  const users = out.results || [];
  for (const user of users) {
    const a = await env.DB.prepare(`SELECT id,country_code,region,city,market_slug,active FROM curator_assignments WHERE contributor_id=? ORDER BY created_at ASC`).bind(user.id).all();
    user.assignments = a.results || [];
  }
  return Response.json({ success:true, users, actor:{handle:actor.handle,role:actor.role} });
}

export async function onRequestPost({ request, env }) {
  const { response } = await requireModerator(request, env, ['super_admin']);
  if (response) return response;
  await ensureModerationSchema(env);
  await ensureCuratorAuthSchema(env);

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success:false,error:'invalid JSON body' }, {status:400}); }
  const action = String(body.action || 'provision');

  if (action === 'deactivate') {
    const id = Number(body.contributor_id);
    if (!Number.isInteger(id) || id < 1) return Response.json({success:false,error:'valid contributor_id required'},{status:400});
    await env.DB.prepare(`UPDATE curator_credentials SET active=0 WHERE contributor_id=?`).bind(id).run();
    await env.DB.prepare(`UPDATE curator_assignments SET active=0 WHERE contributor_id=?`).bind(id).run();
    return Response.json({success:true,action:'deactivated',contributor_id:id});
  }

  const handle = String(body.handle || '').trim().slice(0,80);
  const displayName = String(body.display_name || '').trim().slice(0,120) || null;
  const email = String(body.email || '').trim().slice(0,180) || null;
  const role = String(body.role || 'curator');
  if (!handle) return Response.json({success:false,error:'handle required'},{status:400});
  if (!['curator','regional_admin','super_admin'].includes(role)) return Response.json({success:false,error:'invalid role'},{status:400});

  await env.DB.prepare(`INSERT INTO contributors(handle,display_name,email,role,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(handle) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,role=excluded.role,updated_at=excluded.updated_at`)
    .bind(handle,displayName,email,role,new Date().toISOString()).run();
  const contributor = await env.DB.prepare(`SELECT id FROM contributors WHERE handle=?`).bind(handle).first();
  const token = randomToken();
  const tokenHash = await hashCuratorToken(token);
  await env.DB.prepare(`INSERT INTO curator_credentials(contributor_id,token_hash,active) VALUES(?,?,1) ON CONFLICT(contributor_id) DO UPDATE SET token_hash=excluded.token_hash,active=1,created_at=CURRENT_TIMESTAMP`)
    .bind(contributor.id,tokenHash).run();

  if (role !== 'super_admin') {
    const a = body.assignment || {};
    const country = String(a.country_code || '').trim().slice(0,8) || null;
    const region = String(a.region || '').trim().slice(0,120) || null;
    const city = String(a.city || '').trim().slice(0,120) || null;
    const market = String(a.market_slug || '').trim().slice(0,160) || null;
    if (!country && !region && !city && !market) return Response.json({success:false,error:'market assignment required for non-super-admin'},{status:400});
    await env.DB.prepare(`INSERT INTO curator_assignments(contributor_id,country_code,region,city,market_slug,active) VALUES(?,?,?,?,?,1)`)
      .bind(contributor.id,country,region,city,market).run();
  }

  return Response.json({
    success:true,
    contributor_id:contributor.id,
    handle,
    role,
    token,
    warning:'Store this token securely. It is returned only when provisioned or rotated.'
  });
}
