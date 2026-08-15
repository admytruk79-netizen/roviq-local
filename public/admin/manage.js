(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let places = [];
  const passKey = 'roviq_admin_passcode';
  const pass = () => sessionStorage.getItem(passKey) || '';
  const headers = () => ({ 'Content-Type': 'application/json', 'X-Admin-Passcode': pass() });
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(url, options={}) {
    const res = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({ success:false, error:'Invalid server response' }));
    if (res.status === 401) { sessionStorage.removeItem(passKey); showLogin('Passcode expired or incorrect.'); throw new Error('unauthorized'); }
    if (!res.ok || !data.success) { const e = new Error(data.error || 'Request failed'); e.data = data; throw e; }
    return data;
  }

  function showLogin(msg='') { $('#login').hidden = false; $('#app').hidden = true; $('#loginMsg').textContent = msg; }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; load(); }

  async function load() {
    const q = encodeURIComponent($('#search').value.trim());
    const s = encodeURIComponent($('#statusFilter').value);
    try {
      const data = await api(`/api/admin/places?q=${q}&status=${s}`);
      places = data.places || [];
      render();
    } catch (e) { if (e.message !== 'unauthorized') $('#list').innerHTML = `<div>${esc(e.message)}</div>`; }
  }

  function render() {
    if (!places.length) { $('#list').innerHTML = '<div>No matching places.</div>'; return; }
    $('#list').innerHTML = places.map(p => {
      const verified = p.verified_at ? new Date(p.verified_at).toLocaleDateString() : 'never';
      return `<article class="place-row" data-id="${p.id}">
        <div><h3>${esc(p.name)}</h3><div class="meta">${esc(p.category)} · ${esc(p.address || 'no address')}</div>
        <div class="badges"><span class="badge">${esc(p.status)}</span><span class="badge">${esc(p.trust_level || (p.is_drivers_pick ? 'driver' : 'community'))}</span>${p.is_hidden ? '<span class="badge warn">hidden</span>' : ''}${p.is_drivers_pick ? '<span class="badge">★ driver pick</span>' : ''}<span class="badge">verified ${esc(verified)}</span></div></div>
        <div class="row-actions"><button class="btn btn-outline editBtn" type="button">Edit</button>${p.status === 'pending' ? '<button class="btn btn-fir approveBtn" type="button">Approve</button>' : ''}</div>
      </article>`;
    }).join('');
    document.querySelectorAll('.editBtn').forEach(b => b.onclick = () => openEditor(Number(b.closest('.place-row').dataset.id)));
    document.querySelectorAll('.approveBtn').forEach(b => b.onclick = () => quickApprove(Number(b.closest('.place-row').dataset.id)));
  }

  async function quickApprove(id) {
    try { await api(`/api/admin/places/${id}`, { method:'PATCH', body:JSON.stringify({ status:'approved', verify_now:true }) }); await load(); }
    catch(e) { alert(e.message); }
  }

  function setVal(id, v) { const el = $('#' + id); if (el.type === 'checkbox') el.checked = Boolean(v); else el.value = v ?? ''; }
  function openEditor(id=null) {
    const p = places.find(x => x.id === id) || {};
    $('#editorTitle').textContent = id ? `Edit ${p.name}` : 'Add place';
    ['placeId','name','category','description','address','lat','lng','photo_url','hours','status','trust_level','submitted_by','moderation_note','is_drivers_pick','is_hidden'].forEach(k => setVal(k, k === 'placeId' ? (id || '') : p[k]));
    if (!id) { setVal('category','food'); setVal('status','approved'); setVal('trust_level','roviq'); setVal('submitted_by','ROVIQ curator'); }
    $('#verify_now').checked = !id;
    $('#hideBtn').hidden = !id;
    $('#editorMsg').textContent = '';
    $('#editorWrap').classList.add('open');
  }
  function closeEditor() { $('#editorWrap').classList.remove('open'); }

  function payload() {
    return {
      name: $('#name').value.trim(), category: $('#category').value, description: $('#description').value.trim(),
      address: $('#address').value.trim(), lat: Number($('#lat').value), lng: Number($('#lng').value),
      photo_url: $('#photo_url').value.trim(), hours: $('#hours').value.trim(), status: $('#status').value,
      trust_level: $('#trust_level').value, submitted_by: $('#submitted_by').value.trim(), moderation_note: $('#moderation_note').value.trim(),
      is_drivers_pick: $('#is_drivers_pick').checked, is_hidden: $('#is_hidden').checked, verify_now: $('#verify_now').checked
    };
  }

  $('#editor').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#placeId').value;
    const data = payload();
    $('#editorMsg').textContent = 'Saving…';
    try {
      if (id) await api(`/api/admin/places/${id}`, { method:'PATCH', body:JSON.stringify(data) });
      else await api('/api/admin/places', { method:'POST', body:JSON.stringify(data) });
      $('#editorMsg').textContent = 'Saved.'; await load(); setTimeout(closeEditor, 350);
    } catch(e) {
      if (e.data?.duplicates) $('#editorMsg').textContent = `Possible duplicate: ${e.data.duplicates.map(d => d.name).join(', ')}.`;
      else $('#editorMsg').textContent = e.message;
    }
  });

  $('#hideBtn').onclick = async () => {
    const id = $('#placeId').value; if (!id) return;
    if (!confirm('Hide this place from the public map?')) return;
    try { await api(`/api/admin/places/${id}`, { method:'DELETE' }); await load(); closeEditor(); }
    catch(e) { $('#editorMsg').textContent = e.message; }
  };
  $('#closeEditor').onclick = closeEditor;
  $('#editorWrap').addEventListener('click', e => { if (e.target === $('#editorWrap')) closeEditor(); });
  $('#newBtn').onclick = () => openEditor();
  $('#refreshBtn').onclick = load;
  $('#statusFilter').onchange = load;
  let timer; $('#search').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#loginBtn').onclick = async () => { sessionStorage.setItem(passKey, $('#pass').value.trim()); try { await api('/api/admin/places'); showApp(); } catch(e) { if (e.message !== 'unauthorized') showLogin(e.message); } };
  $('#pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });

  if (pass()) showApp(); else showLogin();
})();
