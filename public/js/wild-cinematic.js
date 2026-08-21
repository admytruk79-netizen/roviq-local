const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let running=false;
const VIDEOS={night:'/assets/wild/roviq_wild_urban_night_compatible.mp4',departure:'/assets/wild/roviq_virtual_departure_daylight.mp4',cruise:'/assets/wild/roviq_virtual_cruise.mp4'};
function ensureStage(){let s=document.querySelector('#rq-wild-cinema');if(s)return s;s=document.createElement('div');s.id='rq-wild-cinema';const CAR_SVG='<svg viewBox="0 0 64 34" aria-hidden="true"><path d="M6 22c0-2 1.6-3.4 3.4-3.7l4.6-.7 4-6.4C19.3 8.8 21.6 7.5 24.2 7.5h13c2.7 0 5.2 1.4 6.6 3.7l3.4 5.6 4.7.9c2 .4 3.4 2 3.4 4v3.6c0 1.3-1 2.4-2.4 2.4H49" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 27H6.4A2.4 2.4 0 0 1 4 24.6V22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="27" r="4.4" fill="#0a1a22" stroke="currentColor" stroke-width="2.2"/><circle cx="44" cy="27" r="4.4" fill="#0a1a22" stroke="currentColor" stroke-width="2.2"/><path d="M23 27h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
s.innerHTML='<video class="rq-wc-video" playsinline webkit-playsinline preload="auto" fetchpriority="high"></video><div class="rq-wc-arrival-photo"></div><div class="rq-wc-park-car">'+CAR_SVG+'</div><button class="rq-wc-skip" aria-label="Skip cinematic">SKIP</button><div class="rq-wc-video-shade"></div><div class="rq-wc-car-badge">'+CAR_SVG+'<span>ROVIQ</span></div><div class="rq-wc-video-lock"><small>ROVIQ VIRTUAL</small><strong id="rq-wc-title">VIRTUAL DRIVE</strong><span>Simulating the journey</span></div><div class="rq-wc-vignette"></div><div class="rq-wc-speed"></div><div class="rq-wc-grid"></div><div class="rq-wc-reticle"><i></i><b>✦</b></div><div class="rq-wc-copy"><small>ROVIQ VIRTUAL</small><strong id="rq-wc-copy-title">ROUTE READY</strong><span>Simulating the journey</span></div><div class="rq-wc-flash"></div>';document.body.appendChild(s);return s}
function pauseMap(){document.body.classList.add('rq-virtual-playing');const map=document.querySelector('#map');if(map)map.setAttribute('aria-hidden','true')}
function resumeMap(){document.body.classList.remove('rq-virtual-playing');const map=document.querySelector('#map');if(map)map.removeAttribute('aria-hidden')}
function setSource(v,url){if(v.dataset.src===url)return;v.dataset.src=url;v.innerHTML='<source src="'+url+'" type="video/mp4">';v.load()}
async function warm(url=VIDEOS.departure){const s=ensureStage(),v=s.querySelector('.rq-wc-video');try{setSource(v,url);if(v.readyState<3)await Promise.race([new Promise(r=>v.addEventListener('canplay',r,{once:true})),sleep(2500)])}catch{}}
async function fallback(s){s.classList.add('fallback','scan');await sleep(450);s.className='fallback chase';await sleep(650);s.className='fallback locked';await sleep(500);s.className='fallback release';await sleep(300)}
async function playClip(url,{title,copyTitle,copyText,holdMs=0}={}){
  const s=ensureStage(),v=s.querySelector('.rq-wc-video'),copy=s.querySelector('.rq-wc-video-lock'),skip=s.querySelector('.rq-wc-skip');
  setSource(v,url);
  document.body.classList.add('rq-wild-cinematic');s.className='video';
  s.querySelector('#rq-wc-title').textContent=title||'VIRTUAL DRIVE';
  s.querySelector('#rq-wc-copy-title').textContent=copyTitle||'ROUTE READY';
  copy.querySelector('span').textContent=copyText||document.querySelector('#rq-name')?.textContent?.trim()||'Simulating the journey';
  let skipped=false;const skipNow=()=>{skipped=true;try{v.pause()}catch{}};skip.onclick=skipNow;
  try{
    v.currentTime=0;v.muted=false;const playPromise=v.play();if(playPromise)await Promise.race([playPromise,new Promise((_,rej)=>setTimeout(()=>rej(new Error('play stalled')),4000))]);
    await new Promise(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;resolve()};v.addEventListener('ended',done,{once:true});const tick=()=>{if(settled)return;if(skipped)return done();const d=Number.isFinite(v.duration)&&v.duration>0?v.duration:8;const left=d-v.currentTime;s.classList.toggle('video-lock',left<3.5);requestAnimationFrame(tick)};tick();setTimeout(done,12000)});
    try{v.pause()}catch{}
    navigator.vibrate?.([18,45,32]);
    if(holdMs){s.classList.add('video-release');await sleep(holdMs)}
  }catch(e){
    try{v.muted=true;await Promise.race([v.play(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('muted play stalled')),3000))]);const unlock=document.createElement('button');unlock.className='rq-wc-audio-unlock';unlock.textContent='SOUND ON';unlock.onclick=()=>{v.muted=false;unlock.remove()};s.appendChild(unlock);if(holdMs)await sleep(holdMs);unlock.remove()}catch{await fallback(s)}
  }
  return !skipped;
}
function isDayTheme(){return document.documentElement.dataset.theme==='day'}
async function playSequence(){
  if(running)return false;running=true;pauseMap();
  let ok;
  if(isDayTheme()){
    // Daytime sequence — only the matched daylight pair, never the night clip.
    // No "DEPARTING"/destination-name overlay here: the car hasn't actually reached anywhere yet,
    // and there's no footage backing that claim until arrival is handled separately.
    ok=await playClip(VIDEOS.departure,{});
    if(ok)ok=await playClip(VIDEOS.cruise,{holdMs:400});
  }else{
    // Nighttime sequence — untouched: plays straight through to the destination reveal, same as before the day/night split.
    ok=await playClip(VIDEOS.night,{holdMs:5000});
  }
  document.body.classList.remove('rq-wild-cinematic');document.querySelector('#rq-wild-cinema').className='';resumeMap();running=false;return ok;
}
async function playArrival(photoUrl,name){
  const s=ensureStage(),photo=s.querySelector('.rq-wc-arrival-photo');
  photo.style.backgroundImage=photoUrl?`url("${String(photoUrl).replace(/"/g,'')}")`:'linear-gradient(135deg,#10252b,#5a4326)';
  document.body.classList.add('rq-wild-cinematic');
  // Beat 1: destination recreation — the real place photo fades in.
  s.className='photo-reveal';
  s.querySelector('#rq-wc-copy-title').textContent='ARRIVED';
  s.querySelector('.rq-wc-copy span').textContent=name||'';
  navigator.vibrate?.([20,40,20,60]);
  await sleep(1900);
  // Beat 2: the ROVIQ car arrives and parks in front of the recreated destination.
  s.className='photo-reveal parked';
  s.querySelector('#rq-wc-copy-title').textContent='PARKED';
  navigator.vibrate?.(35);
  await sleep(2100);
  document.body.classList.remove('rq-wild-cinematic');s.className='';resumeMap();
}
window.ROVIQ_CINEMATIC={playVirtual:playSequence,playArrival,warm};
function warmForTheme(){warm(isDayTheme()?VIDEOS.departure:VIDEOS.night)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warmForTheme,{once:true});else warmForTheme();
