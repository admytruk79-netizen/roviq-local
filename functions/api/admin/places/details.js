import { requireModerator, canModeratePlace } from '../../../_lib/auth.js';
import { validateDetails, freshness } from '../../../_lib/place-freshness.js';

export async function onRequestPatch({request,env,params}){
 const {response,actor}=await requireModerator(request,env);if(response)return response;
 const place=await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(params.id).first();
 if(!place)return Response.json({success:false,error:'place not found'},{status:404});
 if(!canModeratePlace(actor,place))return Response.json({success:false,error:'outside curator assignment'},{status:403});
 let body,fields;
 try{body=await request.json();if(!body||Array.isArray(body)||typeof body!=='object')throw Error('Expected an object');if(body.verify_now!==undefined&&typeof body.verify_now!=='boolean')throw Error('verify_now must be boolean');fields=validateDetails(body);if(!Object.keys(fields).length)throw Error('No detail fields provided');}
 catch(error){return Response.json({success:false,error:error.message},{status:400});}
 // Changes invalidate previous verification unless explicitly reverified with evidence.
 if(!body.verify_now)fields.verified_at=null;
 const now=new Date().toISOString(),keys=Object.keys(fields);
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO place_details (place_id,${keys.join(',')},updated_at) VALUES (?,${keys.map(()=>'?').join(',')},?) ON CONFLICT(place_id) DO UPDATE SET ${keys.map(key=>`${key}=excluded.${key}`).join(',')},updated_at=excluded.updated_at`).bind(params.id,...Object.values(fields),now),
  env.DB.prepare("INSERT INTO moderation_events (place_id,action,reviewer_handle,note) VALUES (?,'edited',?,?)").bind(params.id,actor.handle,'Structured place details updated: '+keys.join(', '))
 ]);
 const details=await env.DB.prepare('SELECT * FROM place_details WHERE place_id=?').bind(params.id).first();
 return Response.json({success:true,place_id:Number(params.id),details:freshness(place,details)},{headers:{'Cache-Control':'no-store'}});
}
