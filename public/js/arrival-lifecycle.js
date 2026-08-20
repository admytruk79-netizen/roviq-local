(()=>{'use strict';
const ARRIVE_M=35,LEAVE_M=85;
let places=null,target=null,watch=null,arrived=false,nearCount=0;
const $=s=>document.querySelector(s);
const dist=(a,b)=>{const R=6371000,r=Math.PI/180,dLat=(b[1]-a[1])*r,dLng=(b[0]-a[0])*r,x=Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
async function load(){if(places)return places;try{const r=await fetch('/api/places?status=approved&scope=all',{cache:'no-store'}),d=await r.json();places=Array.isArray(d?.places)?d.places:[]}catch{places=[]}return places}
function clearSelection(){target=null;arrived=false;nearCount=0;document.querySelectorAll('.rq-marker.selected').forEach(x=>x.classList.remove('selected'));const c=$('#rq-card');if(c)c.hidden=true}
function arrival(){if(arrived)return;arrived=true;document.body.classList.add('rq-arrived');const h=$('#rq-nav-hud');if(h){const i=$('#rq-nav-instruction'),t=$('#rq-nav-time'),d=$('#rq-nav-distance');if(i)i.textContent='You have arrived';if(t)t.textContent='ARRIVED';if(d)d.textContent='ROVIQ';}setTimeout(()=>{const close=$('.rq-nav-close');if(close)close.click();clearSelection();document.body.classList.remove('rq-arrived');document.body.classList.add('rq-arrival-release');setTimeout(()=>document.body.classList.remove('rq-arrival-release'),1100)},2200)}
async function choose(){const name=($('#rq-name')?.textContent||'').trim();if(!name)return;const all=await load(),p=all.find(x=>String(x.name||'').trim().toLowerCase()===name.toLowerCase());if(p&&Number.isFinite(+p.lng)&&Number.isFinite(+p.lat)){target=[+p.lng,+p.lat];arrived=false;nearCount=0;start()}}
function start(){if(watch!=null||!navigator.geolocation)return;watch=navigator.geolocation.watchPosition(pos=>{if(!target||document.body.dataset.navigating!=='true')return;const here=[pos.coords.longitude,pos.coords.latitude],m=dist(here,target);if(m<=ARRIVE_M){nearCount++;if(nearCount>=2)arrival()}else if(m>LEAVE_M){nearCount=0}},()=>{},{enableHighAccuracy:true,maximumAge:1000,timeout:15000})}
document.addEventListener('click',e=>{if(e.target?.closest?.('#rq-go'))setTimeout(choose,0);if(e.target?.closest?.('#rq-home,.rq-nav-close'))clearSelection()});
window.addEventListener('pagehide',()=>{if(watch!=null)navigator.geolocation.clearWatch(watch)});
})();