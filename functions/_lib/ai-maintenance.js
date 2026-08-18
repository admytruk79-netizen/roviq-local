const MODEL='@cf/meta/llama-3.1-8b-instruct-fast';
const MAX_SOURCE_CHARS=14000;

export function currentSnapshot(place){
  return {
    id:place.id,name:place.name,category:place.category,address:place.address,city:place.city,region:place.region,
    country_code:place.country_code,lat:place.lat,lng:place.lng,hours:place.hours,website_url:place.website_url,
    verified_at:place.verified_at,trust_level:place.trust_level,is_drivers_pick:place.is_drivers_pick
  };
}

function safePublicUrl(value){
  try{
    const u=new URL(value);
    if(!['http:','https:'].includes(u.protocol))return null;
    const h=u.hostname.toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h==='127.0.0.1'||h==='0.0.0.0'||h==='::1')return null;
    if(/^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(h))return null;
    return u;
  }catch{return null}
}

function pageText(html){
  return String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ').trim().slice(0,MAX_SOURCE_CHARS);
}

export async function fetchWebsiteObservation(place){
  const url=safePublicUrl(place.website_url);
  if(!url)return null;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  try{
    const r=await fetch(url.toString(),{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'ROVIQ-Local-Verification/1.0'}});
    if(!r.ok)return {source_type:'website',source_url:url.toString(),error:`http_${r.status}`};
    const type=r.headers.get('content-type')||'';
    if(!type.includes('text/html')&&!type.includes('text/plain'))return {source_type:'website',source_url:url.toString(),error:'unsupported_content'};
    const text=pageText(await r.text());
    return {source_type:'website',source_url:r.url||url.toString(),text};
  }catch(e){return {source_type:'website',source_url:url.toString(),error:e?.name==='AbortError'?'timeout':'fetch_failed'};}
  finally{clearTimeout(timeout)}
}

function schema(){return {
  type:'object',additionalProperties:false,
  properties:{
    issue_type:{type:'string',enum:['none','stale_record','possible_closure','hours_changed','address_changed','website_changed','category_mismatch','conflicting_information']},
    confidence:{type:'number',minimum:0,maximum:1},priority:{type:'integer',minimum:0,maximum:100},
    explanation:{type:'string'},
    proposed_changes:{type:'object',additionalProperties:false,properties:{address:{type:['string','null']},hours:{type:['string','null']},category:{type:['string','null']},website_url:{type:['string','null']}},required:['address','hours','category','website_url']}
  },required:['issue_type','confidence','priority','explanation','proposed_changes']
}}

export async function analyzeObservation(env,place,observation){
  if(!env.AI)throw new Error('Workers AI binding unavailable');
  const source=observation?.text||JSON.stringify(observation?.payload||{});
  const messages=[
    {role:'system',content:'You are the ROVIQ factual place-maintenance engine. Compare a current place record with evidence from an approved factual source. Never invent facts. Driver recommendations, ROVIQ Pick status, trust level, editorial copy, and Wild eligibility are human-controlled and must never be changed. If evidence is insufficient, return issue_type stale_record or none with low confidence. Prefer human review for closure, identity, address, or conflicting information.'},
    {role:'user',content:`CURRENT RECORD:\n${JSON.stringify(currentSnapshot(place))}\n\nSOURCE TYPE: ${observation?.source_type||'unknown'}\nSOURCE URL: ${observation?.source_url||''}\nSOURCE EVIDENCE:\n${String(source||'').slice(0,MAX_SOURCE_CHARS)}`}
  ];
  const out=await env.AI.run(MODEL,{messages,temperature:0,response_format:{type:'json_schema',json_schema:{name:'roviq_place_verification',schema:schema()}}});
  const result=out?.response&&typeof out.response==='object'?out.response:(typeof out?.response==='string'?JSON.parse(out.response):out);
  return result;
}

