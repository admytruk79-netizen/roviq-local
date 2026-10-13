const MAX_AGE_DAYS=90;
export function freshness(place,details,now=new Date()){
 const timestamp=details?details.verified_at||null:place.verified_at||null,stamp=timestamp?Date.parse(timestamp):NaN;
 const age=Number.isFinite(stamp)?Math.max(0,(now.getTime()-stamp)/86400000):null;
 const state=age===null?'unverified':age>MAX_AGE_DAYS?'stale':'current';
 let weekly=null;try{weekly=JSON.parse(details?.hours_json||'null')}catch{}
 let open=null;
 const status=details?.operational_status||'unknown',zone=details?.timezone||place.timezone;
 if(state==='current'&&['temporarily_closed','permanently_closed'].includes(status))open=false;
 else if(state==='current'&&weekly&&zone){
  try{
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
   const part=type=>parts.find(p=>p.type===type)?.value,day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday')),minute=Number(part('hour'))*60+Number(part('minute'));
   const time=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
   open=weekly.some(w=>{const start=time(w.start),end=time(w.end);return end>start?w.day===day&&minute>=start&&minute<end:(w.day===day&&minute>=start)||(w.day===(day+6)%7&&minute<end);});
  }catch{}
 }
 return {operational_status:status,open_now:open,opening_hours:weekly,parking:details?.parking||null,accessibility:details?.accessibility||null,verification:{state,last_verified_at:timestamp,stale_after_days:MAX_AGE_DAYS,source_url:details?.source_url||null}};
}
export async function enrichPlaces(db,places,now=new Date()){
 if(!places.length)return [];
 const rows=[];
 for(let start=0;start<places.length;start+=80){const ids=places.slice(start,start+80).map(p=>p.id);const out=await db.prepare(`SELECT * FROM place_details WHERE place_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();rows.push(...out.results);}
 const details=new Map(rows.map(d=>[d.place_id,d]));return places.map(p=>({...p,...freshness(p,details.get(p.id),now)}));
}
export function validateDetails(body){
 const result={};
 if(body.operational_status!==undefined){if(!['unknown','open','temporarily_closed','permanently_closed'].includes(body.operational_status))throw Error('Invalid operational_status');result.operational_status=body.operational_status;}
 for(const key of ['parking','accessibility'])if(body[key]!==undefined){if(body[key]!==null&&(typeof body[key]!=='string'||body[key].length>800))throw Error(`Invalid ${key}`);result[key]=body[key];}
 if(body.timezone!==undefined){try{new Intl.DateTimeFormat('en-US',{timeZone:body.timezone}).format()}catch{throw Error('Invalid timezone')};result.timezone=body.timezone;}
 if(body.source_url!==undefined){if(body.source_url!==null){let url;try{url=new URL(body.source_url)}catch{throw Error('source_url must be HTTPS')};if(url.protocol!=='https:'||body.source_url.length>1000)throw Error('source_url must be HTTPS');}result.source_url=body.source_url;}
 if(body.opening_hours!==undefined){
  const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if(body.opening_hours!==null&&(!Array.isArray(body.opening_hours)||body.opening_hours.length>42||body.opening_hours.some(w=>!w||!Number.isInteger(w.day)||w.day<0||w.day>6||!time.test(w.start)||!time.test(w.end)||w.start===w.end)))throw Error('opening_hours requires day 0–6 and distinct HH:MM start/end');
  result.hours_json=body.opening_hours===null?null:JSON.stringify(body.opening_hours.map(({day,start,end})=>({day,start,end})));
 }
 if(body.verify_now){if(!body.source_url)throw Error('source_url required to verify details');result.verified_at=new Date().toISOString();}
 return result;
}
