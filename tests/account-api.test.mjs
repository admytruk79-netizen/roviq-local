import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hashCuratorToken} from '../functions/_lib/auth.js';
import * as saved from '../functions/api/saved.js';
import * as details from '../functions/api/admin/places/details.js';
import * as curators from '../functions/api/admin/curators.js';
async function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['schema.sql','migrations/0004_moderation_network.sql','migrations/0014_place_freshness.sql','migrations/0014_place_freshness.sql'])sql.exec(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 sql.exec("ALTER TABLE places ADD COLUMN category_key TEXT; CREATE TABLE curator_credentials(contributor_id INTEGER PRIMARY KEY,token_hash TEXT UNIQUE,active INTEGER DEFAULT 1,created_at TEXT,last_used_at TEXT);");
 sql.exec("INSERT INTO contributors(id,handle,role) VALUES(1,'alice','city_curator'),(2,'bob','contributor'),(3,'owner','super_admin'); INSERT INTO curator_assignments(contributor_id,country_code,region,city) VALUES(1,'US','OR','Portland'); INSERT INTO places(id,name,category,category_key,lat,lng,city,region,country_code,status) VALUES(1,'Public','coffee','coffee',45.52,-122.67,'Portland','OR','US','approved'),(2,'Pending','coffee','coffee',45.52,-122.67,'Portland','OR','US','pending'),(3,'Outside','coffee','coffee',45,-122,'Salem','OR','US','approved');");
 for(const [id,token] of [[1,'alice-test'],[2,'bob-test'],[3,'owner-test']])sql.prepare('INSERT INTO curator_credentials(contributor_id,token_hash) VALUES(?,?)').run(id,await hashCuratorToken(token));
 const DB={prepare(query){return {args:[],bind(...args){this.args=args;return this},async all(){return {results:sql.prepare(query).all(...this.args)}},async first(){return sql.prepare(query).get(...this.args)||null},async run(){const result=sql.prepare(query).run(...this.args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 return {sql,env:{DB}};
}
function request(token,method='GET',body){return new Request('https://test/api/saved',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test('favorites are idempotent, individual, and contain only public records',async()=>{
 const {sql,env}=await setup();
 for(let i=0;i<2;i++)assert.equal((await saved.onRequestPost({request:request('alice-test','POST',{place_id:1}),env})).status,200);
 assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM saved_places').get().count,1);
 assert.equal((await saved.onRequestPost({request:request('alice-test','POST',{place_id:2}),env})).status,404);
 let body=await(await saved.onRequestGet({request:request('bob-test'),env})).json();assert.equal(body.places.length,0);
 await saved.onRequestDelete({request:request('bob-test','DELETE'),env,params:{id:1}});
 body=await(await saved.onRequestGet({request:request('alice-test'),env})).json();assert.equal(body.places[0].id,1);
 sql.exec('UPDATE places SET is_hidden=1 WHERE id=1');body=await(await saved.onRequestGet({request:request('alice-test'),env})).json();assert.equal(body.places.length,0);
});
test('structured updates require scope and record an atomic audit entry',async()=>{
 const {sql,env}=await setup();
 const body={operational_status:'open',timezone:'America/Los_Angeles',opening_hours:[{day:2,start:'09:00',end:'17:00'}],source_url:'https://example.test/hours',verify_now:true};
 assert.equal((await details.onRequestPatch({request:request('alice-test','PATCH',body),env,params:{id:3}})).status,403);
 assert.equal((await details.onRequestPatch({request:request('bob-test','PATCH',body),env,params:{id:1}})).status,403);
 const response=await details.onRequestPatch({request:request('alice-test','PATCH',body),env,params:{id:1}});assert.equal(response.status,200);
 assert.equal((await response.json()).details.verification.state,'current');assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM moderation_events').get().count,1);
 await details.onRequestPatch({request:request('alice-test','PATCH',{parking:'Street parking'}),env,params:{id:1}});
 assert.equal(sql.prepare('SELECT verified_at FROM place_details WHERE place_id=1').get().verified_at,null);
});
test('invalid curator assignments cannot create users or broaden access',async()=>{
 const {sql,env}=await setup();
 const response=await curators.onRequestPost({request:request('owner-test','POST',{handle:'bad',role:'city_curator',assignment:{country_code:'US',region:'OR'}}),env});assert.equal(response.status,400);
 assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM contributors WHERE handle='bad'").get().count,0);
});
test('credential rotation replaces previous assignments and revoked tokens fail',async()=>{
 const {sql,env}=await setup();
 const response=await curators.onRequestPost({request:request('owner-test','POST',{handle:'alice',role:'city_curator',assignment:{country_code:'US',region:'WA',city:'Seattle'}}),env});assert.equal(response.status,200);
 assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM curator_assignments WHERE contributor_id=1 AND active=1').get().count,1);
 assert.equal(sql.prepare('SELECT city FROM curator_assignments WHERE contributor_id=1 AND active=1').get().city,'Seattle');
 assert.equal((await saved.onRequestGet({request:request('alice-test'),env})).status,401);
 assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM security_audit_events').get().count,1);
});
