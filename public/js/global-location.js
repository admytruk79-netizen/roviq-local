(()=>{
'use strict';
const state={map:null,fix:null,retries:0};
window.__ROVIQ_GLOBAL_LOCATION=state;

function captureMap(){
  if(!window.maplibregl?.Map||window.maplibregl.Map.__roviqWrapped)return;
  const Base=window.maplibregl.Map;
  class RoviqMap extends Base{
    constructor(options){
      const safe={...options,center:[0,20],zoom:2.4};
      super(safe);
      state.map=this;
      window.__ROVIQ_MAP=this;
      if(state.fix)centerOn(state.fix,false);
    }
  }
  RoviqMap.__roviqWrapped=true;
  window.maplibregl.Map=RoviqMap;
}

function brand(text){
  const el=document.querySelector('.rq-brand span');
  if(el&&text)el.textContent=String(text).toUpperCase();
}

async function labelFor(lat,lng){
  try{
    const r=await fetch(`/api/geocode?reverse=1&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,{cache:'no-store'});
    if(!r.ok)return null;
    const d=await r.json();
    const x=d?.result;
    if(!x)return null;
    window.__ROVIQ_LOCATION_SCOPE={lat,lng,city:x.city||'',region:x.region||'',country:x.country||'',country_code:x.country_code||'',label:x.label||''};
    return [x.city,x.region].filter(Boolean).join(', ')||x.country||'Current location';
  }catch{return null;}
}

function centerOn(fix,animate=true){
  state.fix=fix;
  const map=state.map||window.__ROVIQ_MAP;
  if(!map)return;
  const run=()=>{
    try{
      const opts={center:[fix.lng,fix.lat],zoom:13.6,pitch:16,bearing:0,essential:true};
      if(animate)map.flyTo({...opts,speed:1.15,curve:1.2});else map.jumpTo(opts);
    }catch{}
  };
  if(map.loaded?.())run();else map.once?.('load',run);
}

async function applyPosition(pos){
  const lat=Number(pos?.coords?.latitude),lng=Number(pos?.coords?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  const fix={lat,lng,accuracy:Number(pos.coords.accuracy)||null,at:Date.now()};
  centerOn(fix,true);
  const label=await labelFor(lat,lng);
  brand(label||'Current location');
  window.dispatchEvent(new CustomEvent('roviq:global-location',{detail:fix}));
}

function locate(){
  if(!navigator.geolocation){brand('Current location');return;}
  brand('Locating…');
  navigator.geolocation.getCurrentPosition(
    applyPosition,
    ()=>{
      state.retries++;
      if(state.retries<3)setTimeout(locate,state.retries*1800);
      else brand('Current location');
    },
    {enableHighAccuracy:true,timeout:12000,maximumAge:30000}
  );
}

captureMap();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',locate,{once:true});else locate();
})();
