const STORAGE_KEY='roviq_fog_explored';
const CELL=0.00018;
const MAX_POINTS=4000;
const REVEAL_RADIUS_PX=130;
const USER_RADIUS_PX=190;
const FOG_FILL='rgba(2,9,14,.7)';

function loadPoints(){try{const arr=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(arr)?arr.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[]}catch{return[]}}
function savePoints(points){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(points))}catch{}}
function snap(ll){return Math.round(ll[0]/CELL)+':'+Math.round(ll[1]/CELL)}

export function createFog(map,container){
  const points=loadPoints();
  const seen=new Set(points.map(snap));
  let lastUser=null,dpr=Math.min(2,window.devicePixelRatio||1);

  const canvas=document.createElement('canvas');
  canvas.id='rq-fog';
  canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';
  container.appendChild(canvas);
  const ctx=canvas.getContext('2d');

  function punchHole(x,y,radius){
    const g=ctx.createRadialGradient(x,y,radius*0.35,x,y,radius);
    g.addColorStop(0,'rgba(0,0,0,1)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
  }

  function draw(){
    const w=canvas.width/dpr,h=canvas.height/dpr;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=FOG_FILL;
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='destination-out';
    const b=map.getBounds(),pad=0.01;
    for(const p of points){
      if(p[0]<b.getWest()-pad||p[0]>b.getEast()+pad||p[1]<b.getSouth()-pad||p[1]>b.getNorth()+pad)continue;
      const pt=map.project(p);
      punchHole(pt.x,pt.y,REVEAL_RADIUS_PX);
    }
    if(lastUser){const pt=map.project(lastUser);punchHole(pt.x,pt.y,USER_RADIUS_PX)}
    ctx.globalCompositeOperation='source-over';
  }

  function resize(){
    const r=container.getBoundingClientRect();
    canvas.width=Math.max(1,r.width*dpr);
    canvas.height=Math.max(1,r.height*dpr);
    canvas.style.width=r.width+'px';
    canvas.style.height=r.height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  function reveal(lngLat){
    if(!Array.isArray(lngLat)||!Number.isFinite(lngLat[0])||!Number.isFinite(lngLat[1]))return;
    lastUser=lngLat;
    const key=snap(lngLat);
    if(!seen.has(key)){
      seen.add(key);
      points.push(lngLat);
      if(points.length>MAX_POINTS)points.splice(0,points.length-MAX_POINTS);
      savePoints(points);
    }
    draw();
  }

  map.on('move',draw);
  map.on('zoom',draw);
  map.on('rotate',draw);
  window.addEventListener('resize',resize);
  resize();

  return{reveal,setVisible(v){canvas.style.display=v?'':'none'}};
}
