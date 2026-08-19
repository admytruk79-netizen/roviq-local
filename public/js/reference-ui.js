(()=>{'use strict';
const ICONS={food:'🍴',coffee:'☕',breweries:'◉',nature:'✦',scenic:'✦',culture:'◫',markets:'▣',recreation:'⌁',family:'◇',lodging:'⌂',automotive:'◈',charging:'ϟ',services:'•',other:'◆'};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let hydrateTimer=null;
function buzz(ms=6){try{navigator.vibrate?.(ms)}catch{}}
function placeByName(name){const a=Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[];const b=Array.isArray(window.__roviqAllPlaces)?window.__roviqAllPlaces:[];return [...a,...b].find(p=>String(p?.name||'')===String(name||''))||null}
function decorateMarkers(){
  $$('.roviq-gl-marker,.roviq-runtime-marker').forEach(el=>{
    const p=placeByName(el.getAttribute('aria-label')||'');
    const cat=String(p?.category_key||p?.category||'other').toLowerCase();el.dataset.category=cat;
    if(!el.querySelector('.rq-marker-icon')){const i=document.createElement('span');i.className='rq-marker-icon';i.textContent=ICONS[cat]||'◆';el.appendChild(i)}
    el.classList.toggle('driver',p?.trust_level==='driver');el.classList.toggle('roviq',p?.trust_level==='roviq'||Number(p?.is_drivers_pick)===1);
  });
}
function decorateCard(){
  const card=$('.place-preview');if(!card)return;const p=placeByName(card.querySelector('h3')?.textContent?.trim());if(!p)return;
  if(!card.querySelector('.rq-card-photo')){const photo=document.createElement('div');photo.className='rq-card-photo';if(p.photo_url)photo.style.backgroundImage=`url("${String(p.photo_url).replace(/"/g,'')}")`;card.prepend(photo)}
  if(!card.querySelector('.rq-card-go')){const go=document.createElement('button');go.type='button';go.className='rq-card-go';go.textContent='Go';go.onclick=()=>{buzz(7);window.ROVIQShowRoute?.(p.lat,p.lng)};card.appendChild(go)}
  if(!card.querySelector('.rq-card-nav')){const nav=document.createElement('a');nav.className='rq-card-nav';nav.textContent='↗';nav.setAttribute('aria-label','Open turn-by-turn directions in Maps');nav.href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lat)},${encodeURIComponent(p.lng)}`;nav.target='_blank';nav.rel='noopener';nav.onclick=e=>{e.stopPropagation();buzz(5)};card.appendChild(nav)}
}
function wireCenter(){const b=$('.bottom-nav .mockup-center');if(!b||b.dataset.rqWired)return;b.dataset.rqWired='1';b.addEventListener('click',()=>{buzz(8);$('.place-preview')?.remove();const map=window.__ROVIQ_MAPLIBRE;try{map?.easeTo({pitch:0,bearing:0,duration:500,essential:true})}catch{}})}
function keepUiFixed(){const t=$('.mockup-tools');if(t){t.style.setProperty('position','fixed','important');t.style.setProperty('top','calc(88px + env(safe-area-inset-top))','important');t.style.setProperty('bottom','auto','important');t.style.setProperty('left','20px','important');t.style.setProperty('transform','none','important')}const n=$('.bottom-nav');if(n){n.style.setProperty('position','fixed','important');n.style.setProperty('bottom','0','important');n.style.setProperty('top','auto','important');n.style.setProperty('transform','none','important')}}
function hydrate(){clearTimeout(hydrateTimer);hydrateTimer=setTimeout(()=>{decorateMarkers();decorateCard();wireCenter();keepUiFixed()},25)}
const observer=new MutationObserver(hydrate);observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('roviq:map-ready',hydrate);window.addEventListener('roviq:places-loaded',hydrate);window.addEventListener('roviq:visual-mode-changed',hydrate);window.addEventListener('roviq:user-recentered',hydrate);
document.addEventListener('click',e=>{if(e.target.closest('.mockup-discover,.mockup-wild,.roviq-gl-marker,.roviq-runtime-marker,.bottom-nav button,.roviq-locate-native'))hydrate()},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate);else hydrate();
})();
