(() => {
  'use strict';

  const CATEGORY_EMOJI = { food: '🌮', coffee: '☕', breweries: '🍺', nature: '💧', culture: '📖' };
  const ADVISORY_ICON = { access:'↗', road:'⌁', parking:'P', seasonal:'❄', closure:'×', pedestrian:'⌁', accessibility:'♿', official:'!', other:'!' };
  const $ = (sel) => document.querySelector(sel);

  function getPasscode() { return sessionStorage.getItem('roviq_admin_passcode'); }
  function setPasscode(v) { sessionStorage.setItem('roviq_admin_passcode', v); }
  function clearPasscode() { sessionStorage.removeItem('roviq_admin_passcode'); }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadQueue() {
    const passcode = getPasscode();
    const res = await fetch('/api/admin/queue', { headers: { 'X-Admin-Passcode': passcode } });
    if (res.status === 401) {
      clearPasscode();
      showLogin('Wrong passcode — try again.');
      return;
    }
    const data = await res.json();
    renderQueue(data.success ? (data.places || []) : [], data.success ? (data.advisories || []) : []);
  }

  function placeCard(place) {
    const category = place.category_key || place.category;
    return `
      <div class="review-card" data-id="${place.id}" data-kind="place">
        <div class="rc-top">
          <div class="rc-photo" style="${place.photo_url ? `background-image:url('${escapeHtml(place.photo_url)}')` : ''}">${place.photo_url ? '' : (CATEGORY_EMOJI[place.category] || '📍')}</div>
          <div class="rc-info"><div class="rc-name">${escapeHtml(place.name)}</div><div class="rc-meta">PLACE · ${escapeHtml(category)}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div></div>
        </div>
        <div class="rc-desc">“${escapeHtml(place.description || '')}”</div>
        <div class="rc-driver">Suggested by ${place.submitted_by ? escapeHtml(place.submitted_by) : 'anonymous contributor'}</div>
        <div class="rc-actions"><button class="rc-btn rc-reject" data-action="rejected" type="button">Reject</button><button class="rc-btn rc-approve" data-action="approved" type="button">Approve</button></div>
      </div>`;
  }

  function advisoryCard(a) {
    return `
      <div class="review-card" data-id="${a.id}" data-kind="advisory">
        <div class="rc-top">
          <div class="rc-photo">${ADVISORY_ICON[a.advisory_type] || '!'}</div>
          <div class="rc-info"><div class="rc-name">${escapeHtml(a.title)}</div><div class="rc-meta">JOURNEY ADVISORY · ${escapeHtml(a.advisory_type)}${a.address ? ' · ' + escapeHtml(a.address) : ''}</div></div>
        </div>
        <div class="rc-desc">${escapeHtml(a.description || '')}</div>
        ${a.source_name || a.source_url ? `<div class="rc-driver">Source: ${escapeHtml(a.source_name || 'link')}${a.source_url ? ` · ${escapeHtml(a.source_url)}` : ''}</div>` : ''}
        <div class="rc-driver">Submitted by ${a.submitted_by ? escapeHtml(a.submitted_by) : 'anonymous contributor'}</div>
        <div class="rc-actions"><button class="rc-btn rc-reject" data-action="rejected" type="button">Reject</button><button class="rc-btn rc-approve" data-action="active" type="button">Publish advisory</button></div>
      </div>`;
  }

  function renderQueue(places, advisories) {
    const total = places.length + advisories.length;
    $('#queue-count').textContent = `● ${total} pending · ${places.length} places · ${advisories.length} advisories`;
    const queue = $('#queue');
    if (!total) {
      queue.innerHTML = '<div class="empty-state">Nothing pending. Nice and clean.</div>';
      return;
    }
    queue.innerHTML = [...places.map(placeCard), ...advisories.map(advisoryCard)].join('');

    queue.querySelectorAll('.rc-actions button').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const card = e.target.closest('.review-card');
        const id = card.dataset.id;
        const kind = card.dataset.kind;
        const status = e.target.dataset.action;
        btn.closest('.rc-actions').querySelectorAll('button').forEach((b) => (b.disabled = true));
        const endpoint = kind === 'advisory' ? `/api/admin/advisories/${id}` : `/api/admin/places/${id}`;
        const res = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Passcode': getPasscode() },
          body: JSON.stringify({ status, reviewed_by: 'admin' }),
        });
        if (res.ok) { card.remove(); loadQueue(); }
        else btn.closest('.rc-actions').querySelectorAll('button').forEach((b) => (b.disabled = false));
      });
    });
  }

  function showLogin(errorMsg) {
    $('#login-wrap').hidden = false;
    $('#queue-wrap').hidden = true;
    $('#login-error').textContent = errorMsg || '';
  }

  function showQueue() {
    $('#login-wrap').hidden = true;
    $('#queue-wrap').hidden = false;
    loadQueue();
  }

  function init() {
    $('#login-btn').addEventListener('click', () => {
      const val = $('#passcode').value.trim();
      if (!val) return;
      setPasscode(val);
      showQueue();
    });
    $('#passcode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-btn').click(); });
    $('#logout').addEventListener('click', () => { clearPasscode(); $('#passcode').value = ''; showLogin(); });
    if (getPasscode()) showQueue(); else showLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
