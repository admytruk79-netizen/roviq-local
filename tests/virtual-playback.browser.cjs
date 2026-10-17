const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const os=require('node:os');
const root=path.resolve(__dirname,'../public');
const artifacts=path.resolve('test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'roviq-video-'));
const clip=path.join(temporary,'drive.mp4');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=240x360:rate=12','-t','8','-c:v','libx264','-pix_fmt','yuv420p',clip]);
const html=theme=>'<!doctype html><html data-theme="'+theme+'"><head><link rel="stylesheet" href="/css/wild-cinematic.css"><link rel="stylesheet" href="/css/discovery-recovery.css"></head><body><div id="map"></div><div id="rq-meta">Coffee</div><div id="rq-name">Test stop</div><button id="rq-virtual">Virtual</button><script>window.simulations=0;document.querySelector("#rq-virtual").onclick=()=>window.simulations++;</script><script type="module" src="/js/wild-cinematic.js"></script><script type="module" src="/js/virtual-cinematic-bridge.js"></script></body></html>';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 async function pageFor(theme,{broken=false,reduced=false}={}){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:reduced?'reduce':'no-preference'});
  await page.addInitScript(({broken})=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(broken||!this.muted)return Promise.reject(new DOMException('Autoplay sound blocked','NotAllowedError'));return original.call(this)};},{broken});
  await page.route('https://roviq.test/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:html(theme)});
   const file=pathname.endsWith('.mp4')?clip:path.join(root,pathname);
   return route.fulfill({contentType:pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'video/mp4',body:fs.readFileSync(file)});
  });
  await page.goto('https://roviq.test/');await page.waitForFunction(()=>window.ROVIQ_CINEMATIC);return page;
 }
 try{
  for(const theme of ['day','night']){
   const page=await pageFor(theme);await page.click('#rq-virtual');
   await page.waitForTimeout(theme==='night'?5600:1000);
   const state=await page.evaluate(()=>{const stage=document.querySelector('#rq-wild-cinema'),video=stage.querySelector('video');return {visible:getComputedStyle(stage).opacity,time:video.currentTime,paused:video.paused,source:video.querySelector('source').getAttribute('src'),simulations:window.simulations,mediaError:video.error?.message,codec:video.canPlayType('video/mp4; codecs="avc1.42E01E"')}});
   console.log('PLAYBACK_STATE',theme,JSON.stringify(state));await page.screenshot({path:path.join(artifacts,theme+'-state.png')});
   assert.equal(state.visible,'1');assert(state.time>0);assert.equal(state.paused,false);assert.equal(state.simulations,0);assert(state.source.includes(theme==='night'?'night':'day'));
   await page.screenshot({path:path.join(artifacts,theme+'-muted-playing.png')});
   await page.evaluate(()=>document.querySelector('#rq-virtual').click());assert.equal(await page.evaluate(()=>window.simulations),0);
   await page.waitForFunction(()=>window.simulations===1,{},{timeout:12000});
   assert.equal(await page.evaluate(()=>document.querySelector('video').paused),true);
   console.log('PASS '+theme+': muted clip stays visible until ended, then starts one simulation');await page.close();
  }
  const skip=await pageFor('night');await skip.click('#rq-virtual');await skip.waitForTimeout(250);await skip.click('.rq-wc-skip');await skip.waitForTimeout(350);assert.equal(await skip.evaluate(()=>window.simulations),1);assert.equal(await skip.evaluate(()=>document.body.classList.contains('rq-virtual-playing')),false);await skip.click('#rq-virtual');await skip.waitForTimeout(250);assert.equal(await skip.evaluate(()=>document.querySelector('#rq-wild-cinema').classList.contains('video')),true);await skip.click('.rq-wc-skip');console.log('PASS Skip cinematic continues the drive and replay remains available');await skip.close();
  const fallback=await pageFor('night',{broken:true,reduced:true});await fallback.click('#rq-virtual');await fallback.waitForFunction(()=>document.querySelector('#rq-wild-cinema').classList.contains('fallback'));assert.equal(await fallback.locator('.rq-wc-copy').evaluate(el=>getComputedStyle(el).opacity),'1');await fallback.screenshot({path:path.join(artifacts,'reduced-motion-fallback.png')});console.log('PASS reduced-motion fallback remains visible');await fallback.close();
 }finally{await browser.close();fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
