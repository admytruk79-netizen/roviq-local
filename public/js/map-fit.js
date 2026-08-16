(() => {
  'use strict';

  let lastSignature = '';

  function coordsFromScope() {
    const s = window.__ROVIQ_LOCATION_SCOPE || {};
    const lat = Number(s.lat), lng = Number(s.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  function fit() {
    const map = window.__ROVIQ_MAP_INSTANCE;
    const places = Array.isArray(window.__roviqPlaces) ? window.__roviqPlaces : [];
    if (!map || !window.L || !places.length) return;

    const points = places
      .map((p) => [Number(p.lat), Number(p.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    const user = coordsFromScope();
    if (user) points.push(user);
    if (!points.length) return;

    const signature = points.map((p) => p.join(',')).join('|');
    if (signature === lastSignature) return;
    lastSignature = signature;

    try {
      if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        const bounds = window.L.latLngBounds(points);
        map.fitBounds(bounds, {
          paddingTopLeft: [24, 24],
          paddingBottomRight: [24, 24],
          maxZoom: 12,
          animate: false
        });
      }
      setTimeout(() => map.invalidateSize(), 50);
    } catch (err) {
      console.error('ROVIQ map fit failed', err);
    }
  }

  window.addEventListener('roviq:map-ready', () => setTimeout(fit, 150));
  window.addEventListener('roviq:location-updated', () => setTimeout(fit, 150));
  document.addEventListener('DOMContentLoaded', () => {
    const timer = setInterval(fit, 500);
    setTimeout(() => clearInterval(timer), 10000);
  });
})();