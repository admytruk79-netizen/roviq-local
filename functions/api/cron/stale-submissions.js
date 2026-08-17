import { ensureModerationSchema } from '../../_lib/moderation.js';

const MAIL_URL='https://wiafdkxfgwazprjucspg.supabase.co/functions/v1/send-contact-email';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYWZka3hmZ3dhenByanVjc3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE4NDgsImV4cCI6MjEwMjM3Nzg0OH0.qghDfY_FIOEoqmoQWFDmvLTqhKbuJDOi5MmmkG7nhv8';

async function ensureSchema(env){
  await ensureModerationSchema(env);
  for(const sql of [
    `ALTER TABLE moderation_notifications ADD COLUMN reminder_level INTEGER DEFAULT 0`,
    `ALTER TABLE moderation_notifications ADD COLUMN last_reminded_at TEXT`
  ]){try{await env.DB.prepare(sql).run();}catch{}}
}
async function mail(env,p,level){
  const key=String(env.ROVIQ_MAIL_SUPABASE_ANON_KEY||ANON);
  const age=level===1?'24 hours':'48 hours';
  const body={mode:'roviq_local_curator_notification',place_id:String(p.id),place_name:p.name||'Unnamed place',category:p.category_key||p.category||'',market_slug:p.market_slug||'',city:p.city||'',submitted_by:p.submitted_by||'anonymous contributor',curator_name:level===1?(p.curator_name||'ROVIQ curator'):'ROVIQ regional/admin team',curator_handle:p.curator_handle||'',admin_url:'https://roviq-local2.admytruk79.workers.dev/admin/',notification_type:level===1?'stale_reminder':'stale_escalation',notification_note:`Pending moderation for more than ${age}.`};
  const r=await fetch(MAIL_URL,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  return r.ok&&data.notified!==false;
}
export async function onRequestGet({request,env}){
  if(env.CRON_SECRET){const supplied=request.headers.get('authorization')||'';if(supplied!==`Bearer ${env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});}
  await ensureSchema(env);
  const rows=await env.DB.prepare(`SELECT p.*,n.id notification_id,n.reminder_level,c.display_name curator_name,c.handle curator_handle FROM places p LEFT JOIN moderation_notifications n ON n.place_id=p.id AND n.type='pending_submission' LEFT JOIN contributors c ON c.id=n.recipient_contributor_id WHERE p.status='pending' AND datetime(p.created_at)<=datetime('now','-24 hours') ORDER BY p.created_at ASC LIMIT 100`).all();
  let reminded=0,escalated=0,failed=0;
  for(const p of rows.results||[]){
    const hours=(Date.now()-new Date(p.created_at).getTime())/3600000;
    const level=hours>=48?2:1;
    if(Number(p.reminder_level||0)>=level)continue;
    const ok=await mail(env,p,level);
    if(ok){if(level===1)reminded++;else escalated++;if(p.notification_id)await env.DB.prepare(`UPDATE moderation_notifications SET reminder_level=?,last_reminded_at=? WHERE id=?`).bind(level,new Date().toISOString(),p.notification_id).run();}
    else failed++;
  }
  return Response.json({ok:true,checked:(rows.results||[]).length,reminded,escalated,failed});
}
