(() => {
  'use strict';

  const CATEGORY_EMOJI = { food: '🌮', coffee: '☕', breweries: '🍺', nature: '💧', culture: '📖' };
  const $ = (sel) => document.querySelector(sel);

  function getPasscode() { return sessionStorage.getItem('roviq_admin_passcode'); }
  function setPasscode(v) { sessionStorage.setItem('roviq_admin_passcode', v); }
  function clearPasscode() { sessionStorage.removeItem('roviq_admin_passcode'); }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadQueue() {
    const passcode = getPasscode();
    const res = await fetch('/api/admin/queue', { headers: { 'X-Admin-Passcode': passcode } });
    if (res.status === 401) {
      clearPasscode();
      showLogin('Wrong passcode — try again.');
      return;
    }
    const places = await res.json();
    renderQueue(places);
  }

  function renderQueue(places) {
    $('#queue-count').textContent = `● ${places.length} pending`;
    const queue = $('#queue');
    if (!places.length) {
      queue.innerHTML = '<div class="empty-state">Nothing pending. Nice and clean.</div>';
      return;
    }
    queue.innerHTML = places.map((place) => `
      <div class="review-card" data-id="${place.id}">
        <div class="rc-top">
          <div class="rc-photo" style="${place.photo_url ? `background-image:url('${escapeHtml(place.photo_url)}')` : ''}">
            ${place.photo_url ? '' : (CATEGORY_EMOJI[place.category] || '📍')}
          </div>
          <div class="rc-info">
            <div class="rc-name">${escapeHtml(place.name)}</div>
            <div class="rc-meta">${escapeHtml(place.category)}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div>
          </div>
        </div>
        <div class="rc-desc">"${escapeHtml(place.description || '')}"</div>
        <div class="rc-driver">— suggested by ${place.submitted_by ? 'driver #' + escapeHtml(place.submitted_by) : 'a Qremyn driver'}</div>
        <div class="rc-actions">
          <button class="rc-btn rc-reject" data-action="rejected" type="button">Reject</button>
          <button class="rc-btn rc-approve" data-action="approved" type="button">Approve</button>
        </div>
      </div>
    `).join('');

    queue.querySelectorAll('.rc-actions button').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const card = e.target.closest('.review-card');
        const id = card.dataset.id;
        const status = e.target.dataset.action;
        btn.closest('.rc-actions').querySelectorAll('button').forEach((b) => (b.disabled = true));
        const res = await fetch(`/api/places/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Passcode': getPasscode() },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          card.remove();
          loadQueue();
        }
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
    $('#passcode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#login-btn').click();
    });
    $('#logout').addEventListener('click', () => {
      clearPasscode();
      $('#passcode').value = '';
      showLogin();
    });

    if (getPasscode()) showQueue();
    else showLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
