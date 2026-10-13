import { parseQuery, queryWhere, distanceKm, CATEGORIES, BROAD_CATEGORY } from '../../_lib/catalog-query.js';
import { enrichPlaces } from '../../_lib/place-freshness.js';
import { publicColumns } from '../../_lib/public-places.js';
import { recordSubmission } from '../../_lib/moderation.js';
import { notifyCuratorsOfSubmission } from '../../_lib/notifications.js';
import { requireContributor } from '../../_lib/auth.js';

const clean=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
function marketSlug(countryCode,region,city){return[countryCode,region,city].filter(Boolean).map(v=>String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean).join('-');}

export async function onRequestGet({request,env}){
  let q;
  try{q=parseQuery(new URL(request.url).searchParams);}catch(error){return Response.json({success:false,error:error.message},{status:400});}
  const {where,params}=queryWhere(q);
  try{
    const columns=await publicColumns(env.DB);
    const count=await env.DB.prepare(`SELECT COUNT(*) AS total FROM places WHERE ${where}`).bind(...params).first();
    let results,total=Number(count.total);
    if(q.hasCoords){
      // Read bounded candidate batches before selecting nearest results. No trig SQL extension required.
      if(total>10000)return Response.json({success:false,error:'Too many candidates. Reduce radius or add a category or market.',code:'scope_too_broad'},{status:422});
      results=[];let lastId=0;
      while(true){
        const out=await env.DB.prepare(`SELECT ${columns} FROM places WHERE ${where} AND id > ? ORDER BY id LIMIT 500`).bind(...params,lastId).all();
        const batch=out.results||[];if(!batch.length)break;
        results.push(...batch);lastId=batch.at(-1).id;if(batch.length<500)break;
      }
      results=results.map(p=>({...p,distance_km:distanceKm(q.lat,q.lng,p)})).filter(p=>p.distance_km<=q.radius)
        .sort((a,b)=>a.distance_km-b.distance_km||a.id-b.id);
      total=results.length;results=results.slice(q.offset,q.offset+q.limit);
    }else{
      const out=await env.DB.prepare(`SELECT ${columns} FROM places WHERE ${where} ORDER BY is_drivers_pick DESC,id ASC LIMIT ? OFFSET ?`).bind(...params,q.limit,q.offset).all();
      results=out.results||[];
    }
    results=await enrichPlaces(env.DB,results.map(p=>({...p,category_key:p.category_key||p.category})));
    const next=q.offset+results.length;
    return Response.json({success:true,api_version:2,scope:{country_code:q.country||null,city:q.city||null,market:q.market||null,radius_km:q.hasCoords?q.radius:null,center:q.hasCoords?{lat:q.lat,lng:q.lng}:null,source:q.hasCoords||q.city||q.country||q.market?'client':'unscoped'},pagination:{limit:q.limit,offset:q.offset,total,has_more:next<total,next_offset:next<total?next:null},places:results},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('catalog_query_failed',{message:error instanceof Error?error.message:'unknown'});
    return Response.json({success:false,error:'Catalog temporarily unavailable'},{status:503});
  }
}

const VERIFICATION_BY_ROLE={contributor:'verified_driver',city_curator:'trusted',regional_admin:'trusted',super_admin:'trusted'};

export async function onRequestPost({request,env}){
  const{response,actor}=await requireContributor(request,env);
  if(response)return response;
  let body;try{body=await request.json();}catch{return Response.json({success:false,error:'invalid JSON body'},{status:400});}
  const name=clean(body.name,120),categoryKey=String(body.category||'').toLowerCase(),category=BROAD_CATEGORY[categoryKey],description=clean(body.description,800),whyStop=clean(body.why_stop,800)||description,recommendedFor=clean(body.recommended_for,240),localTip=clean(body.local_tip,300),address=clean(body.address,300),photoUrl=clean(body.photo_url,500),countryCode=clean(body.country_code,2).toUpperCase(),country=clean(body.country,120),region=clean(body.region,120),city=clean(body.city,120),locality=clean(body.locality,120),postalCode=clean(body.postal_code,32),timezone=clean(body.timezone,80),market=clean(body.market_slug,180)||marketSlug(countryCode,region,city),lat=body.lat===null||body.lat===undefined||body.lat===''?NaN:Number(body.lat),lng=body.lng===null||body.lng===undefined||body.lng===''?NaN:Number(body.lng);
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

