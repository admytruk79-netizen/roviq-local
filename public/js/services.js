export async function loadApprovedPlaces(location=null){
  const params=new URLSearchParams({status:'approved'});
  let scope=location;
  if(!scope&&typeof navigator!=='undefined'&&navigator.geolocation){
    scope=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,radius_km:80}),
      ()=>resolve(null),
      {enableHighAccuracy:true,timeout:12000,maximumAge:30000}
    ));
  }
  if(scope&&Number.isFinite(Number(scope.lat))&&Number.isFinite(Number(scope.lng))){
    params.set('lat',String(scope.lat));
    params.set('lng',String(scope.lng));
    params.set('radius_km',String(scope.radius_km||80));
  }else{
    return [];
  }
  const r=await fetch(`/api/places?${params.toString()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`places ${r.status}`);
  const d=await r.json();
  return Array.isArray(d?.places)?d.places:[];
}
export function savedIds(){try{return new Set(JSON.parse(localStorage.getItem('roviq_saved')||'[]').map(String))}catch{return new Set()}}
export function toggleSaved(id){const s=savedIds(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem('roviq_saved',JSON.stringify([...s]));return s.has(k)}