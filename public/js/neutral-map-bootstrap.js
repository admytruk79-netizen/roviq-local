(()=>{
'use strict';
if(!window.maplibregl?.Map||window.maplibregl.Map.__roviqNeutralBootstrap)return;
const BaseMap=window.maplibregl.Map;
class RoviqNeutralMap extends BaseMap{
  constructor(options={}){
    const center=Array.isArray(options.center)?options.center:null;
    const isLegacyPortland=center&&Math.abs(Number(center[0])+122.6765)<0.01&&Math.abs(Number(center[1])-45.5231)<0.01;
    const safe=isLegacyPortland?{...options,center:[0,20],zoom:2.4,pitch:0,bearing:0}:options;
    super(safe);
    window.__ROVIQ_MAP=this;
  }
}
RoviqNeutralMap.__roviqNeutralBootstrap=true;
window.maplibregl.Map=RoviqNeutralMap;
})();
