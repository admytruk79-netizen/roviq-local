(() => {
  'use strict';

  const LOCATION_KEY = 'roviq_location_scope';
  const DEFAULT_CENTER = { lng: -122.6765, lat: 45.5231, label: 'Portland, OR', city: 'Portland', region: 'Oregon', country: 'United States', country_code: 'US' };
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null'); } catch { return null; }
  })();
  const scope = saved || { mode: 'auto', ...DEFAULT_CENTER };
  let activeMap = null;
  let mapboxToken = null;

  window.__ROVIQ_LOCATION_SCOPE = scope;

  function saveScope(next) {
    Object.assign(scope, next);
    localStorage.setItem(LOCATION_KEY, JSON.stringify(scope));
    window.__ROVIQ_LOCATION_SCOPE = scope;
  }

  function currentCoords() {
    return Number.isFinite(Number(scope.lat)) && Number.isFinite(Number(scope.lng))
      ? { lat: Number(scope.lat), lng: Number(scope.lng) }
      : null;
  }

  function updateBadge() {
    const badge = document.getElementById('loc-badge');
    if (!badge) return;
    badge.textContent = `📍 ${scope.label || (scope.mode === 'auto' ? 'Near me' : 'Choose location')}`;
    badge.setAttribute('title', 'Change ROVIQ Local location');
  }

  async function loadMapboxToken() {
    if (mapboxToken) return mapboxToken;
    try {
      const res = await window.__ROVIQ_ORIGINAL_FETCH('/api/config');
      const data = await res.json();
      mapboxToken = data.mapboxToken || null;
    } catch {}
    return mapboxToken;
  }

  function contextFromFeature(feature) {
    if (!feature) return {};
    const all = [feature, ...(feature.context || [])];
    const find = (prefix) => all.find((x) => String(x.id || '').startsWith(prefix));
    const country = find('country.');
    const region = find('region.');
    const place = find('place.');
    const locality = find('locality.');
    const postcode = find('postcode.');
    return {
      country: country?.text || '',
      country_code: String(country?.properties?.short_code || '').toUpperCase(),
      region: region?.text || '',
      city: place?.text || feature.place_type?.includes('place') ? feature.text : '',
      locality: locality?.text || '',
      postal_code: postcode?.text || '',
    };
  }

  async function geocodeLocation(query) {
    const token = await loadMapboxToken();
    if (!token || !query) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&types=place,region,country,locality&limit=1`;
    try {
      const res = await window.__ROVIQ_ORIGINAL_FETCH(url);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;
      const ctx = contextFromFeature(feature);
      return {
        lng: Number(feature.center[0]),
        lat: Number(feature.center[1]),
        label: feature.place_name || feature.text,
        ...ctx,
      };
    } catch {
      return null;
    }
  }

  async function chooseLocation() {
    const query = window.prompt('Enter a city or region (for example: Seattle, WA or Kyiv, Ukraine):', scope.mode === 'manual' ? (scope.label || '') : '');
    if (!query) return;
    const result = await geocodeLocation(query.trim());
    if (!result) {
      window.alert('ROVIQ Local could not find that location. Try city + state/region + country.');
      return;
    }
    saveScope({ mode: 'manual', ...result });
    location.reload();
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      window.alert('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      saveScope({
        mode: 'auto',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: 'Near me',
        city: '', region: '', country: '', country_code: '', locality: '', postal_code: ''
      });
      location.reload();
    }, () => {
      window.alert('Location permission was not granted. You can choose a city instead.');
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }

  // Keep a recent approximate foreground position. No background tracking.
  if (scope.mode !== 'manual' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      saveScope({ mode: 'auto', lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Near me' });
      if (activeMap) activeMap.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12.2, duration: 700 });
    }, () => {}, { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
  }

  // Patch Mapbox construction so the original app no longer hard-locks the map to Portland.
  if (window.mapboxgl?.Map) {
    const OriginalMap = window.mapboxgl.Map;
    window.mapboxgl.Map = class RoviqGlobalMap extends OriginalMap {
      constructor(options = {}) {
        const coords = currentCoords();
        if (coords) options = { ...options, center: [coords.lng, coords.lat] };
        super(options);
        activeMap = this;
      }
    };
  }

  // Scope existing API calls globally without breaking the v1 app code.
  const originalFetch = window.fetch.bind(window);
  window.__ROVIQ_ORIGINAL_FETCH = originalFetch;
  window.fetch = async function roviqFetch(input, init) {
    let raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return originalFetch(input, init);

    let url;
    try { url = new URL(raw, location.origin); } catch { return originalFetch(input, init); }

    // Remove the old Portland-only geocoder bias. Bias toward the selected/current location instead.
    if (url.hostname === 'api.mapbox.com' && url.pathname.includes('/geocoding/')) {
      const coords = currentCoords();
      if (coords) url.searchParams.set('proximity', `${coords.lng},${coords.lat}`);
      else url.searchParams.delete('proximity');
      const response = await originalFetch(url.toString(), init);
      try {
        const clone = response.clone();
        const data = await clone.json();
        const feature = data.features?.[0];
        if (feature) window.__ROVIQ_LAST_GEOCODE_CONTEXT = contextFromFeature(feature);
      } catch {}
      return response;
    }

    if (url.origin === location.origin && url.pathname === '/api/places') {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        if (!url.searchParams.has('lat') && !url.searchParams.has('city') && !url.searchParams.has('market')) {
          const coords = currentCoords();
          if (coords) {
            url.searchParams.set('lat', coords.lat);
            url.searchParams.set('lng', coords.lng);
            url.searchParams.set('radius_km', '50');
          } else if (scope.city) {
            url.searchParams.set('city', scope.city);
            if (scope.country_code) url.searchParams.set('country_code', scope.country_code);
          }
        }
        return originalFetch(url.toString(), init);
      }

      if (method === 'POST' && typeof init?.body === 'string') {
        try {
          const body = JSON.parse(init.body);
          const ctx = window.__ROVIQ_LAST_GEOCODE_CONTEXT || {};
          init = {
            ...init,
            body: JSON.stringify({
              ...body,
              country_code: body.country_code || ctx.country_code || scope.country_code || '',
              country: body.country || ctx.country || scope.country || '',
              region: body.region || ctx.region || scope.region || '',
              city: body.city || ctx.city || scope.city || '',
              locality: body.locality || ctx.locality || scope.locality || '',
              postal_code: body.postal_code || ctx.postal_code || scope.postal_code || '',
              timezone: body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            })
          };
        } catch {}
      }
    }

    return originalFetch(url.toString(), init);
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateBadge();
    document.getElementById('loc-badge')?.addEventListener('click', chooseLocation);
    document.getElementById('change-location')?.addEventListener('click', chooseLocation);
    document.getElementById('near-me')?.addEventListener('click', useMyLocation);
  });
})();
