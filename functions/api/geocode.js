function addressContext(address={}){return{country:address.country||'',country_code:String(address.country_code||'').toUpperCase(),region:address.state||address.region||'',city:address.city||address.town||address.village||address.municipality||'',locality:address.suburb||address.neighbourhood||address.city_district||'',postal_code:address.postcode||''}}

export async function onRequestGet({request}){
  const url=new URL(request.url);
  const q=(url.searchParams.get('q')||'').trim();
  if(!q)return Response.json({success:false,error:'q is required'},{status:400});
  const upstream=new URL('https://nominatim.openstreetmap.org/search');
  upstream.searchParams.set('format','jsonv2');
  upstream.searchParams.set('addressdetails','1');
  upstream.searchParams.set('limit','8');
  upstream.searchParams.set('q',q);
  const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
  if(Number.isFinite(lat)&&Number.isFinite(lng)){
    const d=.8;
    upstream.searchParams.set('viewbox',`${lng-d},${lat+d},${lng+d},${lat-d}`);
    upstream.searchParams.set('bounded','0');
  }
  try{
    const r=await fetch(upstream.toString(),{headers:{Accept:'application/json','User-Agent':'ROVIQ-Local/1.0 (location lookup for user-submitted places)'}});
    if(!r.ok)return Response.json({success:false,error:`geocoder ${r.status}`},{status:502});
    const data=await r.json();
    const results=(data||[]).map(x=>({lat:Number(x.lat),lng:Number(x.lon),label:x.display_name||q,type:x.type||'',class:x.class||'',...addressContext(x.address||{})})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
    return Response.json({success:true,results},{headers:{'Cache-Control':'public, max-age=120'}});
  }catch(err){return Response.json({success:false,error:String(err?.message||err)},{status:502});}
}
