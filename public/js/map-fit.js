(()=>{'use strict';
/* This file is already in the production HTML. Use it as the deterministic bridge
   from the legacy bundle to the single authoritative MapLibre controller. */
function bootPrimary(){
  if(window.__ROVIQ_PRIMARY_BOOT_REQUESTED)return;
  window.__ROVIQ_PRIMARY_BOOT_REQUESTED=true;
  const s=document.createElement('script');
  s.src='/js/maplibre-primary.js?v=20260818-1';
  s.async=false;
  s.dataset.roviqPrimary='1';
  s.onerror=()=>{window.__ROVIQ_PRIMARY_BOOT_REQUESTED=false;console.error('ROVIQ primary map controller failed to load')};
  document.head.appendChild(s);
}
bootPrimary();
let lastSignature='';const AREA_ZOOM=11,PLACE_ZOOM=14;
function map(){return window.__ROVIQ_MAPLIBRE||null}
function points(){const ps=(window.__roviqPlaces||[]).map(p=>[Number(p.lng),Number(p.lat)]).filter(([lng,lat])=>Number.isFinite(lng)&&Number.isFinite(lat));const sc=window.__ROVIQ_LOCATION_SCOPE||{},lat=Number(sc.lat),lng=Number(sc.lng);if(Number.isFinite(lat)&&Number.isFinite(lng))ps.push([lng,lat]);return ps}
function fit(){const m=map(),ps=points();if(!m||!ps.length||!window.maplibregl)return;const sig=ps.map(p=>p.join(',')).join('|');if(sig===lastSignature)return;lastSignature=sig;try{if(ps.length===1)m.easeTo({center:ps[0],zoom:AREA_ZOOM,duration:350});else{const b=new maplibregl.LngLatBounds();ps.forEach(p=>b.extend(p));m.fitBounds(b,{padding:{top:145,bottom:155,left:28,right:28},maxZoom:AREA_ZOOM,duration:450})}}catch(e){console.error('ROVIQ MapLibre fit failed',e)}}
window.ROVIQMapContext={area(){lastSignature='';fit()},place(lat,lng){const m=map(),a=Number(lat),b=Number(lng);if(m&&Number.isFinite(a)&&Number.isFinite(b))m.flyTo({center:[b,a],zoom:PLACE_ZOOM,pitch:28,speed:1.25,essential:true})},locate(){window.ROVIQInteraction?.recenter?.()}};
window.addEventListener('roviq:map-ready',()=>setTimeout(fit,120));window.addEventListener('roviq:places-loaded',()=>setTimeout(fit,80));window.addEventListener('roviq:location-scope-changed',()=>{lastSignature='';setTimeout(fit,80)});
})();