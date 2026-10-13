import { requireContributor } from '../_lib/auth.js';
import { publicColumns } from '../_lib/public-places.js';
import { enrichPlaces } from '../_lib/place-freshness.js';
async function identity(request,env){
 const result=await requireContributor(request,env);
 if(result.response)return result;
 if(!result.actor.contributorId)return {response:Response.json({success:false,error:'An individual account is required'},{status:403})};
 return result;
}
export async function onRequestGet({request,env}){
 const {response,actor}=await identity(request,env);if(response)return response;
 const columns=(await publicColumns(env.DB)).split(', ').map(c=>'p.'+c).join(', ');
 const out=await env.DB.prepare(`SELECT ${columns} FROM saved_places s JOIN places p ON p.id=s.place_id WHERE s.contributor_id=? AND p.status='approved' AND COALESCE(p.is_hidden,0)=0 ORDER BY s.saved_at DESC,p.id LIMIT 500`).bind(actor.contributorId).all();
 return Response.json({success:true,places:await enrichPlaces(env.DB,out.results||[])},{headers:{'Cache-Control':'no-store'}});
}
export async function onRequestPost({request,env}){
 const {response,actor}=await identity(request,env);if(response)return response;
 let id;try{const body=await request.json();id=body.place_id;if(!Number.isInteger(id)||id<1)throw Error();}catch{return Response.json({success:false,error:'valid place_id required'},{status:400});}
 const place=await env.DB.prepare("SELECT id FROM places WHERE id=? AND status='approved' AND COALESCE(is_hidden,0)=0").bind(id).first();
 if(!place)return Response.json({success:false,error:'place not found'},{status:404});
 const result=await env.DB.prepare('INSERT INTO saved_places (contributor_id,place_id) SELECT ?,? WHERE (SELECT COUNT(*) FROM saved_places WHERE contributor_id=?) < 500 ON CONFLICT(contributor_id,place_id) DO NOTHING').bind(actor.contributorId,id,actor.contributorId).run();
 if(!result.meta.changes){const existing=await env.DB.prepare('SELECT place_id FROM saved_places WHERE contributor_id=? AND place_id=?').bind(actor.contributorId,id).first();if(!existing)return Response.json({success:false,error:'Saved places limit reached'},{status:409});}

 return Response.json({success:true,place_id:id},{headers:{'Cache-Control':'no-store'}});
}
export async function onRequestDelete({request,env,params}){
 const {response,actor}=await identity(request,env);if(response)return response;
 await env.DB.prepare('DELETE FROM saved_places WHERE contributor_id=? AND place_id=?').bind(actor.contributorId,params.id).run();
 return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
}
