import { requireModerator } from '../../_lib/auth.js';
import { ensureMarketSchema, activateMarket, approveCandidate } from '../../_lib/market-expansion.js';

export async function onRequestGet({request,env}){
  const {response,actor}=await requireModerator(request,env);if(response)return response;await ensureMarketSchema(env);
  const url=new URL(request.url),marketId=Number(url.searchParams.get('market_id')||0),status=url.searchParams.get('status')||'pending';
  const markets=await env.DB.prepare(`SELECT m.*,COUNT(c.id) candidate_count,SUM(CASE WHEN c.status='pending' THEN 1 ELSE 0 END) pending_count FROM markets m LEFT JOIN market_candidates c ON c.market_id=m.id GROUP BY m.id ORDER BY m.created_at DESC`).all();
  let candidates=[];if(marketId){const out=await env.DB.prepare(`SELECT * FROM market_candidates WHERE market_id=? AND status=? ORDER BY ai_score DESC,created_at ASC LIMIT 200`).bind(marketId,status).all();candidates=out.results||[];}
  return Response.json({success:true,actor:{handle:actor.handle,role:actor.role},markets:markets.results||[],candidates});
}

export async function onRequestPost({request,env}){
  const {response,actor}=await requireModerator(request,env);if(response)return response;await ensureMarketSchema(env);const body=await request.json().catch(()=>({}));
  try{
    if(body.action==='activate'){const result=await activateMarket(env,body);return Response.json({success:true,result});}
    if(body.action==='approve'){const result=await approveCandidate(env,Number(body.id),actor.handle||actor.role);return Response.json({success:true,result});}
    if(body.action==='reject'){const id=Number(body.id);if(!id)return Response.json({success:false,error:'id required'},{status:400});await env.DB.prepare("UPDATE market_candidates SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=? AND status='pending'").bind(actor.handle||actor.role,id).run();return Response.json({success:true,id,status:'rejected'});}
    if(body.action==='set_status'){const id=Number(body.market_id),status=String(body.status||'');if(!id||!['draft','scanning','review','active','paused'].includes(status))return Response.json({success:false,error:'invalid market status'},{status:400});await env.DB.prepare('UPDATE markets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run();return Response.json({success:true,market_id:id,status});}
    return Response.json({success:false,error:'unknown action'},{status:400});
  }catch(error){return Response.json({success:false,error:error?.message||'market expansion failed'},{status:500});}
}
