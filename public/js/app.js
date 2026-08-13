(() => {
  'use strict';

  const PORTLAND_CENTER = [-122.6765, 45.5231];
  const CATEGORY_EMOJI = { food: '🌮', coffee: '☕', breweries: '🍺', nature: '💧', culture: '📖' };

  const state = {
    category: 'all',
    view: 'map',
    places: [],
    map: null,
    markers: [],
    mapboxToken: null,
    userLocation: null,
    activePlace: null,
    saved: new Set(JSON.parse(localStorage.getItem('roviq_saved') || '[]')),
  };

  const $ = (sel) => document.querySelector(sel);

  // ---------- Welcome screen ----------
  function initWelcome() {
    const welcome = $('#welcome');
    if (localStorage.getItem('roviq_seen_welcome')) {
      welcome.hidden = true;
    } else {
      welcome.hidden = false;
    }
    $('#welcome-continue').addEventListener('click', () => {
      localStorage.setItem('roviq_seen_welcome', '1');
      welcome.hidden = true;
    });
  }

  // ---------- Config / Mapbox ----------
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      state.mapboxToken = data.mapboxToken;
    } catch (err) {
      console.error('Failed to load config', err);
    }
  }

  function showMapUnavailable(message) {
    $('#map').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:32px;text-align:center;font-family:Inter,sans-serif;color:#5B5A52;">' +
      message +
      '</div>';
  }

  function initMap() {
    if (!state.mapboxToken) {
      showMapUnavailable('Map unavailable: no Mapbox token configured. Set the MAPBOX_TOKEN environment variable in the Cloudflare Pages project.');
      return;
    }
    if (typeof mapboxgl === 'undefined') {
      showMapUnavailable('Map unavailable: Mapbox GL JS failed to load. The list view still works below.');
      return;
    }

    mapboxgl.accessToken = state.mapboxToken;
    state.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v11',
      center: PORTLAND_CENTER,
      zoom: 12.2,
      attributionControl: true,
    });
    state.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    state.map.on('load', () => {
      // Muted, driver-first custom look layered on top of light-v11 at
      // runtime (no separate Mapbox Studio style needed): soft moss-green
      // parcels/parks, a blue-grey Willamette, and a thinner street grid.
      const layers = state.map.getStyle().layers || [];
      layers.forEach((layer) => {
        try {
          if (layer.type === 'fill' && /water/.test(layer.id)) {
            state.map.setPaintProperty(layer.id, 'fill-color', '#C7D2D6');
          } else if (layer.type === 'fill' && /landuse|landcover|park/.test(layer.id)) {
            state.map.setPaintProperty(layer.id, 'fill-color', '#B7C9AE');
            state.map.setPaintProperty(layer.id, 'fill-opacity', 0.45);
          } else if (layer.type === 'line' && /road|street|bridge/.test(layer.id)) {
            const current = state.map.getPaintProperty(layer.id, 'line-width');
            if (typeof current === 'number') {
              state.map.setPaintProperty(layer.id, 'line-width', Math.max(0.4, current * 0.6));
            }
            state.map.setPaintProperty(layer.id, 'line-color', '#D8D2C0');
          }
        } catch {
          // Some layer/property combos don't exist on every style version -- skip silently.
        }
      });
      renderMarkers();
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }

  // ---------- Data ----------
  async function loadPlaces() {
    const url = new URL('/api/places', location.origin);
    url.searchParams.set('status', 'approved');
    if (state.category !== 'all') url.searchParams.set('category', state.category);
    const res = await fetch(url);
    const data = res.ok ? await res.json() : null;
    state.places = (data && data.success) ? data.places : [];
    renderMarkers();
    renderList();
  }

  function distanceLabel(place) {
    if (!state.userLocation) return '';
    const km = haversineKm(state.userLocation, { lat: place.lat, lng: place.lng });
    const miles = km * 0.621371;
    return `${miles < 0.1 ? '<0.1' : miles.toFixed(1)} mi away`;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ---------- Hours / open-closed ----------
  // Best-effort parser for "Mon-Fri 7am-5pm, Sat-Sun 8am-3pm" style strings.
  // Falls back to showing the raw text with no open/closed color if it can't parse.
  const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function parseHourToken(tok) {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(tok.trim());
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const suffix = m[3] ? m[3].toLowerCase() : null;
    if (suffix === 'pm' && h !== 12) h += 12;
    if (suffix === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }
  function openStatus(hoursStr, now = new Date()) {
    if (!hoursStr || typeof hoursStr !== 'string') return null;
    const day = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const segments = hoursStr.split(',').map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      const parts = seg.split(/\s+/);
      if (parts.length < 2) continue;
      const dayPart = parts[0];
      const timePart = parts.slice(1).join(' ');
      const [startTime, endTime] = timePart.split('-').map((s) => s && s.trim());
      const start = startTime && parseHourToken(startTime);
      const end = endTime && parseHourToken(endTime);
      if (start == null || end == null) continue;

      let dayMatches = false;
      const rangeMatch = /^([a-z]{3})-([a-z]{3})$/i.exec(dayPart);
      if (rangeMatch) {
        const startDay = DAY_NAMES.indexOf(rangeMatch[1].toLowerCase());
        const endDay = DAY_NAMES.indexOf(rangeMatch[2].toLowerCase());
        if (startDay !== -1 && endDay !== -1) {
          dayMatches = startDay <= endDay
            ? day >= startDay && day <= endDay
            : day >= startDay || day <= endDay;
        }
      } else {
        dayMatches = DAY_NAMES.indexOf(dayPart.slice(0, 3).toLowerCase()) === day;
      }
      if (!dayMatches) continue;
      return nowMin >= start && nowMin < end;
    }
    return null;
  }

  // ---------- Markers (map) ----------
  function renderMarkers() {
    if (!state.map) return;
    state.markers.forEach((m) => m.remove());
    state.markers = [];

    state.places.forEach((place) => {
      const el = document.createElement('div');
      el.className = 'marker-pin ' + (place.is_drivers_pick ? 'pick' : 'standard');
      el.addEventListener('click', () => openSheet(place));
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(state.map);
      state.markers.push(marker);
    });
  }

  // ---------- List view ----------
  function renderList() {
    const list = $('#list-view');
    if (!state.places.length) {
      list.innerHTML = '<div style="text-align:center;color:var(--ink-soft);padding:40px 16px;font-size:13px;">No spots in this category yet.</div>';
      return;
    }
    list.innerHTML = state.places.map((place) => `
      <button class="place-card" data-id="${place.id}" type="button">
        <div class="place-photo" style="${place.photo_url ? `background-image:url('${escapeAttr(place.photo_url)}')` : ''}">
          ${place.photo_url ? '' : (CATEGORY_EMOJI[place.category] || '📍')}
        </div>
        <div class="place-info">
          <div class="place-name">${place.is_drivers_pick ? '<span class="pick-flag">★</span> ' : ''}${escapeHtml(place.name)}</div>
          <div class="place-meta mono">${escapeHtml(place.category)}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div>
          <div class="place-desc">${escapeHtml(place.description || '')}</div>
        </div>
      </button>
    `).join('');

    list.querySelectorAll('.place-card').forEach((card) => {
      card.addEventListener('click', () => {
        const place = state.places.find((p) => String(p.id) === card.dataset.id);
        if (place) openSheet(place);
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/'/g, '&#39;'); }

  // ---------- Bottom sheet ----------
  function openSheet(place) {
    state.activePlace = place;
    $('#sheet-photo').style.backgroundImage = place.photo_url ? `url('${place.photo_url}')` : 'none';
    $('#sheet-tag').textContent = `${CATEGORY_EMOJI[place.category] || ''} ${place.category}`;

    const pickBadge = $('#sheet-pick-badge');
    pickBadge.hidden = !place.is_drivers_pick;

    $('#sheet-name').textContent = place.name;
    $('#sheet-status').textContent = distanceLabel(place) || (place.address || '');

    const hoursEl = $('#sheet-hours');
    if (place.hours) {
      hoursEl.hidden = false;
      const status = openStatus(place.hours);
      hoursEl.className = 'sheet-hours' + (status === true ? ' open' : status === false ? ' closed' : '');
      const prefix = status === true ? 'Open now · ' : status === false ? 'Closed · ' : '';
      hoursEl.textContent = prefix + place.hours;
    } else {
      hoursEl.hidden = true;
    }

    $('#sheet-desc').textContent = place.description || '';
    updateSaveButton();

    $('#sheet-backdrop').classList.add('open');
    $('#sheet').classList.add('open');

    fetch(`/api/places/${place.id}/view`, { method: 'POST' }).catch(() => {});
  }

  function closeSheet() {
    $('#sheet-backdrop').classList.remove('open');
    $('#sheet').classList.remove('open');
    state.activePlace = null;
  }

  // ---------- Directions choice sheet ----------
  function openDirectionsSheet() {
    const place = state.activePlace;
    if (!place) return;
    const dest = `${place.lat},${place.lng}`;
    const label = encodeURIComponent(place.name);
    $('#dir-google').href = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    $('#dir-apple').href = `https://maps.apple.com/?daddr=${dest}&q=${label}`;
    $('#dir-waze').href = `https://waze.com/ul?ll=${dest}&navigate=yes`;
    $('#directions-backdrop').classList.add('open');
    $('#directions-sheet').classList.add('open');
  }

  function closeDirectionsSheet() {
    $('#directions-backdrop').classList.remove('open');
    $('#directions-sheet').classList.remove('open');
  }

  function updateSaveButton() {
    const btn = $('#sheet-save');
    if (!state.activePlace) return;
    const isSaved = state.saved.has(state.activePlace.id);
    btn.textContent = isSaved ? '★ Saved' : '☆ Save';
  }

  function toggleSave() {
    if (!state.activePlace) return;
    const id = state.activePlace.id;
    if (state.saved.has(id)) state.saved.delete(id);
    else state.saved.add(id);
    localStorage.setItem('roviq_saved', JSON.stringify([...state.saved]));
    updateSaveButton();
  }

  // ---------- View toggle ----------
  function setView(view) {
    state.view = view;
    $('#toggle-map').classList.toggle('active', view === 'map');
    $('#toggle-list').classList.toggle('active', view === 'list');
    $('#map').style.display = view === 'map' ? '' : 'none';
    $('#list-view').hidden = view !== 'list';
  }

  // ---------- Category chips ----------
  function initChips() {
    $('#chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.category = chip.dataset.category;
      loadPlaces();
    });
  }

  // ---------- Suggest-a-spot panel ----------
  function initSuggestPanel() {
    const panel = $('#suggest-panel');
    $('#open-suggest').addEventListener('click', () => { panel.hidden = false; });
    $('#close-suggest').addEventListener('click', () => { panel.hidden = true; });

    let selectedCategory = null;
    $('#f-category-pills').addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      document.querySelectorAll('#f-category-pills .cat-pill').forEach((p) => p.classList.remove('sel'));
      pill.classList.add('sel');
      selectedCategory = pill.dataset.value;
    });

    $('#suggest-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#form-msg');
      msg.textContent = '';
      msg.className = 'form-msg';

      const name = $('#f-name').value.trim();
      const address = $('#f-address').value.trim();
      if (!selectedCategory) {
        msg.textContent = 'Pick a category.';
        msg.classList.add('error');
        return;
      }

      msg.textContent = 'Locating address…';
      const coords = await geocode(address);
      if (!coords) {
        msg.textContent = "Couldn't find that location — try a more specific address.";
        msg.classList.add('error');
        return;
      }

      const payload = {
        name,
        category: selectedCategory,
        description: $('#f-desc').value.trim(),
        address,
        lat: coords.lat,
        lng: coords.lng,
        photo_url: $('#f-photo').value.trim() || undefined,
        submitted_by: $('#f-driver').value.trim() || undefined,
      };

      msg.textContent = 'Submitting…';
      try {
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('submit failed');
        msg.textContent = 'Submitted! It’s in the curator queue now.';
        msg.classList.add('ok');
        e.target.reset();
        document.querySelectorAll('#f-category-pills .cat-pill').forEach((p) => p.classList.remove('sel'));
        selectedCategory = null;
        setTimeout(() => { panel.hidden = true; msg.textContent = ''; }, 1400);
      } catch (err) {
        msg.textContent = 'Something went wrong — try again.';
        msg.classList.add('error');
      }
    });
  }

  async function geocode(query) {
    if (!state.mapboxToken || !query) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${state.mapboxToken}&proximity=${PORTLAND_CENTER[0]},${PORTLAND_CENTER[1]}&limit=1`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features && data.features[0];
      if (!feature) return null;
      return { lng: feature.center[0], lat: feature.center[1] };
    } catch {
      return null;
    }
  }

  // ---------- Wire up ----------
  function init() {
    initWelcome();
    initChips();
    initSuggestPanel();

    $('#toggle-map').addEventListener('click', () => setView('map'));
    $('#toggle-list').addEventListener('click', () => setView('list'));
    $('#sheet-backdrop').addEventListener('click', closeSheet);
    $('#sheet-save').addEventListener('click', toggleSave);
    $('#sheet-directions').addEventListener('click', openDirectionsSheet);
    $('#directions-backdrop').addEventListener('click', closeDirectionsSheet);

    loadConfig().then(() => {
      try {
        initMap();
      } catch (err) {
        console.error('Map init failed', err);
        showMapUnavailable('Map unavailable right now. The list view still works below.');
      }
      loadPlaces();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
