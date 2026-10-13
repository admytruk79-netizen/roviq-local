import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshness,validateDetails} from '../functions/_lib/place-freshness.js';
import {canModeratePlace,requireModerator} from '../functions/_lib/auth.js';
import worker from '../worker.js';
const now=new Date('2026-10-14T00:30:00Z');
test('unknown, stale and freshly verified hours remain distinct',()=>{
 assert.equal(freshness({},null,now).open_now,null);
 const details={verified_at:now.toISOString(),timezone:'UTC',hours_json:JSON.stringify([{day:2,start:'23:00',end:'01:00'}])};
 assert.equal(freshness({},details,now).open_now,true);
 assert.equal(freshness({}, {...details,verified_at:'2020-01-01'},now).open_now,null);
 assert.equal(freshness({}, {...details,operational_status:'temporarily_closed'},now).open_now,false);
 assert.equal(freshness({verified_at:now.toISOString()},{verified_at:null},now).verification.state,'unverified');
});
test('freshness respects local timezone and daylight saving rules',()=>{
 const details={verified_at:now.toISOString(),timezone:'America/Los_Angeles',hours_json:JSON.stringify([{day:2,start:'17:00',end:'18:00'}])};
 assert.equal(freshness({},details,now).open_now,true);
 assert.equal(freshness({}, {...details,timezone:'Not/A/Zone'},now).open_now,null);
});
test('structured details reject invalid schedules, zones and evidence',()=>{
 for(const body of [{opening_hours:[{day:7,start:'09:00',end:'17:00'}]},{opening_hours:[{day:1,start:'25:00',end:'17:00'}]},{timezone:'invalid'},{source_url:'http://example.test'},{verify_now:true}])assert.throws(()=>validateDetails(body));
 assert.equal(validateDetails({operational_status:'open'}).operational_status,'open');
});
test('city assignments cannot escalate to region-wide moderation',()=>{
 const actor={role:'city_curator',assignments:[{country_code:'US',region:'OR',city:'Portland'}]};
 assert.equal(canModeratePlace(actor,{country_code:'US',region:'OR',city:'Portland'}),true);
 assert.equal(canModeratePlace(actor,{country_code:'US',region:'OR',city:'Salem'}),false);
 assert.equal(canModeratePlace({role:'city_curator',assignments:[{market_slug:'a',region:'OR'}]},{market_slug:'b',region:'OR'}),false);
});
test('unauthenticated requests do not initialize or query curator tables',async()=>{
 const result=await requireModerator(new Request('https://test'),{DB:{prepare(){throw Error('must not query')}}});assert.equal(result.response.status,401);
});
test('rate-limited requests do not touch the database and include retry metadata',async()=>{
 const response=await worker.fetch(new Request('https://test/api/places',{headers:{'CF-Connecting-IP':'192.0.2.1'}}),{PUBLIC_RATE_LIMITER:{limit:async()=>({success:false})},DB:{prepare(){throw Error('must not query')}}});
 assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert(response.headers.has('X-Request-ID'));
});
test('server exceptions are sanitized and correlate with a request id',async()=>{
 const response=await worker.fetch(new Request('https://test/api/health'),{DB:{prepare(){throw Error('private failure')}}});assert.equal(response.status,503);assert(response.headers.has('X-Request-ID'));assert(!JSON.stringify(await response.json()).includes('private failure'));
});
