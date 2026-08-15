(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let userLocation = null;
  let sortNearby = false;

  function announce(msg) {
    const el = $('#app-status');
    if (el) el.textContent = msg;
  }

  function haversine(a, b) {
    const R = 3958.8;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat/2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function enhanceLocation() {
    const badge = $('#loc-badge');
    if (!badge) return;
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    if (!navigator.geolocation) { badge.textContent = 'Location unavailable'; return; }
    badge.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(pos => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      badge.textContent = '📍 Near you · Portland';
      announce('Your location is available.');
      if (sortNearby) sortListNearby();
    }, () => {
      badge.textContent = '📍 Portland, OR';
      announce('Location was not enabled. You can still browse all places.');
    }, { enableHighAccuracy:false, timeout:6000, maximumAge:300000 });
  }

  function sortListNearby() {
    if (!userLocation) { announce('Enable location to sort by distance.'); return; }
    const list = $('#list-view');
    if (!list) return;
    const rows = [...list.querySelectorAll('.place-card')];
    const places = window.__roviqPlaces || [];
    const byName = new Map(places.map(p => [String(p.name).trim(), p]));
    rows.sort((a,b) => {
      const an = a.querySelector('.place-name')?.textContent.replace('★','').trim() || '';
      const bn = b.querySelector('.place-name')?.textContent.replace('★','').trim() || '';
      const ap = byName.get(an), bp = byName.get(bn);
      if (!ap || !bp) return 0;
      return haversine(userLocation, ap) - haversine(userLocation, bp);
    }).forEach(row => list.appendChild(row));
    rows.forEach(row => {
      const n = row.querySelector('.place-name')?.textContent.replace('★','').trim() || '';
      const p = byName.get(n);
      let el = row.querySelector('.v2-distance');
      if (!el) { el = document.createElement('div'); el.className='v2-distance'; row.querySelector('.place-info')?.appendChild(el); }
      if (p) el.textContent = `${haversine(userLocation,p).toFixed(1)} mi away`;
    });
    announce('List sorted by distance.');
  }

  function addUtilityChips() {
    const chips = $('#chips');
    if (!chips) return;
    const near = document.createElement('button');
    near.className = 'chip utility-chip'; near.type='button'; near.textContent='◎ Near me';
    near.addEventListener('click', () => {
      sortNearby = !sortNearby;
      near.classList.toggle('active', sortNearby);
      $('#toggle-list')?.click();
      if (sortNearby) sortListNearby();
    });
    chips.appendChild(near);
  }

  function addTrustBadge() {
    const sheet = $('#sheet');
    const name = $('#sheet-name');
    const existing = $('#sheet-trust-badge');
    if (!sheet || !name || !existing) return;
    const update = () => {
      const p = (window.__roviqPlaces || []).find(x => x.name === name.textContent);
      if (!p) { existing.hidden = true; return; }
      const level = p.trust_level || (p.is_drivers_pick ? 'driver' : 'community');
      existing.hidden = false;
      existing.textContent = level === 'roviq' ? '◆ ROVIQ Pick' : level === 'driver' ? '★ Driver recommended' : 'Community submitted';
      existing.dataset.level = level;
    };
    new MutationObserver(update).observe(name, { childList:true, characterData:true, subtree:true });
  }

  function improveSubmissionFeedback() {
    const form = $('#suggest-form'), msg = $('#form-msg');
    if (!form || !msg) return;
    msg.setAttribute('role','status'); msg.setAttribute('aria-live','polite');
    form.addEventListener('submit', () => announce('Checking and submitting your recommendation for review.'), true);
  }

  function accessibilityPass() {
    document.querySelectorAll('button, a, input, select, textarea').forEach(el => {
      if (!el.getAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title);
    });
    $('#sheet')?.setAttribute('role','dialog');
    $('#sheet')?.setAttribute('aria-modal','true');
    $('#directions-sheet')?.setAttribute('role','dialog');
    $('#directions-sheet')?.setAttribute('aria-modal','true');
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceLocation(); addUtilityChips(); addTrustBadge(); improveSubmissionFeedback(); accessibilityPass();
    new MutationObserver(() => { if (sortNearby) sortListNearby(); }).observe($('#list-view'), { childList:true });
  });
})();
