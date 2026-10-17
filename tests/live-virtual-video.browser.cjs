const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,geolocation:{latitude:45.52,longitude:-122.67},permissions:['geolocation']});
 const page=await context.newPage(),base=process.env.ROVIQ_BASE_URL||'https://roviq-local2.admytruk79.workers.dev';
 fs.mkdirSync('test-artifacts',{recursive:true});
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&window.ROVIQ_CINEMATIC,{},{timeout:20000});
  const check=await page.evaluate(async()=>{
   const text=await(await fetch('/sw.js',{cache:'no-store'})).text();
   if(!text.includes('roviq-shell-v3'))throw Error('Expected updated service worker');
   const response=await fetch('/assets/wild/roviq_wild_urban_night_compatible.mp4',{headers:{Range:'bytes=0-31'}});
   const bytes=new Uint8Array(await response.arrayBuffer());
   return {controlled:!!navigator.serviceWorker.controller,status:response.status,signature:new TextDecoder().decode(bytes.slice(4,8))};
  });
  assert.equal(check.controlled,true);assert.equal(check.status,206);assert.equal(check.signature,'ftyp');
  // Use the deployed Virtual click handler and real MP4, with the installed service worker controlling the page.
  await page.waitForSelector('.rq-marker',{timeout:30000});
  await page.locator('#map').click({position:{x:140,y:300}});
  await page.click('#rq-discover');
  await page.click('#rq-discover-menu [data-category=coffee]');
  await page.waitForSelector('#rq-card:not([hidden])');
  if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='night')await page.click('#rq-theme-toggle');
  await page.screenshot({path:'test-artifacts/selected-place-before-virtual.png'});
  await page.click('#rq-virtual');
  await page.waitForFunction(()=>{const s=document.querySelector('#rq-wild-cinema'),v=s?.querySelector('video');return v&&v.currentTime>1&&!v.paused&&getComputedStyle(s).opacity==='1';},{},{timeout:20000});
  const playback=await page.evaluate(()=>{const s=document.querySelector('#rq-wild-cinema'),v=s.querySelector('video');return {source:v.currentSrc,time:v.currentTime,duration:v.duration,muted:v.muted,visible:getComputedStyle(s).opacity,controlled:!!navigator.serviceWorker.controller};});
  assert(playback.source.includes('roviq_wild_urban_night_compatible.mp4'));assert.equal(playback.visible,'1');assert(playback.time>1);
  await page.screenshot({path:'test-artifacts/live-night-video.png'});
  console.log('PASS deployed real night video plays visibly with active service worker',JSON.stringify(playback));
  await page.click('.rq-wc-skip');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
