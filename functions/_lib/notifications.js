import { ensureModerationSchema } from './moderation.js';

const DEFAULT_MAIL_URL='https://wiafdkxfgwazprjucspg.supabase.co/functions/v1/send-contact-email';
const DEFAULT_SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYWZka3hmZ3dhenByanVjc3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE4NDgsImV4cCI6MjEwMjM3Nzg0OH0.qghDfY_FIOEoqmoQWFDmvLTqhKbuJDOi5MmmkG7nhv8';

async function ensureNotificationDeliverySchema(env){
  await ensureModerationSchema(env);
  for(const sql of [
    `ALTER TABLE moderation_notifications ADD COLUMN recipient_contributor_id INTEGER`,
    `ALTER TABLE moderation_notifications ADD COLUMN recipient_email TEXT`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_status TEXT DEFAULT 'queued'`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_attempted_at TEXT`,
    `ALTER TABLE moderation_notifications ADD COLUMN delivery_error TEXT`
  ]){try{await env.DB.prepare(sql).run();}catch{}}
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON moderation_notifications(recipient_contributor_id,status,created_at DESC)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_delivery ON moderation_notifications(delivery_status,created_at DESC)`).run();
}
const eq=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
function assignmentMatches(a,p){
  if(a.market_slug&&eq(a.market_slug,p.market_slug))return true;
  if(a.city&&eq(a.city,p.city)&&(!a.region||eq(a.region,p.region))&&(!a.country_code||eq(a.country_code,p.country_code)))return true;
  if(a.region&&eq(a.region,p.region)&&(!a.country_code||eq(a.country_code,p.country_code)))return true;
  return !!(a.country_code&&eq(a.country_code,p.country_code)&&!a.region&&!a.city&&!a.market_slug);
}
async function recipientsForPlace(env,place){
  const out=await env.DB.prepare(`SELECT c.id,c.handle,c.display_name,c.email,c.role FROM contributors c WHERE c.role IN ('curator','regional_admin','super_admin')`).all();
  const recipients=[];
  for(const user of out.results||[]){
    if(user.role==='super_admin'){recipients.push(user);continue;}
    const a=await env.DB.prepare(`SELECT country_code,region,city,market_slug FROM curator_assignments WHERE contributor_id=? AND active=1`).bind(user.id).all();
    if((a.results||[]).some(x=>assignmentMatches(x,place)))recipients.push(user);
  }
  return recipients;
}
async function deliver(env,payload){
  const url=String(env.CURATOR_NOTIFICATION_WEBHOOK_URL||DEFAULT_MAIL_URL).trim();
  try{
    const headers={'Content-Type':'application/json'};
    let body=payload;
    if(url===DEFAULT_MAIL_URL){
      const key=String(env.ROVIQ_MAIL_SUPABASE_ANON_KEY||DEFAULT_SUPABASE_ANON);
      headers.apikey=key; headers.Authorization=`Bearer ${key}`;
      body={mode:'roviq_local_curator_notification',place_id:String(payload.place.id),place_name:payload.place.name||'Unnamed place',category:payload.place.category||'',market_slug:payload.place.market_slug||'',city:payload.place.city||'',submitted_by:payload.submitted_by||'anonymous contributor',curator_name:payload.recipient?.display_name||payload.recipient?.handle||'ROVIQ admin',curator_handle:payload.recipient?.handle||'',admin_url:'https://roviq-local2.admytruk79.workers.dev/admin/'};
    }else if(env.CURATOR_NOTIFICATION_WEBHOOK_SECRET) headers.Authorization=`Bearer ${env.CURATOR_NOTIFICATION_WEBHOOK_SECRET}`;
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.notified===false)return{status:'failed',error:data.error||`webhook ${res.status}`};
    return{status:'delivered',error:null};
  }catch(err){return{status:'failed',error:String(err?.message||err).slice(0,500)};}
}
function payloadFor(place,user,id){return{event:'roviq.local.pending_submission',notification_id:id,recipient:user?{id:user.id,handle:user.handle,display_name:user.display_name||user.handle,email:user.email||null,role:user.role}:{handle:'super_admin',display_name:'ROVIQ admin',role:'super_admin'},place:{id:place.id,name:place.name||null,category:place.category_key||place.category||null,city:place.city||null,region:place.region||null,country_code:place.country_code||null,market_slug:place.market_slug||null,lat:place.lat??null,lng:place.lng??null},submitted_by:place.submitted_by||null,admin_url:'/admin/'};}
export async function notifyCuratorsOfSubmission(env,place){
  await ensureNotificationDeliverySchema(env);
  const recipients=await recipientsForPlace(env,place),created=[]; let delivered=0;
  if(!recipients.length){
    const r=await env.DB.prepare(`INSERT INTO moderation_notifications (market_slug,city,type,place_id,recipient_role,status,delivery_status) VALUES (?,?, 'pending_submission', ?, 'super_admin', 'unread', 'queued')`).bind(place.market_slug||null,place.city||null,place.id).run();
    const id=r.meta.last_row_id; created.push(id); const attempt=await deliver(env,payloadFor(place,null,id)); if(attempt.status==='delivered')delivered++;
    await env.DB.prepare(`UPDATE moderation_notifications SET delivery_status=?,delivery_attempted_at=?,delivery_error=? WHERE id=?`).bind(attempt.status,new Date().toISOString(),attempt.error,id).run();
    return{recipients:0,notifications:created,delivered};
  }
  for(const user of recipients){
    const r=await env.DB.prepare(`INSERT INTO moderation_notifications (market_slug,city,type,place_id,recipient_role,status,recipient_contributor_id,recipient_email,delivery_status) VALUES (?,?, 'pending_submission', ?, ?, 'unread', ?, ?, 'queued')`).bind(place.market_slug||null,place.city||null,place.id,user.role,user.id,user.email||null).run();
    const id=r.meta.last_row_id; created.push(id); const attempt=await deliver(env,payloadFor(place,user,id)); if(attempt.status==='delivered')delivered++;
    await env.DB.prepare(`UPDATE moderation_notifications SET delivery_status=?,delivery_attempted_at=?,delivery_error=? WHERE id=?`).bind(attempt.status,new Date().toISOString(),attempt.error,id).run();
  }
  return{recipients:recipients.length,notifications:created,delivered};
}
