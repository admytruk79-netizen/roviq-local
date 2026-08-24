export async function loadApprovedPlaces(location=null){
  const params=new URLSearchParams({status:'approved'});
  if(location&&Number.isFinite(Number(location.lat))&&Number.isFinite(Number(location.lng))){
    params.set('lat',String(location.lat));
    params.set('lng',String(location.lng));
    params.set('radius_km',String(location.radius_km||80));
  }
  const r=await fetch(`/api/places?${params.toString()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`places ${r.status}`);
  const d=await r.json();
  return Array.isArray(d?.places)?d.places:[];
}
export function savedIds(){try{return new Set(JSON.parse(localStorage.getItem('roviq_saved')||'[]').map(String))}catch{return new Set()}}
export function toggleSaved(id){const s=savedIds(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem('roviq_saved',JSON.stringify([...s]));return s.has(k)}