import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet as list} from '../functions/api/places/index.js';
import {onRequestGet as detail} from '../functions/api/places/[id].js';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  sqlite.exec('ALTER TABLE places ADD COLUMN category_key TEXT');
  const insert = sqlite.prepare('INSERT INTO places (id,name,category,category_key,lat,lng,status,is_hidden,submitted_by,moderation_note) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for(const row of [[1,'Nearby coffee','coffee','coffee',45.52,-122.67,'approved',0],[2,'Pending','coffee','coffee',45.52,-122.67,'pending',0],[3,'Hidden','coffee','coffee',45.52,-122.67,'approved',1],[4,'Far away','coffee','coffee',0,0,'approved',0],[5,'Rejected','coffee','coffee',45.52,-122.67,'rejected',0],[6,'Charging','culture','charging',45.52,-122.67,'approved',0]])insert.run(...row,'private contributor','private moderation');
  return {prepare(sql){return {args:[],bind(...args){this.args=args;return this},async all(){return{results:sqlite.prepare(sql).all(...this.args)}},async first(){return sqlite.prepare(sql).get(...this.args)}}}};
}
const request = query=>new Request('https://example.test/api/places'+query);
test('public list excludes private fields and non-public records',async()=>{
 const response=await list({request:request(''),env:{DB:database()}});assert.equal(response.status,200);
 const body=await response.json();assert.deepEqual(body.places.map(p=>p.id).sort(),[1,4,6]);assert(!JSON.stringify(body).includes('private'));assert(body.places.every(p=>!('submitted_by' in p)&&!('moderation_note' in p)));
});
test('pending and rejected cannot be requested publicly',async()=>{
 for(const status of ['pending','rejected'])assert.equal((await list({request:request('?status='+status),env:{DB:database()}})).status,400);
});
test('geographic and category constraints apply together',async()=>{
 const body=await(await list({request:request('?lat=45.52&lng=-122.67&radius_km=10&category=coffee'),env:{DB:database()}})).json();assert.deepEqual(body.places.map(p=>p.id),[1]);assert.equal(body.places[0].distance_km,0);
});
test('bad coordinates never silently broaden a request',async()=>{
 for(const query of ['?lat=oops&lng=1','?lat=45','?lat=91&lng=0'])assert.equal((await list({request:request(query),env:{DB:database()}})).status,400);
});
test('schema failures return unavailable rather than hidden records',async()=>{
 const DB={prepare(){throw Error('database failure')}};assert.equal((await list({request:request(''),env:{DB}})).status,503);assert.equal((await detail({params:{id:1},env:{DB}})).status,503);
});
test('detail endpoint keeps hidden, pending and rejected records private',async()=>{
 const DB=database();for(const id of [2,3,5,999])assert.equal((await detail({params:{id},env:{DB}})).status,404);
 const body=await(await detail({params:{id:1},env:{DB}})).json();assert.equal(body.place.name,'Nearby coffee');assert(!JSON.stringify(body).includes('private'));
});

test('broad legacy categories do not mislabel specialized places',async()=>{
 const DB=database();
 const culture=await(await list({request:request('?category=culture'),env:{DB}})).json();assert.equal(culture.places.length,0);
 const charging=await(await list({request:request('?category=charging'),env:{DB}})).json();assert.deepEqual(charging.places.map(p=>p.id),[6]);
});
