(()=>{
'use strict';
if(new URLSearchParams(location.search).get('mode')==='tow')return;
const TOKEN_KEY='roviq_contributor_token';
const categories=[['coffee','Coffee'],['food','Food'],['nature','Nature'],['scenic','Scenic'],['culture','Culture'],['markets','Market'],['recreation','Recreation'],['family','Family'],['lodging','Lodging'],['automotive','Automotive'],['charging','Charging'],['services','Services'],['other','Other']];
const $=s=>document.querySelector(s);
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function getToken(){try{return localStorage.getItem(TOKEN_KEY)||''}catch{return''}}
function setToken(v){try{if(v)localStorage.setItem(TOKEN_KEY,v);else localStorage.removeItem(TOKEN_KEY)}catch{}}
async function scopeFromLocation(){
  const loc=window.__ROVIQ_LOCATION;
  if(!loc||!Number.isFinite(+loc.lat)||!Number.isFinite(+loc.lng))return null;
  let geo={};
  try{const r=await fetch(`/api/geocode?reverse=1&lat=${encodeURIComponent(loc.lat)}&lng=${encodeURIComponent(loc.lng)}`,{cache:'no-store'});if(r.ok){const d=await r.json();geo=d?.result||{}}}catch{}
  return {lat:+loc.lat,lng:+loc.lng,country_code:geo.country_code||'',country:geo.country||'',region:geo.region||'',city:geo.city||'',locality:geo.locality||'',postal_code:geo.postal_code||'',timezone:geo.timezone||''};
}
function ensureUi(){
  if($('#rq-recommend'))return;
  const btn=document.createElement('button');btn.id='rq-recommend';btn.className='rq-recommend';btn.type='button';btn.innerHTML='<span>＋</span><small>Recommend</small>';btn.setAttribute('aria-label','Recommend a place');document.querySelector('.rq-shell')?.appendChild(btn);
  const modal=document.createElement('div');modal.id='rq-recommend-modal';modal.className='rq-recommend-modal';modal.hidden=true;modal.innerHTML=`<div class="rq-recommend-backdrop" data-close></div><section class="rq-recommend-sheet" role="dialog" aria-modal="true" aria-labelledby="rq-rec-title"><button class="rq-rec-close" data-close aria-label="Close">×</button><div class="rq-rec-kicker">CONTRIBUTE TO ROVIQ</div><h2 id="rq-rec-title">Recommend a place worth stopping for.</h2><p class="rq-rec-intro">Your recommendation goes to local ROVIQ curators before it appears publicly.</p><form id="rq-rec-form"><div class="rq-rec-grid"><label><span>Place name</span><input name="name" maxlength="120" required placeholder="What is this place called?"></label><label><span>Category</span><select name="category" required>${categories.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div><label><span>Why stop here?</span><textarea name="why_stop" maxlength="800" required placeholder="What makes this genuinely worth interrupting a journey for?"></textarea></label><label><span>Who do you recommend it to?</span><input name="recommended_for" maxlength="240" required placeholder="Road-trippers, families, coffee people, EV drivers…"></label><label><span>Local tip <em>optional</em></span><textarea name="local_tip" maxlength="300" placeholder="Best time, parking tip, what to order, what not to miss…"></textarea></label><label><span>Photo URL <em>optional</em></span><input name="photo_url" type="url" maxlength="500" placeholder="https://…"></label><label class="rq-token-row"><span>Contributor access token</span><input name="token" type="password" autocomplete="off" placeholder="Required for verified contributors"><small>Stored only on this device.</small></label><div class="rq-rec-location" id="rq-rec-location">◎ Using your current location</div><div class="rq-rec-status" id="rq-rec-status" aria-live="polite"></div><button class="rq-rec-submit" type="submit">Send to local curators <span>→</span></button></form></section>`;document.body.appendChild(modal);
  btn.onclick=open;
  modal.addEventListener('click',e=>{if(e.target.closest('[data-close]'))close()});
  $('#rq-rec-form').addEventListener('submit',submit);
}
async function open(){
  const m=$('#rq-recommend-modal');if(!m)return;m.hidden=false;document.body.dataset.recommending='true';
  const token=$('#rq-rec-form [name=token]');token.value=getToken();
  const status=$('#rq-rec-status');status.textContent='';status.dataset.kind='';
  const loc=$('#rq-rec-location');loc.textContent='◎ Locating this recommendation…';
  const scope=await scopeFromLocation();m.__scope=scope;
  if(scope){const label=[scope.city,scope.region].filter(Boolean).join(', ')||scope.country||'Current location';loc.textContent=`◎ ${label} · current coordinates captured`;}else loc.textContent='Location unavailable — enable location before submitting.';
}
function close(){const m=$('#rq-recommend-modal');if(m)m.hidden=true;document.body.dataset.recommending='false'}
async function submit(e){
  e.preventDefault();const form=e.currentTarget,m=$('#rq-recommend-modal'),status=$('#rq-rec-status'),submitBtn=form.querySelector('.rq-rec-submit'),scope=m.__scope||await scopeFromLocation();
  if(!scope){status.textContent='Location is required so your recommendation reaches the correct local curators.';status.dataset.kind='error';return;}
  const fd=new FormData(form),token=String(fd.get('token')||'').trim();if(!token){status.textContent='A verified contributor token is required.';status.dataset.kind='error';return;}setToken(token);
  const body={name:String(fd.get('name')||'').trim(),category:String(fd.get('category')||''),why_stop:String(fd.get('why_stop')||'').trim(),description:String(fd.get('why_stop')||'').trim(),recommended_for:String(fd.get('recommended_for')||'').trim(),local_tip:String(fd.get('local_tip')||'').trim(),photo_url:String(fd.get('photo_url')||'').trim(),...scope};
  submitBtn.disabled=true;submitBtn.innerHTML='Sending…';status.textContent='';
  try{const r=await fetch('/api/places',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Submission failed (${r.status})`);form.reset();form.querySelector('[name=token]').value=token;status.dataset.kind='success';status.innerHTML=`<strong>Recommendation sent.</strong><br>It is now pending review by ROVIQ curators${d.market_slug?` for <span>${esc(d.market_slug)}</span>`:''}.`;setTimeout(()=>close(),2600)}catch(err){status.dataset.kind='error';status.textContent=err.message||'Could not send recommendation.'}finally{submitBtn.disabled=false;submitBtn.innerHTML='Send to local curators <span>→</span>'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUi,{once:true});else ensureUi();
})();
