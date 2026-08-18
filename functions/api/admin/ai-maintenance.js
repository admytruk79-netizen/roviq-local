import { requireModerator } from '../../_lib/auth.js';
import { analyzeObservation, enqueueFinding, runMaintenanceBatch } from '../../_lib/ai-maintenance.js';

export async function onRequestGet({request,env}){
  const {response,actor}=await requireModerator(request,env);if(response)return response;
  const status=new URL(request.url).searchParams.get('status')||'pending';
  const out=await env.DB.prepare(`SELECT q.*,p.name,p.city,p.region,p.category,p.website_url FROM ai_maintenance_queue q JOIN places p ON p.id=q.place_id WHERE q.status=? ORDER BY q.priority DESC,q.created_at ASC LIMIT 200`).bind(status).all();
  const counts=await env.DB.prepare(`SELECT status,COUNT(*) count FROM ai_maintenance_queue GROUP BY status`).all();
  return Response.json({success:true,actor:{handle:actor.handle,role:actor.role},items:out.results||[],counts:counts.results||[]});
}

export async function onRequestPost({request,env}){
  const {response,actor}=await requireModerator(request,env);if(response)return response;
  const body=await request.json().catch(()=>({}));
  if(body.action==='run'){
    const result=await runMaintenanceBatch(env,{limit:Math.min(25,Math.max(1,Number(body.limit)||10)),staleDays:Math.min(365,Math.max(7,Number(body.stale_days)||30))});
    return Response.json({success:true,result});
  }
  if(body.action==='observe'){
    const place=await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(Number(body.place_id)).first();
    if(!place)return Response.json({success:false,error:'place not found'},{status:404});
    if(!body.payload)return Response.json({success:false,error:'payload required'},{status:400});
    const observation={source_type:String(body.source_type||'admin_observation'),source_url:body.source_url||null,payload:body.payload};
    await env.DB.prepare('INSERT INTO ai_source_observations(place_id,source_type,source_url,payload) VALUES(?,?,?,?)').bind(place.id,observation.source_type,observation.source_url,JSON.stringify(body.payload)).run();
    const finding=await analyzeObservation(env,place,observation);
    const queue_id=await enqueueFinding(env,place,finding,observation);
    return Response.json({success:true,finding,queue_id});
  }
  if(body.action==='resolve'){
    const id=Number(body.id);const decision=String(body.decision||'');
    if(!id||!['approved','rejected','resolved'].includes(decision))return Response.json({success:false,error:'invalid resolution'},{status:400});
    const row=await env.DB.prepare('SELECT * FROM ai_maintenance_queue WHERE id=?').bind(id).first();
    if(!row)return Response.json({success:false,error:'finding not found'},{status:404});
    await env.DB.prepare('UPDATE ai_maintenance_queue SET status=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(decision,actor.handle||actor.role,id).run();
    await env.DB.prepare("UPDATE places SET ai_review_status=?, suspected_change=CASE WHEN ?='approved' THEN suspected_change ELSE NULL END WHERE id=?").bind(decision==='approved'?'approved_change':'reviewed',decision,row.place_id).run();
    return Response.json({success:true,id,status:decision});
  }
  return Response.json({success:false,error:'unknown action'},{status:400});
}
