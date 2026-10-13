import {test} from 'node:test';
import assert from 'node:assert/strict';
let attempt=0;
Object.defineProperty(globalThis,'navigator',{value:{geolocation:{getCurrentPosition(success,error){attempt++;if(attempt===1)error({code:1});else success({coords:{latitude:45.52,longitude:-122.67,accuracy:20}})}}},configurable:true});
globalThis.window={dispatchEvent(){}};
globalThis.document={querySelector(){return null}};
globalThis.CustomEvent=class{constructor(name,options){this.name=name;this.detail=options.detail}};
const cache=new Map();
globalThis.localStorage={getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)};
const requests=[];
globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({success:true,places:[{id:1,name:'Coffee'}]})}};
const service=await import('../public/js/services.js');
test('denied location does not poison retry',async()=>{
 assert.equal(await service.getCurrentPosition(),null);
 const scope=await service.getCurrentPosition();assert.equal(scope.lat,45.52);assert.equal(attempt,2);
});
test('manual area scopes public catalog requests',async()=>{
 const places=await service.loadApprovedPlaces({lat:40,lng:-73,radius_km:12});assert.equal(places.length,1);
 const url=requests.find(x=>x.startsWith('/api/places'));const params=new URL(url,'https://test').searchParams;assert.equal(params.get('lat'),'40');assert.equal(params.get('lng'),'-73');assert.equal(params.get('radius_km'),'12');
});

test('network failure returns only fresh cached public data for the same area',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('offline')};
 const places=await service.loadApprovedPlaces({lat:40,lng:-73,radius_km:12});assert.equal(places.offline,true);assert.equal(places[0].id,1);
 await assert.rejects(service.loadApprovedPlaces({lat:41,lng:-73,radius_km:12}));
 const stored=JSON.parse(cache.get('roviq_public_places'));stored.savedAt=Date.now()-8*24*60*60*1000;cache.set('roviq_public_places',JSON.stringify(stored));
 await assert.rejects(service.loadApprovedPlaces({lat:40,lng:-73,radius_km:12}));
 globalThis.fetch=original;
});

test('known client errors never revive an old catalog',async()=>{
 const key='roviq_public_places';cache.set(key,JSON.stringify({scope:'status=approved&lat=40&lng=-73&radius_km=12',savedAt:Date.now(),places:[{id:1}]}));
 globalThis.fetch=async()=>({ok:false,status:403});
 await assert.rejects(service.loadApprovedPlaces({lat:40,lng:-73,radius_km:12}));
});
