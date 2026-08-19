(()=>{'use strict';
const MAX_MARKERS=18, PAD=0.16, DEBOUNCE=260;
let map=null,timer=null,lastKey='',wired=false;
const num=v=>Number(v),valid=p=>Number.isFinite(num(p?.lat))&&Number.isFinite(num(p?.lng));
const allPlaces=()=>Array.isArray(window.__roviqAllPlaces)?window.__roviqAllPlaces:(Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[]);
function inView(p){const b=map.getBounds(),w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth(),dx=(e-w)*PAD,dy=(n-s)*PAD,lng=num(p.lng),lat=num(p.lat);return lng>=w-dx&&lng<=e+dx&&lat>=s-dy&&lat<=n+dy}
function distance(p,c){const dx=num(p.lng)-c.lng,dy=num(p.lat)-c.lat;return dx*dx+dy*dy}
function reveal(){if(!map||!map.loaded?.())return;const b=map.getBounds(),key=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth(),map.getZoom()].map(Number).map(v=>v.toFixed(3)).join(':');if(key===lastKey)return;lastKey=key;const c=map.getCenter(),chosen=allPlaces().filter(valid).filter(inView).sort((a,b)=>distance(a,c)-distance(b,c)).slice(0,MAX_MARKERS);window.__roviqPlaces=chosen;window.dispatchEvent(new CustomEvent('roviq:viewport-places',{detail:{places:chosen,count:chosen.length}}));if(typeof window.__ROVIQ_RENDER_VIEWPORT==='function')window.__ROVIQ_RENDER_VIEWPORT(chosen)}
function schedule(){clearTimeout(timer);timer=setTimeout(reveal,DEBOUNCE)}
function wire(){map=window.__ROVIQ_MAPLIBRE;if(!map||wired)return;wired=true;map.on('moveend',schedule);map.on('zoomend',schedule);setTimeout(schedule,350)}
window.addEventListener('roviq:catalog-loaded',e=>{if(Array.isArray(e.detail?.places)){window.__roviqAllPlaces=e.detail.places;schedule()}});window.addEventListener('roviq:map-ready',()=>setTimeout(wire,60));window.addEventListener('roviq:places-loaded',()=>{if(!window.__roviqAllPlaces&&Array.isArray(window.__roviqPlaces)&&window.__roviqPlaces.length)window.__roviqAllPlaces=[...window.__roviqPlaces];if(!wired)wire()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,500));else setTimeout(wire,500);
})();