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
  var MAX = 25 * 1024 * 1024, TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

  var S = { session: null, role: null, profileName: '', preferences: {}, page: 0, rows: [], filter: { q: '', status: 'all', cat: 'all', aud: 'all', dl: 'all', sort: 'updated' } };

  function esc(x) { return x == null ? '' : String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function say(text, bad) { var m = $('#msg'); m.innerHTML = text ? '<p class="m ' + (bad ? 'er' : 'ok') + '">' + esc(text) + '</p>' : ''; if (text && !bad) setTimeout(function () { if (m.textContent === text) m.innerHTML = ''; }, 6000); }
  function fmtErr(e) {
    if (!e) return 'Something went wrong.';
    if (e.code === 'network') return e.message;
    if (e.status === 429 || /rate limit|only request this after/i.test(e.message || '')) return 'Too many emails have been requested. Please wait a few minutes before trying again.';
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
    S.session = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || (Math.floor(Date.now() / 1000) + (r.expires_in || 3600)), user: { id: r.user.id, email: r.user.email, user_metadata: r.user.user_metadata || {} } };
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
    setPath('/admin/login');
    app.innerHTML = '<div class="login card"><h2>Log in</h2>' +
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
    $('#who').textContent = ((S.session.user.user_metadata && (S.session.user.user_metadata.full_name || S.session.user.user_metadata.name)) || S.session.user.email) + (S.role ? ' (' + S.role + ')' : '');
    $('#out').hidden = false;
    if (!S.role) { app.innerHTML = '<div class="card"><h2>No access yet</h2><p>You are logged in as ' + esc(S.session.user.email) + ', but this account has not been given access. Ask an ASA Kenya administrator to add you, then log in again.</p><p class="note">You will be taken back to the website in a few seconds.</p></div>'; setTimeout(function () { if (!S.role && /^\/admin(\/|$)/.test(location.pathname)) location.href = '/'; }, 6000); return; }
    S.profileName = (S.session.user.user_metadata && (S.session.user.user_metadata.full_name || S.session.user.user_metadata.name)) || '';
    loadPreferences(); applyPreferences();
    S.admin = S.role === 'admin'; route();
  }
  function isAdmin() { return S.role === 'admin'; }

  /* ---------------- routing between views ---------------- */
  function nav(active) {
    var b = [['home', 'Overview'], ['list', 'Opportunities'], ['new', 'Add opportunity'], ['profile', 'My profile'], ['customize', 'Customize dashboard']];
    if (isAdmin()) b.push(['access', 'Access requests']);
    if (isAdmin()) b.push(['subs', 'Student submissions']); b.push(['events', 'Events']); if (isAdmin()) b.push(['news', 'Announcements'], ['people', 'Sign-ups and portfolios'], ['staff', 'Staff and roles']);
    /* The two wrapper divs are closed by the browser at the end of the page fragment. */
    return '<div class="shell"><aside class="side" aria-label="Dashboard menu">' + b.map(function (x) { return '<button type="button" class="' + (x[0] === active ? 'on' : '') + '" data-v="' + x[0] + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>' + x[1] + '</button>'; }).join('') + '</aside><div class="main">';
  }
  function bindNav() { app.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { go(b.dataset.v); }; }); }
  function go(v, arg) {
    say('');
    if (v === 'home') return viewHome(); if (v === 'list') return viewList(); if (v === 'new') return viewForm(null); if (v === 'edit') return viewForm(arg);
    if (v === 'profile') return viewProfile(); if (v === 'customize') return viewCustomize();
    if (v === 'people') return viewPeople('interest'); if (v === 'events' || v === 'news') return viewContent(v);
    if (v === 'staff') return viewStaff();
    if (v === 'access') { if (!isAdmin()) { say('Only administrators can review access requests.', true); return viewHome(); } return viewAccessRequests(); }
    if (v === 'subs') return viewSubs();
  }
  function route() { setPath('/admin'); if (S.preferences && S.preferences.startPage === 'list') viewList(); else viewHome(); }
  function setPath(p) { try { if (/^\/admin(\/|$)/.test(location.pathname) && location.pathname.replace(/\/$/, '') !== p) history.replaceState(null, '', p); } catch (e) { } }

  /* ---------------- profile and dashboard preferences ---------------- */
  function preferenceKey() { return 'asa_admin_preferences_' + (S.session && S.session.user ? S.session.user.id : 'guest'); }
  function loadPreferences() {
    var defaults = { theme: 'forest', compact: false, startPage: 'home' };
    try { S.preferences = Object.assign(defaults, JSON.parse(localStorage.getItem(preferenceKey()) || '{}')); }
    catch (e) { S.preferences = defaults; }
    if (['forest', 'ocean', 'slate'].indexOf(S.preferences.theme) < 0) S.preferences.theme = 'forest';
    if (['home', 'list'].indexOf(S.preferences.startPage) < 0) S.preferences.startPage = 'home';
  }
  function applyPreferences() {
    var p = S.preferences || {};
    document.body.setAttribute('data-admin-theme', p.theme || 'forest');
    document.body.classList.toggle('admin-compact', !!p.compact);
  }
  function savePreferences() {
    try { localStorage.setItem(preferenceKey(), JSON.stringify(S.preferences)); applyPreferences(); return true; }
    catch (e) { say('Could not save preferences in this browser. Check browser storage settings.', true); return false; }
  }
  function viewCustomize() {
    var p = S.preferences || { theme: 'forest', compact: false, startPage: 'home' };
    app.innerHTML = nav('customize') + '<h2>Customize dashboard</h2><p class="note">Personalize the look and starting page of your ASAKenya workspace. These settings are saved in this browser for your account.</p>' +
      '<div class="card"><h3>Colour theme</h3><div class="theme-options">' +
      '<label class="theme-choice"><input type="radio" name="theme" value="forest"' + (p.theme === 'forest' ? ' checked' : '') + '><span class="theme-swatch forest-swatch"></span><b>Forest</b><small>ASAKenya green and warm cream</small></label>' +
      '<label class="theme-choice"><input type="radio" name="theme" value="ocean"' + (p.theme === 'ocean' ? ' checked' : '') + '><span class="theme-swatch ocean-swatch"></span><b>Ocean</b><small>Deep blue and cool light tones</small></label>' +
      '<label class="theme-choice"><input type="radio" name="theme" value="slate"' + (p.theme === 'slate' ? ' checked' : '') + '><span class="theme-swatch slate-swatch"></span><b>Slate</b><small>Neutral charcoal and silver</small></label>' +
      '</div></div><div class="card"><h3>Workspace layout</h3><label class="setting-row"><span><b>Compact layout</b><small>Reduce spacing so more information fits on screen.</small></span><input id="prefCompact" type="checkbox"' + (p.compact ? ' checked' : '') + '></label>' +
      '<label class="setting-row"><span><b>Starting page</b><small>Choose what opens after you sign in.</small></span><select id="prefStart"><option value="home"' + (p.startPage === 'home' ? ' selected' : '') + '>Overview</option><option value="list"' + (p.startPage === 'list' ? ' selected' : '') + '>Opportunities</option></select></label>' +
      '<div class="acts" style="margin-top:18px"><button type="button" class="btn" id="savePrefs">Save preferences</button><button type="button" class="btn o" id="resetPrefs">Reset to default</button></div></div>';
    bindNav();
    $('#savePrefs').onclick = function () {
      var theme = app.querySelector('input[name="theme"]:checked');
      S.preferences = { theme: theme ? theme.value : 'forest', compact: $('#prefCompact').checked, startPage: $('#prefStart').value };
      if (savePreferences()) say('Dashboard preferences saved.');
    };
    $('#resetPrefs').onclick = function () {
      S.preferences = { theme: 'forest', compact: false, startPage: 'home' };
      savePreferences(); viewCustomize(); say('Dashboard preferences reset.');
    };
  }
  async function viewProfile() {
    var u = S.session && S.session.user || {};
    var meta = u.user_metadata || {};
    var profile = {
      full_name: meta.full_name || meta.name || S.profileName || '',
      avatar_url: meta.avatar_url || '',
      university: meta.university || '',
      course: meta.course || '',
      study_year: meta.study_year || '',
      phone: meta.phone || '',
      bio: meta.bio || '',
      motivation_message: meta.motivation_message || ''
    };
    app.innerHTML = nav('profile') + '<h2>My profile</h2><p class="note">Edit your profile photo, personal details, and the motivational message shown on your workspace. Changes are saved to your account.</p>' +
      '<div class="card"><h3>Profile details</h3><form id="profileForm" class="f">' +
      '<label>Full name<input name="full_name" maxlength="120" autocomplete="name" value="' + esc(profile.full_name) + '" placeholder="Your full name" required></label>' +
      '<label>Profile photo<input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp"><small>Choose a JPG, PNG or WebP image from your device (up to 10 MB). Leave empty to keep your current photo.</small></label>' +
      '<label>University / institution<input name="university" maxlength="160" value="' + esc(profile.university) + '" placeholder="Your university or institution"></label>' +
      '<label>Course / programme<input name="course" maxlength="160" value="' + esc(profile.course) + '" placeholder="Architecture, Interior Design, etc."></label>' +
      '<label>Year of study / graduation year<input name="study_year" maxlength="20" value="' + esc(profile.study_year) + '" placeholder="e.g. Year 3 or 2025"></label>' +
      '<label>Phone number<input name="phone" type="tel" maxlength="40" autocomplete="tel" value="' + esc(profile.phone) + '" placeholder="+254…"></label>' +
      '<label>Short bio<textarea name="bio" maxlength="600" rows="4" placeholder="Tell the ASAKenya network a little about yourself">' + esc(profile.bio) + '</textarea><small>Up to 600 characters.</small></label>' +
      '<label>My workspace motivation<textarea name="motivation_message" maxlength="300" rows="3" placeholder="e.g. Every great building starts with a bold idea.">' + esc(profile.motivation_message) + '</textarea><small>This editable message appears near the bottom of your workspace. Leave blank to use the default encouragement.</small></label>' +
      '<label>Email address<input value="' + esc(u.email || '') + '" readonly aria-readonly="true"><small>Email is read-only here to protect account recovery and sign-in.</small></label>' +
      '<label>Account role<input value="' + esc(S.role || 'staff') + '" readonly aria-readonly="true"></label><div class="acts"><button class="btn" type="submit">Save profile</button></div></form></div>' +
      '<div class="card"><h3>Change password</h3><form id="passwordForm" class="f"><label>New password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label><label>Confirm new password<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label><div class="acts"><button class="btn" type="submit">Update password</button></div></form></div>';
    bindNav();
    $('#profileForm').onsubmit = async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = $('button[type="submit"]', f);
      var name = f.full_name.value.trim();
      var avatarFile = f.avatar_file.files && f.avatar_file.files[0];
      var avatar = (S.session.user.user_metadata || {}).avatar_url || '';
      var university = f.university.value.trim();
      var course = f.course.value.trim();
      var studyYear = f.study_year.value.trim();
      var phone = f.phone.value.trim();
      var bio = f.bio.value.trim();
      var motivation = f.motivation_message.value.trim();
      if (name.length < 2) { say('Enter your full name (at least 2 characters).', true); return; }
      if (avatarFile && (!/^image\/(jpeg|png|webp)$/.test(avatarFile.type) || avatarFile.size > 10 * 1024 * 1024)) { say('Choose a JPG, PNG or WebP image up to 10 MB.', true); return; }
      if (university.length > 160 || course.length > 160 || studyYear.length > 20 || phone.length > 40 || bio.length > 600 || motivation.length > 300) { say('One or more profile fields are too long. Please shorten them and try again.', true); return; }
      b.disabled = true;
      try {
        if (avatarFile) avatar = await uploadFile(avatarFile);
        var data = { full_name: name, name: name, avatar_url: avatar, university: university, course: course, study_year: studyYear, phone: phone, bio: bio, motivation_message: motivation };
        var res = await api(function (t) { return DB.request('/auth/v1/user', { method: 'PUT', token: t, body: { data: data } }); });
        S.profileName = name;
        S.session.user.user_metadata = Object.assign({}, S.session.user.user_metadata || {}, data);
        if (res && res.user_metadata) S.session.user.user_metadata = res.user_metadata;
        if (res && res.email) S.session.user.email = res.email;
        saveSession();
        $('#who').textContent = name + ' · ' + S.session.user.email + (S.role ? ' (' + S.role + ')' : '');
        say('Your profile has been saved.');
      } catch (e) { if (!e.handled) say(fmtErr(e), true); }
      finally { b.disabled = false; }
    };
    $('#passwordForm').onsubmit = async function (ev) {
      ev.preventDefault(); var f = ev.target, b = $('button[type="submit"]', f);
      if (f.password.value.length < 8) { say('Use at least 8 characters.', true); return; }
      if (f.password.value !== f.confirm.value) { say('The passwords do not match.', true); return; }
      b.disabled = true;
      try {
        await api(function (t) { return DB.request('/auth/v1/user', { method: 'PUT', token: t, body: { password: f.password.value } }); });
        f.reset(); say('Password updated successfully.');
      } catch (e) { if (!e.handled) say(fmtErr(e), true); }
      finally { b.disabled = false; }
    };
  }

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
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var SORTS = [['updated', 'Recently updated'], ['newest', 'Newest first'], ['deadline', 'Deadline, soonest first'], ['title', 'Title A-Z']];
  function filteredRows() {
    var f = S.filter, t0 = today(), wk = addDays(t0, 7);
    var rows = S.rows.filter(function (r) {
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.cat !== 'all' && r.category !== f.cat) return false;
      if (f.aud !== 'all' && r.audience !== f.aud) return false;
      if (f.dl === 'expired' && !(r.deadline && r.deadline < t0)) return false;
      if (f.dl === 'upcoming' && !(r.deadline && r.deadline >= t0)) return false;
      if (f.dl === 'week' && !(r.deadline && r.deadline >= t0 && r.deadline <= wk)) return false;
      if (f.dl === 'none' && r.deadline) return false;
      var q = f.q.toLowerCase(); return !q || (r.title + ' ' + r.organisation + ' ' + (r.location || '') + ' ' + (r.source || '')).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      if (f.sort === 'title') return String(a.title).localeCompare(String(b.title));
      if (f.sort === 'deadline') return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : 0;
      if (f.sort === 'newest') return String(b.created_at).localeCompare(String(a.created_at));
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });
    return rows;
  }
  var OPP_CSV_COLS = ['id', 'title', 'organisation', 'category', 'audience', 'status', 'deadline', 'location', 'apply_url', 'file_url', 'eligibility', 'source', 'created_at', 'updated_at'];
  function drawList() {
    var f = S.filter, c = counts();
    var rows = filteredRows();
    var total = rows.length, per = 15, pages = Math.max(1, Math.ceil(total / per)); if (S.page >= pages) S.page = pages - 1; if (S.page < 0) S.page = 0;
    rows = rows.slice(S.page * per, S.page * per + per);
    var tabs = [['all', 'All']].concat(STATUS.map(function (s) { return [s, STATUS_LABEL[s]]; })).map(function (t) { return '<button type="button" data-s="' + t[0] + '" aria-pressed="' + (f.status === t[0]) + '">' + t[1] + ' (' + c[t[0]] + ')</button>'; }).join('');
    var h = nav('list') + '<h2>Opportunities</h2>' + (isAdmin() ? '' : '<p class="note">You can add opportunities and submit them for approval. An administrator publishes them.</p>') +
      '<div class="tabs" role="group" aria-label="Status">' + tabs + '</div>' +
      '<div class="tools"><label class="grow">Search<input id="q" type="search" value="' + esc(f.q) + '" placeholder="Title, organisation, location, source"></label><label>Category<select id="cf"><option value="all">All categories</option>' + CATS.map(function (x) { return '<option' + (f.cat === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label>Audience<select id="af"><option value="all">Everyone</option>' + AUD.map(function (a) { return '<option value="' + a[0] + '"' + (f.aud === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Deadline<select id="df"><option value="all">Any deadline</option><option value="upcoming"' + (f.dl === 'upcoming' ? ' selected' : '') + '>Upcoming</option><option value="week"' + (f.dl === 'week' ? ' selected' : '') + '>Due in 7 days</option><option value="expired"' + (f.dl === 'expired' ? ' selected' : '') + '>Expired</option><option value="none"' + (f.dl === 'none' ? ' selected' : '') + '>No deadline</option></select></label>' +
      '<label>Sort by<select id="sf">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + (f.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="btn o s" id="clf">Clear filters</button><button type="button" class="btn o s" id="csv">Download CSV (' + total + ')</button></div>';
    if (!rows.length) h += '<div class="card"><b>' + (S.rows.length ? 'Nothing matches those filters.' : 'No opportunities yet.') + '</b> ' + (S.rows.length ? '' : 'Use "Add opportunity" to create the first one.') + '</div>';
    else h += '<div class="tw"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Deadline</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (r) {
      var a = [];
      a.push('<button class="btn o s" data-a="preview" data-id="' + esc(r.id) + '">Preview</button>');
      if (canEdit(r)) a.push('<button class="btn o s" data-a="edit" data-id="' + esc(r.id) + '">Edit</button>');
      if (!isAdmin() && r.status === 'draft' && canEdit(r)) a.push('<button class="btn s" data-a="submit" data-id="' + esc(r.id) + '">Submit for approval</button>');
      if (isAdmin()) {
        if (r.status === 'pending' || r.status === 'draft') a.push('<button class="btn s" data-a="publish" data-id="' + esc(r.id) + '">' + (r.status === 'pending' ? 'Approve and publish' : 'Publish') + '</button>');
        if (r.status === 'published') a.push('<button class="btn o s" data-a="unpublish" data-id="' + esc(r.id) + '">Unpublish</button>');
        if (r.status === 'published') a.push('<button class="btn o s" data-a="archive" data-id="' + esc(r.id) + '">Archive</button>');
        if (r.status === 'archived') a.push('<button class="btn o s" data-a="restore" data-id="' + esc(r.id) + '">Restore to draft</button>');
        a.push('<button class="btn d s" data-a="delete" data-id="' + esc(r.id) + '">Delete</button>');
      }
      var exp = r.deadline && r.deadline < new Date().toISOString().slice(0, 10);
      return '<tr><td><b>' + esc(r.title) + '</b><br><span class="note">' + esc(r.organisation) + '</span></td><td>' + esc(r.category) + '<br><span class="note">' + esc(r.audience) + '</span></td><td><span class="st ' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + '</span>' + (exp ? '<br><span class="note">Expired (hidden from site)</span>' : '') + '</td><td>' + esc(r.deadline || '') + '</td><td>' + esc((r.updated_at || '').slice(0, 10)) + '</td><td><div class="acts">' + a.join('') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>' + pager(S.page, pages, total);
    app.innerHTML = h; bindNav(); bindPager(function (p) { S.page = p; drawList(); });
    app.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { S.filter.status = b.dataset.s; S.page = 0; drawList(); }; });
    var q = $('#q'); q.oninput = function () { S.filter.q = q.value.trim(); S.page = 0; var p = q.selectionStart; drawList(); var n = $('#q'); n.focus(); n.setSelectionRange(p, p); };
    $('#cf').onchange = function (e) { S.filter.cat = e.target.value; S.page = 0; drawList(); };
    $('#af').onchange = function (e) { S.filter.aud = e.target.value; S.page = 0; drawList(); };
    $('#df').onchange = function (e) { S.filter.dl = e.target.value; S.page = 0; drawList(); };
    $('#sf').onchange = function (e) { S.filter.sort = e.target.value; S.page = 0; drawList(); };
    $('#clf').onclick = function () { S.filter = { q: '', status: 'all', cat: 'all', aud: 'all', dl: 'all', sort: 'updated' }; S.page = 0; drawList(); };
    $('#csv').onclick = function () { downloadCsv('opportunities.csv', OPP_CSV_COLS, filteredRows()); };
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
    if (a === 'unpublish') { if (confirm('Unpublish "' + r.title + '"? It will go back to draft and disappear from the website.')) setStatus(id, 'draft', 'Unpublished. It is now a draft.', btn); return; }
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
    if (o.publish && isAdmin()) {
      var pb = mk('<button class="btn" type="button">Confirm: publish to the website</button>');
      pb.onclick = async function () { pb.disabled = true; try { await o.publish(); } catch (e) { if (!e.handled) say(fmtErr(e), true); pb.disabled = false; } };
      box.appendChild(pb);
    }
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
      '<label>Poster or document<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>JPG, PNG, WebP or PDF, up to 25 MB. Or paste a link below.</small></label>' +
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
      if (file) { if (!TYPES[file.type]) return 'Only JPG, PNG, WebP or PDF files can be uploaded.'; if (file.size > MAX) return 'That file is larger than 25 MB.'; }
      return '';
    }
    function payload(v) {
      var p = { title: v.title, organisation: v.organisation, category: v.category, audience: v.audience, description: v.description, location: v.location || null, deadline: v.deadline || null, apply_url: v.apply_url || null, eligibility: v.eligibility || null, source: v.source || null, file_url: v.file_url || null };
      return p;
    }
    async function upload(file) {
      if (!file) return null;
      var path = S.session.user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + '.' + TYPES[file.type];
      await api(function (t) { return DB.request('/storage/v1/object/' + (C.OPPORTUNITY_BUCKET || 'opportunity-files') + '/' + path, { method: 'POST', token: t, body: file, raw: true, timeout: 180000, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } }); });
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
    async function done(msg) { say(msg); S.filter = { q: '', status: 'all', cat: 'all', aud: 'all', dl: 'all', sort: 'updated' }; await viewList(); }
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
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + out], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
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

  /* ---------------- staff and roles (administrators) ----------------
     Uses SECURITY DEFINER functions from supabase/migrations/004_staff_management.sql.
     The database checks is_admin() again on every call, so the buttons only reflect access. */
  function staffErr(e) {
    var m = (e && e.message) || '';
    if (/no_user/.test(m)) return 'No account exists with that email. Create it first under Authentication, then Users, in Supabase.';
    if (/bad_role/.test(m)) return 'Role must be editor or admin.';
    if (/not_admin/.test(m)) return 'Only administrators can manage staff.';
    if (/cannot_change_self/.test(m)) return 'You cannot change or remove your own admin role here. Use SQL if you really mean it.';
    if (/last_admin/.test(m)) return 'That would leave the site with no administrator. Give someone else the admin role first.';
    return fmtErr(e);
  }
  async function viewStaff() {
    if (!isAdmin()) { say('Only administrators can manage this.', true); return viewHome(); }
    var head = nav('staff') + '<h2>Staff and roles</h2><p class="note">Editors add and submit opportunities. Administrators can also publish, and manage events, announcements, sign-ups and staff.</p>';
    app.innerHTML = head + '<p>Loading...</p>'; bindNav();
    var rows;
    try { rows = await api(function (t) { return DB.rpc('list_staff', {}, t); }) || []; }
    catch (e) {
      if (e.handled) return;
      var missing = e.status === 404 || /PGRST202|not find the function|could not find/i.test(e.message || '');
      app.innerHTML = head + '<div class="card"><b>' + (missing ? 'Staff management is not switched on yet.' : 'Could not load staff.') + '</b><p>' + esc(missing ? 'Run the SQL in supabase/migrations/004_staff_management.sql in the Supabase SQL Editor once (see SETUP-SUPABASE.md), then reload this page.' : fmtErr(e)) + '</p></div>';
      bindNav(); return;
    }
    app.innerHTML = head +
      '<div class="card"><h3>Add or update a staff member</h3><form class="f" id="sf2" style="max-width:520px"><div class="row"><label>Email<input type="email" name="email" required placeholder="person@example.org"></label><label>Role<select name="role"><option value="editor">Editor</option><option value="admin">Administrator</option></select></label></div><div class="acts"><button class="btn" type="submit">Save role</button></div><span class="note">The person must already have a login account (Supabase, Authentication, then Users). Saving a role for an email that already has one updates it.</span></form></div>' +
      (rows.length ? '<div class="tw"><table><thead><tr><th>Email</th><th>Role</th><th>Staff since</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (r) {
        var self = S.session.user.email && r.email && r.email.toLowerCase() === S.session.user.email.toLowerCase();
        return '<tr><td><b>' + esc(r.email) + '</b>' + (self ? ' <span class="note">(you)</span>' : '') + '</td><td><span class="st ' + (r.role === 'admin' ? 'published' : 'draft') + '">' + esc(r.role) + '</span></td><td>' + esc(String(r.created_at || '').slice(0, 10)) + '</td><td><div class="acts">' +
          '<button class="btn o s" data-swap="' + esc(r.email) + '" data-role="' + esc(r.role) + '"' + (self ? ' disabled' : '') + '>' + (r.role === 'admin' ? 'Make editor' : 'Make admin') + '</button>' +
          '<button class="btn d s" data-rm="' + esc(r.email) + '"' + (self ? ' disabled' : '') + '>Remove access</button></div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card"><b>No staff found.</b></div>');
    bindNav();
    $('#sf2').onsubmit = async function (ev) {
      ev.preventDefault(); var f = ev.target, b = $('button', f); b.disabled = true;
      try { await api(function (t) { return DB.rpc('set_staff_role', { p_email: f.email.value.trim(), p_role: f.role.value }, t); }); say('Role saved.'); viewStaff(); }
      catch (e) { if (!e.handled) { say(staffErr(e), true); b.disabled = false; } }
    };
    app.querySelectorAll('[data-swap]').forEach(function (b) {
      b.onclick = async function () {
        var nr = b.dataset.role === 'admin' ? 'editor' : 'admin';
        if (!confirm('Change ' + b.dataset.swap + ' to ' + nr + '?')) return;
        b.disabled = true;
        try { await api(function (t) { return DB.rpc('set_staff_role', { p_email: b.dataset.swap, p_role: nr }, t); }); say('Role updated.'); viewStaff(); }
        catch (e) { if (!e.handled) { say(staffErr(e), true); b.disabled = false; } }
      };
    });
    app.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('Remove all access for ' + b.dataset.rm + '? Their login account stays, but they will no longer be staff.')) return;
        b.disabled = true;
        try { await api(function (t) { return DB.rpc('remove_staff', { p_email: b.dataset.rm }, t); }); say('Access removed.'); viewStaff(); }
        catch (e) { if (!e.handled) { say(staffErr(e), true); b.disabled = false; } }
      };
    });
  }

  /* ---------------- registered account access approvals ----------------
     Staff may approve a verified signup for editor access. The database RPC
     checks staff membership and never allows this workflow to grant admin. */
  function accessRequestErr(e) {
    var m = (e && e.message) || '';
    if (/not_admin/.test(m)) return 'Only administrators can approve account access.';
    if (/email_not_verified/.test(m)) return 'This email has not been verified yet. Ask the person to confirm their email first.';
    if (/already_staff/.test(m)) return 'This account already has staff access. Reload the list.';
    if (/no_user/.test(m)) return 'No registered account was found for that email.';
    return fmtErr(e);
  }
  async function viewAccessRequests() {
    if (!isAdmin()) { say('Only administrators can review access requests.', true); return viewHome(); }
    app.innerHTML = nav('access') + '<h2>Access requests</h2><p class="note">Review newly registered ASAKenya accounts. This page is available to administrators only. Approving grants <b>Editor</b> access only. Email addresses must be verified first; this page cannot grant administrator privileges.</p><p>Loading registered accounts...</p>';
    bindNav();
    var rows;
    try {
      rows = await api(function (t) { return DB.rpc('list_access_requests', {}, t); }) || [];
    } catch (e) {
      if (e.handled) return;
      var missing = e.status === 404 || /PGRST202|not find the function|could not find/i.test(e.message || '');
      app.innerHTML = nav('access') + '<h2>Access requests</h2><div class="card"><b>' + (missing ? 'Access approvals are not switched on yet.' : 'Could not load registered accounts.') + '</b><p>' + esc(missing ? 'The database approval migration is missing. Run supabase/migrations/010_editor_signup_approval.sql in the Supabase SQL Editor, then reload.' : fmtErr(e)) + '</p></div>';
      bindNav(); return;
    }
    var verified = rows.filter(function (r) { return !!r.email_confirmed_at; }).length;
    var h = nav('access') + '<h2>Access requests</h2><p class="note">Approving grants Editor access only. Unverified email addresses cannot be approved yet.</p>' +
      '<div class="stats"><div class="stat"><b>' + rows.length + '</b><span>Accounts awaiting access</span></div><div class="stat"><b>' + verified + '</b><span>Email verified</span></div></div>';
    if (!rows.length) h += '<div class="card"><b>No new accounts are awaiting access.</b><p>When someone registers and confirms their email, their account will appear here until a staff member approves it.</p></div>';
    else h += '<div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Email status</th><th>Action</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var ok = !!r.email_confirmed_at;
        return '<tr><td>' + esc(r.full_name || '—') + '</td><td><b>' + esc(r.email) + '</b></td><td>' + esc(String(r.registered_at || '').slice(0, 10)) + '</td><td><span class="st ' + (ok ? 'published' : 'draft') + '">' + (ok ? 'Verified' : 'Not verified') + '</span></td><td><button type="button" class="btn s" data-approve-email="' + esc(r.email) + '"' + (ok ? '' : ' disabled title="Email must be verified first"') + '>Approve as editor</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    app.innerHTML = h; bindNav();
    app.querySelectorAll('[data-approve-email]').forEach(function (b) {
      b.onclick = async function () {
        var email = b.getAttribute('data-approve-email');
        if (!confirm('Approve ' + email + ' for ASAKenya Editor access? This does not grant administrator privileges.')) return;
        b.disabled = true;
        try {
          await api(function (t) { return DB.rpc('approve_editor_access', { p_email: email }, t); });
          say('Approved ' + email + ' as an editor.');
          await viewAccessRequests();
        } catch (e) {
          if (!e.handled) say(accessRequestErr(e), true);
          b.disabled = false;
        }
      };
    });
  }

  /* ---------------- shared helpers (pager, dates, uploads) ---------------- */
  function pager(page, pages, total) {
    if (total <= 15) return '<p class="note">' + total + ' item' + (total === 1 ? '' : 's') + '</p>';
    return '<div class="pager"><button type="button" class="btn o s" data-pg="' + (page - 1) + '"' + (page <= 0 ? ' disabled' : '') + '>Previous</button><span>Page ' + (page + 1) + ' of ' + pages + ' (' + total + ' items)</span><button type="button" class="btn o s" data-pg="' + (page + 1) + '"' + (page >= pages - 1 ? ' disabled' : '') + '>Next</button></div>';
  }
  function bindPager(fn) { app.querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { fn(parseInt(b.dataset.pg, 10)); }; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  function fmtTime(t) { if (!t) return ''; var p = String(t).split(':'), h = +p[0], m = p[1] || '00'; return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM'); }
  async function uploadFile(file) {
    if (!file) return null;
    var path = S.session.user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + '.' + TYPES[file.type];
    await api(function (t) { return DB.request('/storage/v1/object/' + (C.OPPORTUNITY_BUCKET || 'opportunity-files') + '/' + path, { method: 'POST', token: t, body: file, raw: true, timeout: 180000, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } }); });
    return DB.publicFileUrl(path);
  }

  /* ---------------- overview ---------------- */
  async function viewHome() {
    setPath('/admin');
    app.innerHTML = nav('home') + '<h2>Overview</h2><p>Loading...</p>'; bindNav();
    try {
      await loadRows();
      var ev = [], an = [], pf = [], gi = [], al = [], ss = [];
      if (isAdmin()) {
        var sel = function (tb, q) { return api(function (t) { return DB.select(tb, q, t); }).then(function (r) { return r || []; }); };
        var all = await Promise.all([sel('events', 'select=id,status,event_date&limit=1000'), sel('announcements', 'select=id,status&limit=1000'), sel('portfolio_submissions', 'select=id,status,created_at&limit=1000'), sel('graduate_interest', 'select=id,created_at&limit=1000'), sel('alert_subscriptions', 'select=id,created_at&limit=1000')]);
        ev = all[0]; an = all[1]; pf = all[2]; gi = all[3]; al = all[4];
        try { ss = await sel('student_submissions', 'select=id,status,created_at&limit=1000'); } catch (e2) { ss = []; /* table not created yet: show zeros */ }
      }
    } catch (e) { if (!e.handled) { app.innerHTML = nav('home') + '<div class="card"><b>Could not load the overview.</b><p>' + esc(fmtErr(e)) + '</p></div>'; bindNav(); } return; }
    var c = counts(), t0 = today(), exp = S.rows.filter(function (r) { return r.status === 'published' && r.deadline && r.deadline < t0; }).length;
    function stat(n, label, v, tone) { return '<button type="button" class="stat ' + (tone || '') + '" data-v="' + v + '"><b>' + n + '</b><span>' + label + '</span></button>'; }
    var user = S.session && S.session.user || {};
    var meta = user.user_metadata || {};
    var motivation = (meta.motivation_message || '').trim() || 'Keep learning, keep designing, and keep showing up. Your next great idea could shape the future of architecture in Kenya.';
    var h = nav('home');
    var displayName = (meta.full_name || meta.name || S.profileName || (user.email || '').split('@')[0] || 'there').trim();
    var firstName = displayName.split(/\s+/)[0] || 'there';
    var initials = displayName.split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('') || 'A';
    var avatarCard = meta.avatar_url
      ? '<img src="' + esc(meta.avatar_url) + '" alt="Profile photo" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.75);flex:0 0 88px">'
      : '<div aria-label="Profile initials" style="width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.18);border:3px solid rgba(255,255,255,.55);font-size:28px;font-weight:800;flex:0 0 88px">' + esc(initials) + '</div>';
    h += '<section class="card" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:24px;background:linear-gradient(120deg,#174b36,#287653);color:#fff;border:0;border-radius:18px;margin-bottom:24px">' +
      avatarCard + '<div style="flex:1;min-width:180px"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">ASAKenya workspace</p><h2 style="color:#fff;margin:0 0 8px">Welcome back, ' + esc(firstName) + '!</h2><p style="margin:0;opacity:.9">Good to have you here. Keep learning, connecting, and shaping the future of architecture in Kenya.</p></div>' +
      '<button type="button" class="btn" data-v="profile" style="background:#fff;color:#174b36;border-color:#fff">Edit profile</button></section>';
    if (isAdmin()) {
      var evUp = ev.filter(function (e) { return e.status === 'published' && e.event_date >= t0; }).length;
      var pend = c.pending, pfp = pf.filter(function (p) { return p.status === 'pending'; }).length;
      var ssp = ss.filter(function (x) { return x.status === 'pending'; }).length;
      if (pend || pfp || ssp) h += '<div class="card attn"><b>Needs your attention</b><br>' + (ssp ? ssp + ' student submission' + (ssp === 1 ? '' : 's') + ' awaiting review. ' : '') + (pend ? pend + ' opportunit' + (pend === 1 ? 'y is' : 'ies are') + ' awaiting approval. ' : '') + (pfp ? pfp + ' portfolio' + (pfp === 1 ? '' : 's') + ' to review.' : '') + '</div>';
      h += '<h3>Student Hub submissions</h3><div class="stats">' + stat(ssp, 'Awaiting review', 'subs', ssp ? 'hot' : '') + stat(ss.filter(function (x) { return x.status === 'approved'; }).length, 'Approved', 'subs') + stat(ss.filter(function (x) { return x.status === 'rejected'; }).length, 'Rejected', 'subs') + '</div>' +
        '<h3>Opportunities</h3><div class="stats">' + stat(c.published, 'Published', 'list') + stat(c.pending, 'Awaiting approval', 'list', c.pending ? 'hot' : '') + stat(c.draft, 'Drafts', 'list') + stat(c.archived, 'Archived', 'list') + stat(exp, 'Published but past deadline', 'list') + '</div>' +
        '<h3>Events</h3><div class="stats">' + stat(evUp, 'Upcoming (published)', 'events') + stat(ev.filter(function (e) { return e.status === 'published' && e.event_date < t0; }).length, 'Past (published)', 'events') + stat(ev.filter(function (e) { return e.status === 'draft'; }).length, 'Drafts', 'events') + '</div>' +
        '<h3>Announcements</h3><div class="stats">' + stat(an.filter(function (e) { return e.status === 'published'; }).length, 'Published', 'news') + stat(an.filter(function (e) { return e.status === 'draft'; }).length, 'Drafts', 'news') + '</div>' +
        '<h3>Graduate hub</h3><div class="stats">' + stat(gi.length, 'Network sign-ups', 'people') + stat(al.length, 'Alert interest', 'people') + stat(pfp, 'Portfolios to review', 'people', pfp ? 'hot' : '') + '</div>';
      /* ---- analytics ---- */
      var recent30 = function (r) { return r.created_at && String(r.created_at) >= addDays(t0, -30); };
      h += '<h3>Last 30 days</h3><div class="stats">' + stat(gi.filter(recent30).length, 'New network sign-ups', 'people') + stat(al.filter(recent30).length, 'New alert interest', 'people') + stat(pf.filter(recent30).length, 'New portfolios', 'people') +
        stat(S.rows.filter(function (r) { return r.created_at && String(r.created_at) >= addDays(t0, -30); }).length, 'New opportunities', 'list') + '</div>';
      var byCat = CATS.map(function (cat) { return [cat, S.rows.filter(function (r) { return r.category === cat && r.status === 'published'; }).length]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
      if (byCat.length) {
        var max = byCat[0][1];
        h += '<h3>Published opportunities by category</h3><div class="card">' + byCat.map(function (x) {
          return '<div class="brow"><span>' + esc(x[0]) + '</span><span class="btrack"><span class="bfill" style="width:' + Math.max(3, Math.round(x[1] / max * 100)) + '%"></span></span><b>' + x[1] + '</b></div>';
        }).join('') + '</div>';
      }
      var next5 = S.rows.filter(function (r) { return r.status === 'published' && r.deadline && r.deadline >= t0; }).sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; }).slice(0, 5);
      if (next5.length) h += '<h3>Next deadlines</h3><div class="card"><ul class="dl">' + next5.map(function (r) { return '<li><b>' + esc(fmtDate(r.deadline)) + '</b> &middot; ' + esc(r.title) + ' <span class="note">(' + esc(r.organisation) + ')</span></li>'; }).join('') + '</ul></div>';
    } else {
      h += '<p class="note">You can add opportunities and submit them for approval. An administrator publishes them.</p><h3>Your opportunities</h3><div class="stats">' + stat(c.draft, 'Drafts', 'list') + stat(c.pending, 'Awaiting approval', 'list') + stat(c.published, 'Published', 'list') + '</div><p><button type="button" class="btn" data-v="new">Add an opportunity</button></p>';
    }
    h += '<section class="motivation-panel"><span class="motivation-mark" aria-hidden="true">“</span><div><p class="motivation-label">A NOTE TO KEEP YOU GOING</p><p class="motivation-copy">' + esc(motivation) + '</p><p class="motivation-signoff">Your ideas matter. Keep building.</p></div><button type="button" class="btn o" data-v="profile">Edit message</button></section>';
    app.innerHTML = h; bindNav();
  }

  /* ---------------- events and announcements (administrators) ---------------- */
  var ASSOCS = ['ASA Kenya', 'ASA TUK', 'ASA KU', 'ASA JKUAT', 'ASA UoN', 'ASA TUM'];
  var EVENT_CATEGORIES = ['Conference','Workshop','Competition','Site visit','Exhibition','Talk','Networking','Other'];
  var CT = {
    events: {
      table: 'events', one: 'event', many: 'Events', order: 'event_date.desc',
      fields: [
        { k: 'title', label: 'Event title', type: 'text', max: 200 },
        { k: 'association', label: 'Organised by', type: 'select', opts: ASSOCS },
        { k: 'category', label: 'Event category', type: 'select', opts: EVENT_CATEGORIES },
        { k: 'event_date', label: 'Date', type: 'date' },
        { k: 'start_time', label: 'Start time (optional)', type: 'time', half: 1 },
        { k: 'end_time', label: 'End time (optional)', type: 'time', half: 1 },
        { k: 'venue', label: 'Venue (optional if online)', type: 'text', max: 300 },
        { k: 'online_url', label: 'Online meeting link (optional)', type: 'url', help: 'Must start with https://' },
        { k: 'registration_url', label: 'Registration link (optional)', type: 'url', help: 'Must start with https://' },
        { k: 'description', label: 'Description', type: 'textarea', max: 5000, help: '10 to 5000 characters. Plain text.' }
      ]
    },
    news: {
      table: 'announcements', one: 'announcement', many: 'Announcements', order: 'created_at.desc',
      fields: [
        { k: 'title', label: 'Title', type: 'text', max: 200 },
        { k: 'kind', label: 'Type', type: 'select', opts: ['Announcement', 'News', 'Update'] },
        { k: 'body', label: 'Text', type: 'textarea', max: 8000, help: '10 to 8000 characters. Plain text; line breaks are kept.' }
      ]
    }
  };
  var CS = { events: { rows: [], q: '', status: 'all', when: 'all', page: 0 }, news: { rows: [], q: '', status: 'all', when: 'all', page: 0 } };
  var CSTAT = { draft: 'Draft', published: 'Published', archived: 'Archived' };

  async function viewContent(key) {
    if (!isAdmin() && key !== 'events') { say('Only administrators can manage this.', true); return viewHome(); }
    var cfg = CT[key], st = CS[key];
    app.innerHTML = nav(key) + '<h2>' + cfg.many + '</h2><p>Loading...</p>'; bindNav();
    try { st.rows = await api(function (t) { return DB.select(cfg.table, 'select=*&order=' + cfg.order + '&limit=500', t); }) || []; }
    catch (e) { if (!e.handled) { app.innerHTML = nav(key) + '<div class="card"><b>Could not load ' + cfg.many.toLowerCase() + '.</b><p>' + esc(fmtErr(e)) + '</p></div>'; bindNav(); } return; }
    drawContent(key);
  }
  function drawContent(key) {
    var cfg = CT[key], st = CS[key], t0 = today(), c = { all: st.rows.length };
    Object.keys(CSTAT).forEach(function (s) { c[s] = st.rows.filter(function (r) { return r.status === s; }).length; });
    if (key === 'events') c.pending = st.rows.filter(function (r) { return r.status === 'pending'; }).length;
    var rows = st.rows.filter(function (r) {
      if (st.status !== 'all' && r.status !== st.status) return false;
      if (key === 'events' && st.when === 'upcoming' && r.event_date < t0) return false;
      if (key === 'events' && st.when === 'past' && r.event_date >= t0) return false;
      var q = st.q.toLowerCase(); return !q || (r.title + ' ' + (r.venue || '') + ' ' + (r.association || r.kind || '')).toLowerCase().indexOf(q) >= 0;
    });
    var total = rows.length, per = 15, pages = Math.max(1, Math.ceil(total / per)); if (st.page >= pages) st.page = pages - 1; rows = rows.slice(st.page * per, st.page * per + per);
    var tabs = [['all', 'All']].concat(Object.keys(CSTAT).concat(key === 'events' ? ['pending'] : []).map(function (s) { return [s, s === 'pending' ? 'Pending approval' : CSTAT[s]]; })).map(function (t) { return '<button type="button" data-s="' + t[0] + '" aria-pressed="' + (st.status === t[0]) + '">' + t[1] + ' (' + (c[t[0]] || 0) + ')</button>'; }).join('');
    var h = nav(key) + '<h2>' + cfg.many + '</h2><p><button class="btn" type="button" data-new="1">Add ' + cfg.one + '</button></p><div class="tabs" role="group" aria-label="Status">' + tabs + '</div>' +
      '<div class="tools"><label class="grow">Search<input id="q" type="search" value="' + esc(st.q) + '" placeholder="Title or venue"></label>' +
      (key === 'events' ? '<label>When<select id="wf"><option value="all">All dates</option><option value="upcoming"' + (st.when === 'upcoming' ? ' selected' : '') + '>Upcoming</option><option value="past"' + (st.when === 'past' ? ' selected' : '') + '>Past</option></select></label>' : '') +
      '<button type="button" class="btn o s" id="csv">Download CSV (' + total + ')</button></div>';
    if (!rows.length) h += '<div class="card"><b>' + (st.rows.length ? 'Nothing matches those filters.' : 'No ' + cfg.many.toLowerCase() + ' yet.') + '</b></div>';
    else h += '<div class="tw"><table><thead><tr><th>Title</th><th>' + (key === 'events' ? 'Date' : 'Type') + '</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (r) {
      var ownEditable = isAdmin() || (key === 'events' && r.created_by === S.session.user.id && ['draft','pending'].indexOf(r.status) >= 0);
      var a = ['<button class="btn o s" data-a="preview" data-id="' + esc(r.id) + '">Preview</button>'];
      if (ownEditable) a.push('<button class="btn o s" data-a="edit" data-id="' + esc(r.id) + '">Edit</button>');
      if (isAdmin()) { if (r.status === 'published') a.push('<button class="btn o s" data-a="unpublish" data-id="' + esc(r.id) + '">Unpublish</button>'); else a.push('<button class="btn s" data-a="publish" data-id="' + esc(r.id) + '">Publish</button>'); if (r.status !== 'archived') a.push('<button class="btn o s" data-a="archive" data-id="' + esc(r.id) + '">Archive</button>'); a.push('<button class="btn d s" data-a="delete" data-id="' + esc(r.id) + '">Delete</button>'); }
      var when = key === 'events' ? esc(fmtDate(r.event_date)) + (r.start_time ? '<br><span class="note">' + esc(fmtTime(r.start_time)) + '</span>' : '') + (r.event_date < t0 ? ' <span class="st archived">Past</span>' : '') : esc(r.kind);
      return '<tr><td><b>' + esc(r.title) + '</b>' + (key === 'events' ? '<br><span class="note">' + esc(r.association) + '</span>' : '') + '</td><td>' + when + '</td><td><span class="st ' + esc(r.status) + '">' + esc(CSTAT[r.status] || r.status) + '</span></td><td>' + esc(String(r.updated_at || '').slice(0, 10)) + '</td><td><div class="acts">' + a.join('') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>' + pager(st.page, pages, total);
    app.innerHTML = h; bindNav(); bindPager(function (p) { st.page = p; drawContent(key); });
    app.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { st.status = b.dataset.s; st.page = 0; drawContent(key); }; });
    var q = $('#q'); q.oninput = function () { st.q = q.value.trim(); st.page = 0; var p = q.selectionStart; drawContent(key); var n = $('#q'); n.focus(); n.setSelectionRange(p, p); };
    var wf = $('#wf'); if (wf) wf.onchange = function () { st.when = wf.value; st.page = 0; drawContent(key); };
    var CONTENT_CSV_COLS = {
      events: ['id', 'title', 'association', 'event_date', 'start_time', 'end_time', 'venue', 'online_url', 'registration_url', 'description', 'status', 'created_at', 'updated_at'],
      news: ['id', 'title', 'kind', 'body', 'status', 'created_at', 'updated_at']
    };
    $('#csv').onclick = function () {
      var st2 = CS[key], t0b = today();
      var out = st2.rows.filter(function (r) {
        if (st2.status !== 'all' && r.status !== st2.status) return false;
        if (key === 'events' && st2.when === 'upcoming' && r.event_date < t0b) return false;
        if (key === 'events' && st2.when === 'past' && r.event_date >= t0b) return false;
        var q2 = st2.q.toLowerCase(); return !q2 || (r.title + ' ' + (r.venue || '') + ' ' + (r.association || r.kind || '')).toLowerCase().indexOf(q2) >= 0;
      });
      downloadCsv(key === 'events' ? 'events.csv' : 'announcements.csv', CONTENT_CSV_COLS[key], out);
    };
    $('[data-new]', app).onclick = function () { contentForm(key, null); };
    app.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { contentAction(key, b.dataset.a, b.dataset.id, b); }; });
  }
  function cfind(key, id) { return CS[key].rows.filter(function (r) { return r.id === id; })[0]; }
  async function contentStatus(key, id, status, okText, btn) {
    var cfg = CT[key]; if (btn) btn.disabled = true;
    try { var o = await api(function (t) { return DB.update(cfg.table, 'id=eq.' + encodeURIComponent(id), { status: status }, t); }); if (!o || !o.length) throw new Error('Nothing was changed. You may not have permission.'); say(okText); await viewContent(key); }
    catch (e) { if (!e.handled) say(fmtErr(e), true); if (btn) btn.disabled = false; }
  }
  function contentAction(key, a, id, btn) {
    var cfg = CT[key], r = cfind(key, id); if (!r) return;
    if (a === 'preview') return contentPreview(key, r, { onBack: function () { drawContent(key); } });
    if (a === 'edit') return contentForm(key, r);
    if (a === 'publish') return contentPreview(key, r, { onBack: function () { drawContent(key); }, publish: function (b) { return contentStatus(key, id, 'published', 'Published. It is now live on the website.', b); } });
    if (a === 'unpublish') { if (confirm('Unpublish "' + r.title + '"? It will go back to draft and disappear from the website.')) contentStatus(key, id, 'draft', 'Unpublished. It is now a draft.', btn); return; }
    if (a === 'archive') { if (confirm('Archive "' + r.title + '"? It will disappear from the website.')) contentStatus(key, id, 'archived', 'Archived.', btn); return; }
    if (a === 'delete') {
      if (!confirm('Delete "' + r.title + '" permanently? This cannot be undone.')) return;
      btn.disabled = true;
      api(function (t) { return DB.remove(cfg.table, 'id=eq.' + encodeURIComponent(id), t); }).then(function (o) { if (!o || !o.length) throw new Error('Nothing was deleted. You may not have permission.'); say('Deleted.'); return viewContent(key); })
        .catch(function (e) { if (!e.handled) say(fmtErr(e), true); btn.disabled = false; });
    }
  }
  function contentPreview(key, r, o) {
    var body = '<div class="pv"><h3>' + esc(r.title) + '</h3>';
    if (key === 'events') {
      body += '<p><b>' + esc(fmtDate(r.event_date)) + (r.start_time ? ', ' + esc(fmtTime(r.start_time)) + (r.end_time ? ' to ' + esc(fmtTime(r.end_time)) : '') : '') + '</b><br>' + esc([r.venue, r.online_url ? 'Online' : ''].filter(Boolean).join(' and ')) + ' &middot; <span class="note">' + esc(r.association) + '</span></p><p style="white-space:pre-line">' + esc(r.description) + '</p>' + link(r.online_url, 'Join online') + link(r.registration_url, 'Register');
    } else body += '<p class="note">' + esc(r.kind) + '</p><p style="white-space:pre-line">' + esc(r.body) + '</p>';
    if (/^https:\/\//.test(r.image_url || '')) body += '<p><img src="' + esc(r.image_url) + '" alt="" style="max-width:100%;max-height:420px"></p>';
    body += '</div><div class="acts" style="margin-top:14px"></div>';
    app.innerHTML = nav(key) + '<h2>Preview</h2><p class="note">This is how it will look on the website' + (r.status === 'published' ? ' (it is already published).' : '. It is <b>not public</b> until you publish it.') + '</p>' + body; bindNav();
    var box = $('.acts', app), back = mk('<button class="btn o" type="button">' + (o.backLabel || 'Back') + '</button>'); back.onclick = o.onBack; box.appendChild(back);
    if (o.publish) { var pub = mk('<button class="btn" type="button">Confirm: publish to the website</button>'); pub.onclick = function () { pub.disabled = true; Promise.resolve(o.publish(pub)).catch(function () { pub.disabled = false; }); }; box.appendChild(pub); }
  }
  function contentForm(key, r, pre) {
    var cfg = CT[key], isNew = !r, d = r || Object.assign({ association: 'ASA Kenya', category: EVENT_CATEGORIES[0], kind: 'Announcement', status: 'draft' }, pre || {});
    var inner = cfg.fields.map(function (f) {
      var v = d[f.k] == null ? '' : String(d[f.k]); if (f.type === 'time') v = v.slice(0, 5);
      var ctl = f.type === 'textarea' ? '<textarea name="' + f.k + '" rows="7" maxlength="' + f.max + '">' + esc(v) + '</textarea>'
        : f.type === 'select' ? '<select name="' + f.k + '">' + f.opts.map(function (o) { return '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
        : '<input name="' + f.k + '" type="' + (f.type === 'url' ? 'url' : f.type) + '" value="' + esc(v) + '"' + (f.max ? ' maxlength="' + f.max + '"' : '') + (f.type === 'url' ? ' placeholder="https://"' : '') + '>';
      return '<label>' + f.label + ctl + (f.help ? '<small>' + f.help + '</small>' : '') + '</label>';
    }).join('');
    app.innerHTML = nav(key) + '<h2>' + (isNew ? 'Add ' : 'Edit ') + cfg.one + '</h2><form class="f" id="cf" novalidate>' + inner +
      '<label>Poster or image<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small>JPG, PNG, WebP or PDF, up to 25 MB. Or paste a link below.</small></label>' +
      '<label>Poster or image link (optional)<input type="url" name="image_url" maxlength="2000" placeholder="https://" value="' + esc(d.image_url) + '"></label>' +
      '<span id="fe" class="m er" role="alert" style="padding:0;color:#B5452A"></span><div class="acts" id="fa"></div></form>'; bindNav();
    var f = $('#cf'), fa = $('#fa');
    function btn(label, cls, fn) { var b = mk('<button type="button" class="btn ' + cls + '">' + label + '</button>'); b.onclick = function () { fn(b); }; fa.appendChild(b); return b; }
    function read() { var v = {}; cfg.fields.concat([{ k: 'image_url' }]).forEach(function (x) { v[x.k] = f.elements[x.k].value.trim(); }); return v; }
    function check(v) {
      var https = /^https:\/\/[^\s]+$/i;
      if (v.title.length < 3) return 'Add a title (at least 3 characters).';
      if (key === 'events') {
        if (!v.event_date) return 'Choose the event date.';
        if (!v.venue && !v.online_url) return 'Add a venue or an online meeting link.';
        if (v.start_time && v.end_time && v.end_time < v.start_time) return 'The end time must be after the start time.';
        if (v.description.length < 10) return 'The description needs at least 10 characters.';
        if (v.online_url && !https.test(v.online_url)) return 'The online link must start with https://';
        if (v.registration_url && !https.test(v.registration_url)) return 'The registration link must start with https://';
      } else if (v.body.length < 10) return 'The text needs at least 10 characters.';
      if (v.image_url && !https.test(v.image_url)) return 'The image link must start with https://';
      var file = f.elements.file.files[0];
      if (file) { if (!TYPES[file.type]) return 'Only JPG, PNG, WebP or PDF files can be uploaded.'; if (file.size > MAX) return 'That file is larger than 25 MB.'; }
      return '';
    }
    function payload(v) { var p = {}; cfg.fields.forEach(function (x) { p[x.k] = v[x.k] === '' && ['start_time', 'end_time', 'venue', 'online_url', 'registration_url', 'category'].indexOf(x.k) >= 0 ? null : v[x.k]; }); p.image_url = v.image_url || null; return p; }
    async function persist(v, status, file) {
      var up = await uploadFile(file), p = payload(v); if (up) p.image_url = up; p.status = status;
      if (isNew) { p.created_by = S.session.user.id; await api(function (t) { return DB.insert(cfg.table, p, t); }); }
      else { var o = await api(function (t) { return DB.update(cfg.table, 'id=eq.' + encodeURIComponent(r.id), p, t); }); if (!o || !o.length) throw new Error('Nothing was saved. You may not have permission.'); }
    }
    async function save(status, b, msg) {
      $('#fe').textContent = ''; var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return; }
      b.disabled = true; var label = b.textContent; b.textContent = 'Saving...';
      try { await persist(v, status, f.elements.file.files[0]); say(msg); await viewContent(key); }
      catch (e) { if (!e.handled) $('#fe').textContent = fmtErr(e); b.disabled = false; b.textContent = label; }
    }
    function again(v) { return function () { contentForm(key, isNew ? null : Object.assign({}, d, payload(v), { id: d.id }), isNew ? Object.assign(payload(v), { status: d.status }) : null); }; }
    btn('Preview', 'o', function () {
      var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return; }
      contentPreview(key, Object.assign({}, d, payload(v), { image_url: f.elements.file.files[0] ? '' : v.image_url }), { backLabel: 'Back to editing', onBack: again(v) });
    });
    if (d.status === 'published') btn('Save changes', '', function (b) { save('published', b, 'Changes saved.'); });
    else {
      btn('Save draft', 'o', function (b) { save(d.status === 'archived' ? 'archived' : 'draft', b, 'Draft saved.'); });
      if (key === 'events') btn('Submit for approval', '', function (b) { save('pending', b, 'Event submitted for administrator approval.'); });
      if (isAdmin()) btn('Preview and publish', '', function () {
        var v = read(), bad = check(v); if (bad) { $('#fe').textContent = bad; return; }
        var file = f.elements.file.files[0];
        contentPreview(key, Object.assign({}, d, payload(v), { status: 'draft', image_url: file ? '' : v.image_url }), {
          backLabel: 'Back to editing', onBack: again(v),
          publish: async function (b) {
            try { await persist(v, 'published', file); say('Published. It is now live on the website.'); await viewContent(key); }
            catch (e) { if (!e.handled) say(fmtErr(e), true); throw e; }
          }
        });
      });
    }
    btn('Cancel', 'o', function () { viewContent(key); });
  }

  /* ---------------- Student Hub submissions (administrators) ---------------- */
  var SS = { rows: [], q: '', status: 'all', cat: 'all', uni: 'all', att: 'all', sort: 'new', page: 0 };
  var SUB_LABEL = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', published: 'Published' };
  function subSt(r) { return r.published_opportunity_id ? 'published' : r.status; }
  var SUB_COLS = ['created_at', 'status', 'title', 'organisation', 'category', 'location', 'deadline', 'apply_url', 'submitter_name', 'submitter_email', 'university', 'attachment_name', 'review_note', 'reviewed_at', 'published_at'];
  function bytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function subsFiltered() {
    var rows = SS.rows.filter(function (r) {
      if (SS.status !== 'all' && subSt(r) !== SS.status) return false;
      if (SS.cat !== 'all' && r.category !== SS.cat) return false;
      if (SS.uni !== 'all' && r.university !== SS.uni) return false;
      if (SS.att === 'with' && !r.attachment_path) return false;
      if (SS.att === 'without' && r.attachment_path) return false;
      var q = SS.q.toLowerCase(); return !q || [r.title, r.organisation, r.submitter_name, r.submitter_email, r.university, r.category].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      if (SS.sort === 'new' && subSt(a) !== subSt(b)) { if (subSt(a) === 'pending') return -1; if (subSt(b) === 'pending') return 1; }
      var d = String(a.created_at).localeCompare(String(b.created_at)); return SS.sort === 'old' ? d : -d;
    });
    return rows;
  }
  async function viewSubs() {
    if (!isAdmin()) { say('Only administrators can review student submissions.', true); return viewHome(); }
    app.innerHTML = nav('subs') + '<h2>Student submissions</h2><p>Loading...</p>'; bindNav();
    try { SS.rows = await api(function (t) { return DB.select('student_submissions', 'select=*&order=created_at.desc&limit=1000', t); }) || []; }
    catch (e) { if (!e.handled) { var missing = e.status === 404; app.innerHTML = nav('subs') + '<div class="card"><b>' + (missing ? 'Student submissions are not switched on yet.' : 'Could not load student submissions.') + '</b><p>' + esc(missing ? 'Run supabase/migrations/005_student_submissions.sql in the Supabase SQL Editor, then reload this page.' : fmtErr(e)) + '</p></div>'; bindNav(); } return; }
    drawSubs();
  }
  function drawSubs() {
    var c = { all: SS.rows.length, pending: 0, approved: 0, rejected: 0, published: 0 }; SS.rows.forEach(function (r) { var k = subSt(r); c[k] = (c[k] || 0) + 1; });
    var unis = Object.keys(SS.rows.reduce(function (m, r) { m[r.university] = 1; return m; }, {})).sort();
    var rows = subsFiltered(), per = 15, total = rows.length, pages = Math.max(1, Math.ceil(total / per)); if (SS.page >= pages) SS.page = pages - 1; var shown = rows.slice(SS.page * per, SS.page * per + per);
    var tabs = [['all', 'All'], ['pending', 'Pending review'], ['published', 'Published'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(function (t) { return '<button type="button" data-s="' + t[0] + '" aria-pressed="' + (SS.status === t[0]) + '">' + t[1] + ' (' + c[t[0]] + ')</button>'; }).join('');
    var h = nav('subs') + '<h2>Student submissions</h2><p class="note">Opportunities sent in through the Student Hub form. Personal details: handle with care. Open a submission to preview it, then publish it to the Student Opportunities page, reject it, or leave it pending. Approve alone does not publish.</p>' +
      (c.pending ? '<div class="card attn"><b>' + c.pending + ' awaiting review.</b></div>' : '') +
      '<div class="tabs" role="group" aria-label="Review status">' + tabs + '</div>' +
      '<div class="tools"><label class="grow">Search<input id="sq" type="search" value="' + esc(SS.q) + '" placeholder="Title, organisation, name, email, university"></label>' +
      '<label>Category<select id="scat"><option value="all">All categories</option>' + CATS.map(function (x) { return '<option' + (SS.cat === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
      '<label>University<select id="suni"><option value="all">All universities</option>' + unis.map(function (x) { return '<option' + (SS.uni === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
      '<label>Attachment<select id="satt"><option value="all">Any</option><option value="with"' + (SS.att === 'with' ? ' selected' : '') + '>With file</option><option value="without"' + (SS.att === 'without' ? ' selected' : '') + '>No file</option></select></label>' +
      '<label>Sort<select id="ssort"><option value="new">Pending first, newest</option><option value="old"' + (SS.sort === 'old' ? ' selected' : '') + '>Oldest first</option></select></label></div>';
    if (!shown.length) h += '<div class="card"><b>' + (SS.rows.length ? 'Nothing matches those filters.' : 'No student submissions yet.') + '</b></div>';
    else h += '<p><button class="btn o s" id="scsv" type="button">Download CSV (' + total + ')</button></p><div class="tw"><table><thead><tr><th>Title</th><th>Category</th><th>Submitted by</th><th>Submitted</th><th>Status</th><th>File</th><th>Actions</th></tr></thead><tbody>' + shown.map(function (r) {
      return '<tr><td><b>' + esc(r.title) + '</b><br><span class="note">' + esc(r.organisation) + '</span></td><td>' + esc(r.category) + '</td><td>' + esc(r.submitter_name) + '<br><span class="note">' + esc(r.university) + '</span></td><td>' + esc(String(r.created_at).slice(0, 10)) + '</td><td><span class="st ' + esc(subSt(r)) + '">' + esc(SUB_LABEL[subSt(r)] || r.status) + '</span></td><td>' + (r.attachment_path ? esc(r.attachment_type === 'application/pdf' ? 'PDF' : 'Image') : '<span class="note">None</span>') + '</td><td><div class="acts"><button class="btn s" data-open="' + esc(r.id) + '">Open</button>' +
        (r.status === 'pending' && !r.published_opportunity_id ? '<button class="btn o s" data-quick="approved" data-id="' + esc(r.id) + '">Approve</button><button class="btn o s" data-quick="rejected" data-id="' + esc(r.id) + '">Reject</button>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>' + pager(SS.page, pages, total);
    app.innerHTML = h; bindNav(); bindPager(function (p) { SS.page = p; drawSubs(); });
    app.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { SS.status = b.dataset.s; SS.page = 0; drawSubs(); }; });
    var q = $('#sq'); q.oninput = function () { SS.q = q.value.trim(); SS.page = 0; var p = q.selectionStart; drawSubs(); var n = $('#sq'); n.focus(); n.setSelectionRange(p, p); };
    $('#scat').onchange = function (e) { SS.cat = e.target.value; SS.page = 0; drawSubs(); };
    $('#suni').onchange = function (e) { SS.uni = e.target.value; SS.page = 0; drawSubs(); };
    $('#satt').onchange = function (e) { SS.att = e.target.value; SS.page = 0; drawSubs(); };
    $('#ssort').onchange = function (e) { SS.sort = e.target.value; SS.page = 0; drawSubs(); };
    var csv = $('#scsv'); if (csv) csv.onclick = function () { downloadCsv('student-submissions.csv', SUB_COLS, rows); };
    app.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { viewSub(b.dataset.open); }; });
    app.querySelectorAll('[data-quick]').forEach(function (b) { b.onclick = function () { reviewSub(b.dataset.id, b.dataset.quick, '', b); }; });
  }
  async function publishSub(id, note) {
    var oid; try { oid = await api(function (t) { return DB.rpc('publish_student_submission', { p_id: id, p_note: note || null }, t); }); }
    catch (e) { if (!e.handled && e.status === 404) throw new Error('Publishing is not switched on yet. Run supabase/migrations/006_publish_student_submissions.sql in the Supabase SQL Editor, then try again.'); throw e; }
    if (!oid) throw new Error('Publishing did not complete. Nothing was published.');
    var o = await api(function (t) { return DB.select('student_submissions', 'select=*&id=eq.' + encodeURIComponent(id), t); });
    var r = subById(id); if (r && o && o[0]) Object.assign(r, o[0]);
    if (!r || !r.published_opportunity_id) throw new Error('Could not confirm the publication. Check Opportunities before trying again.');
    say('Published. It is now live on the Student Opportunities page.'); viewSub(id);
  }
  function subById(id) { return SS.rows.filter(function (r) { return r.id === id; })[0]; }
  async function reviewSub(id, status, note, btn, stay) {
    if (btn) btn.disabled = true;
    try {
      var patch = { status: status }; if (note !== null && note !== undefined && note !== '') patch.review_note = note;
      var o = await api(function (t) { return DB.update('student_submissions', 'id=eq.' + encodeURIComponent(id), patch, t); });
      if (!o || !o.length) throw new Error('Nothing was changed. Only administrators can review submissions.');
      var r = subById(id); if (r) Object.assign(r, o[0]);
      say(status === 'approved' ? 'Approved. It is not public yet: open it and choose Preview and publish.' : status === 'rejected' ? 'Rejected.' : 'Moved back to awaiting review.');
      if (stay) viewSub(id); else drawSubs();
    } catch (e) { if (!e.handled) say(fmtErr(e), true); if (btn) btn.disabled = false; }
  }
  /* Attachments are private: ask Supabase for a short-lived signed link (admins only, enforced by the database). */
  async function signedUrl(r, download) {
    var res = await api(function (t) { return DB.request('/storage/v1/object/sign/student-submissions/' + r.attachment_path, { method: 'POST', token: t, body: { expiresIn: 300 } }); });
    if (!res || !res.signedURL) throw new Error('Could not open the attachment.');
    return DB.BASE + '/storage/v1' + res.signedURL + (download ? '&download=' + encodeURIComponent(r.attachment_name || 'attachment') : '');
  }
  function viewSub(id) {
    var r = subById(id); if (!r) return drawSubs();
    function row(k, v) { return '<tr><th scope="row" style="width:34%">' + k + '</th><td>' + (v || '<span class="note">Not given</span>') + '</td></tr>'; }
    var h = nav('subs') + '<p><button class="btn o s" id="sback" type="button">Back to the list</button></p><h2>' + esc(r.title) + '</h2><p><span class="st ' + esc(subSt(r)) + '">' + esc(SUB_LABEL[subSt(r)] || r.status) + '</span> <span class="note">Submitted ' + esc(String(r.created_at).slice(0, 10)) + (r.published_at ? ' &middot; published ' + esc(String(r.published_at).slice(0, 10)) : r.reviewed_at ? ' &middot; reviewed ' + esc(String(r.reviewed_at).slice(0, 10)) : '') + '</span></p>' +
      '<div class="tw"><table><tbody>' + row('Organisation', esc(r.organisation)) + row('Category', esc(r.category)) + row('Description', '<span style="white-space:pre-line">' + esc(r.description) + '</span>') + row('Location', esc(r.location)) + row('Deadline', esc(r.deadline)) +
      row('Application link', /^https:\/\//.test(r.apply_url || '') ? '<a href="' + esc(r.apply_url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.apply_url) + '</a>' : '') +
      row('Submitted by', esc(r.submitter_name)) + row('Email', r.submitter_email ? '<a href="mailto:' + esc(r.submitter_email) + '">' + esc(r.submitter_email) + '</a>' : '') + row('University', esc(r.university)) +
      row('Attachment', r.attachment_path ? esc(r.attachment_name || 'attachment') + ' <span class="note">(' + esc(r.attachment_type) + ', ' + bytes(r.attachment_size) + ')</span><div class="acts" style="margin-top:6px"><button class="btn o s" id="aopen" type="button">Open</button><button class="btn o s" id="adl" type="button">Download</button></div><div id="apv"></div>' : '') +
      row('Review note', esc(r.review_note)) + '</tbody></table></div>' +
      '<form class="f" id="rf" style="margin-top:14px"><label>Review note (optional, only administrators see it)<textarea name="note" rows="2" maxlength="1000">' + esc(r.review_note) + '</textarea></label><div class="acts" id="ra"></div></form>';
    app.innerHTML = h; bindNav();
    $('#sback').onclick = function () { drawSubs(); };
    function act(label, cls, fn) { var b = mk('<button type="button" class="btn ' + cls + '">' + label + '</button>'); b.onclick = function () { fn(b); }; $('#ra').appendChild(b); }
    var note = function () { return $('#rf').elements.note.value.trim(); };
    var pubd = !!r.published_opportunity_id;
    if (pubd) $('#ra').appendChild(mk('<p class="note" style="flex-basis:100%;margin:0">Published to Student Opportunities. To take it down, archive the opportunity under Opportunities. The submission stays here as a record.</p>'));
    if (!pubd && r.status !== 'rejected') act('Preview and publish', '', function () {
      // Capture the review note before the preview replaces the submission form.
      var publishNote = note();
      viewPreview({ title: r.title, organisation: r.organisation, category: r.category, description: r.description, location: r.location, deadline: r.deadline, apply_url: r.apply_url, audience: 'students', status: 'draft' }, {
        backLabel: 'Back to the submission', onBack: function () { viewSub(id); },
        publish: function () { return publishSub(id, publishNote); } });
    });
    if (!pubd && r.status !== 'approved') act('Approve', 'o', function (b) { reviewSub(id, 'approved', note(), b, true); });
    if (!pubd && r.status !== 'rejected') act('Reject', 'o', function (b) { reviewSub(id, 'rejected', note(), b, true); });
    if (!pubd && r.status !== 'pending') act('Leave pending / move back to review', 'o', function (b) { reviewSub(id, 'pending', note(), b, true); });
    if (!pubd) act('Create opportunity draft', 'o', function () {
      viewForm(null, { title: r.title, organisation: r.organisation, category: r.category, description: r.description, location: r.location || '', deadline: r.deadline || '', apply_url: r.apply_url || '', source: 'Student Hub submission by ' + r.submitter_name + ', ' + r.university });
      say('Draft prefilled from the submission. Check the details' + (r.attachment_path ? ', then download the attachment and re-upload it here if you want it shown' : '') + ', then save.');
    });
    act('Delete', 'd', async function (b) {
      if (!confirm('Delete this submission permanently' + (r.attachment_path ? ' and its attachment' : '') + '? This cannot be undone.')) return;
      b.disabled = true;
      try {
        var o = await api(function (t) { return DB.remove('student_submissions', 'id=eq.' + encodeURIComponent(id), t); });
        if (!o || !o.length) throw new Error('Nothing was deleted. Only administrators can delete submissions.');
        var warn = '';
        if (r.attachment_path) { try { await api(function (t) { return DB.request('/storage/v1/object/student-submissions/' + r.attachment_path, { method: 'DELETE', token: t }); }); } catch (e) { warn = ' The attachment file could not be removed from storage.'; } }
        SS.rows = SS.rows.filter(function (x) { return x.id !== id; }); say('Deleted.' + warn, !!warn); drawSubs();
      } catch (e) { if (!e.handled) say(fmtErr(e), true); b.disabled = false; }
    });
    if (r.attachment_path) {
      var open = function (download) { return async function (ev) {
        var b = ev.target, w = download ? null : window.open('', '_blank'); b.disabled = true;
        try {
          var url = await signedUrl(r, download);
          if (download) { var a = document.createElement('a'); a.href = url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
          else if (w) { w.opener = null; w.location = url; }
          else $('#apv').innerHTML = '<p><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open the attachment</a> <span class="note">(link works for 5 minutes)</span></p>';
          if (/^image\//.test(r.attachment_type) && !download) $('#apv').innerHTML = '<p><img src="' + esc(url) + '" alt="Attachment preview" style="max-width:100%;max-height:360px;border:1px solid var(--line)"></p>';
        } catch (e) { if (w) w.close(); if (!e.handled) say(e.status === 404 ? 'The attachment file was not found in storage.' : fmtErr(e), true); }
        b.disabled = false; }; };
      $('#aopen').onclick = open(false); $('#adl').onclick = open(true);
    }
  }

  /* ---------------- boot ---------------- */
  if (!DB || !DB.configured()) { app.innerHTML = '<div class="card"><h2>Not connected</h2><p>The Supabase connection details in config.js are missing or invalid.</p></div>'; return; }
  var h = location.hash || '';
  if (/type=recovery/.test(h) && /access_token=/.test(h)) { var m = h.match(/access_token=([^&]+)/); renderNewPassword(decodeURIComponent(m[1])); return; }
  loadSession();
  if (S.session) start(); else renderLogin();
})();
