import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function setup({status=200,failCache=false}={}){
 const events={},calls={fetch:0,put:0};
 const context={self:{location:{origin:'https://test'},addEventListener:(name,fn)=>events[name]=fn},URL,fetch:async()=>{calls.fetch++;return new Response('network bytes',{status})},caches:{open:async()=>({put:async()=>{calls.put++;if(failCache||status===206)throw Error('Cannot cache response')}}),match:async()=>undefined}};
 vm.runInNewContext(source,context);
 return {calls,dispatch(url,headers={}){let response;events.fetch({request:new Request('https://test'+url,{headers}),respondWith:value=>response=value});return response;}};
}
test('night/day videos and range requests bypass service-worker caching',()=>{
 const app=setup({status:206});
 for(const [path,headers] of [['/assets/wild/roviq_wild_urban_night_compatible.mp4',{}],['/assets/wild/roviq_virtual_day_drive.mp4',{}],['/other-resource',{Range:'bytes=0-31'}]])assert.equal(app.dispatch(path,headers),undefined);
 assert.equal(app.calls.put,0);assert.equal(app.calls.fetch,0);
});
test('cache write failures never break successful network responses',async()=>{
 const app=setup({failCache:true});const response=await app.dispatch('/js/app-v3.js');assert.equal(response.status,200);assert.equal(await response.text(),'network bytes');
});
test('unexpected partial responses are returned without caching',async()=>{
 const app=setup({status:206});assert.equal((await app.dispatch('/other-resource')).status,206);assert.equal(app.calls.put,0);
});
test('private APIs remain excluded from offline cache',()=>{
 const app=setup();assert.equal(app.dispatch('/api/saved'),undefined);assert.equal(app.dispatch('/admin/'),undefined);assert.equal(app.calls.put,0);
});
