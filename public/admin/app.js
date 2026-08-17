(() => {
  'use strict';

  const CATEGORY_EMOJI = { food:'🌮', coffee:'☕', breweries:'🍺', nature:'💧', culture:'📖', scenic:'◈', family:'●', recreation:'⌁', markets:'▣', lodging:'⌂', automotive:'◆', charging:'⚡', services:'+' };
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
  function humanAction(v='') { return String(v).replaceAll('_',' ').replace(/^./, c => c.toUpperCase()); }
  function niceDate(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.valueOf()) ? '' : d.toLocaleString(); }

  async function loadQueue() {
    const res = await fetch('/api/admin/queue', { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      clearCredential(); showLogin('Credential was not accepted or is no longer active.'); return;
    }
    const data = await res.json().catch(() => ({}));
    if (!data.success) { showLogin(data.error || 'Could not load moderation queue.'); return; }
    const actor = data.actor || {};
    $('#admin-sub').textContent = `${actor.display_name || actor.handle || 'Curator'} · ${(actor.role || 'curator').replace('_',' ')}`;
    $('#curator-admin-link').hidden = actor.role !== 'super_admin';
    renderSummary(data);
    renderQueue(data.places || [], data.advisories || []);
  }

  function renderSummary(data) {
    const counts = data.counts || {};
    $('#queue-count').textContent = `● ${counts.total || 0} pending · ${counts.places || 0} places · ${counts.advisories || 0} advisories · ${counts.unread || 0} unread`;
    const markets = data.markets || [];
    $('#market-summary').innerHTML = markets.length ? markets.map(m => `<span class="ops-chip">${escapeHtml(m.market)} · ${m.count}</span>`).join('') : '<span class="ops-chip">No pending markets</span>';
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
    const queue = $('#queue');
    if (!total) { queue.innerHTML = '<div class="empty-state">Nothing pending in your assigned markets.</div>'; return; }
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
      if (res.ok) { await Promise.all([loadQueue(), loadActivity()]); }
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Moderation action failed.'); buttons.forEach((b) => b.disabled = false);
      }
    }));
  }

  async function loadActivity() {
    const el = $('#activity');
    el.innerHTML = '<div class="empty-state">Loading activity…</div>';
    const res = await fetch('/api/admin/activity?limit=40', { headers:authHeaders() });
    if (!res.ok) { el.innerHTML = '<div class="empty-state">Could not load moderation activity.</div>'; return; }
    const data = await res.json().catch(() => ({}));
    const events = data.events || [];
    if (!events.length) { el.innerHTML = '<div class="empty-state">No moderation history yet.</div>'; return; }
    el.innerHTML = events.map(e => `<div class="activity-item">
      <strong>${escapeHtml(humanAction(e.action))} · ${escapeHtml(e.name || `Place #${e.place_id}`)}</strong>
      <div class="activity-meta">${escapeHtml(e.reviewer_handle || 'system')} · ${escapeHtml(e.market_slug || e.city || 'unassigned')} · ${escapeHtml(niceDate(e.created_at))}</div>
      ${e.previous_status || e.new_status ? `<div class="activity-meta">${escapeHtml(e.previous_status || '—')} → ${escapeHtml(e.new_status || '—')}</div>` : ''}
      ${e.note ? `<div class="activity-note">${escapeHtml(e.note)}</div>` : ''}
    </div>`).join('');
  }

  function showLogin(errorMsg) { $('#login-wrap').hidden = false; $('#queue-wrap').hidden = true; $('#login-error').textContent = errorMsg || ''; }
  function showQueue() { $('#login-wrap').hidden = true; $('#queue-wrap').hidden = false; Promise.all([loadQueue(), loadActivity()]); }
  function init() {
    $('#login-btn').addEventListener('click', () => { const val = $('#passcode').value.trim(); if (!val) return; setCredential(val); showQueue(); });
    $('#passcode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-btn').click(); });
    $('#logout').addEventListener('click', () => { clearCredential(); $('#passcode').value = ''; showLogin(); });
    $('#refresh-queue')?.addEventListener('click', loadQueue);
    $('#refresh-activity')?.addEventListener('click', loadActivity);
    if (getCredential()) showQueue(); else showLogin();
  }
  document.addEventListener('DOMContentLoaded', init);
})();