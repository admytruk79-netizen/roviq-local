import { recordSubmission } from '../../_lib/moderation.js';
import { notifyCuratorsOfSubmission } from '../../_lib/notifications.js';
import { requireContributor } from '../../_lib/auth.js';

const LEGACY_CATEGORIES = ['food', 'coffee', 'breweries', 'nature', 'culture'];
const CATEGORIES = [...LEGACY_CATEGORIES,'markets','scenic','recreation','family','lodging','automotive','charging','services','other'];
const STATUSES = ['pending','approved','rejected'];
const BROAD_CATEGORY={food:'food',coffee:'coffee',breweries:'breweries',markets:'food',nature:'nature',scenic:'nature',recreation:'nature',culture:'culture',family:'culture',lodging:'culture',automotive:'culture',charging:'culture',services:'culture',other:'culture'};
const clean=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
function marketSlug(countryCode,region,city){return[countryCode,region,city].filter(Boolean).map(v=>String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean).join('-');}

export async function onRequestGet({request,env}){
  const url=new URL(request.url),rawCategory=url.searchParams.get('category'),category=rawCategory?rawCategory.toLowerCase():null,status=url.searchParams.get('status')||'approved',countryCode=clean(url.searchParams.get('country_code'),2).toUpperCase(),city=clean(url.searchParams.get('city'),120),market=clean(url.searchParams.get('market'),180),latParam=url.searchParams.get('lat'),lngParam=url.searchParams.get('lng'),lat=latParam!==null&&latParam!==''?Number(latParam):NaN,lng=lngParam!==null&&lngParam!==''?Number(lngParam):NaN,radiusKm=Math.min(Math.max(Number(url.searchParams.get('radius_km'))||50,1),250);
  if(!STATUSES.includes(status))return Response.json({success:false,error:`status must be one of ${STATUSES.join(', ')}`},{status:400});
  const explicitGeo=url.searchParams.has('lat')||url.searchParams.has('lng')||city||market||countryCode,params=[status]; let where='status = ? AND COALESCE(is_hidden, 0) = 0';
  if(category&&category!=='all'){
    if(!CATEGORIES.includes(category))return Response.json({success:false,error:`category must be one of ${CATEGORIES.join(', ')}`},{status:400});
    if(LEGACY_CATEGORIES.includes(category)){where+=' AND lower(category) = ?';params.push(category);}else{where+=' AND lower(COALESCE(category_key, category)) = ?';params.push(category);}
  }
  if(countryCode&&!Number.isFinite(lat)){where+=' AND upper(COALESCE(country_code, ?)) = ?';params.push('US',countryCode);}
  if(city&&!Number.isFinite(lat)){where+=' AND lower(COALESCE(city, ?)) = lower(?)';params.push('Portland',city);}
  if(market){where+=' AND COALESCE(market_slug, ?) = ?';params.push('us-or-portland',market);}
  const hasCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  if(hasCoords){const latDelta=radiusKm/111.0,lngScale=Math.max(Math.cos(lat*Math.PI/180),0.15),lngDelta=radiusKm/(111.0*lngScale);where+=' AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';params.push(lat-latDelta,lat+latDelta,lng-lngDelta,lng+lngDelta);}
  let results;try{const out=await env.DB.prepare(`SELECT * FROM places WHERE ${where} ORDER BY is_drivers_pick DESC, created_at DESC LIMIT 500`).bind(...params).all();results=out.results||[];}catch{const fallback=await env.DB.prepare('SELECT * FROM places WHERE status = ? ORDER BY is_drivers_pick DESC, created_at DESC LIMIT 500').bind(status).all();results=fallback.results||[];}
  if(hasCoords){const toRad=d=>d*Math.PI/180;results=results.map(p=>{const dLat=toRad(Number(p.lat)-lat),dLng=toRad(Number(p.lng)-lng),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat))*Math.cos(toRad(Number(p.lat)))*Math.sin(dLng/2)**2,distance_km=6371*2*Math.asin(Math.sqrt(a));return{...p,category_key:p.category_key||p.category,distance_km};}).filter(p=>p.distance_km<=radiusKm).sort((a,b)=>(b.is_drivers_pick-a.is_drivers_pick)||(a.distance_km-b.distance_km));}else results=results.map(p=>({...p,category_key:p.category_key||p.category}));
  return Response.json({success:true,scope:{country_code:countryCode||null,city:city||null,market:market||null,radius_km:hasCoords?radiusKm:null,center:hasCoords?{lat,lng}:null,source:explicitGeo?'client':'unscoped'},places:results});
}

