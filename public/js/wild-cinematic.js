const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let running=false;
let cancelled=false;
const VIDEOS={night:'/assets/wild/roviq_wild_urban_night_compatible.mp4',day:'/assets/wild/roviq_virtual_day_drive.mp4'};
function ensureStage(){let s=document.querySelector('#rq-wild-cinema');if(s)return s;s=document.createElement('div');s.id='rq-wild-cinema';const CAR_SVG='<svg viewBox="0 0 64 34" aria-hidden="true"><path d="M6 22c0-2 1.6-3.4 3.4-3.7l4.6-.7 4-6.4C19.3 8.8 21.6 7.5 24.2 7.5h13c2.7 0 5.2 1.4 6.6 3.7l3.4 5.6 4.7.9c2 .4 3.4 2 3.4 4v3.6c0 1.3-1 2.4-2.4 2.4H49" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 27H6.4A2.4 2.4 0 0 1 4 24.6V22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="27" r="4.4" fill="#0a1a22" stroke="currentColor" stroke-width="2.2"/><circle cx="44" cy="27" r="4.4" fill="#0a1a22" stroke="currentColor" stroke-width="2.2"/><path d="M23 27h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
s.innerHTML='<video class="rq-wc-video" playsinline webkit-playsinline preload="auto" fetchpriority="high"></video><div class="rq-wc-arrival-photo"></div><div class="rq-wc-park-car">'+CAR_SVG+'</div><button class="rq-wc-skip" aria-label="Skip cinematic">SKIP</button><div class="rq-wc-video-shade"></div><div class="rq-wc-car-badge">'+CAR_SVG+'<span>ROVIQ</span></div><div class="rq-wc-video-lock"><small>ROVIQ VIRTUAL</small><strong id="rq-wc-title">VIRTUAL DRIVE</strong><span>Simulating the journey</span></div><div class="rq-wc-vignette"></div><div class="rq-wc-speed"></div><div class="rq-wc-grid"></div><div class="rq-wc-reticle"><i></i><b>✦</b></div><div class="rq-wc-copy"><small>ROVIQ VIRTUAL</small><strong id="rq-wc-copy-title">ROUTE READY</strong><span>Simulating the journey</span></div><div class="rq-wc-flash"></div>';document.body.appendChild(s);return s}
function pauseMap(){document.body.classList.add('rq-virtual-playing');const map=document.querySelector('#map');if(map)map.setAttribute('aria-hidden','true')}
function resumeMap(){document.body.classList.remove('rq-virtual-playing');const map=document.querySelector('#map');if(map)map.removeAttribute('aria-hidden')}
function setSource(v,url){if(v.dataset.src===url)return;v.dataset.src=url;v.innerHTML='<source src="'+url+'" type="video/mp4">';v.load()}
async function warm(url=VIDEOS.day){const s=ensureStage(),v=s.querySelector('.rq-wc-video');try{setSource(v,url);if(v.readyState<3)await Promise.race([new Promise(r=>v.addEventListener('canplay',r,{once:true})),sleep(2500)])}catch{}}
async function fallback(s){s.classList.add('fallback','scan');await sleep(450);s.className='fallback chase';await sleep(650);s.className='fallback locked';await sleep(500);s.className='fallback release';await sleep(300)}
function withTimeout(promise,ms){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Video playback timed out')),ms)})]).finally(()=>clearTimeout(timer));
}
function waitForVideoEnd(video,stage,skipSignal){
 return new Promise((resolve,reject)=>{
  let settled=false,timer,lastTime=video.currentTime,lastProgress=Date.now();
  const finish=error=>{if(settled)return;settled=true;clearInterval(timer);video.removeEventListener('ended',ended);video.removeEventListener('error',failed);error?reject(error):resolve();};
  const ended=()=>finish(),failed=()=>finish(new Error('Video could not load'));
  video.addEventListener('ended',ended);video.addEventListener('error',failed);
  skipSignal.then(ended);
  timer=setInterval(()=>{
   if(video.ended)return ended();
   if(video.error)return failed();
   if(video.currentTime>lastTime){lastTime=video.currentTime;lastProgress=Date.now();stage.dataset.playback='playing';}
   if(Number.isFinite(video.duration))stage.classList.toggle('video-lock',video.duration-video.currentTime<3.5);
   if(Date.now()-lastProgress>15000)finish(new Error('Video stopped progressing'));
  },150);
  if(video.ended)ended();
 });
}
async function playClip(url,{title,copyTitle,copyText,holdMs=0}={}){
 const stage=ensureStage(),video=stage.querySelector('.rq-wc-video'),skip=stage.querySelector('.rq-wc-skip');
 setSource(video,url);document.body.classList.add('rq-wild-cinematic');stage.className='video';stage.dataset.playback='loading';
 stage.querySelector('#rq-wc-title').textContent=title||'VIRTUAL DRIVE';stage.querySelector('#rq-wc-copy-title').textContent=copyTitle||'ROUTE READY';
 stage.querySelector('.rq-wc-video-lock span').textContent=copyText||document.querySelector('#rq-name')?.textContent?.trim()||'Simulating the journey';
 let skipped=false,resolveSkip,unlock;
 const skipSignal=new Promise(resolve=>resolveSkip=resolve);
 skip.onclick=()=>{if(skipped)return;skipped=true;video.pause();resolveSkip();};
 try{
  video.currentTime=0;video.muted=false;
  try{await withTimeout(Promise.race([video.play(),skipSignal]),4000);}
  catch(error){
   if(skipped)return !cancelled;
   video.muted=true;
   await withTimeout(Promise.race([video.play(),skipSignal]),4000);
   unlock=document.createElement('button');unlock.className='rq-wc-audio-unlock';unlock.textContent='Sound on';
   unlock.onclick=()=>{video.muted=false;unlock.remove();};stage.appendChild(unlock);
  }
  // Audio permission changes must not shorten or skip the video.
  if(!skipped)await waitForVideoEnd(video,stage,skipSignal);
  if(!skipped&&holdMs)await Promise.race([sleep(holdMs),skipSignal]);
  return !cancelled;
 }catch(error){
  if(!skipped){stage.dataset.playback='fallback';stage.querySelector('#rq-wc-copy-title').textContent='VIRTUAL DRIVE';await fallback(stage);}
  return !cancelled;
 }finally{
  video.pause();unlock?.remove();skip.onclick=null;delete stage.dataset.playback;
 }
}
function isDayTheme(){return document.documentElement.dataset.theme==='day'}
async function playSequence(){
 if(running)return false;running=true;cancelled=false;pauseMap();
 try{return await playClip(isDayTheme()?VIDEOS.day:VIDEOS.night,{holdMs:isDayTheme()?400:500});}
 finally{document.body.classList.remove('rq-wild-cinematic');ensureStage().className='';resumeMap();running=false;}
}
function looksLikeVideo(value){return /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(String(value||''))}
async function playArrival(source,name){const s=ensureStage(),photo=s.querySelector('.rq-wc-arrival-photo'),v=s.querySelector('.rq-wc-video');pauseMap();document.body.classList.add('rq-wild-cinematic');if(looksLikeVideo(source)){s.querySelector('#rq-wc-title').textContent='ARRIVAL';s.querySelector('#rq-wc-copy-title').textContent='ARRIVING';s.querySelector('.rq-wc-video-lock span').textContent=name||'Destination';await playClip(source,{title:'ARRIVAL',copyTitle:'ARRIVED',copyText:name||'Destination',holdMs:2200});document.body.classList.remove('rq-wild-cinematic');s.className='';resumeMap();return}
  photo.style.backgroundImage=source?`url("${String(source).replace(/"/g,'')}")`:'linear-gradient(135deg,#10252b,#5a4326)';s.className='photo-reveal';s.querySelector('#rq-wc-copy-title').textContent='ARRIVED';s.querySelector('.rq-wc-copy span').textContent=name||'';navigator.vibrate?.([20,40,20,60]);await sleep(2500);if(!cancelled){s.className='photo-reveal parked';s.querySelector('#rq-wc-copy-title').textContent='PARKED';navigator.vibrate?.(35);await sleep(3000)}document.body.classList.remove('rq-wild-cinematic');s.className='';resumeMap()}
function cancel(){cancelled=true;document.querySelector('#rq-wild-cinema .rq-wc-skip')?.click()}
window.ROVIQ_CINEMATIC={playVirtual:playSequence,playArrival,warm,cancel};function warmForTheme(){warm(isDayTheme()?VIDEOS.day:VIDEOS.night)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warmForTheme,{once:true});else warmForTheme();