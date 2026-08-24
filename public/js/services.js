let positionPromise=null;

async function updateLocationLabel(scope){
  try{
    const r=await fetch(`/api/geocode?reverse=1&lat=${encodeURIComponent(scope.lat)}&lng=${encodeURIComponent(scope.lng)}`,{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json(),x=d?.result;
    const label=[x?.city,x?.region].filter(Boolean).join(', ')||x?.country||'Current location';
    const el=document.querySelector('.rq-brand span');
    if(el)el.textContent=String(label).toUpperCase();
  }catch{}
}

export function getCurrentPosition({fresh=false}={}){
  if(fresh)positionPromise=null;
  if(positionPromise)return positionPromise;
  positionPromise=new Promise(resolve=>{
    if(typeof navigator==='undefined'||!navigator.geolocation)return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p=>{
        const position={lat:Number(p.coords.latitude),lng:Number(p.coords.longitude),accuracy:Number(p.coords.accuracy)||null,position:p,radius_km:80};
        if(!Number.isFinite(position.lat)||!Number.isFinite(position.lng))return resolve(null);
        window.__ROVIQ_LOCATION=position;
        window.dispatchEvent(new CustomEvent('roviq:location',{detail:position}));
        resolve(position);
      },
      ()=>resolve(null),
      {enableHighAccuracy:true,timeout:12000,maximumAge:30000}
    );
  });
  return positionPromise;
}

export async function loadApprovedPlaces(location=null){
  const params=new URLSearchParams({status:'approved'});
  const scope=location||await getCurrentPosition();
  if(!scope||!Number.isFinite(Number(scope.lat))||!Number.isFinite(Number(scope.lng))){
    const el=typeof document!=='undefined'?document.querySelector('.rq-brand span'):null;
    if(el)el.textContent='LOCATION UNAVAILABLE';
    window.dispatchEvent(new CustomEvent('roviq:places-loaded',{detail:{count:0,location:null}}));
    return [];
  }
  params.set('lat',String(scope.lat));
  params.set('lng',String(scope.lng));
  params.set('radius_km',String(scope.radius_km||80));
  updateLocationLabel(scope);
  const r=await fetch(`/api/places?${params.toString()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`places ${r.status}`);
  const d=await r.json();
  const places=Array.isArray(d?.places)?d.places:[];
  window.dispatchEvent(new CustomEvent('roviq:places-loaded',{detail:{count:places.length,location:scope}}));
  return places;
}
export function savedIds(){try{return new Set(JSON.parse(localStorage.getItem('roviq_saved')||'[]').map(String))}catch{return new Set()}}
export function toggleSaved(id){const s=savedIds(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem('roviq_saved',JSON.stringify([...s]));return s.has(k)}