const VERIFICATION_BY_ROLE={contributor:'verified_driver',city_curator:'trusted',regional_admin:'trusted',super_admin:'trusted'};

export async function onRequestPost({request,env}){
  const{response,actor}=await requireContributor(request,env);
  if(response)return response;
  let body;try{body=await request.json();}catch{return Response.json({success:false,error:'invalid JSON body'},{status:400});}
  const name=clean(body.name,120),categoryKey=String(body.category||'').toLowerCase(),category=BROAD_CATEGORY[categoryKey],description=clean(body.description,800),whyStop=clean(body.why_stop,800)||description,recommendedFor=clean(body.recommended_for,240),localTip=clean(body.local_tip,300),address=clean(body.address,300),photoUrl=clean(body.photo_url,500),countryCode=clean(body.country_code,2).toUpperCase(),country=clean(body.country,120),region=clean(body.region,120),city=clean(body.city,120),locality=clean(body.locality,120),postalCode=clean(body.postal_code,32),timezone=clean(body.timezone,80),market=clean(body.market_slug,180)||marketSlug(countryCode,region,city),lat=Number(body.lat),lng=Number(body.lng);
  const submittedBy=actor.handle;
  if(!name)return Response.json({success:false,error:'name is required'},{status:400});
  if(!CATEGORIES.includes(categoryKey)||!category)return Response.json({success:false,error:`category must be one of ${CATEGORIES.join(', ')}`},{status:400});
  if(!whyStop)return Response.json({success:false,error:'Tell us why you recommend this place'},{status:400});
  if(!recommendedFor)return Response.json({success:false,error:'Tell us who you usually recommend this place to'},{status:400});
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180)return Response.json({success:false,error:'valid lat and lng are required'},{status:400});
  if(photoUrl&&!/^https:\/\//i.test(photoUrl))return Response.json({success:false,error:'photo URL must use https'},{status:400});
  const possible=await env.DB.prepare(`SELECT id,name,address,city,country_code FROM places WHERE lower(name)=lower(?) OR (ABS(lat-?)<0.0015 AND ABS(lng-?)<0.0015) LIMIT 3`).bind(name,lat,lng).all();
  if(possible.results?.length)return Response.json({success:false,error:'This place may already be in ROVIQ Local.',duplicates:possible.results},{status:409});
  const verificationStatus=VERIFICATION_BY_ROLE[actor.role]||'unverified';
  let result;try{result=await env.DB.prepare(`INSERT INTO places (name,category,category_key,description,why_stop,recommended_for,local_tip,lat,lng,address,country_code,country,region,city,locality,postal_code,market_slug,timezone,photo_url,status,submitted_by,contributor_id,contributor_role,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?,?,?,?)`).bind(name,category,categoryKey,description||null,whyStop||null,recommendedFor||null,localTip||null,lat,lng,address||null,countryCode||null,country||null,region||null,city||null,locality||null,postalCode||null,market||null,timezone||null,photoUrl||null,submittedBy||null,actor.contributorId||null,actor.role||null,verificationStatus).run();}catch{result=await env.DB.prepare(`INSERT INTO places (name,category,description,lat,lng,address,country_code,country,region,city,locality,postal_code,market_slug,timezone,photo_url,status,submitted_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`).bind(name,category,description||null,lat,lng,address||null,countryCode||null,country||null,region||null,city||null,locality||null,postalCode||null,market||null,timezone||null,photoUrl||null,submittedBy||null).run();}
  const place={id:result.meta.last_row_id,name,category,category_key:categoryKey,market_slug:market||null,city:city||null,region:region||null,country_code:countryCode||null,lat,lng,submitted_by:submittedBy||null};
  try{await recordSubmission(env,place,submittedBy);}catch(err){console.error('moderation record failed',err);}
  let notification=null;try{notification=await notifyCuratorsOfSubmission(env,place);}catch(err){console.error('curator notification failed',err);}
  return Response.json({success:true,id:result.meta.last_row_id,status:'pending',market_slug:market||null,category:categoryKey,notification:notification?{recipients:notification.recipients,delivered:notification.delivered}:null},{status:201});
}
