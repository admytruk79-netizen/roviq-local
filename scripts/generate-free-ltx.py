from pathlib import Path
import subprocess,json,shutil,traceback
from gradio_client import Client,handle_file
preview=Path('preview');preview.mkdir(exist_ok=True)
reference=preview/'arrival-reference.jpg'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','7.5','-i','public/assets/wild/roviq_wild_urban_night_compatible.mp4','-frames:v','1','-q:v','2',str(reference)],check=True)
prompt='A cinematic first-person car dash-camera view in natural bright daylight. Drive smoothly down a modern city street, turn gently into the driveway of the modern stone and glass building shown in the reference, slow down and arrive directly in front of its main entrance. Finish with the building entrance centered and clearly visible. Midday blue sky, soft sun, realistic materials and natural shadows. All exterior and window lights are off. Calm premium automotive commercial. Continuous forward camera movement followed by a gentle stop. No cuts, no text, no logos.'
negative='night, darkness, black sky, neon lights, glowing windows, sunset, overexposed, washed out, flickering, shaking, reversed motion, text, subtitles, watermark, logo, deformed architecture, abrupt cuts'
try:
    client=Client('https://linoyts-ltx-2-3.hf.space',verbose=False,httpx_kwargs={'timeout':60})
    job=client.submit(input_image=handle_file(str(reference)),prompt=prompt,duration=4,enhance_prompt=False,seed=42,randomize_seed=False,height=512,width=896,api_name='/generate_video')
    result=job.result(timeout=300)
    print('GENERATION_RESULT',json.dumps(result,default=str))
    candidate=result[0] if isinstance(result,(list,tuple)) else result
    if isinstance(candidate,dict):
        candidate=candidate.get('video',candidate.get('path'))
        if isinstance(candidate,dict):candidate=candidate.get('path')
    if candidate and Path(str(candidate)).is_file():
        shutil.copyfile(candidate,preview/'generated-daylight-arrival.mp4')
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(preview/'generated-daylight-arrival.mp4'),'-vf','fps=1,scale=360:-2,tile=5x1','-frames:v','1','-q:v','3',str(preview/'generated-contact.jpg')],check=True)
        import base64
        print('ROVIQ_GENERATED_CONTACT_BEGIN')
        print(base64.b64encode((preview/'generated-contact.jpg').read_bytes()).decode())
        print('ROVIQ_GENERATED_CONTACT_END')
        print('FREE_VIDEO_CREATED')
except Exception as error:
    print('FREE_GENERATION_BLOCKED',type(error).__name__,str(error))
    (preview/'generation-status.txt').write_text(type(error).__name__+': '+str(error))
