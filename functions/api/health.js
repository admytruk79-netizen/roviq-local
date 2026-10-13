export async function onRequestGet({env}) {
 try {
  const row=await env.DB.prepare('SELECT 1 AS ok').first();
  const schema=await env.DB.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('places','place_details')").first();
  const healthy=row?.ok===1&&schema?.total===2;
  return Response.json({success:healthy,service:'roviq-local2',checks:{database:row?.ok===1,catalog_schema:schema?.total===2},commit:env.GIT_COMMIT||'unknown'},{status:healthy?200:503,headers:{'Cache-Control':'no-store'}});
 } catch {
  console.error('health_check_failed');
  return Response.json({success:false,service:'roviq-local2',error:'Service temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
