import json,urllib.request,urllib.parse
def get(url):
 try:
  with urllib.request.urlopen(url,timeout=12) as r:return json.load(r)
 except Exception as e:return {'error':str(e)}
for query in ['LTX-Video','LTX-2']:
 spaces=get('https://huggingface.co/api/spaces?search='+query+'&limit=8&sort=likes&direction=-1')
 if not isinstance(spaces,list):continue
 for item in spaces:
  if item.get('sdk')!='gradio':continue
  name=item['id'];runtime=get('https://huggingface.co/api/spaces/'+name+'/runtime')
  if runtime.get('stage')!='RUNNING':continue
  host='https://'+runtime['domains'][0]['domain'];info=get(host+'/gradio_api/info')
  endpoints={}
  for k,v in info.get('named_endpoints',{}).items():
   if any(x in k for x in ['generate','infer','predict']):
    endpoints[k]={'parameters':[{key:p.get(key) for key in ['parameter_name','parameter_has_default','parameter_default','python_type','component','label']} for p in v.get('parameters',[])],'returns':v.get('returns',[])}
  print('LTX_CANDIDATE',json.dumps({'id':name,'host':host,'hardware':runtime.get('hardware'),'endpoints':endpoints,'error':info.get('error')}))
