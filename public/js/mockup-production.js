(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let fallbackMarkers=[];
function ensureReferenceAssets(){if(!document.querySelector('link[data-rq-reference]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/css/reference-ui.css?v=20260819-1';l.dataset.rqReference='1';document.head.appendChild(l)}if(!document.querySelector('script[data-rq-reference]')){const s=document.createElement('script');s.src='/js/reference-ui.js?v=20260819-1';s.defer=true;s.dataset.rqReference='1';document.head.appendChild(s)}}
function force(el,prop,val){if(el)el.style.setProperty(prop,val,'important')}
function pinUi(){
  const tools=$('.mockup-tools');
  if(tools){force(tools,'position','fixed');force(tools,'top','calc(96px + env(safe-area-inset-top))');force(tools,'bottom','auto');force(tools,'left','24px');force(tools,'right','auto');force(tools,'transform','none');force(tools,'z-index','2300')}
  const nav=$('.bottom-nav');
  if(nav){force(nav,'position','fixed');force(nav,'left','0');force(nav,'right','0');force(nav,'top','auto');force(nav,'bottom','0');force(nav,'transform','none');force(nav,'z-index','2310')}
  const locate=$('.roviq-locate-native');
  if(locate){force(locate,'position','fixed');force(locate,'left','24px');force(locate,'top','auto');force(locate,'bottom','calc(82px + env(safe-area-inset-bottom))');force(locate,'transform','none');force(locate,'z-index','2320')}
}
function compat(){const m=window.__ROVIQ_MAPLIBRE||window.__ROVIQ_MAP_INSTANCE;if(!m||m.__roviqCompat)return;m.__roviqCompat=true;const once=m.once?.bind(m);if(once)m.once=function(type,fn){if(type==='click')return once(type,e=>{if(!e.latlng&&e.lngLat)e.latlng={lat:e.lngLat.lat,lng:e.lngLat.lng};fn(e)});return once(type,fn)}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clearFallback(){fallbackMarkers.forEach(m=>{try{m.remove()}catch{}});fallbackMarkers=[]}
function fallbackCard(p){document.querySelector('.place-preview')?.remove();const card=document.createElement('div');card.className='place-preview roviq-card-enter';card.innerHTML=`<span class="trust-pill ${p.trust_level==='roviq'?'roviq':'standard'}">◆ ${p.trust_level==='roviq'?'ROVIQ PICK':'CURATED'}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.category||'Place')}</div><p><strong>Why stop here?</strong><br>${esc(p.editorial_reason||p.why_stop||p.description||'A curated stop worth knowing about.')}</p><div class="preview-actions"><button data-save>Save</button><button class="primary" data-dir>Go →</button></div>`;$('#map')?.appendChild(card);card.querySelector('[data-dir]')?.addEventListener('click',()=>window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,'_blank'));card.querySelector('[data-save]')?.addEventListener('click',e=>{let s;try{s=new Set(JSON.parse(localStorage.getItem('roviq_saved')||'[]').map(String))}catch{s=new Set()}const id=String(p.id);if(s.has(id)){s.delete(id);e.currentTarget.textContent='Save'}else{s.add(id);e.currentTarget.textContent='Saved'}localStorage.setItem('roviq_saved',JSON.stringify([...s]))})}
async function restorePlaces(){
  const map=window.__ROVIQ_MAPLIBRE;if(!map||!window.maplibregl)return;
  await new Promise(r=>setTimeout(r,700));
  if(document.querySelector('.roviq-gl-marker')){clearFallback();return}
  let places=Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[];
  if(!places.length){try{const res=await fetch('/api/places?status=approved&scope=all',{cache:'no-store'}),data=await res.json();if(res.ok&&data?.success&&Array.isArray(data.places))places=data.places}catch(e){console.error('ROVIQ place recovery fetch failed',e)}}
  window.__roviqPlaces=places;
  if(!places.length){console.error('ROVIQ has no approved place records to render');return}
  clearFallback();const bounds=new maplibregl.LngLatBounds();let count=0;
  for(const p of places){const lat=Number(p.lat),lng=Number(p.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;const el=document.createElement('button');el.type='button';el.className='roviq-gl-marker roviq-runtime-marker'+(p.trust_level==='roviq'||Number(p.is_drivers_pick)===1?' roviq':'');el.setAttribute('aria-label',p.name||'ROVIQ place');el.addEventListener('click',e=>{e.stopPropagation();fallbackCard(p);map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),13.5),pitch:28,duration:600,essential:true})});fallbackMarkers.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(map));bounds.extend([lng,lat]);count++}
  if(count>1)try{map.fitBounds(bounds,{padding:{top:150,bottom:175,left:30,right:30},maxZoom:12,duration:500})}catch{}
  window.dispatchEvent(new CustomEvent('roviq:places-loaded',{detail:{count}}));
}
function boot(){ensureReferenceAssets();pinUi();if(!window.__ROVIQ_PRIMARY_ACTIVE&&!window.__ROVIQ_PRIMARY_BOOT_REQUESTED){window.__ROVIQ_PRIMARY_BOOT_REQUESTED=true;const s=document.createElement('script');s.src='/js/maplibre-primary.js?v=20260819-3';s.async=false;s.dataset.roviqPrimary='1';s.onerror=()=>{window.__ROVIQ_PRIMARY_BOOT_REQUESTED=false;console.error('ROVIQ primary map controller failed to load')};document.head.appendChild(s)}setTimeout(()=>{pinUi();compat();restorePlaces()},500)}
const observer=new MutationObserver(()=>pinUi());observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.addEventListener('roviq:map-ready',()=>{pinUi();compat();restorePlaces()});
window.addEventListener('roviq:places-loaded',()=>setTimeout(restorePlaces,250));
window.addEventListener('resize',pinUi);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();