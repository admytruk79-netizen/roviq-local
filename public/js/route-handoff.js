(()=>{'use strict';
function clearBadRoute(){
  const map=window.__ROVIQ_MAPLIBRE;
  if(!map)return;
  try{if(map.getLayer('rq-route'))map.removeLayer('rq-route')}catch{}
  try{if(map.getSource('rq-route'))map.removeSource('rq-route')}catch{}
}
function destinationFromCard(card){
  const name=card?.querySelector('h3')?.textContent?.trim();
  const places=Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[];
  const p=places.find(x=>String(x?.name||'').trim()===name);
  if(!p)return null;
  const lat=Number(p.lat),lng=Number(p.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
function openDirections(lat,lng){
  clearBadRoute();
  const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
  window.open(url,'_blank','noopener');
}
document.addEventListener('click',e=>{
  const go=e.target.closest('.place-preview [data-go],.rq-card-go');
  if(!go)return;
  const card=go.closest('.place-preview');
  const dest=destinationFromCard(card);
  if(!dest)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openDirections(dest.lat,dest.lng);
},true);
window.addEventListener('roviq:map-ready',clearBadRoute);
window.addEventListener('roviq:experience-changed',clearBadRoute);
window.ROVIQOpenDirections=openDirections;
})();