import { ensureAiMaintenanceSchema } from '../../_lib/ai-schema.js';
import { runMaintenanceBatch } from '../../_lib/ai-maintenance.js';

export async function onRequestGet({request,env}){
  const auth=request.headers.get('authorization')||'';
  const secret=env.CRON_SECRET||'';
  if(secret&&auth!==`Bearer ${secret}`)return Response.json({success:false,error:'unauthorized'},{status:401});
  try{
    await ensureAiMaintenanceSchema(env);
    const result=await runMaintenanceBatch(env,{limit:10,staleDays:30});
    return Response.json({success:true,result});
  }catch(error){
    console.error('AI maintenance cron failed',error);
    return Response.json({success:false,error:error?.message||'maintenance failed'},{status:500});
  }
}
