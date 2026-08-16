(() => {
  'use strict';
  if (!window.L || typeof window.L.map !== 'function' || window.__ROVIQ_MAP_CAPTURED) return;
  const originalMap = window.L.map.bind(window.L);
  window.L.map = function roviqMap(...args) {
    const instance = originalMap(...args);
    window.__ROVIQ_MAP_INSTANCE = instance;
    window.dispatchEvent(new CustomEvent('roviq:map-ready', { detail: { map: instance } }));
    return instance;
  };
  window.__ROVIQ_MAP_CAPTURED = true;
})();