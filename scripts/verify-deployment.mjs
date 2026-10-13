import assert from 'node:assert/strict';
const base=process.env.ROVIQ_BASE_URL||'https://roviq-local2.admytruk79.workers.dev';
const expected=process.env.GITHUB_SHA;
let version;
for(let attempt=0;attempt<12;attempt++){
 try{const response=await fetch(base+'/api/version',{signal:AbortSignal.timeout(15000)});version=await response.json();if(response.ok&&(!expected||version.commit===expected))break;}catch{}
 if(attempt===11)throw Error('Deployed version did not match expected commit');
 await new Promise(resolve=>setTimeout(resolve,5000));
}
if(expected)assert.equal(version.commit,expected);
const page=await fetch(base+'/',{signal:AbortSignal.timeout(15000)});assert.equal(page.status,200);assert((await page.text()).includes('/css/discovery-recovery.css'));
for(const status of ['pending','rejected'])assert.equal((await fetch(base+'/api/places?status='+status,{signal:AbortSignal.timeout(15000)})).status,400);
assert.equal((await fetch(base+'/api/places?lat=invalid&lng=0',{signal:AbortSignal.timeout(15000)})).status,400);
const response=await fetch(base+'/api/places?lat=45.52&lng=-122.67&radius_km=80',{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
const catalog=await response.json();assert.equal(catalog.success,true);assert(Array.isArray(catalog.places));
for(const place of catalog.places){for(const key of ['submitted_by','contributor_id','moderation_note','contributor_role','status','is_hidden'])assert(!(key in place),'Private field: '+key);assert(place.distance_km<=80);}
assert.equal((await fetch(base+'/api/places/999999999',{signal:AbortSignal.timeout(15000)})).status,404);
console.log('Verified deployed commit, frontend assets, public catalog boundaries, geographic scope and detail visibility.');
