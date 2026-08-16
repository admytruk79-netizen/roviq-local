(() => {
'use strict';

const $ = (s) => document.querySelector(s);
let map;
let markers = [];
let userMarker;
let places = [];
let userLocation = null;
let activeFilter = 'all';
let activeView = 'map';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const CATEGORY_ICON = {
  food: '🍴',
  coffee: '☕',
  nature: '⌁',
  culture: '◫',
  breweries: '◉'
};

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function isPick(place) {
  return place?.trust_level === 'roviq' || place?.trust_level === 'driver' || Number(place?.is_drivers_pick) === 1;
}

function trust(place) {
  if (place.network_type) return ['network', 'ROVIQ NETWORK'];
  if (place.trust_level === 'roviq') return ['roviq', 'ROVIQ PICK'];
  if (Number(place.is_drivers_pick) === 1 || place.trust_level === 'driver') return ['driver', 'DRIVER’S PICK'];
  return ['standard', 'CURATED'];
}

function why(place) {
  return place.editorial_reason || place.why_stop || place.description ||
    'A locally curated stop worth knowing about while you’re on the road.';
}

function dist(place) {
  if (!userLocation) return '';
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const R = 3958.8;
  const rad = (x) => x * Math.PI / 180;
  const dLat = rad(lat - userLocation.lat);
  const dLng = rad(lng - userLocation.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(userLocation.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return `${(2 * R * Math.asin(Math.sqrt(a))).toFixed(1)} mi`;
}

function locationLabel() {
  const scope = window.__ROVIQ_LOCATION_SCOPE || {};
  const bits = [scope.city, scope.region].filter(Boolean);
  return bits.length ? bits.join(', ') : (scope.label && scope.label !== 'Near me' ? scope.label : 'Near you');
}

function shortAddress(place) {
  const source = String(place.locality || place.address || '').trim();
  if (!source) return '';
  return source.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 2).join(', ');
}

function openLabel(place) {
  return place.hours || '';
}

function applyAutomaticTheme() {
  const saved = localStorage.getItem('roviq_theme');
  const hour = new Date().getHours();
  const mode = saved === 'day' || saved === 'night' ? saved : (hour >= 7 && hour < 19 ? 'day' : 'night');
  document.documentElement.dataset.theme = mode;
  document.body?.classList.toggle('theme-day', mode === 'day');
  document.body?.classList.toggle('theme-night', mode === 'night');
}

function injectHeader() {
  const row = $('.brandrow');
  if (!row) return;

  if (!document.querySelector('.discovery-copy')) {
    const copy = document.createElement('div');
    copy.className = 'discovery-copy';
    copy.innerHTML = '<h1>Worth stopping for near you</h1><div class="location-line"><strong id="dynamic-location">Finding your location…</strong><button id="redesign-change-location" type="button">Change location</button></div>';
    row.insertAdjacentElement('afterend', copy);
    $('#redesign-change-location')?.addEventListener('click', () => $('#change-location')?.click());
  }

  const actions = $('.location-actions');
  if (actions) actions.style.display = 'none';

  const chips = $('#chips');
  if (chips) {
    chips.innerHTML = [
      '<button class="chip active" data-category="all" type="button">All</button>',
      '<button class="chip" data-category="picks" type="button">ROVIQ Picks</button>',
      '<button class="chip" data-category="food" type="button">Food</button>',
      '<button class="chip" data-category="coffee" type="button">Coffee</button>',
      '<button class="chip" data-category="nature" type="button">Nature</button>',
      '<button class="chip" data-category="culture" type="button">Culture</button>',
      '<button class="chip" data-category="breweries" type="button">Breweries</button>'
    ].join('');
  }
}

function injectNav() {
  if (document.querySelector('.bottom-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Primary');
  nav.innerHTML = '<button class="active" data-dest="explore"><span>⌖</span>Explore</button><button data-dest="picks"><span>◆</span>Picks</button><button data-dest="saved"><span>☆</span>Saved</button><button data-dest="suggest"><span>＋</span>Suggest</button><button data-dest="profile"><span>○</span>Profile</button>';
  document.body.appendChild(nav);

  nav.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    nav.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    button.classList.add('active');

    if (button.dataset.dest === 'suggest') {
      $('#open-suggest')?.click();
      return;
    }
    if (button.dataset.dest === 'picks') {
      setFilter('picks');
      setView('list');
      return;
    }
    if (button.dataset.dest === 'saved') {
      setView('list');
      renderList(places.filter(isSaved));
      return;
    }
    if (button.dataset.dest === 'profile') {
      alert('Profile and contributor identity are prepared as a future account surface.');
      return;
    }

    setFilter('all');
    setView('map');
  });
}

function mapFallback() {
  const el = $('#map');
  if (!el) return;
  el.innerHTML = '<div class="map-fallback"><div class="map-fallback-card"><h2>Map is temporarily unavailable</h2><p>Your location still works. Browse nearby ROVIQ places in List view.</p><button id="fallback-list">Open List</button></div></div>';
  $('#fallback-list')?.addEventListener('click', () => setView('list'));
}

function initLeaflet() {
  if (!window.L) {
    mapFallback();
    return;
  }
  const el = $('#map');
  if (!el) return;

  el.innerHTML = '';
  const scope = window.__ROVIQ_LOCATION_SCOPE || {};
  const center = Number.isFinite(+scope.lat) && Number.isFinite(+scope.lng)
    ? [+scope.lat, +scope.lng]
    : [45.5231, -122.6765];

  try {
    map = L.map(el, { zoomControl: false }).setView(center, 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 120);
  } catch (err) {
    console.error('Leaflet map initialization failed', err);
    mapFallback();
  }
}

function markerIcon(type) {
  return L.divIcon({
    className: '',
    html: `<div class="roviq-marker ${type}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

function visiblePlaces() {
  if (activeFilter === 'all') return places;
  if (activeFilter === 'picks') return places.filter(isPick);
  return places.filter((place) => normalizeCategory(place.category) === activeFilter);
}

function renderMarkers(items = visiblePlaces()) {
  if (!map || !window.L) return;
  markers.forEach((m) => m.remove());
  markers = [];

  items.forEach((place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const [type] = trust(place);
    const marker = L.marker([lat, lng], { icon: markerIcon(type) })
      .addTo(map)
      .on('click', () => preview(place));
    markers.push(marker);
  });
}

function preview(place) {
  document.querySelector('.place-preview')?.remove();
  const [type, label] = trust(place);
  const card = document.createElement('div');
  card.className = 'place-preview';
  card.innerHTML = `<span class="trust-pill ${type}">${label}</span><h3>${esc(place.name)}</h3><div class="meta">${esc(place.category || 'Place')}${dist(place) ? ' · ' + dist(place) : ''}${openLabel(place) ? ' · ' + esc(openLabel(place)) : ''}</div><p><strong>Why stop here?</strong> ${esc(why(place))}</p><div class="preview-actions"><button data-save>${isSaved(place) ? 'Saved' : 'Save'}</button><button data-view>View place</button><button class="primary" data-dir>Directions</button></div>`;
  $('#map')?.appendChild(card);

  card.querySelector('[data-view]')?.addEventListener('click', () => {
    setView('list');
    requestAnimationFrame(() => {
      const row = [...document.querySelectorAll('.place-card')].find((x) => x.dataset.id === String(place.id));
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  card.querySelector('[data-dir]')?.addEventListener('click', () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank'));
  card.querySelector('[data-save]')?.addEventListener('click', () => savePlace(place, card.querySelector('[data-save]')));
}

function savePlace(place, button) {
  let saved;
  try { saved = new Set(JSON.parse(localStorage.getItem('roviq_saved') || '[]').map(String)); }
  catch { saved = new Set(); }

  const id = String(place.id);
  if (saved.has(id)) {
    saved.delete(id);
    if (button) button.textContent = 'Save';
  } else {
    saved.add(id);
    if (button) button.textContent = 'Saved';
  }
  localStorage.setItem('roviq_saved', JSON.stringify([...saved]));
}

function isSaved(place) {
  try {
    return new Set(JSON.parse(localStorage.getItem('roviq_saved') || '[]').map(String)).has(String(place.id));
  } catch {
    return false;
  }
}

function renderList(items = visiblePlaces()) {
  const list = $('#list-view');
  if (!list) return;

  if (!items.length) {
    const label = activeFilter === 'all' ? 'nearby' : activeFilter === 'picks' ? 'ROVIQ Picks' : activeFilter;
    list.innerHTML = `<div class="empty-state"><strong>No ${esc(label)} stops yet.</strong><span>Try another category or suggest a place worth knowing about.</span></div>`;
    return;
  }

  list.innerHTML = items.map((place) => {
    const [type, label] = trust(place);
    const category = normalizeCategory(place.category);
    const photo = place.photo_url ? `style="background-image:url('${esc(place.photo_url)}')"` : '';
    const fallback = CATEGORY_ICON[category] || '•';
    const meta = [dist(place), openLabel(place), category].filter(Boolean).join(' · ');
    const addr = shortAddress(place);
    return `<article class="place-card" data-id="${esc(place.id)}">
      <div class="place-photo${place.photo_url ? ' has-photo' : ''}" ${photo}>${place.photo_url ? '' : esc(fallback)}</div>
      <div class="place-info">
        <span class="trust-pill ${type}">${label}</span>
        <div class="place-name">${esc(place.name)}</div>
        <div class="why-stop">${esc(why(place))}</div>
        <div class="place-meta">${esc(meta)}</div>
        ${addr ? `<span class="place-address" title="${esc(place.address || addr)}">${esc(addr)}</span>` : ''}
      </div>
      <div class="card-actions">
        <button data-save>${isSaved(place) ? 'Saved' : 'Save'}</button>
        <button data-view>View place</button>
        <button data-dir>Directions</button>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('.place-card').forEach((card) => {
    const place = items.find((x) => String(x.id) === card.dataset.id);
    if (!place) return;
    card.querySelector('[data-view]')?.addEventListener('click', () => {
      setView('map');
      preview(place);
      if (map) map.setView([Number(place.lat), Number(place.lng)], Math.max(map.getZoom(), 14));
    });
    card.querySelector('[data-dir]')?.addEventListener('click', () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank'));
    card.querySelector('[data-save]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      savePlace(place, e.currentTarget);
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      setView('map');
      preview(place);
      if (map) map.setView([Number(place.lat), Number(place.lng)], Math.max(map.getZoom(), 14));
    });
  });
}

function renderCurrent() {
  renderMarkers();
  renderList();
}

async function loadPlaces() {
  const url = new URL('/api/places', location.origin);
  url.searchParams.set('status', 'approved');
  if (userLocation) {
    url.searchParams.set('lat', userLocation.lat);
    url.searchParams.set('lng', userLocation.lng);
    url.searchParams.set('radius_km', '100');
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    places = response.ok && data?.success && Array.isArray(data.places) ? data.places : [];
    window.__roviqPlaces = places;
    renderCurrent();
  } catch (err) {
    console.error('Failed to load ROVIQ places', err);
    places = [];
    renderCurrent();
  }
}

function setFilter(filter) {
  activeFilter = filter || 'all';
  const chips = $('#chips');
  chips?.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.category === activeFilter);
  });
  renderCurrent();
}

function initFilters() {
  $('#chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    e.preventDefault();
    setFilter(chip.dataset.category);
  });
}

