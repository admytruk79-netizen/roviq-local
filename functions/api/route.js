const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const parsePoint=(value)=>{const [lng,lat]=String(value||'').split(',').map(Number);return Number.isFinite(lng)&&Number.isFinite(lat)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lng,lat}:null};
export async function onRequestGet({request}){
  const url=new URL(request.url);
  const from=parsePoint(url.searchParams.get('from'));
  const to=parsePoint(url.searchParams.get('to'));
  if(!from||!to)return json({error:'Valid from/to coordinates are required.'},400);
  const endpoint=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=false&continue_straight=true`;
  try{
    const upstream=await fetch(endpoint,{headers:{'accept':'application/json','user-agent':'ROVIQ-Local/1.0'}});
    if(!upstream.ok)return json({error:'Routing service unavailable.',status:upstream.status},502);
    const data=await upstream.json();
    const route=data?.routes?.[0];
    if(!route?.geometry?.coordinates?.length)return json({error:'No driving route found.'},404);
    const steps=(route.legs||[]).flatMap(leg=>leg.steps||[]).map(step=>({
      distance:step.distance,
      duration:step.duration,
      name:step.name||'',
      instruction:step.maneuver?.instruction||'',
      type:step.maneuver?.type||'',
      modifier:step.maneuver?.modifier||'',
      location:step.maneuver?.location||null
    }));
    return json({route:{geometry:route.geometry,distance:route.distance,duration:route.duration,steps}});
  }catch(error){
    return json({error:'Routing request failed.',detail:String(error?.message||error)},502);
  }
}
