(()=>{'use strict';
if(window.__ROVIQ_PRIMARY_ACTIVE)return;window.__ROVIQ_PRIMARY_ACTIVE=true;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const STYLE={day:'https://tiles.stadiamaps.com/styles/alidade_smooth.json',night:'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'};
const ICONS={food:'🍴',coffee:'☕',breweries:'◉',nature:'✦',scenic:'✦',culture:'◫',markets:'▣',recreation:'⌁',family:'◇',lodging:'⌂',automotive:'◈',charging:'ϟ',services:'•',other:'◆'};
let map=null,places=[],markers=[],userMarker=null,userLngLat=null,active='all',experience='rest',routeCoords=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buzz=(ms=8)=>{try{navigator.vibrate?.(ms)}catch{}};
const scope=()=>window.__ROVIQ_LOCATION_SCOPE||{};
const scopeLabel=()=>{const s=scope();return [s.city,s.region].filter(Boolean).join(', ')||s.label||'Near me'};
const isPick=p=>p?.trust_level==='roviq'||Number(p?.is_drivers_pick)===1;
const why=p=>p?.editorial_reason||p?.why_stop||p?.description||'A locally curated stop worth knowing about while you are on the road.';
function loadCss(){
 if(!document.querySelector('link[data-maplibre]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css';l.dataset.maplibre='1';document.head.appendChild(l)}
}
function loadScript(){return new Promise((resolve,reject)=>{if(window.maplibregl)return resolve();const s=document.createElement('script');s.src='https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js';s.onload=resolve;s.onerror=()=>reject(new Error('MapLibre failed to load'));document.head.appendChild(s)})}
function styleForVisual(){return STYLE[document.documentElement.dataset.roviqMode==='day'?'day':'night']}
function center(){const s=scope(),lat=Number(s.lat),lng=Number(s.lng);return Number.isFinite(lat)&&Number.isFinite(lng)?[lng,lat]:[-122.6765,45.5231]}
function destroyLegacy(){try{window.__ROVIQ_MAP_INSTANCE?.remove?.()}catch{}const el=$('#map');if(el)el.innerHTML='';$$('.leaflet-pane,.leaflet-control-container,.leaflet-map-pane').forEach(x=>x.remove())}
function buildHalo(){const w=document.createElement('div');w.className='roviq-halo';w.innerHTML='<div class="roviq-halo-field"></div><div class="roviq-halo-ring"></div><div class="roviq-halo-core"></div>';return w}
function setHalo(state){const h=$('.roviq-halo');if(h)h.dataset.state=state}
function markerType(p){return isPick(p)?'roviq':p?.trust_level==='driver'?'driver':'standard'}
function visible(){if(active==='all')return places;if(active==='picks')return places.filter(isPick);return places.filter(p=>String(p.category_key||p.category||'').toLowerCase()===active)}
function clearMarkers(){markers.forEach(x=>{try{x.marker.remove()}catch{}});markers=[]}
function makeMarker(p){
 const lat=Number(p.lat),lng=Number(p.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const el=document.createElement('button');el.type='button';el.className=`roviq-gl-marker ${markerType(p)}`;el.setAttribute('aria-label',p.name||'ROVIQ place');
 const icon=document.createElement('span');icon.className='rq-marker-icon';const cat=String(p.category_key||p.category||'other').toLowerCase();icon.textContent=ICONS[cat]||'◆';el.appendChild(icon);
 el.onclick=e=>{e.stopPropagation();setExperience('explore',{keepCamera:true});$$('.roviq-gl-marker.selected').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');showCard(p,false);map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),13.6),pitch:30,duration:700,essential:true});buzz(8)};
 const marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(map);markers.push({marker,el,p});
}
function render(){if(!map||!map.loaded())return;clearMarkers();visible().forEach(makeMarker);applyExperienceToMarkers()}
function applyExperienceToMarkers(){markers.forEach(({el})=>{el.classList.toggle('rq-state-hidden',experience==='rest');el.classList.toggle('rq-state-wild',experience==='wild')})}
function fitArea(){const pts=visible().map(p=>[+p.lng,+p.lat]).filter(([lng,lat])=>Number.isFinite(lng)&&Number.isFinite(lat));if(!pts.length)return;if(pts.length===1){map.easeTo({center:pts[0],zoom:13,duration:500});return}const b=new maplibregl.LngLatBounds();pts.forEach(p=>b.extend(p));map.fitBounds(b,{padding:{top:155,bottom:190,left:34,right:34},maxZoom:12.5,duration:650,essential:true})}
function savedSet(){try{return new Set(JSON.parse(localStorage.getItem('roviq_saved')||'[]').map(String))}catch{return new Set()}}
function toggleSave(p,b){const s=savedSet(),id=String(p.id);if(s.has(id)){s.delete(id);b.textContent='Save'}else{s.add(id);b.textContent='Saved'}localStorage.setItem('roviq_saved',JSON.stringify([...s]));buzz(5)}
function showCard(p,wild=false){
 document.querySelector('.place-preview')?.remove();const card=document.createElement('div');card.className='place-preview roviq-card-enter'+(wild?' rq-wild-card':'');
 const photo=p.photo_url?`<div class="rq-card-photo" style="background-image:url('${esc(p.photo_url)}')"></div>`:'';
 card.innerHTML=`${photo}<div class="rq-card-copy"><span class="trust-pill ${wild?'wild':markerType(p)}">${wild?'WILD DISCOVERY':isPick(p)?'◆ ROVIQ PICK':p.trust_level==='driver'?'DRIVER RECOMMENDED':'CURATED'}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.category||'Place')}</div><p>${esc(why(p))}</p><div class="preview-actions"><button data-save>${savedSet().has(String(p.id))?'Saved':'Save'}</button><button class="primary" data-go>Go →</button></div></div>`;
 $('#map')?.appendChild(card);card.querySelector('[data-save]').onclick=e=>toggleSave(p,e.currentTarget);card.querySelector('[data-go]').onclick=()=>showRoute(p.lat,p.lng);
}
function chooseWild(){const pool=visible().filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng));if(!pool.length)return null;const picks=pool.filter(isPick);return (picks.length?picks:pool)[Math.floor(Math.random()*(picks.length?picks.length:pool.length))]}
function wildOverlay(){let h=$('.wild-honeycomb-native');if(!h){h=document.createElement('div');h.className='wild-honeycomb-native';h.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';($('#app')||document.body).appendChild(h)}return h}
function runWildReveal(){
 const h=wildOverlay();h.classList.remove('show');void h.offsetWidth;h.classList.add('show');setHalo('wild');buzz(14);
 const candidate=chooseWild();markers.forEach(({el})=>el.classList.remove('wild-candidate'));
 if(candidate){const entry=markers.find(x=>String(x.p.id)===String(candidate.id));if(entry){setTimeout(()=>entry.el.classList.add('wild-candidate'),450);setTimeout(()=>{showCard(candidate,true);map.easeTo({center:[+candidate.lng,+candidate.lat],zoom:13.8,pitch:36,duration:900,essential:true})},850)}}
 setTimeout(()=>h.classList.remove('show'),1800);
}
function setExperience(next,opt={}){
 if(!['rest','explore','wild'].includes(next))next='rest';experience=next;document.body.dataset.roviqExperience=next;
 document.body.classList.toggle('rq-rest',next==='rest');document.body.classList.toggle('rq-explore',next==='explore');document.body.classList.toggle('rq-wild',next==='wild');
 $('.mockup-discover')?.classList.toggle('active',next==='explore');$('.mockup-wild')?.classList.toggle('active',next==='wild');
 if(next==='rest'){document.querySelector('.place-preview')?.remove();$('.topchrome')?.classList.remove('discover-open');setHalo('idle');if(!opt.keepCamera&&map)map.easeTo({pitch:18,bearing:0,duration:650,essential:true})}
 if(next==='explore'){setHalo('discovery');if(!opt.keepCamera)fitArea()}
 if(next==='wild')runWildReveal();
 applyExperienceToMarkers();
 window.dispatchEvent(new CustomEvent('roviq:experience-changed',{detail:{state:next}}));
}
function rebuildControls(){
 const chips=$('#chips');if(chips){chips.innerHTML='<button class="chip active" data-category="all">All</button><button class="chip" data-category="food">Food</button><button class="chip" data-category="coffee">Coffee</button><button class="chip" data-category="nature">Nature</button><button class="chip" data-category="culture">Culture</button><button class="chip" data-category="breweries">Breweries</button><button class="chip" data-category="picks">ROVIQ Picks</button>';chips.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;active=b.dataset.category;$$('#chips .chip').forEach(x=>x.classList.toggle('active',x===b));setExperience('explore',{keepCamera:true});render();fitArea();$('.topchrome')?.classList.remove('discover-open')}}
 document.querySelector('.mockup-tools')?.remove();const tools=document.createElement('div');tools.className='mockup-tools';tools.innerHTML='<button class="mockup-discover" type="button">Discover <span>⌄</span></button><button class="mockup-wild" type="button">✧ WILD</button>';($('#app')||document.body).appendChild(tools);
 tools.querySelector('.mockup-discover').onclick=()=>{setExperience('explore',{keepCamera:true});$('.topchrome')?.classList.toggle('discover-open')};tools.querySelector('.mockup-wild').onclick=()=>setExperience('wild',{keepCamera:true});
 document.querySelector('.bottom-nav')?.remove();const nav=document.createElement('nav');nav.className='bottom-nav';nav.innerHTML='<button class="rq-nav-explore" type="button"><span>◈</span><small>Explore</small></button><button class="mockup-center" type="button"><span>R</span></button><button class="rq-nav-saved" type="button"><span>▱</span><small>Saved</small></button>';($('#app')||document.body).appendChild(nav);
 nav.querySelector('.rq-nav-explore').onclick=()=>setExperience('explore');nav.querySelector('.mockup-center').onclick=()=>setExperience('rest');nav.querySelector('.rq-nav-saved').onclick=()=>{setExperience('explore',{keepCamera:true});active='all';renderListSaved()};
}
function renderListSaved(){const ids=savedSet();const list=$('#list-view');if(!list)return;const items=places.filter(p=>ids.has(String(p.id)));list.hidden=false;$('#map').style.display='none';list.innerHTML=items.length?items.map(p=>`<article class="place-card"><div class="place-name">${esc(p.name)}</div><div class="why-stop">${esc(why(p))}</div><button data-id="${esc(p.id)}">Map</button></article>`).join(''):'<div class="empty-state"><strong>No saved places yet.</strong></div>';list.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>{const p=places.find(x=>String(x.id)===b.dataset.id);list.hidden=true;$('#map').style.display='';map.resize();if(p){setExperience('explore',{keepCamera:true});showCard(p);map.easeTo({center:[+p.lng,+p.lat],zoom:14,pitch:30,duration:700})}})}
function locate(){if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(pos=>{userLngLat=[pos.coords.longitude,pos.coords.latitude];if(userMarker)userMarker.setLngLat(userLngLat);else{const h=buildHalo();h.dataset.state=experience==='wild'?'wild':experience==='explore'?'discovery':'idle';userMarker=new maplibregl.Marker({element:h,anchor:'center'}).setLngLat(userLngLat).addTo(map)}map.flyTo({center:userLngLat,zoom:13.6,pitch:experience==='rest'?18:28,speed:1.1,curve:1.25,essential:true});window.dispatchEvent(new CustomEvent('roviq:user-recentered'));buzz(8)},()=>{}, {enableHighAccuracy:false,timeout:8000,maximumAge:300000})}
function locateButton(){document.querySelector('.roviq-locate-native')?.remove();const b=document.createElement('button');b.className='roviq-locate-native';b.type='button';b.setAttribute('aria-label','Center on my location');b.textContent='◎';b.onclick=locate;($('#app')||document.body).appendChild(b)}
function clearRoute(){routeCoords=null;try{map?.getLayer('rq-route')&&map.removeLayer('rq-route');map?.getSource('rq-route')&&map.removeSource('rq-route')}catch{}}
function ensureRoute(){if(!map||!routeCoords)return;try{if(!map.getSource('rq-route'))map.addSource('rq-route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:routeCoords}}});if(!map.getLayer('rq-route'))map.addLayer({id:'rq-route',type:'line',source:'rq-route',paint:{'line-color':'#55ddca','line-width':4,'line-opacity':.9}})}catch{}}
function showRoute(lat,lng){const dest=[+lng,+lat];if(!Number.isFinite(dest[0])||!Number.isFinite(dest[1]))return;if(!userLngLat){map.flyTo({center:dest,zoom:15,pitch:38,duration:850,essential:true});return}routeCoords=[userLngLat,dest];ensureRoute();const b=new maplibregl.LngLatBounds();b.extend(userLngLat);b.extend(dest);map.fitBounds(b,{padding:{top:180,bottom:220,left:60,right:60},pitch:42,duration:900,essential:true})}
window.ROVIQShowRoute=showRoute;
async function loadPlaces(){try{const r=await fetch('/api/places?status=approved',{cache:'no-store'}),d=await r.json();places=Array.isArray(d?.places)?d.places:[];window.__roviqPlaces=places;render();window.dispatchEvent(new CustomEvent('roviq:places-loaded',{detail:{count:places.length}}))}catch(e){console.error('ROVIQ places failed',e)}}
function installMap(){destroyLegacy();map=new maplibregl.Map({container:'map',style:styleForVisual(),center:center(),zoom:11.5,pitch:18,bearing:0,attributionControl:true,minZoom:3,maxZoom:18});window.__ROVIQ_MAPLIBRE=map;window.__ROVIQ_MAP_INSTANCE=map;map.on('load',()=>{window.dispatchEvent(new CustomEvent('roviq:map-ready'));render();setExperience('rest',{keepCamera:true})});map.on('click',()=>{if(experience==='rest')setExperience('explore',{keepCamera:true})});map.on('dragstart',()=>{if(experience==='rest')setExperience('explore',{keepCamera:true});setHalo('interaction')});map.on('dragend',()=>setHalo(experience==='wild'?'wild':experience==='explore'?'discovery':'idle'));map.on('styledata',()=>{render();ensureRoute()})}
function themeListener(){window.addEventListener('roviq:visual-mode-changed',()=>{if(!map)return;try{map.setStyle(styleForVisual())}catch{}})}
async function init(){loadCss();await loadScript();rebuildControls();installMap();locateButton();themeListener();loadPlaces();if($('#loc-badge'))$('#loc-badge').textContent=scopeLabel();window.ROVIQInteraction={setExperience,enterWild:()=>setExperience('wild'),exitWild:()=>setExperience('explore'),wake:()=>setExperience('explore',{keepCamera:true}),recenter:locate};window.ROVIQMapContext={area:fitArea,locate,place(lat,lng){map?.flyTo({center:[+lng,+lat],zoom:14,pitch:30,duration:700})}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error));else init().catch(console.error);
})();