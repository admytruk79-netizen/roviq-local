(()=>{'use strict';
function destinationFromCard(card){
  const name=card?.querySelector('h3')?.textContent?.trim();
  if(!name)return null;
  const places=Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[];
  const p=places.find(x=>String(x?.name||'').trim()===name);
  const lat=Number(p?.lat),lng=Number(p?.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
function launch(lat,lng){
  const fallback=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat+','+lng)}&travelmode=driving&dir_action=navigate`;
  if(/Android/i.test(navigator.userAgent)){
    const deep=`google.navigation:q=${lat},${lng}&mode=d`;
    window.location.href=deep;
    setTimeout(()=>{if(document.visibilityState==='visible')window.location.href=fallback},900);
  }else{
    window.open(fallback,'_blank','noopener');
  }
}
document.addEventListener('click',e=>{
  const go=e.target.closest('.place-preview [data-go]');
  if(!go)return;
  const dest=destinationFromCard(go.closest('.place-preview'));
  if(!dest)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  launch(dest.lat,dest.lng);
},true);
})();