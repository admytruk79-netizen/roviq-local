(()=>{
'use strict';
if(typeof navigator==='undefined'||!navigator.geolocation||window.__ROVIQ_LOCATION_AUTHORITY)return;

const geo=navigator.geolocation;
const nativeGet=geo.getCurrentPosition.bind(geo);
let cached=null;
let inFlight=null;

function normalized(pos){
  if(!pos?.coords)return null;
  const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return {lat,lng,accuracy:Number(pos.coords.accuracy)||null,position:pos,at:Date.now(),radius_km:80};
}

function publish(pos){
  const fix=normalized(pos);
  if(!fix)return null;
  cached=fix;
  window.__ROVIQ_LOCATION=fix;
  window.dispatchEvent(new CustomEvent('roviq:location',{detail:fix}));
  return fix;
}

function usable(maximumAge){
  if(!cached)return false;
  const age=Date.now()-cached.at;
  const max=Number.isFinite(Number(maximumAge))?Number(maximumAge):30000;
  return age<=Math.max(0,max);
}

function acquire(options={}){
  const opts={enableHighAccuracy:true,timeout:12000,maximumAge:30000,...options};
  if(usable(opts.maximumAge))return Promise.resolve(cached.position);
  if(inFlight)return inFlight;
  inFlight=new Promise((resolve,reject)=>{
    nativeGet(pos=>{publish(pos);inFlight=null;resolve(pos)},err=>{inFlight=null;reject(err)},opts);
  });
  return inFlight;
}

try{
  geo.getCurrentPosition=(success,error,options={})=>{
    acquire(options).then(pos=>success?.(pos)).catch(err=>error?.(err));
  };
}catch{}

window.__ROVIQ_LOCATION_AUTHORITY={
  get current(){return cached||window.__ROVIQ_LOCATION||null},
  acquire:async options=>normalized(await acquire(options)),
  publish,
  invalidate(){cached=null;inFlight=null;window.__ROVIQ_LOCATION=null}
};
})();
