import {loadApprovedPlaces,toggleSaved,savedIds} from './services.js';
import {DiscoveryEngine} from './discovery.js';

const $=s=>document.querySelector(s);
const icons={food:'🍴',coffee:'☕',breweries:'◉',nature:'✦',scenic:'✦',culture:'◫',markets:'▣',recreation:'⌁',family:'◇',lodging:'⌂',automotive:'◈',charging:'ϟ',services:'•',other:'◆'};
const STYLES={day:'https://tiles.stadiamaps.com/styles/alidade_smooth.json',night:'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'};
let map,engine,catalog=[],markers=new Map(),userMarker,state='rest',selected=null,userLngLat=null,watchId=null,navigation=null,lastRerouteAt=0;

function visualMode(){const h=new Date().getHours();return h>=7&&h<19?'day':'night'}
function applyVisualMode(){const mode=visualMode();document.documentElement.dataset.theme=mode;if(map&&map.getStyle()){try{map.setStyle(STYLES[mode])}catch{}}}
function setState(s){state=s;document.body.dataset.state=s;engine?.setState(s);refresh();if(s==='wild')wild()}
function key(p){return String(p.id??`${p.lat},${p.lng}`)}
function isPick(p){return p.trust_level==='roviq'||+p.is_drivers_pick===1}
function refresh(){if(!map||!engine)return;const wanted=new Map(engine.visible().map(p=>[key(p),p]));for(const [k,m] of markers)if(!wanted.has(k)){m.remove();markers.delete(k)}for(const [k,p] of wanted){if(markers.has(k))continue;const el=document.createElement('button');el.className='rq-marker'+(isPick(p)?' pick':'');el.innerHTML=`<span>${icons[String(p.category_key||p.category||'other').toLowerCase()]||'◆'}</span>`;el.onclick=e=>{e.stopPropagation();selected=p;document.querySelectorAll('.rq-marker.selected').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');setState('explore');showCard(p);map.easeTo({center:[+p.lng,+p.lat],zoom:Math.max(map.getZoom(),13.7),pitch:28,duration:650,essential:true})};markers.set(k,new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([+p.lng,+p.lat]).addTo(map))}}
function showCard(p){const c=$('#rq-card');c.hidden=false;$('#rq-kicker').textContent=isPick(p)?'◆ ROVIQ PICK':'CURATED';$('#rq-name').textContent=p.name||'Place';$('#rq-meta').textContent=p.category||'';$('#rq-desc').textContent=p.editorial_reason||p.why_stop||p.description||'Worth knowing about while you are on the road.';$('#rq-save').textContent=savedIds().has(String(p.id))?'Saved':'Save';$('#rq-go').textContent='Navigate →'}
function wild(){const pool=engine.visible();if(!pool.length)return;const p=pool[Math.floor(Math.random()*pool.length)];selected=p;showCard(p);$('#rq-kicker').textContent='WILD DISCOVERY';document.body.classList.remove('wild-pulse');void document.body.offsetWidth;document.body.classList.add('wild-pulse');map.easeTo({center:[+p.lng,+p.lat],zoom:13.8,pitch:34,duration:850,essential:true})}
function updateUser(ll,heading=null,follow=false){userLngLat=ll;if(userMarker)userMarker.setLngLat(ll);else{const el=document.createElement('div');el.className='rq-user';el.innerHTML='<span></span>';userMarker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(ll).addTo(map)}if(follow){try{map.easeTo({center:ll,zoom:15.7,pitch:52,bearing:Number.isFinite(heading)?heading:map.getBearing(),duration:500,essential:true})}catch{}}}
function locate(){navigator.geolocation?.getCurrentPosition(pos=>{const ll=[pos.coords.longitude,pos.coords.latitude];updateUser(ll,pos.coords.heading,false);try{map.flyTo({center:ll,zoom:navigation?15.7:13.8,pitch:navigation?52:state==='rest'?16:28,bearing:navigation&&Number.isFinite(pos.coords.heading)?pos.coords.heading:0,speed:1.1,curve:1.2,essential:true})}catch{}},()=>{}, {enableHighAccuracy:true,timeout:10000,maximumAge:5000})}
function savedView(){const ids=savedIds(),p=catalog.find(x=>ids.has(String(x.id)));if(p){setState('explore');selected=p;showCard(p);map.easeTo({center:[+p.lng,+p.lat],zoom:14,pitch:28,duration:650})}}
function haversine(a,b){const R=6371000,toRad=x=>x*Math.PI/180,dLat=toRad(b[1]-a[1]),dLon=toRad(b[0]-a[0]),la1=toRad(a[1]),la2=toRad(b[1]);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function formatDistance(m){if(m<1000)return `${Math.max(10,Math.round(m/10)*10)} m`;return `${(m/1000).toFixed(m<10000?1:0)} km`}
function formatTime(sec){const min=Math.max(1,Math.round(sec/60));if(min<60)return `${min} min`;return `${Math.floor(min/60)}h ${min%60}m`}
function navHud(){let hud=$('#rq-nav-hud');if(!hud){hud=document.createElement('section');hud.id='rq-nav-hud';hud.className='rq-nav-hud';hud.innerHTML='<button class="rq-nav-close" aria-label="End navigation">×</button><div class="rq-nav-kicker">ROVIQ NAVIGATION</div><div class="rq-nav-instruction" id="rq-nav-instruction">Calculating route…</div><div class="rq-nav-meta"><strong id="rq-nav-time">—</strong><span id="rq-nav-distance">—</span></div>';$('.rq-shell').appendChild(hud);hud.querySelector('.rq-nav-close').onclick=endNavigation}return hud}
function clearRoute(){if(!map)return;try{if(map.getLayer('rq-route-line'))map.removeLayer('rq-route-line');if(map.getLayer('rq-route-casing'))map.removeLayer('rq-route-casing');if(map.getSource('rq-route'))map.removeSource('rq-route')}catch{}}
function drawRoute(geometry){clearRoute();if(!geometry?.coordinates?.length)return;map.addSource('rq-route',{type:'geojson',data:{type:'Feature',properties:{},geometry}});map.addLayer({id:'rq-route-casing',type:'line',source:'rq-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#082a31','line-width':9,'line-opacity':.72}});map.addLayer({id:'rq-route-line',type:'line',source:'rq-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#54dfcf','line-width':5,'line-opacity':.96}})}
function maneuverText(step){if(!step)return'Continue on the route';const road=step.name?` on ${step.name}`:'';const type=String(step.type||'').replaceAll('_',' ');const mod=String(step.modifier||'');if(type==='turn')return `Turn ${mod}${road}`;if(type==='roundabout'||type==='rotary')return `Enter the roundabout${road}`;if(type==='arrive')return 'You have arrived';if(type==='depart')return `Head ${mod||'forward'}${road}`;return `${type?type[0].toUpperCase()+type.slice(1):'Continue'}${road}`}
async function requestRoute(from,to,fit=true){
  const q=`/api/route?from=${encodeURIComponent(from[0]+','+from[1])}&to=${encodeURIComponent(to[0]+','+to[1])}`;
  const res=await fetch(q,{cache:'no-store'});
  if(!res.ok)throw new Error('route unavailable');
  const data=await res.json(),r=data.route;
  if(!r?.geometry?.coordinates?.length)throw new Error('no route');
  navigation.route=r;
  drawRoute(r.geometry);
  const hud=navHud();hud.hidden=false;
  $('#rq-nav-time').textContent=formatTime(r.duration);
  $('#rq-nav-distance').textContent=formatDistance(r.distance);
  $('#rq-nav-instruction').textContent=maneuverText(r.steps?.[0]);
  if(fit){
    try{
      const b=new maplibregl.LngLatBounds();
      r.geometry.coordinates.forEach(c=>b.extend(c));
      map.fitBounds(b,{padding:{top:150,bottom:210,left:45,right:45},maxZoom:15,duration:850,essential:true});
      setTimeout(()=>{try{map.easeTo({pitch:42,duration:350,essential:true})}catch{}},850);
    }catch(e){console.warn('ROVIQ route camera fit skipped',e)}
  }
  return r;
}
function startWatch(){if(watchId!=null||!navigator.geolocation)return;watchId=navigator.geolocation.watchPosition(async pos=>{const ll=[pos.coords.longitude,pos.coords.latitude],heading=Number.isFinite(pos.coords.heading)?pos.coords.heading:null;updateUser(ll,heading,!!navigation);if(!navigation)return;const now=Date.now();if(now-lastRerouteAt>12000&&navigation.lastRouteFrom&&haversine(navigation.lastRouteFrom,ll)>70){lastRerouteAt=now;navigation.lastRouteFrom=ll;try{await requestRoute(ll,navigation.destination,false)}catch{}}},{}, {enableHighAccuracy:true,maximumAge:2000,timeout:15000})}
async function startNavigation(){if(!selected)return;const destination=[+selected.lng,+selected.lat];if(!Number.isFinite(destination[0])||!Number.isFinite(destination[1]))return;setState('explore');document.body.dataset.navigating='true';navHud().hidden=false;$('#rq-nav-instruction').textContent='Getting your GPS position…';const begin=async ll=>{navigation={destination,route:null,lastRouteFrom:ll};try{await requestRoute(ll,destination,true);startWatch()}catch(e){if(!navigation?.route){$('#rq-nav-instruction').textContent='Could not calculate a drivable route.'}console.error(e)}};if(userLngLat)return begin(userLngLat);navigator.geolocation?.getCurrentPosition(p=>{const ll=[p.coords.longitude,p.coords.latitude];updateUser(ll,p.coords.heading,false);begin(ll)},()=>{$('#rq-nav-instruction').textContent='Location permission is required for navigation.'},{enableHighAccuracy:true,timeout:12000,maximumAge:3000})}
function endNavigation(){navigation=null;document.body.dataset.navigating='false';const hud=$('#rq-nav-hud');if(hud)hud.hidden=true;clearRoute();if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}setState('explore')}

async function init(){document.documentElement.dataset.theme=visualMode();map=new maplibregl.Map({container:'map',style:STYLES[visualMode()],center:[-122.6765,45.5231],zoom:11.5,pitch:16,bearing:0,minZoom:3,maxZoom:18});engine=new DiscoveryEngine(map);map.on('load',async()=>{try{catalog=await loadApprovedPlaces()}catch(e){console.error(e);catalog=[]}engine.setCatalog(catalog);setState('rest');locate()});map.on('moveend',refresh);map.on('zoomend',refresh);map.on('dragstart',()=>{if(state==='rest'&&!navigation)setState('explore')});map.on('click',()=>{if(state==='rest'&&!navigation)setState('explore')});map.on('styledata',()=>{if(navigation?.route?.geometry&&!map.getSource('rq-route'))setTimeout(()=>{try{drawRoute(navigation.route.geometry)}catch{}},50)});$('#rq-discover').onclick=()=>setState('explore');$('#rq-wild').onclick=()=>setState('wild');$('#rq-search').onclick=()=>setState('explore');$('#rq-locate').onclick=locate;$('#rq-home').onclick=()=>navigation?endNavigation():setState('rest');$('#rq-explore').onclick=()=>setState('explore');$('#rq-saved').onclick=savedView;$('#rq-save').onclick=()=>{if(selected)$('#rq-save').textContent=toggleSaved(selected.id)?'Saved':'Save'};$('#rq-go').onclick=startNavigation;setInterval(()=>{const next=visualMode();if(document.documentElement.dataset.theme!==next){document.documentElement.dataset.theme=next;applyVisualMode()}},60000)}
init().catch(console.error);
