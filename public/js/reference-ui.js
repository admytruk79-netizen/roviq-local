(()=>{'use strict';
const DARK='https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json';
const ICONS={food:'🍴',coffee:'☕',breweries:'◉',nature:'✦',scenic:'✦',culture:'◫',markets:'▣',recreation:'⌁',family:'◇',lodging:'⌂',automotive:'◈',charging:'ϟ',services:'•',other:'◆'};
let stylingTimer=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function buzz(ms=6){try{navigator.vibrate?.(ms)}catch{}}
function forceDark(){const map=window.__ROVIQ_MAPLIBRE;if(!map)return;try{const style=map.getStyle?.();const sprite=style?.sprite||'';if(!String(sprite).includes('alidade_smooth_dark')){map.setStyle(DARK);map.once('styledata',()=>setTimeout(decorateMarkers,80));}}catch{}}
function placeByName(name){const items=Array.isArray(window.__roviqPlaces)?window.__roviqPlaces:[];return items.find(p=>String(p.name||'')===String(name||''))||null}
function decorateMarkers(){clearTimeout(stylingTimer);stylingTimer=setTimeout(()=>{
  $$('.roviq-gl-marker,.roviq-runtime-marker').forEach(el=>{
    const name=el.getAttribute('aria-label')||'';const p=placeByName(name);const cat=String(p?.category_key||p?.category||'other').toLowerCase();el.dataset.category=cat;
    if(!el.querySelector('.rq-marker-icon')){const i=document.createElement('span');i.className='rq-marker-icon';i.textContent=ICONS[cat]||'◆';el.appendChild(i)}
    if(p?.trust_level==='driver')el.classList.add('driver');if(p?.trust_level==='roviq'||Number(p?.is_drivers_pick)===1)el.classList.add('roviq');
  });
},40)}
function decorateCard(){const card=$('.place-preview');if(!card)return;const name=card.querySelector('h3')?.textContent?.trim();const p=placeByName(name);if(!card.querySelector('.rq-card-photo')){const photo=document.createElement('div');photo.className='rq-card-photo';if(p?.photo_url)photo.style.backgroundImage=`url("${String(p.photo_url).replace(/"/g,'')}")`;card.prepend(photo)}
  if(!card.querySelector('.rq-card-go')&&p){const go=document.createElement('a');go.className='rq-card-go';go.textContent='Go';go.href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lat)},${encodeURIComponent(p.lng)}`;go.target='_blank';go.rel='noopener';go.addEventListener('click',()=>buzz(7));card.appendChild(go)}
}
function ensureRestControls(){if(!$('.rq-rest-search')){const b=document.createElement('button');b.className='rq-rest-search';b.type='button';b.setAttribute('aria-label','Explore ROVIQ');b.textContent='⌕';b.onclick=()=>{buzz(7);document.body.classList.remove('roviq-rest');$('.mockup-discover')?.click()};($('#app')||document.body).appendChild(b)}
  if(!$('.rq-rest-new')){const b=document.createElement('button');b.className='rq-rest-new';b.type='button';b.innerHTML='<strong>2</strong><span>NEW</span>';b.onclick=()=>{buzz(7);document.body.classList.remove('roviq-rest');$('.mockup-wild')?.click()};($('#app')||document.body).appendChild(b)}}
function wireCenter(){const b=$('.bottom-nav .mockup-center');if(!b||b.dataset.rqWired)return;b.dataset.rqWired='1';b.addEventListener('click',()=>{buzz(8);setTimeout(()=>{document.body.classList.add('roviq-rest');$('.place-preview')?.remove();const map=window.__ROVIQ_MAPLIBRE;if(map){try{map.easeTo({pitch:0,bearing:0,duration:500,essential:true})}catch{}}},0)})}
function keepUiFixed(){const t=$('.mockup-tools');if(t){t.style.setProperty('position','fixed','important');t.style.setProperty('top','calc(96px + env(safe-area-inset-top))','important');t.style.setProperty('bottom','auto','important');t.style.setProperty('left','24px','important');t.style.setProperty('transform','none','important')}
  const n=$('.bottom-nav');if(n){n.style.setProperty('position','fixed','important');n.style.setProperty('bottom','0','important');n.style.setProperty('top','auto','important');n.style.setProperty('transform','none','important')}}
function hydrate(){ensureRestControls();wireCenter();keepUiFixed();decorateMarkers();decorateCard();forceDark()}
const observer=new MutationObserver(()=>hydrate());observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('roviq:map-ready',()=>setTimeout(()=>{forceDark();hydrate()},50));
window.addEventListener('roviq:places-loaded',()=>setTimeout(()=>{decorateMarkers();hydrate()},80));
window.addEventListener('roviq:visual-mode-changed',()=>setTimeout(forceDark,30));
window.addEventListener('roviq:user-recentered',()=>{buzz(10);document.body.classList.remove('roviq-rest')});
document.addEventListener('click',e=>{if(e.target.closest('.mockup-discover,.mockup-wild,.roviq-gl-marker,.roviq-runtime-marker,.bottom-nav button,.roviq-locate-native'))setTimeout(hydrate,20)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrate,80));else setTimeout(hydrate,80);
})();
