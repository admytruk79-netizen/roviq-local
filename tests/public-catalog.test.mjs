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
  sqlite.exec(readFileSync(new URL('../migrations/0014_place_freshness.sql', import.meta.url),'utf8'));
  const insert = sqlite.prepare('INSERT INTO places (id,name,category,category_key,lat,lng,status,is_hidden,submitted_by,moderation_note) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for(const row of [[1,'Nearby coffee','coffee','coffee',45.52,-122.67,'approved',0],[2,'Pending','coffee','coffee',45.52,-122.67,'pending',0],[3,'Hidden','coffee','coffee',45.52,-122.67,'approved',1],[4,'Far away','coffee','coffee',0,0,'approved',0],[5,'Rejected','coffee','coffee',45.52,-122.67,'rejected',0],[6,'Charging','culture','charging',45.52,-122.67,'approved',0]])insert.run(...row,'private contributor','private moderation');
  return {sqlite,prepare(sql){return {args:[],bind(...args){this.args=args;return this},async all(){return{results:sqlite.prepare(sql).all(...this.args)}},async first(){return sqlite.prepare(sql).get(...this.args)}}}};
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
test('nearby results are selected by distance before the output limit',async()=>{
 const DB=database();DB.sqlite.exec('UPDATE places SET lat=0,lng=0');
 const add=DB.sqlite.prepare("INSERT INTO places(id,name,category,category_key,lat,lng,status) VALUES (?,?, 'coffee','coffee',?,?,'approved')");
 for(let i=0;i<600;i++)add.run(100+i,'Other '+i,45.6,-122.67);
 add.run(10000,'Closest',45.52,-122.67);
 const body=await(await list({request:request('?lat=45.52&lng=-122.67&limit=1'),env:{DB}})).json();assert.equal(body.places[0].id,10000);assert.equal(body.pagination.total,601);assert.equal(body.pagination.next_offset,1);
 const second=await(await list({request:request('?lat=45.52&lng=-122.67&limit=1&offset=1'),env:{DB}})).json();assert.equal(second.places[0].id,100);
});
test('nearby search crosses the date line and reaches every longitude near a pole',async()=>{
 for(const [lat,lng,otherLat,otherLng] of [[0,179.9,0,-179.9],[89.9,0,89.9,180]]){
  const DB=database();DB.sqlite.prepare("INSERT INTO places(id,name,category,category_key,lat,lng,status) VALUES(100,'Boundary','coffee','coffee',?,?,'approved')").run(otherLat,otherLng);
  const body=await(await list({request:request(`?lat=${lat}&lng=${lng}&radius_km=50`),env:{DB}})).json();assert(body.places.some(p=>p.id===100));
 }
});
test('explicit geography never invents a Portland location for unknown metadata',async()=>{
 const body=await(await list({request:request('?city=Portland'),env:{DB:database()}})).json();assert.equal(body.places.length,0);
});
test('invalid pagination or radius is rejected, not silently clamped',async()=>{
 for(const query of ['?limit=0','?limit=501','?offset=-1','?offset=1.2','?radius_km=invalid','?radius_km=251'])assert.equal((await list({request:request(query),env:{DB:database()}})).status,400);
});

test('known closures are excluded from discovery unless explicitly requested',async()=>{
 const DB=database();DB.sqlite.exec("INSERT INTO place_details(place_id,operational_status) VALUES(1,'temporarily_closed')");
 const body=await(await list({request:request(''),env:{DB}})).json();assert(!body.places.some(p=>p.id===1));
 const all=await(await list({request:request('?include_closed=1'),env:{DB}})).json();assert(all.places.some(p=>p.id===1));
});
