(() => {
  'use strict';

  const LOCATION_KEY = 'roviq_location_scope';
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null'); }
    catch { return null; }
  })();
  const scope = saved || { mode: 'auto', label: 'Near me' };

  window.__ROVIQ_LOCATION_SCOPE = scope;

  function emitLocationUpdate() {
    window.dispatchEvent(new CustomEvent('roviq:location-updated', { detail: { ...scope } }));
  }

  function saveScope(next) {
    Object.assign(scope, next);
    localStorage.setItem(LOCATION_KEY, JSON.stringify(scope));
    window.__ROVIQ_LOCATION_SCOPE = scope;
    updateBadge();
    emitLocationUpdate();
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

  function addressContext(address = {}) {
    const city = address.city || address.town || address.village || address.municipality || address.county || '';
    return {
      country: address.country || '',
      country_code: String(address.country_code || '').toUpperCase(),
      region: address.state || address.region || '',
      city,
      locality: address.suburb || address.neighbourhood || address.city_district || '',
      postal_code: address.postcode || ''
    };
  }

  async function geocodeLocation(query) {
    if (!query) return null;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', query);
    try {
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const data = await response.json();
      const item = data?.[0];
      if (!item) return null;
      const ctx = addressContext(item.address || {});
      return {
        lat: Number(item.lat),
        lng: Number(item.lon),
        label: item.display_name || query,
        ...ctx
      };
    } catch {
      return null;
    }
  }

  async function reverseGeocode(lat, lng) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lng);
    try {
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const data = await response.json();
      const ctx = addressContext(data.address || {});
      const label = [ctx.city, ctx.region].filter(Boolean).join(', ') || data.display_name || 'Near me';
      return { label, ...ctx };
    } catch {
      return null;
    }
  }

  window.__ROVIQ_GEOCODE_LOCATION = geocodeLocation;

  async function chooseLocation() {
    const query = window.prompt(
      'Enter a city or region (for example: Seattle, WA or Kyiv, Ukraine):',
      scope.mode === 'manual' ? (scope.label || '') : ''
    );
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
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const resolved = await reverseGeocode(lat, lng);
      saveScope({
        mode: 'auto',
        lat,
        lng,
        label: resolved?.label || 'Near me',
        city: resolved?.city || '',
        region: resolved?.region || '',
        country: resolved?.country || '',
        country_code: resolved?.country_code || '',
        locality: resolved?.locality || '',
        postal_code: resolved?.postal_code || ''
      });
      location.reload();
    }, () => {
      window.alert('Location permission was not granted. You can choose a city instead.');
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }

  if (scope.mode !== 'manual' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const resolved = await reverseGeocode(lat, lng);
      saveScope({
        mode: 'auto',
        lat,
        lng,
        label: resolved?.label || scope.label || 'Near me',
        city: resolved?.city || scope.city || '',
        region: resolved?.region || scope.region || '',
        country: resolved?.country || scope.country || '',
        country_code: resolved?.country_code || scope.country_code || '',
        locality: resolved?.locality || scope.locality || '',
        postal_code: resolved?.postal_code || scope.postal_code || ''
      });
    }, () => {}, { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
  }

  const originalFetch = window.fetch.bind(window);
  window.__ROVIQ_ORIGINAL_FETCH = originalFetch;
  window.fetch = async function roviqFetch(input, init) {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return originalFetch(input, init);

    let url;
    try { url = new URL(raw, location.origin); }
    catch { return originalFetch(input, init); }

    if (url.origin === location.origin && url.pathname === '/api/places') {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        if (!url.searchParams.has('lat') && !url.searchParams.has('city') && !url.searchParams.has('market')) {
          const coords = currentCoords();
          if (coords) {
            url.searchParams.set('lat', coords.lat);
            url.searchParams.set('lng', coords.lng);
            if (!url.searchParams.has('radius_km')) url.searchParams.set('radius_km', '100');
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
          init = {
            ...init,
            body: JSON.stringify({
              ...body,
              country_code: body.country_code || scope.country_code || '',
              country: body.country || scope.country || '',
              region: body.region || scope.region || '',
              city: body.city || scope.city || '',
              locality: body.locality || scope.locality || '',
              postal_code: body.postal_code || scope.postal_code || '',
              timezone: body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
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