export async function enqueueFinding(env,place,finding,observation={}){
  if(!finding||finding.issue_type==='none')return null;
  const existing=await env.DB.prepare("SELECT id FROM ai_maintenance_queue WHERE place_id=? AND issue_type=? AND status='pending' ORDER BY id DESC LIMIT 1").bind(place.id,finding.issue_type).first();
  if(existing)return existing.id;
  const proposed=JSON.stringify(finding.proposed_changes||{}),current=JSON.stringify(currentSnapshot(place));
  const observed=JSON.stringify(observation?.text?{text:observation.text.slice(0,5000)}:(observation?.payload||observation||{}));
  const q=await env.DB.prepare(`INSERT INTO ai_maintenance_queue(place_id,issue_type,confidence,priority,source_type,source_url,current_snapshot,observed_snapshot,ai_result,proposed_changes,explanation) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(place.id,finding.issue_type,Number(finding.confidence||0),Number(finding.priority||50),observation?.source_type||null,observation?.source_url||null,current,observed,JSON.stringify(finding),proposed,String(finding.explanation||'')).run();
  await env.DB.prepare("UPDATE places SET ai_review_status='needs_review', suspected_change=?, confidence_score=?, last_ai_review_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(finding.issue_type,Number(finding.confidence||0),place.id).run();
  return q.meta?.last_row_id||null;
}

export async function flagStaleWithoutSource(env,place,days=30){
  return enqueueFinding(env,place,{issue_type:'stale_record',confidence:.55,priority:35,explanation:`No approved current source was available; record is older than the ${days}-day verification target.`,proposed_changes:{address:null,hours:null,category:null,website_url:null}},{source_type:'internal_age_check'});
}

export async function detectDuplicateCandidates(env,limit=25){
  const out=await env.DB.prepare(`SELECT a.id a_id,b.id b_id,a.name,a.city,a.region,a.lat a_lat,a.lng a_lng,b.lat b_lat,b.lng b_lng FROM places a JOIN places b ON a.id<b.id AND lower(trim(a.name))=lower(trim(b.name)) AND coalesce(lower(a.city),'')=coalesce(lower(b.city),'') WHERE a.status='approved' AND b.status='approved' LIMIT ?`).bind(limit).all();
  return out.results||[];
}

export async function runMaintenanceBatch(env,{limit=10,staleDays=30}={}){
  const stale=await env.DB.prepare(`SELECT * FROM places WHERE status='approved' AND is_hidden=0 AND (verified_at IS NULL OR datetime(verified_at)<datetime('now',?)) ORDER BY coalesce(verified_at,created_at) ASC LIMIT ?`).bind(`-${staleDays} days`,limit).all();
  const results=[];
  for(const place of stale.results||[]){
    let observation=null,finding=null;
    if(place.website_url)observation=await fetchWebsiteObservation(place);
    if(observation?.text){
      try{finding=await analyzeObservation(env,place,observation);await enqueueFinding(env,place,finding,observation);}
      catch(e){finding={issue_type:'stale_record',confidence:.45,priority:40,explanation:`AI verification failed: ${e.message}`,proposed_changes:{address:null,hours:null,category:null,website_url:null}};await enqueueFinding(env,place,finding,{source_type:'ai_error'});}
    }else await flagStaleWithoutSource(env,place,staleDays);
    results.push({place_id:place.id,finding:finding?.issue_type||'stale_record'});
  }
  const duplicates=await detectDuplicateCandidates(env,Math.min(limit,25));
  for(const d of duplicates){
    const place=await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(d.a_id).first();
    if(place)await enqueueFinding(env,place,{issue_type:'conflicting_information',confidence:.9,priority:70,explanation:`Possible duplicate place records: ${d.a_id} and ${d.b_id} share the same normalized name and city.`,proposed_changes:{address:null,hours:null,category:null,website_url:null}},{source_type:'duplicate_detector',payload:d});
  }
  return {processed:results.length,results,duplicate_candidates:duplicates.length};
}
