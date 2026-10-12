/* ASA Kenya admin dashboard.
   Logs in with Supabase email + password. Uses only the publishable key plus the signed-in
   user's own session token. What each person may do is decided by the database (Row Level
   Security); the buttons below only reflect that, they do not enforce it. */
(function () {
  'use strict';
  var DB = window.ASA_DB, C = window.ASA_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app');
  var CATS = ['Competitions', 'Internships', 'Scholarships', 'Mentorship', 'Workshops', 'Site visits', 'Exhibitions', 'Fellowships', 'Calls for papers', 'Research', 'Volunteering', 'Jobs', 'Traineeships', 'Grants', 'Paid projects'];
  var AUD = [['both', 'Students and graduates'], ['students', 'Students only'], ['graduates', 'Graduates only']];
  var STATUS = ['draft', 'pending', 'published', 'archived'];
  var STATUS_LABEL = { draft: 'Draft', pending: 'Awaiting approval', published: 'Published', archived: 'Archived' };
  var MAX = 5 * 1024 * 1024, TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

  var S = { session: null, role: null, rows: [], filter: { q: '', status: 'all', cat: 'all' } };

  function esc(x) { return x == null ? '' : String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function say(text, bad) { var m = $('#msg'); m.innerHTML = text ? '<p class="m ' + (bad ? 'er' : 'ok') + '">' + esc(text) + '</p>' : ''; if (text && !bad) setTimeout(function () { if (m.textContent === text) m.innerHTML = ''; }, 6000); }
  function fmtErr(e) {
    if (!e) return 'Something went wrong.';
    if (e.code === 'network') return e.message;
    if (e.status === 401 || /jwt/i.test(e.message || '')) return 'Your session has expired. Please log in again.';
    if (e.status === 403 || /row-level|permission denied/i.test(e.message || '')) return 'You do not have permission to do that.';
    if (e.status === 404) return 'The database tables are not set up yet. Run the SQL migrations first (see SETUP-SUPABASE.md).';
    if (/violates check constraint/i.test(e.message || '')) return 'Some details are not valid. Check lengths and that links start with https://';
    return e.message || 'Something went wrong.';
  }

  /* ---------------- session ---------------- */
  function saveSession() { try { if (S.session) sessionStorage.setItem('asa_admin', JSON.stringify(S.session)); else sessionStorage.removeItem('asa_admin'); } catch (e) { } }
  function loadSession() { try { var j = JSON.parse(sessionStorage.getItem('asa_admin') || 'null'); if (j && j.access_token && j.refresh_token) S.session = j; } catch (e) { } }
  function setSession(r) {
    S.session = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || (Math.floor(Date.now() / 1000) + (r.expires_in || 3600)), user: { id: r.user.id, email: r.user.email } };
    saveSession();
  }
  async function token() {
    if (!S.session) throw Object.assign(new Error('Please log in.'), { status: 401 });
    if (S.session.expires_at - 60 < Date.now() / 1000) {
      try { var r = await DB.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: S.session.refresh_token } }); setSession(r); }
      catch (e) { if (e.status === 0) throw e; await endSession('Your session has expired. Please log in again.'); throw Object.assign(new Error('expired'), { status: 401, handled: true }); }
    }
    return S.session.access_token;
  }
  async function api(fn) { try { return await fn(await token()); } catch (e) { if (e.handled) throw e; if (e.status === 401 && S.session) { await endSession('Your session has expired. Please log in again.'); e.handled = true; } throw e; } }
  async function endSession(message) {
    var t = S.session && S.session.access_token;
    S.session = null; S.role = null; saveSession(); $('#who').textContent = ''; $('#out').hidden = true;
    if (t) { try { await DB.request('/auth/v1/logout', { method: 'POST', token: t }); } catch (e) { } }
    renderLogin(message ? { text: message } : null);
  }
  $('#out').onclick = function () { endSession().then(function () { say('You are logged out.'); }); };

  /* ---------------- login ---------------- */
  function renderLogin(note) {
    app.innerHTML = '<div class="login card"><h2>Log in</h2><p class="note">For ASA Kenya officials. Accounts are created by an administrator; there is no public sign-up.</p>' +
      (note ? '<p class="m er" style="padding:10px">' + esc(note.text) + '</p>' : '') +
      '<form id="lf"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn" type="submit">Log in</button></form>' +
      '<p><button class="btn o s" id="fp" type="button">Forgot your password?</button></p></div>';
    $('#lf').onsubmit = async function (ev) {
      ev.preventDefault(); var f = ev.target, b = $('button', f); b.disabled = true; say('');
      try {
        var r = await DB.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: f.email.value.trim(), password: f.password.value } });
        setSession(r); await start();
      } catch (e) { say(e.status === 400 || e.status === 401 ? 'Wrong email or password.' : fmtErr(e), true); b.disabled = false; }
    };
    $('#fp').onclick = async function () {
      var em = $('#lf').email.value.trim(); if (!em) { say('Type your email above first.', true); return; }
      try { await DB.request('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: { email: em } }); say('If that email has an account, a reset link has been sent.'); }
      catch (e) { say(fmtErr(e), true); }
    };
  }
  function renderNewPassword(tok) {
    app.innerHTML = '<div class="login card"><h2>Set a new password</h2><form id="pf"><label>New password (at least 8 characters)<input type="password" name="p" minlength="8" autocomplete="new-password" required></label><button class="btn" type="submit">Save password</button></form></div>';
    $('#pf').onsubmit = async function (ev) {
      ev.preventDefault(); var p = ev.target.p.value; if (p.length < 8) { say('Use at least 8 characters.', true); return; }
      try { await DB.request('/auth/v1/user', { method: 'PUT', token: tok, body: { password: p } }); history.replaceState(null, '', location.pathname); say('Password saved. Please log in.'); renderLogin(); }
      catch (e) { say(fmtErr(e), true); }
    };
  }

  /* ---------------- start / role ---------------- */
  async function start() {
    app.innerHTML = '<p>Loading...</p>';
    try {
      var rows = await api(function (t) { return DB.select('staff_roles', 'select=role&user_id=eq.' + encodeURIComponent(S.session.user.id), t); });
      S.role = rows && rows[0] ? rows[0].role : null;
    } catch (e) { if (!e.handled) { say(fmtErr(e), true); renderLogin(); } return; }
    $('#who').textContent = S.session.user.email + (S.role ? ' (' + S.role + ')' : '');
    $('#out').hidden = false;
    if (!S.role) { app.innerHTML = '<div class="card"><h2>No access yet</h2><p>You are logged in as ' + esc(S.session.user.email) + ', but this account has not been given access. Ask an ASA Kenya administrator to add you, then log in again.</p></div>'; return; }
    S.admin = S.role === 'admin'; route();
  }
  function isAdmin() { return S.role === 'admin'; }

  /* ---------------- routing between views ---------------- */
  function nav(active) {
    var b = [['list', 'Opportunities'], ['new', 'Add opportunity']];
    if (isAdmin()) b.push(['people', 'Sign-ups and portfolios']);
    return '<div class="nav">' + b.map(function (x) { return '<button type="button" class="btn ' + (x[0] === active ? '' : 'o') + ' s" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function bindNav() { app.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { go(b.dataset.v); }; }); }
  function go(v, arg) { say(''); if (v === 'list') return viewList(); if (v === 'new') return viewForm(null); if (v === 'edit') return viewForm(arg); if (v === 'people') return viewPeople('interest'); }
  function route() { viewList(); }

  /* ---------------- list ---------------- */
  async function loadRows() {
    S.rows = await api(function (t) { return DB.select('opportunities', 'select=*&order=updated_at.desc&limit=500', t); }) || [];
  }
  async function viewList() {
    app.innerHTML = nav('list') + '<h2>Opportunities</h2><p>Loading...</p>'; bindNav();
    try { await loadRows(); } catch (e) { if (!e.handled) { app.innerHTML = nav('list') + '<div class="card"><b>Could not load opportunities.</b><p>' + esc(fmtErr(e)) + '</p></div>'; bindNav(); } return; }
    drawList();
  }
  function counts() { var c = { all: S.rows.length }; STATUS.forEach(function (s) { c[s] = S.rows.filter(function (r) { return r.status === s; }).length; }); return c; }
  function canEdit(r) { return isAdmin() || (r.created_by === S.session.user.id && (r.status === 'draft' || r.status === 'pending')); }
  function drawList() {
    var f = S.filter, c = counts();
    var rows = S.rows.filter(function (r) {
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.cat !== 'all' && r.category !== f.cat) return false;
      var q = f.q.toLowerCase(); return !q || (r.title + ' ' + r.organisation + ' ' + (r.location || '')).toLowerCase().indexOf(q) >= 0;
    });
    var tabs = [['all', 'All']].concat(STATUS.map(function (s) { return [s, STATUS_LABEL[s]]; })).map(function (t) { return '<button type="button" data-s="' + t[0] + '" aria-pressed="' + (f.status === t[0]) + '">' + t[1] + ' (' + c[t[0]] + ')</button>'; }).join('');
    var h = nav('list') + '<h2>Opportunities</h2>' + (isAdmin() ? '' : '<p class="note">You can add opportunities and submit them for approval. An administrator publishes them.</p>') +
      '<div class="tabs" role="group" aria-label="Status">' + tabs + '</div>' +
      '<div class="tools"><label class="grow">Search<input id="q" type="search" value="' + esc(f.q) + '" placeholder="Title, organisation, location"></label><label>Category<select id="cf"><option value="all">All categories</option>' + CATS.map(function (x) { return '<option' + (f.cat === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>';
    if (!rows.length) h += '<div class="card"><b>' + (S.rows.length ? 'Nothing matches those filters.' : 'No opportunities yet.') + '</b> ' + (S.rows.length ? '' : 'Use "Add opportunity" to create the first one.') + '</div>';
    else h += '<div class="tw"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Deadline</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (r) {
      var a = [];
      a.push('<button class="btn o s" data-a="preview" data-id="' + esc(r.id) + '">Preview</button>');
      if (canEdit(r)) a.push('<button class="btn o s" data-a="edit" data-id="' + esc(r.id) + '">Edit</button>');
      if (!isAdmin() && r.status === 'draft' && canEdit(r)) a.push('<button class="btn s" data-a="submit" data-id="' + esc(r.id) + '">Submit for approval</button>');
      if (isAdmin()) {
        if (r.status === 'pending' || r.status === 'draft') a.push('<button class="btn s" data-a="publish" data-id="' + esc(r.id) + '">' + (r.status === 'pending' ? 'Approve and publish' : 'Publish') + '</button>');
        if (r.status === 'published') a.push('<button class="btn o s" data-a="archive" data-id="' + esc(r.id) + '">Archive</button>');
        if (r.status === 'archived') a.push('<button class="btn o s" data-a="restore" data-id="' + esc(r.id) + '">Restore to draft</button>');
        a.push('<button class="btn d s" data-a="delete" data-id="' + esc(r.id) + '">Delete</button>');
      }
      var exp = r.deadline && r.deadline < new Date().toISOString().slice(0, 10);
      return '<tr><td><b>' + esc(r.title) + '</b><br><span class="note">' + esc(r.organisation) + '</span></td><td>' + esc(r.category) + '<br><span class="note">' + esc(r.audience) + '</span></td><td><span class="st ' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + '</span>' + (exp ? '<br><span class="note">Expired (hidden from site)</span>' : '') + '</td><td>' + esc(r.deadline || '') + '</td><td>' + esc((r.updated_at || '').slice(0, 10)) + '</td><td><div class="acts">' + a.join('') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
    app.innerHTML = h; bindNav();
    app.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { S.filter.status = b.dataset.s; drawList(); }; });
    var q = $('#q'); q.oninput = function () { S.filter.q = q.value.trim(); var p = q.selectionStart; drawList(); var n = $('#q'); n.focus(); n.setSelectionRange(p, p); };
    $('#cf').onchange = function (e) { S.filter.cat = e.target.value; drawList(); };
    app.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { rowAction(b.dataset.a, b.dataset.id, b); }; });
  }
  function find(id) { return S.rows.filter(function (r) { return r.id === id; })[0]; }
  async function setStatus(id, status, okText, btn) {
    if (btn) btn.disabled = true;
    try { var out = await api(function (t) { return DB.update('opportunities', 'id=eq.' + encodeURIComponent(id), { status: status }, t); }); if (!out || !out.length) throw new Error('Nothing was changed. You may not have permission.'); say(okText); await loadRows(); drawList(); }
    catch (e) { if (!e.handled) say(fmtErr(e), true); if (btn) btn.disabled = false; }
  }
  function rowAction(a, id, btn) {
    var r = find(id); if (!r) return;
    if (a === 'preview') return viewPreview(r, { back: 'list' });
    if (a === 'edit') return viewForm(r);
    if (a === 'submit') return setStatus(id, 'pending', 'Submitted for approval.', btn);
    if (a === 'publish') return viewPreview(r, { back: 'list', publishId: id });
    if (a === 'archive') { if (confirm('Archive "' + r.title + '"? It will disappear from the website.')) setStatus(id, 'archived', 'Archived. It is no longer on the website.', btn); return; }
    if (a === 'restore') return setStatus(id, 'draft', 'Restored to draft.', btn);
    if (a === 'delete') {
      if (!confirm('Delete "' + r.title + '" permanently? This cannot be undone.')) return;
      btn.disabled = true;
      api(function (t) { return DB.remove('opportunities', 'id=eq.' + encodeURIComponent(id), t); }).then(function (o) { if (!o || !o.length) throw new Error('Nothing was deleted. You may not have permission.'); say('Deleted.'); return loadRows().then(drawList); })
        .catch(function (e) { if (!e.handled) say(fmtErr(e), true); btn.disabled = false; });
    }
  }

  /* ---------------- preview (looks like the public listing) ---------------- */
  function link(u, t) { return /^https:\/\//.test(u || '') ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + t + '</a> ' : ''; }
  function viewPreview(r, o) {
    var h = nav('') + '<h2>Preview</h2><p class="note">This is how it will look on the website' + (r.status === 'published' ? ' (it is already published).' : '. It is <b>not public</b> until an administrator publishes it.') + '</p>' +
      '<div class="pv"><h3>' + esc(r.title) + '</h3><p>' + esc([r.organisation, r.location].filter(Boolean).join(', ')) + ' &middot; <span class="note">' + esc(r.category) + ' &middot; ' + esc((AUD.filter(function (a) { return a[0] === r.audience; })[0] || [])[1] || '') + '</span></p><p style="white-space:pre-wrap">' + esc(r.description) + '</p>' +
      (r.eligibility ? '<p><b>Eligibility:</b> ' + esc(r.eligibility) + '</p>' : '') + link(r.apply_url, 'Apply') + link(r.file_url, 'Download') + (r.deadline ? '<p class="note">Deadline: ' + esc(r.deadline) + '</p>' : '') +
      (/\.(jpe?g|png|webp)(\?|$)/i.test(r.file_url || '') && /^https:\/\//.test(r.file_url) ? '<p><img src="' + esc(r.file_url) + '" alt="Poster" style="max-width:100%;max-height:420px"></p>' : '') + '</div><div class="acts" style="margin-top:14px"></div>';
    app.innerHTML = h; bindNav();
    var box = $('.acts', app);
    var back = mk('<button class="btn o" type="button">' + (o.backLabel || 'Back') + '</button>'); back.onclick = o.onBack || function () { viewList(); }; box.appendChild(back);
    if (o.publishId && isAdmin()) {
      var pub = mk('<button class="btn" type="button">Confirm: publish to the website</button>');
      pub.onclick = async function () {
        pub.disabled = true;
        try { await setStatus(o.publishId, 'published', 'Published. It is now live on the website.'); }
        catch (e) { if (!e.handled) say(fmtErr(e), true); pub.disabled = false; }
      };
      box.appendChild(pub);
    }
  }

  /* ---------------- add / edit form ---------------- */
  function viewForm(r, pre) {
    var isNew = !r, d = r || Object.assign({ category: CATS[0], audience: 'both', status: 'draft' }, pre || {});
    var adminStatus = isAdmin() ? '<label>Status<select name="status">' + STATUS.map(function (s) { return '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>'; }).join('') + '</select><small>Choosing "Published" shows a preview first.</small></label>' : '';
    app.innerHTML = nav(isNew ? 'new' : '') + '<h2>' + (isNew ? 'Add an opportunity' : 'Edit opportunity') + '</h2>' +
      '<form class="f" id="of" novalidate><label>Title<input name="title" maxlength="200" value="' + esc(d.title) + '" required></label>' +
      '<label>Organisation<input name="organisation" maxlength="200" value="' + esc(d.organisation) + '" required></label>' +
      '<div class="row"><label>Category<select name="category">' + CATS.map(function (x) { return '<option' + (d.category === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label>Who is it for?<select name="audience">' + AUD.map(function (a) { return '<option value="' + a[0] + '"' + (d.audience === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<label>Description<textarea name="description" rows="6" maxlength="5000" required>' + esc(d.description) + '</textarea><small>10 to 5000 characters. Plain text.</small></label>' +
      '<div class="row"><label>Location (optional)<input name="location" maxlength="200" value="' + esc(d.location) + '"></label><label>Application deadline (optional)<input type="date" name="deadline" value="' + esc(d.deadline) + '"></label></div>' +
      '<label>Application link (optional)<input type="url" name="apply_url" maxlength="2000" placeholder="https://" value="' + esc(d.apply_url) + '"><small>Must start with https://</small></label>' +
      '<label>Eligibility (optional)<textarea name="eligibility" rows="2" maxlength="1000">' + esc(d.eligibility) + '</textarea></label>' +
      '<label>Source or contact (optional, shown to staff only)<input name="source" maxlength="300" value="' + esc(d.source) + '"></label>' +
      '<label>Poster or document<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>JPG, PNG, WebP or PDF, up to 5 MB. Or paste a link below.</small></label>' +
      '<label>Poster or document link (optional)<input type="url" name="file_url" maxlength="2000" placeholder="https://" value="' + esc(d.file_url) + '"></label>' +
      adminStatus + '<span id="fe" class="m er" role="alert" style="padding:0;color:#B5452A"></span><div class="acts" id="fa"></div></form>'; bindNav();
    var f = $('#of'), fa = $('#fa');
    function btn(label, cls, fn) { var b = mk('<button type="button" class="btn ' + cls + '">' + label + '</button>'); b.onclick = function () { fn(b); }; fa.appendChild(b); return b; }
    function read() {
      var v = {}; ['title', 'organisation', 'category', 'audience', 'description', 'location', 'deadline', 'apply_url', 'eligibility', 'source', 'file_url'].forEach(function (k) { v[k] = f.elements[k].value.trim(); });
      return v;
    }
    function check(v) {
      if (v.title.length < 3) return 'Add a title (at least 3 characters).';
      if (v.organisation.length < 2) return 'Add the organisation.';
      if (v.description.length < 10) return 'The description needs at least 10 characters.';
      if (v.apply_url && !/^https:\/\/[^\s]+$/i.test(v.apply_url)) return 'The application link must start with https://';
      if (v.file_url && !/^https:\/\/[^\s]+$/i.test(v.file_url)) return 'The document link must start with https://';
      var file = f.elements.file.files[0];
      if (file) { if (!TYPES[file.type]) return 'Only JPG, PNG, WebP or PDF files can be uploaded.'; if (file.size > MAX) return 'That file is larger than 5 MB.'; }
      return '';
    }
    function payload(v) {
      var p = { title: v.title, organisation: v.organisation, category: v.category, audience: v.audience, description: v.description, location: v.location || null, deadline: v.deadline || null, apply_url: v.apply_url || null, eligibility: v.eligibility || null, source: v.source || null, file_url: v.file_url || null };
      return p;
    }
    async function upload(file) {
      if (!file) return null;
      var path = S.session.user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + '.' + TYPES[file.type];
      await api(function (t) { return DB.request('/storage/v1/object/' + (C.OPPORTUNITY_BUCKET || 'opportunity-files') + '/' + path, { method: 'POST', token: t, body: file, raw: true, timeout: 60000, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } }); });
      return DB.publicFileUrl(path);
    }
    async function persist(v, status, file) {
      var up = await upload(file); var p = payload(v); if (up) p.file_url = up;
      p.status = status;
      if (isNew) { p.created_by = S.session.user.id; await api(function (t) { return DB.insert('opportunities', p, t); }); }
      else { var o = await api(function (t) { return DB.update('opportunities', 'id=eq.' + encodeURIComponent(r.id), p, t); }); if (!o || !o.length) throw new Error('Nothing was saved. You may not have permission to edit this one.'); }
    }
    async function save(status, b) {
      $('#fe').textContent = ''; var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return false; }
      b.disabled = true; var label = b.textContent; b.textContent = 'Saving...';
      try { await persist(v, status, f.elements.file.files[0]); return true; }
      catch (e) { if (!e.handled) $('#fe').textContent = fmtErr(e); return false; }
      finally { b.disabled = false; b.textContent = label; }
    }
    async function done(msg) { say(msg); S.filter = { q: '', status: 'all', cat: 'all' }; await viewList(); }
    btn('Preview', 'o', function () {
      var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return; }
      var fake = Object.assign({}, d, payload(v), { status: d.status }); var file = f.elements.file.files[0];
      if (file) fake.file_url = ''; var snap = f.cloneNode(true);
      /* keep what was typed: return to a re-rendered form filled from the same values */
      viewPreview(fake, { backLabel: 'Back to editing', onBack: function () { if (isNew) viewForm(null, payload(v)); else viewForm(Object.assign({}, d, payload(v), { id: d.id, status: d.status, created_by: d.created_by })); } });
    });
    if (!isAdmin()) {
      btn('Save draft', 'o', async function (b) { if (await save('draft', b)) done('Draft saved.'); });
      btn('Submit for approval', '', async function (b) { if (await save('pending', b)) done('Submitted. An administrator will review it before it is published.'); });
    } else {
      btn('Save', '', async function (b) {
        var st = f.elements.status.value;
        if (st === 'published' && d.status !== 'published') {
          var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return; }
          var fileObj = f.elements.file.files[0];
          var fake = Object.assign({}, d, payload(v), { status: 'draft', file_url: fileObj ? '' : v.file_url });
          viewPreview(fake, { backLabel: 'Back to editing', onBack: function () { if (isNew) viewForm(null, Object.assign(payload(v), { status: 'published' })); else viewForm(Object.assign({}, d, payload(v), { id: d.id, created_by: d.created_by })); } });
          var pub = mk('<button class="btn" type="button">Confirm: publish to the website</button>'); $('.acts', app).appendChild(pub);
          if (fileObj) $('.acts', app).insertAdjacentHTML('beforebegin', '<p class="note">The file you chose will be uploaded when you publish.</p>');
          pub.onclick = async function () {
            pub.disabled = true;
            try { await persist(v, 'published', fileObj); await done('Published. It is now live on the website.'); }
            catch (e) { if (!e.handled) say(fmtErr(e), true); pub.disabled = false; }
          };
          return;
        }
        if (await save(st, b)) done(st === 'published' ? 'Changes saved.' : 'Saved.');
      });
    }
    btn('Cancel', 'o', function () { viewList(); });
  }

  /* ---------------- sign-ups and portfolios (admins) ---------------- */
  function csvCell(x) { var s = x == null ? '' : Array.isArray(x) ? x.join('; ') : String(x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function downloadCsv(name, cols, rows) {
    var out = [cols.map(csvCell).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  async function viewPeople(tab) {
    var tabs = [['interest', 'Graduate network'], ['alerts', 'Alert interest'], ['portfolios', 'Portfolios to review']];
    var head = nav('people') + '<h2>Sign-ups and portfolios</h2><p class="note">Personal details. Handle with care and only use them for what people agreed to.</p><div class="tabs">' + tabs.map(function (t) { return '<button type="button" data-t="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    app.innerHTML = head + '<p>Loading...</p>'; bindNav();
    app.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { viewPeople(b.dataset.t); }; });
    try {
      if (tab === 'interest') {
        var rows = await api(function (t) { return DB.select('graduate_interest', 'select=*&order=created_at.desc&limit=1000', t); }) || [];
        var cols = ['created_at', 'interest_type', 'full_name', 'email', 'university', 'graduation_year', 'location', 'skills', 'interests', 'portfolio_url', 'consent'];
        table(head, rows, cols, 'graduate-network.csv', 'graduate_interest');
      } else if (tab === 'alerts') {
        var al = await api(function (t) { return DB.select('alert_subscriptions', 'select=id,email,categories,consent,confirmed_at,unsubscribed_at,created_at&order=created_at.desc&limit=1000', t); }) || [];
        table(head, al, ['created_at', 'email', 'categories', 'consent', 'confirmed_at', 'unsubscribed_at'], 'alert-interest.csv', 'alert_subscriptions', '<p class="note">No alert emails are being sent yet. This list only records interest.</p>');
      } else {
        var ps = await api(function (t) { return DB.select('portfolio_submissions', 'select=*&order=created_at.desc&limit=500', t); }) || [];
        portfolios(head, ps);
      }
    } catch (e) { if (!e.handled) { app.innerHTML = head + '<div class="card"><b>Could not load.</b><p>' + esc(fmtErr(e)) + '</p></div>'; bindNav(); app.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { viewPeople(b.dataset.t); }; }); } }
  }
  function table(head, rows, cols, file, tbl, extra) {
    app.innerHTML = head + (extra || '') + (rows.length ? '<p><button class="btn o s" id="csv" type="button">Download CSV (' + rows.length + ')</button></p><div class="tw"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c.replace(/_/g, ' ')) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { var v = Array.isArray(r[c]) ? r[c].join(', ') : r[c]; if (/_at$/.test(c) && v) v = String(v).slice(0, 10); return '<td>' + esc(v) + '</td>'; }).join('') + '<td><button class="btn d s" data-del="' + esc(r.id) + '">Delete</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="card"><b>Nothing here yet.</b></div>'); bindNav();
    app.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { viewPeople(b.dataset.t); }; });
    var c = $('#csv'); if (c) c.onclick = function () { downloadCsv(file, cols, rows); };
    app.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('Delete this record permanently? Use this to honour a removal request.')) return;
        api(function (t) { return DB.remove(tbl, 'id=eq.' + encodeURIComponent(b.dataset.del), t); }).then(function () { say('Deleted.'); viewPeople(tbl === 'graduate_interest' ? 'interest' : 'alerts'); }).catch(function (e) { if (!e.handled) say(fmtErr(e), true); });
      };
    });
  }
  function portfolios(head, rows) {
    app.innerHTML = head + '<p class="note">Approving makes the name, university, year, headline, bio and portfolio link public on the Graduate Hub. The email is never shown. Check the link opens a real portfolio first.</p>' + (rows.length ? rows.map(function (r) {
      return '<div class="card"><span class="st ' + esc(r.status) + '">' + esc(r.status) + '</span> <b>' + esc(r.full_name) + '</b> &middot; ' + esc(r.university) + ' ' + esc(r.graduation_year) + '<br>' + esc(r.headline) + (r.bio ? '<br><span class="note">' + esc(r.bio) + '</span>' : '') + '<br>' + link(r.portfolio_url, 'Open portfolio (new tab)') + '<span class="note">' + esc(r.email) + '</span>' +
        '<div class="acts" style="margin-top:8px"><button class="btn s" data-p="approved" data-id="' + esc(r.id) + '">Approve</button><button class="btn o s" data-p="rejected" data-id="' + esc(r.id) + '">Reject</button><button class="btn d s" data-p="delete" data-id="' + esc(r.id) + '">Delete</button></div></div>';
    }).join('') : '<div class="card"><b>No portfolio submissions yet.</b></div>'); bindNav();
    app.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { viewPeople(b.dataset.t); }; });
    app.querySelectorAll('[data-p]').forEach(function (b) {
      b.onclick = function () {
        var id = encodeURIComponent(b.dataset.id), a = b.dataset.p; if (a === 'delete' && !confirm('Delete this submission permanently?')) return;
        b.disabled = true;
        api(function (t) { return a === 'delete' ? DB.remove('portfolio_submissions', 'id=eq.' + id, t) : DB.update('portfolio_submissions', 'id=eq.' + id, { status: a }, t); })
          .then(function (o) { if (!o || !o.length) throw new Error('Nothing changed. Only administrators can do this.'); say(a === 'approved' ? 'Approved. It is now on the Graduate Hub.' : a === 'rejected' ? 'Rejected.' : 'Deleted.'); viewPeople('portfolios'); })
          .catch(function (e) { if (!e.handled) say(fmtErr(e), true); b.disabled = false; });
      };
    });
  }

  /* ---------------- boot ---------------- */
  if (!DB || !DB.configured()) { app.innerHTML = '<div class="card"><h2>Not connected</h2><p>The Supabase connection details in config.js are missing or invalid.</p></div>'; return; }
  var h = location.hash || '';
  if (/type=recovery/.test(h) && /access_token=/.test(h)) { var m = h.match(/access_token=([^&]+)/); renderNewPassword(decodeURIComponent(m[1])); return; }
  loadSession();
  if (S.session) start(); else renderLogin();
})();
