(() => {
  'use strict';

  const CATEGORY_EMOJI = { food: '🌮', coffee: '☕', breweries: '🍺', nature: '💧', culture: '📖' };
  const ADVISORY_ICON = { access:'↗', road:'⌁', parking:'P', seasonal:'❄', closure:'×', pedestrian:'⌁', accessibility:'♿', official:'!', other:'!' };
  const $ = (sel) => document.querySelector(sel);

  function getCredential() { return sessionStorage.getItem('roviq_admin_credential'); }
  function setCredential(v) { sessionStorage.setItem('roviq_admin_credential', v); }
  function clearCredential() { sessionStorage.removeItem('roviq_admin_credential'); }
  function authHeaders(extra = {}) {
    const value = getCredential() || '';
    const headers = { ...extra };
    if (value.startsWith('rql_')) headers.Authorization = `Bearer ${value}`;
    else headers['X-Admin-Passcode'] = value;
    return headers;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadQueue() {
    const res = await fetch('/api/admin/queue', { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      clearCredential();
      showLogin('Credential was not accepted or is no longer active.');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!data.success) { showLogin(data.error || 'Could not load moderation queue.'); return; }
    const actor = data.actor || {};
    const sub = $('#admin-sub');
    if (sub) sub.textContent = `${actor.display_name || actor.handle || 'Curator'} · ${(actor.role || 'curator').replace('_',' ')}`;
    const curatorLink = $('#curator-admin-link');
    if (curatorLink) curatorLink.hidden = actor.role !== 'super_admin';
    renderQueue(data.places || [], data.advisories || []);
  }

  function placeCard(place) {
    const category = place.category_key || place.category;
    return `<div class="review-card" data-id="${place.id}" data-kind="place">
      <div class="rc-top"><div class="rc-photo" style="${place.photo_url ? `background-image:url('${escapeHtml(place.photo_url)}')` : ''}">${place.photo_url ? '' : (CATEGORY_EMOJI[place.category] || '📍')}</div>
      <div class="rc-info"><div class="rc-name">${escapeHtml(place.name)}</div><div class="rc-meta">PLACE · ${escapeHtml(category)}${place.market_slug ? ' · ' + escapeHtml(place.market_slug) : ''}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div></div></div>
      <div class="rc-desc">“${escapeHtml(place.description || '')}”</div><div class="rc-driver">Suggested by ${place.submitted_by ? escapeHtml(place.submitted_by) : 'anonymous contributor'}</div>
      <div class="rc-actions"><button class="rc-btn rc-reject" data-action="reject" type="button">Reject</button><button class="rc-btn rc-approve" data-action="approve" type="button">Approve</button></div></div>`;
  }

  function advisoryCard(a) {
    return `<div class="review-card" data-id="${a.id}" data-kind="advisory">
      <div class="rc-top"><div class="rc-photo">${ADVISORY_ICON[a.advisory_type] || '!'}</div><div class="rc-info"><div class="rc-name">${escapeHtml(a.title)}</div><div class="rc-meta">JOURNEY ADVISORY · ${escapeHtml(a.advisory_type)}${a.market_slug ? ' · ' + escapeHtml(a.market_slug) : ''}${a.address ? ' · ' + escapeHtml(a.address) : ''}</div></div></div>
      <div class="rc-desc">${escapeHtml(a.description || '')}</div>${a.source_name || a.source_url ? `<div class="rc-driver">Source: ${escapeHtml(a.source_name || 'link')}${a.source_url ? ` · ${escapeHtml(a.source_url)}` : ''}</div>` : ''}<div class="rc-driver">Submitted by ${a.submitted_by ? escapeHtml(a.submitted_by) : 'anonymous contributor'}</div>
      <div class="rc-actions"><button class="rc-btn rc-reject" data-action="rejected" type="button">Reject</button><button class="rc-btn rc-approve" data-action="active" type="button">Publish advisory</button></div></div>`;
  }

  function renderQueue(places, advisories) {
    const total = places.length + advisories.length;
    $('#queue-count').textContent = `● ${total} pending · ${places.length} places · ${advisories.length} advisories`;
    const queue = $('#queue');
    if (!total) { queue.innerHTML = '<div class="empty-state">Nothing pending. Nice and clean.</div>'; return; }
    queue.innerHTML = [...places.map(placeCard), ...advisories.map(advisoryCard)].join('');
    queue.querySelectorAll('.rc-actions button').forEach((btn) => btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.review-card'), id = Number(card.dataset.id), kind = card.dataset.kind, action = e.target.dataset.action;
      const buttons = btn.closest('.rc-actions').querySelectorAll('button'); buttons.forEach((b) => b.disabled = true);
      let res;
      if (kind === 'place') {
        res = await fetch('/api/admin/moderate', { method:'POST', headers:authHeaders({'Content-Type':'application/json'}), body:JSON.stringify({ place_id:id, action }) });
      } else {
        res = await fetch(`/api/admin/advisories/${id}`, { method:'PATCH', headers:authHeaders({'Content-Type':'application/json'}), body:JSON.stringify({ status:action }) });
      }
      if (res.ok) { card.remove(); loadQueue(); }
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Moderation action failed.');
        buttons.forEach((b) => b.disabled = false);
      }
    }));
  }

  function showLogin(errorMsg) { $('#login-wrap').hidden = false; $('#queue-wrap').hidden = true; $('#login-error').textContent = errorMsg || ''; }
  function showQueue() { $('#login-wrap').hidden = true; $('#queue-wrap').hidden = false; loadQueue(); }
  function init() {
    $('#login-btn').addEventListener('click', () => { const val = $('#passcode').value.trim(); if (!val) return; setCredential(val); showQueue(); });
    $('#passcode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-btn').click(); });
    $('#logout').addEventListener('click', () => { clearCredential(); $('#passcode').value = ''; showLogin(); });
    if (getCredential()) showQueue(); else showLogin();
  }
  document.addEventListener('DOMContentLoaded', init);
})();