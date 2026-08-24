(()=>{
'use strict';
const STORAGE='roviq_global_fix_v1';
let stored=null;
try{stored=JSON.parse(sessionStorage.getItem(STORAGE)||'null')}catch{}
const valid=f=>f&&Number.isFinite(Number(f.lat))&&Number.isFinite(Number(f.lng));
const state={map:null,fix:valid(stored)?stored:null,retries:0};
window.__ROVIQ_GLOBAL_LOCATION=state;

const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  try{
    const raw=typeof input==='string'?input:input?.url;
    if(raw&&raw.startsWith('/api/places')&&state.fix){
      const u=new URL(raw,location.origin);
      u.searchParams.delete('scope');
      u.searchParams.set('lat',String(state.fix.lat));
      u.searchParams.set('lng',String(state.fix.lng));
      if(!u.searchParams.has('radius_km'))u.searchParams.set('radius_km','80');
      return nativeFetch(u.pathname+u.search,init);
    }
  }catch{}
  return nativeFetch(input,init);
};

function captureMap(){
  if(!window.maplibregl?.Map||window.maplibregl.Map.__roviqWrapped)return;
  const Base=window.maplibregl.Map;
  class RoviqMap extends Base{
    constructor(options){
      const fix=state.fix;
      const safe={...options,center:fix?[Number(fix.lng),Number(fix.lat)]:[0,20],zoom:fix?13.6:2.4};
      super(safe);
      state.map=this;
      window.__ROVIQ_MAP=this;
      if(state.fix)centerOn(state.fix,false);
    }
  }
  RoviqMap.__roviqWrapped=true;
  window.maplibregl.Map=RoviqMap;
}

function brand(text){const el=document.querySelector('.rq-brand span');if(el&&text)el.textContent=String(text).toUpperCase()}

async function labelFor(lat,lng){
  try{
    const r=await nativeFetch(`/api/geocode?reverse=1&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,{cache:'no-store'});
    if(!r.ok)return null;
    const d=await r.json(),x=d?.result;if(!x)return null;
    window.__ROVIQ_LOCATION_SCOPE={lat,lng,city:x.city||'',region:x.region||'',country:x.country||'',country_code:x.country_code||'',label:x.label||''};
    return [x.city,x.region].filter(Boolean).join(', ')||x.country||'Current location';
  }catch{return null}
}

function centerOn(fix,animate=true){
  state.fix=fix;const map=state.map||window.__ROVIQ_MAP;if(!map)return;
  const run=()=>{try{const opts={center:[fix.lng,fix.lat],zoom:13.6,pitch:16,bearing:0,essential:true};animate?map.flyTo({...opts,speed:1.15,curve:1.2}):map.jumpTo(opts)}catch{}};
  if(map.loaded?.())run();else map.once?.('load',run);
}

async function applyPosition(pos){
  const lat=Number(pos?.coords?.latitude),lng=Number(pos?.coords?.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  const hadStored=valid(stored);
  const fix={lat,lng,accuracy:Number(pos.coords.accuracy)||null,at:Date.now()};
  state.fix=fix;
  try{sessionStorage.setItem(STORAGE,JSON.stringify(fix))}catch{}
  centerOn(fix,true);
  const label=await labelFor(lat,lng);brand(label||'Current location');
  window.dispatchEvent(new CustomEvent('roviq:global-location',{detail:fix}));
  if(!hadStored)setTimeout(()=>location.reload(),150);
}

function locate(){
  if(state.fix){centerOn(state.fix,false);labelFor(state.fix.lat,state.fix.lng).then(x=>brand(x||'Current location'))}
  if(!navigator.geolocation){brand(state.fix?'Current location':'LOCATION UNAVAILABLE');return}
  if(!state.fix)brand('Locating…');
  navigator.geolocation.getCurrentPosition(applyPosition,()=>{
    state.retries++;
    if(!state.fix&&state.retries<3)setTimeout(locate,state.retries*1800);
    else if(!state.fix)brand('LOCATION UNAVAILABLE');
  },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}

captureMap();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',locate,{once:true});else locate();
})();