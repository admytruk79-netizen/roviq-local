export const CATEGORIES=['food','coffee','breweries','markets','nature','scenic','culture','recreation','family','lodging','automotive','charging','services','other'];
export const BROAD_CATEGORY={food:'food',coffee:'coffee',breweries:'breweries',markets:'food',nature:'nature',scenic:'nature',recreation:'nature',culture:'culture',family:'culture',lodging:'culture',automotive:'culture',charging:'culture',services:'culture',other:'culture'};
export const EARTH_KM=6371.0088;
export function distanceKm(lat,lng,p){
 const r=Math.PI/180,a=(p.lat-lat)*r,b=(p.lng-lng)*r;
 const h=Math.sin(a/2)**2+Math.cos(lat*r)*Math.cos(p.lat*r)*Math.sin(b/2)**2;
 return 2*EARTH_KM*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
function number(params,key,fallback,min,max,integer=false){
 if(!params.has(key))return fallback;
 const raw=params.get(key),value=raw?.trim()?Number(raw):NaN;
 if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error(`${key} must be ${integer?'an integer':'a number'} between ${min} and ${max}`);
 return value;
}
export function parseQuery(params){
 if(params.has('status')&&params.get('status')!=='approved')throw Error('Only approved places are public');
 const category=(params.get('category')||'all').toLowerCase();if(category!=='all'&&!CATEGORIES.includes(category))throw Error('Invalid category');
 const hasCoords=params.has('lat')||params.has('lng');
 const lat=hasCoords?number(params,'lat',NaN,-90,90):null,lng=hasCoords?number(params,'lng',NaN,-180,180):null;
 if(hasCoords&&(!Number.isFinite(lat)||!Number.isFinite(lng)))throw Error('valid lat and lng are required');
 const radius=number(params,'radius_km',50,1,250),limit=number(params,'limit',500,1,500,true),offset=number(params,'offset',0,0,10000,true);
 const includeClosed=number(params,'include_closed',0,0,1,true)===1;
 const text=(key,max)=>{const value=(params.get(key)||'').trim();if(value.length>max)throw Error(`${key} too long`);return value;};
 return {lat,lng,hasCoords,radius,limit,offset,category,includeClosed,country:text('country_code',2).toUpperCase(),city:text('city',120),market:text('market',180)};
}
export function queryWhere(q){
 const params=[],clauses=["status = 'approved'",'COALESCE(is_hidden,0) = 0','lat BETWEEN -90 AND 90','lng BETWEEN -180 AND 180'];
 if(!q.includeClosed)clauses.push("NOT EXISTS (SELECT 1 FROM place_details d WHERE d.place_id=places.id AND d.operational_status IN ('temporarily_closed','permanently_closed'))");
 if(q.category!=='all'){clauses.push('lower(COALESCE(category_key,category)) = ?');params.push(q.category);}
 for(const [value,clause] of [[q.country,'upper(country_code) = ?'],[q.city,'lower(city) = lower(?)'],[q.market,'market_slug = ?']])if(value){clauses.push(clause);params.push(value);}
 if(q.hasCoords){
  const angle=q.radius/EARTH_KM,delta=angle*180/Math.PI,south=Math.max(-90,q.lat-delta),north=Math.min(90,q.lat+delta);
  clauses.push('lat BETWEEN ? AND ?');params.push(south,north);
  if(south>-90&&north<90){
   const longitudeDelta=Math.asin(Math.min(1,Math.sin(angle)/Math.cos(q.lat*Math.PI/180)))*180/Math.PI;
   const west=q.lng-longitudeDelta,east=q.lng+longitudeDelta;
   if(west< -180){clauses.push('(lng >= ? OR lng <= ?)');params.push(west+360,east);}
   else if(east>180){clauses.push('(lng >= ? OR lng <= ?)');params.push(west,east-360);}
   else{clauses.push('lng BETWEEN ? AND ?');params.push(west,east);}
  }
 }
 return {where:clauses.join(' AND '),params};
}
