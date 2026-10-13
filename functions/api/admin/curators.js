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
    WHERE c.role IN ('contributor','city_curator','regional_admin','super_admin')
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
  const { response, actor } = await requireModerator(request, env, ['super_admin']);
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
    await env.DB.batch([env.DB.prepare('UPDATE curator_credentials SET active=0 WHERE contributor_id=?').bind(id),env.DB.prepare('UPDATE curator_assignments SET active=0 WHERE contributor_id=?').bind(id),env.DB.prepare('INSERT INTO security_audit_events(actor_handle,contributor_id,action) VALUES(?,?,?)').bind(actor.handle,id,'deactivated')]);
    return Response.json({success:true,action:'deactivated',contributor_id:id});
  }

  const handle = String(body.handle || '').trim().slice(0,80);
  const displayName = String(body.display_name || '').trim().slice(0,120) || null;
  const email = String(body.email || '').trim().slice(0,180) || null;
  const role = String(body.role || 'contributor');
  if (!handle) return Response.json({success:false,error:'handle required'},{status:400});
  if (!['contributor','city_curator','regional_admin','super_admin'].includes(role)) return Response.json({success:false,error:'invalid role'},{status:400});

  const assignment = body.assignment || {};
  const assignmentFields = ['country_code','region','city','market_slug'];
  const cleanAssignment = Object.fromEntries(assignmentFields.map(key=>[key,typeof assignment[key]==='string'?assignment[key].trim().slice(0,180)||null:null]));
  if(['city_curator','regional_admin'].includes(role)) {
    if(role==='city_curator'&&!cleanAssignment.city&&!cleanAssignment.market_slug)return Response.json({success:false,error:'city or market required for city curators'},{status:400});
    if(!Object.values(cleanAssignment).some(Boolean))return Response.json({success:false,error:'market assignment required'},{status:400});
    if(!cleanAssignment.market_slug&&!cleanAssignment.country_code)return Response.json({success:false,error:'country_code required for geographic assignments'},{status:400});
  }
  let contributor = await env.DB.prepare('SELECT id FROM contributors WHERE handle=?').bind(handle).first();
  if(!contributor){
    await env.DB.prepare('INSERT INTO contributors(handle,role) VALUES(?,?)').bind(handle,'contributor').run();
    contributor=await env.DB.prepare('SELECT id FROM contributors WHERE handle=?').bind(handle).first();
  }

  const token = randomToken();
  const tokenHash = await hashCuratorToken(token);
  const mutations=[env.DB.prepare('UPDATE contributors SET display_name=?,email=?,role=?,updated_at=? WHERE id=?').bind(displayName,email,role,new Date().toISOString(),contributor.id),env.DB.prepare('INSERT INTO curator_credentials(contributor_id,token_hash,active) VALUES(?,?,1) ON CONFLICT(contributor_id) DO UPDATE SET token_hash=excluded.token_hash,active=1,created_at=CURRENT_TIMESTAMP').bind(contributor.id,tokenHash),env.DB.prepare('UPDATE curator_assignments SET active=0 WHERE contributor_id=?').bind(contributor.id)];
  if(['city_curator','regional_admin'].includes(role))mutations.push(env.DB.prepare('INSERT INTO curator_assignments(contributor_id,country_code,region,city,market_slug,active) VALUES(?,?,?,?,?,1)').bind(contributor.id,...assignmentFields.map(key=>cleanAssignment[key])));
  mutations.push(env.DB.prepare('INSERT INTO security_audit_events(actor_handle,contributor_id,action) VALUES(?,?,?)').bind(actor.handle,contributor.id,'credentials_rotated'));
  await env.DB.batch(mutations);

  return Response.json({
    success:true,
    contributor_id:contributor.id,
    handle,
    role,
    token,
    warning:'Store this token securely. It is returned only when provisioned or rotated.'
  });
}

