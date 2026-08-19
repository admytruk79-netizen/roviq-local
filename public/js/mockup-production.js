(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const initialScope=window.__ROVIQ_LOCATION_SCOPE||{};
const hadCoordsAtBoot=Number.isFinite(Number(initialScope.lat))&&Number.isFinite(Number(initialScope.lng));
function ensureReferenceAssets(){
  if(!document.querySelector('link[data-rq-reference]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/css/reference-ui.css?v=20260819-8';l.dataset.rqReference='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-rq-reference]')){const s=document.createElement('script');s.src='/js/reference-ui.js?v=20260819-8';s.defer=true;s.dataset.rqReference='1';document.head.appendChild(s)}
}
function force(el,p,v){if(el)el.style.setProperty(p,v,'important')}
function pinUi(){
  const tools=$('.mockup-tools');if(tools){force(tools,'position','fixed');force(tools,'top','calc(104px + env(safe-area-inset-top))');force(tools,'bottom','auto');force(tools,'left','24px');force(tools,'right','auto');force(tools,'transform','none');force(tools,'z-index','2300')}
  const nav=$('.bottom-nav');if(nav){force(nav,'position','fixed');force(nav,'left','0');force(nav,'right','0');force(nav,'top','auto');force(nav,'bottom','0');force(nav,'transform','none');force(nav,'z-index','2310')}
  const locate=$('.roviq-locate-native');if(locate){force(locate,'position','fixed');force(locate,'left','24px');force(locate,'bottom','calc(84px + env(safe-area-inset-bottom))');force(locate,'transform','none');force(locate,'z-index','2320')}
}
function tidy(){const brand=$('.brand');if(brand&&!brand.dataset.local){brand.dataset.local='1';brand.textContent='ROVIQ'}$$('.fab-suggest,.curator-entry').forEach(x=>x.style.display='none')}
function boot(){
  ensureReferenceAssets();pinUi();tidy();
  if(!window.__ROVIQ_PRIMARY_ACTIVE&&!window.__ROVIQ_PRIMARY_BOOT_REQUESTED){window.__ROVIQ_PRIMARY_BOOT_REQUESTED=true;const s=document.createElement('script');s.src='/js/maplibre-primary.js?v=20260819-8';s.async=false;s.dataset.roviqPrimary='1';s.onerror=()=>{window.__ROVIQ_PRIMARY_BOOT_REQUESTED=false;console.error('ROVIQ primary map controller failed to load')};document.head.appendChild(s)}
}
const observer=new MutationObserver(()=>{pinUi();tidy()});observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('roviq:map-ready',()=>{pinUi();tidy()});window.addEventListener('resize',pinUi);
window.addEventListener('roviq:location-updated',e=>{const d=e.detail||{};const has=Number.isFinite(Number(d.lat))&&Number.isFinite(Number(d.lng));if(!hadCoordsAtBoot&&has&&!sessionStorage.getItem('roviq_location_boot_reload_v2')){sessionStorage.setItem('roviq_location_boot_reload_v2','1');location.reload()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();