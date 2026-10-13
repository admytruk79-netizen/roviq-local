import { enrichPlaces } from '../../_lib/place-freshness.js';
import { publicColumns } from '../../_lib/public-places.js';
export async function onRequestGet({params,env}) {
  try {
    const columns = await publicColumns(env.DB);
    const place = await env.DB.prepare(`SELECT ${columns} FROM places WHERE id = ? AND status = 'approved' AND COALESCE(is_hidden,0) = 0`).bind(params.id).first();
    if (!place) return Response.json({success:false,error:'not found'},{status:404});
    const [enriched]=await enrichPlaces(env.DB,[place]);
    return Response.json({success:true,api_version:2,place:enriched},{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({success:false,error:'Catalog temporarily unavailable'},{status:503}); }
}