function setView(view) {
  activeView = view === 'list' ? 'list' : 'map';
  $('#toggle-map')?.classList.toggle('active', activeView === 'map');
  $('#toggle-list')?.classList.toggle('active', activeView === 'list');

  const mapEl = $('#map');
  const listEl = $('#list-view');
  if (mapEl) mapEl.style.display = activeView === 'map' ? '' : 'none';
  if (listEl) listEl.hidden = activeView !== 'list';

  if (activeView === 'list') {
    renderList();
  } else {
    document.querySelector('.place-preview')?.remove();
    setTimeout(() => map?.invalidateSize(), 50);
  }
}

function initViewToggle() {
  $('#toggle-map')?.addEventListener('click', () => setView('map'));
  $('#toggle-list')?.addEventListener('click', () => setView('list'));
}

function location() {
  const label = $('#dynamic-location');
  if (label) label.textContent = locationLabel();
  if (!navigator.geolocation) {
    loadPlaces();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (label) label.textContent = locationLabel();

      if (map && window.L) {
        map.setView([userLocation.lat, userLocation.lng], 12);
        userMarker?.remove();
        userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            className: '',
            html: '<div class="user-dot"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(map);
      }
      loadPlaces();
    },
    () => {
      if (label) label.textContent = locationLabel();
      loadPlaces();
    },
    { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
  );
}

document.addEventListener('DOMContentLoaded', () => {
  applyAutomaticTheme();
  injectHeader();
  injectNav();
  initLeaflet();
  initViewToggle();
  initFilters();
  setFilter('all');
  setView('map');
  location();
});
})();