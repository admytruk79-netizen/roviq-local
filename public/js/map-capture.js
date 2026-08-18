(() => {
  'use strict';
  if (!window.L || typeof window.L.map !== 'function' || window.__ROVIQ_MAP_CAPTURED) return;

  const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js';
  const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css';
  const BRIDGE_JS = 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js';
  const STADIA_STYLE = {
    day: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    night: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
  };

  function currentStyle() {
    return document.documentElement.dataset.theme === 'day' ? STADIA_STYLE.day : STADIA_STYLE.night;
  }

  function ensureCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  function loadScript(src, ready) {
    if (ready?.()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let tag = document.querySelector(`script[src="${src}"]`);
      if (tag) {
        tag.addEventListener('load', resolve, { once: true });
        tag.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      tag = document.createElement('script');
      tag.src = src;
      tag.crossOrigin = 'anonymous';
      tag.onload = resolve;
      tag.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(tag);
    });
  }

  async function installVectorLayer(map) {
    if (!map || map.__roviqVectorInstalled) return;
    map.__roviqVectorInstalled = true;
    try {
      ensureCss(MAPLIBRE_CSS);
      await loadScript(MAPLIBRE_JS, () => !!window.maplibregl);
      await loadScript(BRIDGE_JS, () => !!window.L?.maplibreGL);
      if (!window.L?.maplibreGL) throw new Error('MapLibre Leaflet bridge unavailable');

      const vector = window.L.maplibreGL({
        style: currentStyle(),
        interactive: false,
        attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap'
      }).addTo(map);
      vector.bringToBack?.();
      window.__ROVIQ_STADIA_VECTOR_LAYER = vector;
      const gl = vector.getMaplibreMap?.();
      if (gl) {
        window.__ROVIQ_MAPLIBRE_INSTANCE = gl;
        gl.once('load', () => {
          document.documentElement.classList.add('roviq-stadia-vector');
          window.dispatchEvent(new CustomEvent('roviq:stadia-ready'));
        });
      } else {
        document.documentElement.classList.add('roviq-stadia-vector');
        window.dispatchEvent(new CustomEvent('roviq:stadia-ready'));
      }
    } catch (err) {
      map.__roviqVectorInstalled = false;
      document.documentElement.classList.add('roviq-stadia-error');
      console.error('ROVIQ primary vector map failed', err);
    }
  }

  // Block the legacy CARTO raster basemap before product-redesign.js can add it.
  const originalTileLayer = window.L.tileLayer.bind(window.L);
  window.L.tileLayer = function roviqTileLayer(url, options) {
    if (typeof url === 'string' && url.includes('basemaps.cartocdn.com')) {
      const noop = {
        __roviqBlockedLegacyRaster: true,
        addTo() { return noop; },
        remove() { return noop; },
        bringToBack() { return noop; }
      };
      return noop;
    }
    return originalTileLayer(url, options);
  };

  const originalMap = window.L.map.bind(window.L);
  window.L.map = function roviqMap(...args) {
    const instance = originalMap(...args);
    window.__ROVIQ_MAP_INSTANCE = instance;
    installVectorLayer(instance);
    window.dispatchEvent(new CustomEvent('roviq:map-ready', { detail: { map: instance } }));
    return instance;
  };

  window.addEventListener('roviq:visual-mode-changed', (event) => {
    const gl = window.__ROVIQ_MAPLIBRE_INSTANCE;
    if (!gl) return;
    const mode = event.detail?.mode;
    const style = mode === 'day' ? STADIA_STYLE.day : STADIA_STYLE.night;
    try { gl.setStyle(style); } catch (err) { console.error('ROVIQ vector style switch failed', err); }
  });

  window.__ROVIQ_MAP_CAPTURED = true;
})();