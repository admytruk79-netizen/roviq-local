const MODEL='@cf/meta/llama-3.1-8b-instruct-fast';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
export const marketSlug=(country,region,city)=>[country,region,city].filter(Boolean).map(v=>String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean).join('-');

export async function ensureMarketSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS markets(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,city TEXT NOT NULL,region TEXT,country_code TEXT NOT NULL DEFAULT 'US',lat REAL,lng REAL,radius_km REAL NOT NULL DEFAULT 25,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scanning','review','active','paused')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_candidates(id INTEGER PRIMARY KEY AUTOINCREMENT,market_id INTEGER NOT NULL REFERENCES markets(id),name TEXT NOT NULL,category_key TEXT NOT NULL,address TEXT,lat REAL NOT NULL,lng REAL NOT NULL,website_url TEXT,source_type TEXT,source_url TEXT,source_payload TEXT,ai_score REAL,ai_reason TEXT,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),place_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,reviewed_by TEXT)`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_market_candidates_status ON market_candidates(market_id,status,ai_score DESC)').run();
}

async function nominatim(q,limit=8){
  const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('format','jsonv2');u.searchParams.set('addressdetails','1');u.searchParams.set('limit',String(limit));u.searchParams.set('q',q);
  const r=await fetch(u.toString(),{headers:{Accept:'application/json','User-Agent':'ROVIQ-Local/1.0 (curated market expansion)'}});if(!r.ok)throw new Error(`nominatim ${r.status}`);return r.json();
}
function context(a={}){return{country_code:String(a.country_code||'').toUpperCase(),region:a.state||a.region||'',city:a.city||a.town||a.village||a.municipality||'',postal_code:a.postcode||''}}

async function scoreCandidate(env,c){
  if(!env.AI)return{score:.5,reason:'Candidate found from factual map source; AI ranking unavailable.'};
  const schema={type:'object',additionalProperties:false,properties:{score:{type:'number',minimum:0,maximum:1},reason:{type:'string'}},required:['score','reason']};
  try{const out=await env.AI.run(MODEL,{messages:[{role:'system',content:'Rank factual place candidates for a curated local driving/discovery app. Do not invent facts. Score higher when the candidate is a distinctive destination people may intentionally visit; score lower for generic chains, offices, or ambiguous results.'},{role:'user',content:JSON.stringify(c)}],temperature:0,response_format:{type:'json_schema',json_schema:{name:'market_candidate_rank',schema}}});const v=typeof out?.response==='string'?JSON.parse(out.response):out?.response||out;return{score:Number(v?.score??.5),reason:clean(v?.reason,400)}}catch{return{score:.5,reason:'AI ranking unavailable; curator review required.'}}
}

export async function activateMarket(env,{city,region='',country_code='US',radius_km=25}={}){
  city=clean(city,120);region=clean(region,120);country_code=clean(country_code,2).toUpperCase()||'US';if(!city)throw new Error('city is required');
  const slug=marketSlug(country_code,region,city),geo=await nominatim([city,region,country_code].filter(Boolean).join(', '),1),g=geo?.[0];if(!g)throw new Error('city could not be geocoded');
  const lat=Number(g.lat),lng=Number(g.lon);let market=await env.DB.prepare('SELECT * FROM markets WHERE slug=?').bind(slug).first();
  if(!market){const q=await env.DB.prepare(`INSERT INTO markets(slug,city,region,country_code,lat,lng,radius_km,status) VALUES(?,?,?,?,?,?,?,'scanning')`).bind(slug,city,region,country_code,lat,lng,Math.min(100,Math.max(5,Number(radius_km)||25))).run();market={id:q.meta.last_row_id,slug,city,region,country_code,lat,lng};}else await env.DB.prepare("UPDATE markets SET status='scanning',lat=?,lng=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(lat,lng,market.id).run();
  const searches=[['coffee','independent coffee'],['food','restaurant'],['culture','bookstore museum gallery'],['nature','park viewpoint'],['markets','market'],['automotive','automotive museum']];let added=0;
  for(const [category,term] of searches){
    let rows=[];try{rows=await nominatim(`${term}, ${city}, ${region}, ${country_code}`,6)}catch{};
    for(const x of rows){const a=x.address||{},ctx=context(a),clat=Number(x.lat),clng=Number(x.lon),name=clean(x.name||String(x.display_name||'').split(',')[0],120);if(!name||!Number.isFinite(clat)||!Number.isFinite(clng))continue;if(ctx.city&&ctx.city.toLowerCase()!==city.toLowerCase()&&!String(x.display_name||'').toLowerCase().includes(city.toLowerCase()))continue;
      const exists=await env.DB.prepare('SELECT id FROM places WHERE lower(name)=lower(?) AND ABS(lat-?)<0.002 AND ABS(lng-?)<0.002 LIMIT 1').bind(name,clat,clng).first();if(exists)continue;
      const dup=await env.DB.prepare("SELECT id FROM market_candidates WHERE market_id=? AND lower(name)=lower(?) AND status='pending' LIMIT 1").bind(market.id,name).first();if(dup)continue;
      const candidate={name,category_key:category,address:clean(x.display_name,300),lat:clat,lng:clng,city,region,country_code,source_type:'openstreetmap_nominatim',source_url:`https://www.openstreetmap.org/${x.osm_type||'node'}/${x.osm_id||''}`};const ai=await scoreCandidate(env,candidate);
      await env.DB.prepare(`INSERT INTO market_candidates(market_id,name,category_key,address,lat,lng,source_type,source_url,source_payload,ai_score,ai_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(market.id,name,category,candidate.address,clat,clng,candidate.source_type,candidate.source_url,JSON.stringify(x),ai.score,ai.reason).run();added++;if(added>=30)break;
    }if(added>=30)break;await sleep(350);
  }
  await env.DB.prepare("UPDATE markets SET status='review',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(market.id).run();return{market_id:market.id,slug,city,region,country_code,center:{lat,lng},candidates_added:added,status:'review'};
}

export async function approveCandidate(env,id,reviewedBy){
  const c=await env.DB.prepare(`SELECT c.*,m.slug market_slug,m.city,m.region,m.country_code FROM market_candidates c JOIN markets m ON m.id=c.market_id WHERE c.id=?`).bind(id).first();if(!c)throw new Error('candidate not found');if(c.status!=='pending')throw new Error('candidate already reviewed');
  const broad={coffee:'coffee',food:'food',culture:'culture',nature:'nature',markets:'food',automotive:'culture'};const q=await env.DB.prepare(`INSERT INTO places(name,category,category_key,description,why_stop,recommended_for,lat,lng,address,country_code,region,city,market_slug,status,verification_source,verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,CURRENT_TIMESTAMP)`).bind(c.name,broad[c.category_key]||'culture',c.category_key,c.ai_reason||null,c.ai_reason||null,'Curator review',c.lat,c.lng,c.address||null,c.country_code,c.region,c.city,c.market_slug,c.source_url||c.source_type).run();
  const placeId=q.meta.last_row_id;await env.DB.prepare("UPDATE market_candidates SET status='approved',place_id=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?").bind(placeId,reviewedBy||'moderator',id).run();return{candidate_id:id,place_id:placeId};
}
