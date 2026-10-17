import json, urllib.request, urllib.parse
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ROVIQ-video-preview/1.0'}),timeout=12) as response:
            return json.load(response)
    except Exception as error:
        return {'error':str(error)}
found={}
for query in ['VACE','video-to-video']:
    results=get('https://huggingface.co/api/spaces?search='+urllib.parse.quote(query)+'&limit=15&sort=likes&direction=-1')
    if isinstance(results,list):
        for item in results:
            if item.get('sdk')=='gradio':found[item['id']]=item
print('CANDIDATES',json.dumps(list(found)))
for name in list(found)[:14]:
    runtime=get('https://huggingface.co/api/spaces/'+name+'/runtime')
    stage=runtime.get('stage') if isinstance(runtime,dict) else None
    if stage!='RUNNING':
        print('SPACE',name,'STAGE',stage)
        continue
    host='https://'+name.lower().replace('/','-')+'.hf.space'
    config=get(host+'/config')
    print('SPACE',name,'HOST',host,'CONFIG',json.dumps({'runtime':runtime,'version':config.get('version'),'enable_queue':config.get('enable_queue'),'components':[{'id':x.get('id'),'type':x.get('type'),'label':x.get('props',{}).get('label'),'value':x.get('props',{}).get('value') if x.get('type') in ['slider','dropdown','checkbox'] else None} for x in config.get('components',[])],'apis':[{'api_name':d.get('api_name'),'inputs':d.get('inputs'),'outputs':d.get('outputs')} for d in config.get('dependencies',[]) if d.get('api_name')],'error':config.get('error')}))
