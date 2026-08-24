let ready=false;
export async function ensurePlaceMediaSchema(env){
  if(ready)return;
  const cols=await env.DB.prepare('PRAGMA table_info(places)').all();
  const names=new Set((cols.results||[]).map(c=>c.name));
  const additions=[['arrival_video_url','TEXT'],['virtual_image_url','TEXT']];
  for(const [name,type] of additions){if(!names.has(name))await env.DB.prepare(`ALTER TABLE places ADD COLUMN ${name} ${type}`).run();}
  ready=true;
}
