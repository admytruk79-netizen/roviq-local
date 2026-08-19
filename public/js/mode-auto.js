(()=>{'use strict';
let lastMode=null;
function visualMode(){
  const forced=localStorage.getItem('roviq_visual_mode');
  if(forced==='day'||forced==='night')return forced;
  const h=new Date().getHours();
  return h>=7&&h<19?'day':'night';
}
function apply(){
  const mode=visualMode();
  if(mode===lastMode)return;
  lastMode=mode;
  document.body.classList.toggle('theme-day',mode==='day');
  document.body.classList.toggle('theme-night',mode==='night');
  document.documentElement.dataset.roviqMode=mode;
  window.dispatchEvent(new CustomEvent('roviq:visual-mode-changed',{detail:{mode}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
setInterval(apply,300000);
window.ROVIQVisualMode={
  set(mode){if(mode==='auto')localStorage.removeItem('roviq_visual_mode');else if(mode==='day'||mode==='night')localStorage.setItem('roviq_visual_mode',mode);apply();},
  get(){return document.documentElement.dataset.roviqMode||visualMode();}
};
})();