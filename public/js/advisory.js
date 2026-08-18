(() => {
'use strict';

const $ = (s) => document.querySelector(s);

function ensurePanel() {
  if ($('#advisory-panel')) return $('#advisory-panel');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'advisory-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="panel-topbar"><button class="back-btn" id="close-advisory" type="button">←</button><h1>Report an Advisory</h1></div>
    <div class="panel-body"><form id="advisory-form">
      <p class="submit-note" style="margin-top:0"><strong>Something travelers should know?</strong><br>Report an access, road, parking, seasonal or other journey issue. Advisories are reviewed before appearing publicly.</p>
      <div class="field"><label for="a-type">Advisory type</label><select id="a-type" required><option value="" selected disabled>Choose advisory type</option><option value="access">Access issue</option><option value="road">Road condition / restriction</option><option value="parking">Parking issue</option><option value="seasonal">Seasonal condition</option><option value="closure">Closure</option><option value="pedestrian">Pedestrian access</option><option value="official">Official advisory</option></select></div>
      <div class="field"><label for="a-title">Short title</label><input id="a-title" type="text" maxlength="140" placeholder="e.g. Seasonal road closure" required></div>
      <div class="field"><label for="a-desc">What should travelers know?</label><textarea id="a-desc" maxlength="1200" placeholder="Describe the issue factually and briefly." required></textarea></div>
      <div class="field"><label for="a-address">Location</label><input id="a-address" type="text" placeholder="Address, road, park, city, region" required></div>
      <div class="field"><label for="a-source-name">Source (optional)</label><input id="a-source-name" type="text" placeholder="Agency, business, sign, firsthand observation"></div>
      <div class="field"><label for="a-source-url">Source URL (optional)</label><input id="a-source-url" type="url" placeholder="https://..."></div>
      <div class="field"><label for="a-photo">Photo URL (optional)</label><input id="a-photo" type="url" placeholder="https://..."></div>
      <div class="field"><label for="a-driver">Contributor / driver identity (optional)</label><input id="a-driver" type="text" placeholder="Name or driver handle"></div>
      <button class="btn btn-fir" type="submit">Submit for review</button>
      <div class="form-msg" id="advisory-msg"></div>
      <div class="submit-note">ROVIQ does not publish unverified accusations or neighborhood blacklists. Keep reports factual and specific.</div>
    </form></div>`;
  document.querySelector('#app')?.appendChild(panel);
  $('#close-advisory')?.addEventListener('click', closePanel);
  $('#advisory-form')?.addEventListener('submit', submit);
  return panel;
}

function message(text, type = '') {
  const el = $('#advisory-msg');
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg${type ? ' ' + type : ''}`;
}

function openPanel() {
  const panel = ensurePanel();
  $('#suggest-panel') && ($('#suggest-panel').hidden = true);
  panel.hidden = false;
  document.body.classList.add('suggest-open');
  setTimeout(() => $('#a-type')?.focus(), 50);
}

function closePanel() {
  const panel = $('#advisory-panel');
  if (panel) panel.hidden = true;
  document.body.classList.remove('suggest-open');
}

async function submit(e) {
  e.preventDefault();
  const address = $('#a-address')?.value.trim() || '';
  const type = $('#a-type')?.value || '';
  const title = $('#a-title')?.value.trim() || '';
  const description = $('#a-desc')?.value.trim() || '';
  if (!type || !title || !description || !address) { message('Type, title, description and location are required.', 'error'); return; }

  message('Finding that location…');
  const geo = typeof window.__ROVIQ_GEOCODE_LOCATION === 'function' ? await window.__ROVIQ_GEOCODE_LOCATION(address) : null;
  if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lng))) {
    message('Could not find that location. Try a more specific address, road or city.', 'error'); return;
  }

  const payload = {
    advisory_type: type,
    title,
    description,
    address,
    source_name: $('#a-source-name')?.value.trim() || '',
    source_url: $('#a-source-url')?.value.trim() || '',
    photo_url: $('#a-photo')?.value.trim() || '',
    submitted_by: $('#a-driver')?.value.trim() || '',
    lat: Number(geo.lat), lng: Number(geo.lng),
    country_code: geo.country_code || '', region: geo.region || '', city: geo.city || ''
  };

  message('Sending for ROVIQ review…');
  try {
    const response = await fetch('/api/advisories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) { message(data.error || 'Could not submit this advisory.', 'error'); return; }
    message('Submitted. It will remain private until a ROVIQ curator reviews it.', 'success');
    $('#advisory-form')?.reset();
  } catch (err) {
    console.error('Journey Advisory submission failed', err);
    message('Could not submit this advisory. Please try again.', 'error');
  }
}

function loadStadiaPrototype(){
  if(document.querySelector('script[data-roviq-stadia]')) return;
  const s=document.createElement('script');
  s.src='/js/stadia-vector.js?v=20260818-1';
  s.dataset.roviqStadia='1';
  document.head.appendChild(s);
}

function init() {
  loadStadiaPrototype();
  const entry = document.querySelector('.advisory-entry');
  if (entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'advisory-link';
    button.textContent = 'Report a Journey Advisory →';
    entry.querySelector('span')?.replaceWith(button);
    button.addEventListener('click', openPanel);
  }
}

document.addEventListener('DOMContentLoaded', init);
})();
