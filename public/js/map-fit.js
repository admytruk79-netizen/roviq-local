(() => {
  'use strict';

  let lastSignature = '';
  let locateButton = null;
  let liveUserMarker = null;
  const AREA_ZOOM = 11;
  const PLACE_ZOOM = 13;
  const LOCATE_ZOOM = 15;

  function coordsFromScope() {
    const s = window.__ROVIQ_LOCATION_SCOPE || {};
    const lat = Number(s.lat), lng = Number(s.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  function fit() {
    const map = window.__ROVIQ_MAP_INSTANCE;
    const places = Array.isArray(window.__roviqPlaces) ? window.__roviqPlaces : [];
    if (!map || !window.L) return;

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
        map.setView(points[0], AREA_ZOOM, { animate: false });
      } else {
        const bounds = window.L.latLngBounds(points);
        map.fitBounds(bounds, {
          paddingTopLeft: [28, 90],
          paddingBottomRight: [28, 180],
          maxZoom: AREA_ZOOM,
          animate: false
        });
      }
      setTimeout(() => map.invalidateSize(), 50);
    } catch (err) {
      console.error('ROVIQ map fit failed', err);
    }
  }

  function ensureLocateStyle() {
    if (document.getElementById('roviq-locate-style')) return;
    const style = document.createElement('style');
    style.id = 'roviq-locate-style';
    style.textContent = `
      .roviq-locate-control{position:absolute;z-index:820;right:16px;bottom:156px;width:46px;height:46px;border-radius:50%;border:1px solid rgba(201,162,39,.35);background:rgba(7,25,45,.96);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.34);font-size:23px;line-height:1;cursor:pointer;backdrop-filter:blur(8px)}
      .roviq-locate-control:hover,.roviq-locate-control:focus-visible{background:#102f57;outline:2px solid rgba(33,208,122,.65);outline-offset:2px}
      .roviq-locate-control.locating{color:#21d07a;animation:roviqLocatePulse 1s ease-in-out infinite alternate}
      @keyframes roviqLocatePulse{from{transform:scale(1)}to{transform:scale(1.08)}}
      @media(max-width:759px){.roviq-locate-control{right:14px;bottom:150px;width:44px;height:44px;font-size:22px}}
      @media(prefers-reduced-motion:reduce){.roviq-locate-control.locating{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function placeLiveUserMarker(lat, lng) {
    const map = window.__ROVIQ_MAP_INSTANCE;
    if (!map || !window.L) return;
    try {
      if (liveUserMarker) liveUserMarker.remove();
      liveUserMarker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: '',
          html: '<div class="user-dot"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map);
    } catch (err) {
      console.error('ROVIQ user marker failed', err);
    }
  }

  function locateMe() {
    const map = window.__ROVIQ_MAP_INSTANCE;
    if (!map) return;
    if (!navigator.geolocation) {
      window.alert('Location is not available on this device.');
      return;
    }

    locateButton?.classList.add('locating');
    locateButton?.setAttribute('aria-label', 'Locating you');

    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      placeLiveUserMarker(lat, lng);
      map.setView([lat, lng], LOCATE_ZOOM, { animate: true });
      locateButton?.classList.remove('locating');
      locateButton?.setAttribute('aria-label', 'Center map on my location');
    }, () => {
      locateButton?.classList.remove('locating');
      locateButton?.setAttribute('aria-label', 'Center map on my location');
      window.alert('ROVIQ Local could not access your current location. Check location permission and try again.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }

  function addLocateControl() {
    const mapEl = document.getElementById('map');
    if (!mapEl || mapEl.querySelector('.roviq-locate-control')) return;
    ensureLocateStyle();
    locateButton = document.createElement('button');
    locateButton.type = 'button';
    locateButton.className = 'roviq-locate-control';
    locateButton.setAttribute('aria-label', 'Center map on my location');
    locateButton.setAttribute('title', 'My location');
    locateButton.innerHTML = '⌖';
    locateButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      locateMe();
    });
    mapEl.appendChild(locateButton);
  }

  window.ROVIQMapContext = {
    area() { lastSignature = ''; fit(); },
    place(lat, lng) {
      const map = window.__ROVIQ_MAP_INSTANCE;
      if (!map) return;
      const a = Number(lat), b = Number(lng);
      if (Number.isFinite(a) && Number.isFinite(b)) map.setView([a, b], PLACE_ZOOM, { animate: true });
    },
    locate: locateMe
  };

  window.addEventListener('roviq:map-ready', () => {
    setTimeout(fit, 150);
    setTimeout(addLocateControl, 180);
  });
  window.addEventListener('roviq:location-updated', () => setTimeout(fit, 150));
  window.addEventListener('roviq:places-loaded', () => setTimeout(fit, 80));
  document.addEventListener('DOMContentLoaded', () => {
    const timer = setInterval(() => {
      fit();
      addLocateControl();
    }, 500);
    setTimeout(() => clearInterval(timer), 10000);
  });
})();