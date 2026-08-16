(() => {
'use strict';

const $ = (s) => document.querySelector(s);
let selectedCategory = null;

function openPanel() {
  const panel = $('#suggest-panel');
  if (!panel) return;
  panel.hidden = false;
  document.body.classList.add('suggest-open');
  setTimeout(() => $('#f-name')?.focus(), 50);
}

function closePanel() {
  const panel = $('#suggest-panel');
  if (!panel) return;
  panel.hidden = true;
  document.body.classList.remove('suggest-open');
}

function message(text, type = '') {
  const el = $('#form-msg');
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg${type ? ' ' + type : ''}`;
}

async function geocode(address) {
  if (typeof window.__ROVIQ_GEOCODE_LOCATION === 'function') {
    return window.__ROVIQ_GEOCODE_LOCATION(address);
  }
  return null;
}

async function submit(e) {
  e.preventDefault();

  const name = $('#f-name')?.value.trim() || '';
  const address = $('#f-address')?.value.trim() || '';
  const description = $('#f-desc')?.value.trim() || '';
  const photoUrl = $('#f-photo')?.value.trim() || '';
  const submittedBy = $('#f-driver')?.value.trim() || '';

  if (!name || !address) {
    message('Place name and location are required.', 'error');
    return;
  }
  if (!selectedCategory) {
    message('Choose a category.', 'error');
    return;
  }

  message('Finding that location…');
  const geo = await geocode(address);
  if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lng))) {
    message('Could not find that location. Try a more specific address or city.', 'error');
    return;
  }

  const payload = {
    name,
    category: selectedCategory,
    description,
    address,
    photo_url: photoUrl,
    submitted_by: submittedBy,
    lat: Number(geo.lat),
    lng: Number(geo.lng),
    country_code: geo.country_code || '',
    country: geo.country || '',
    region: geo.region || '',
    city: geo.city || '',
    locality: geo.locality || '',
    postal_code: geo.postal_code || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  };

  message('Sending for ROVIQ review…');
  try {
    const response = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 409) {
      message(data.error || 'This place may already be in ROVIQ Local.', 'error');
      return;
    }
    if (!response.ok || !data.success) {
      message(data.error || 'Could not submit this place. Please try again.', 'error');
      return;
    }

    message('Submitted. ROVIQ will review it before it appears publicly.', 'success');
    $('#suggest-form')?.reset();
    selectedCategory = null;
    document.querySelectorAll('#f-category-pills .cat-pill').forEach((p) => p.classList.remove('sel'));
  } catch (err) {
    console.error('Suggest a Spot failed', err);
    message('Could not submit this place. Please try again.', 'error');
  }
}

function init() {
  $('#open-suggest')?.addEventListener('click', openPanel);
  $('#close-suggest')?.addEventListener('click', closePanel);
  $('#f-category-pills')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    document.querySelectorAll('#f-category-pills .cat-pill').forEach((p) => p.classList.remove('sel'));
    pill.classList.add('sel');
    selectedCategory = pill.dataset.value;
  });
  $('#suggest-form')?.addEventListener('submit', submit);
}

document.addEventListener('DOMContentLoaded', init);
})();
