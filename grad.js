/* ASA Kenya - Graduate Architects Hub (listings, forms, portfolio showcase).
   Uses helpers from app.js ($, el, ASA_ESC, ASA_ALL) and the Supabase client in supa.js.
   Only the publishable key is ever used. Nothing here claims email delivery. */
(function () {
  'use strict';
  var esc = window.ASA_ESC, DB = window.ASA_DB, C = window.ASA_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  if (!$('#graduates')) return;

  /* ---------- filter groups (all category names exist in the database check) ---------- */
  var GROUPS = [
    ['All', null],
    ['Careers', ['Jobs', 'Internships', 'Traineeships', 'Volunteering', 'Paid projects']],
    ['Skills and workshops', ['Workshops']],
    ['Mentorship', ['Mentorship']],
    ['Site visits', ['Site visits']],
    ['Competitions, grants and fellowships', ['Competitions', 'Grants', 'Scholarships', 'Fellowships', 'Research', 'Calls for papers', 'Exhibitions']]
  ];
  var group = 'All', query = '';

  function mk(tag, html, cls) { var e = document.createElement(tag); if (html) e.innerHTML = html; if (cls) e.className = cls; return e; }
  function link(u, t) { return u && /^https:\/\//.test(u) ? '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a> ' : ''; }

  /* ---------- opportunity finder ---------- */
  function gradRows() {
    var cats = (GROUPS.filter(function (g) { return g[0] === group; })[0] || [])[1];
    var q = query.toLowerCase();
    return (window.ASA_ALL || []).filter(function (o) {
      if (o.audience === 'students') return false;                 /* graduates + both */
      if (cats && cats.indexOf(o.category) < 0) return false;
      return !q || (o.title + ' ' + o.organisation + ' ' + o.location + ' ' + o.description + ' ' + o.category).toLowerCase().indexOf(q) >= 0;
    });
  }
  function drawFilters() {
    var box = $('#gf'); box.innerHTML = '';
    GROUPS.forEach(function (g) {
      var b = mk('button', esc(g[0]), 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', g[0] === group);
      b.onclick = function () { group = g[0]; drawFilters(); drawList(); };
      box.appendChild(b);
    });
  }
  function drawList() {
    var box = $('#gl'); box.innerHTML = '';
    var state = (window.ASA_OPP_STATE && window.ASA_OPP_STATE()) || 'off';
    var rows = gradRows();
    if (!rows.length) {
      if (state === 'loading') box.appendChild(mk('div', '<b>Loading opportunities...</b>', 'empty'));
      else if (state === 'error') box.appendChild(mk('div', '<b>Opportunities could not be loaded right now</b><p>Please check your connection and refresh the page.</p>', 'empty'));
      else box.appendChild(mk('div', query || group !== 'All'
        ? '<b>No matches</b><p>Try another type or a different search.</p>'
        : '<b>No opportunities published yet</b><p>Verified opportunities will appear here with deadlines and application links. Check back soon, or register your interest in alerts below.</p>', 'empty'));
      return;
    }
    rows.forEach(function (o) {
      var d = o.deadline ? Math.ceil((new Date(o.deadline) - new Date()) / 864e5) : null;
      box.appendChild(mk('div',
        '<div><h3>' + o.title + '</h3><p>' + [o.organisation, o.location].filter(Boolean).join(', ') + ' &middot; <span class="note">' + esc(o.category) + '</span></p><p>' + o.description + '</p>' +
        (o.eligibility ? '<p><b>Eligibility:</b> ' + o.eligibility + '</p>' : '') + link(o.applyUrl, 'Apply') + link(o.download, 'Download') + '</div>' +
        '<div>' + (d !== null && d >= 0 && d <= 14 ? '<span class="badge">Deadline approaching</span>' : '') + (o.deadline ? '<div class="note">Deadline: ' + esc(o.deadline) + '</div>' : '') + '</div>', 'item'));
    });
  }
  $('#gq').oninput = function (e) { query = e.target.value.trim(); drawList(); };
  window.addEventListener('asa:opps', drawList);

  /* section buttons that preset the finder */
  $$('[data-filter]').forEach(function (b) {
    b.onclick = function () { group = b.getAttribute('data-filter'); drawFilters(); drawList(); var t = $('#g-find'); if (t) t.scrollIntoView({ behavior: 'smooth' }); };
  });
  /* in-page jumps (buttons, so they never change the #hash route) */
  $$('[data-go]').forEach(function (b) {
    b.onclick = function () { var t = document.getElementById(b.getAttribute('data-go')); if (t) { t.scrollIntoView({ behavior: 'smooth' }); } };
  });

  /* ---------- registration links: only official links that ASA Kenya has confirmed ---------- */
  (function () {
    var L = C.OFFICIAL_LINKS || {}, h = [];
    h.push(/^https:\/\//.test(L.AAK || '') ? '<a class="btn o" href="' + esc(L.AAK) + '" target="_blank" rel="noopener noreferrer">Architectural Association of Kenya (official site)</a>' : '<span class="note">Architectural Association of Kenya link: to be confirmed by ASA Kenya.</span>');
    h.push(/^https:\/\//.test(L.BORAQS || '') ? '<a class="btn o" href="' + esc(L.BORAQS) + '" target="_blank" rel="noopener noreferrer">Board of Registration of Architects and Quantity Surveyors (official site)</a>' : '<span class="note">Registration board (BORAQS) link: to be confirmed by ASA Kenya. Search for the board&rsquo;s official website until then.</span>');
    $('#glinks').innerHTML = h.join(' ');
  })();

  /* ---------- checkbox groups ---------- */
  var ALERT_CATS = GROUPS.slice(1).map(function (g) { return g[0]; }).concat(['Other opportunities']);
  function boxes(id, name, list) {
    var b = $(id); list.forEach(function (c) { var l = mk('label', '<input type="checkbox" name="' + name + '" value="' + esc(c) + '"> ' + esc(c), 'ck'); b.appendChild(l); });
  }
  boxes('#gac', 'cat', ALERT_CATS);
  boxes('#gic', 'int', GROUPS.slice(1).map(function (g) { return g[0]; }).concat(['Registration', 'Events and CPD']));

  /* ---------- forms ---------- */
  var MSG = {
    not_configured: 'This form is not connected yet. Please use the contact form instead.',
    network: 'Could not reach the server. Check your connection and try again.'
  };
  function friendly(e, dupMsg) {
    if (e && e.code === 'not_configured') return MSG.not_configured;
    if (e && e.code === 'network') return MSG.network;
    if (e && (e.status === 409 || e.code === '23505') && dupMsg) return dupMsg;
    if (e && e.status === 404) return 'This form is not available yet. Please try again later or use the contact form.';
    return 'Sorry, we could not save that. Please try again in a moment.';
  }
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function val(f, n) { var x = f.elements[n]; return x ? x.value.trim() : ''; }
  function httpsOk(u) { return /^https:\/\/[^\s]+$/i.test(u) && u.length <= 2000; }
  function wire(form, table, build, okText, dupMsg) {
    var err = $('.err', form), ok = $('.gok', form), btn = $('button[type=submit]', form), busy = false;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); if (busy) return;
      err.textContent = ''; ok.hidden = true;
      if (val(form, 'website')) { ok.textContent = okText; ok.hidden = false; return; }   /* honeypot: pretend success */
      var row, problem;
      try { row = build(form); } catch (e) { problem = e.message; }
      if (problem) { err.textContent = problem; return; }
      busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = 'Sending...';
      DB.insert(table, row).then(function () {
        form.reset(); ok.textContent = okText; ok.hidden = false; ok.focus && ok.setAttribute('tabindex', '-1'); ok.focus();
        syncType();
      }).catch(function (e) {
        if ((e.status === 409 || e.code === '23505') && dupMsg) { ok.textContent = dupMsg; ok.hidden = false; }
        else err.textContent = friendly(e);
      }).then(function () { busy = false; btn.disabled = false; btn.textContent = label; });
    });
  }
  function need(c, m) { if (!c) throw new Error(m); }
  function year(f) { var y = val(f, 'graduation_year'); if (!y) return null; need(/^\d{4}$/.test(y) && +y >= 1960 && +y <= 2100, 'Enter a four-digit graduation year, for example 2024.'); return +y; }

  wire($('#gint'), 'graduate_interest', function (f) {
    var type = val(f, 'interest_type'), name = val(f, 'full_name'), em = val(f, 'email'), uni = val(f, 'university'), y = year(f), pf = val(f, 'portfolio_url');
    need(name.length >= 2, 'Please enter your full name.');
    need(EMAIL.test(em) && em.length <= 254, 'Please enter a valid email address.');
    if (type !== 'mentor') { need(uni.length >= 2, 'Please enter your university.'); need(y, 'Please enter your graduation year.'); }
    else if (uni) need(uni.length >= 2, 'Practice or university must be at least 2 characters.');
    if (pf) need(httpsOk(pf), 'The portfolio link must start with https://');
    need(f.elements.consent.checked, 'Please tick the consent box to continue.');
    var row = { interest_type: type, full_name: name, email: em, consent: true,
      interests: $$('input[name=int]:checked', f).map(function (c) { return c.value; }) };
    if (uni) row.university = uni; if (y) row.graduation_year = y;
    if (val(f, 'location')) row.location = val(f, 'location'); if (val(f, 'skills')) row.skills = val(f, 'skills'); if (pf) row.portfolio_url = pf;
    return row;
  }, 'Thank you. ASA Kenya has your details and will be in touch when there is something relevant. Nothing is emailed automatically yet.');

  wire($('#galert'), 'alert_subscriptions', function (f) {
    var em = val(f, 'email'), cats = $$('input[name=cat]:checked', f).map(function (c) { return c.value; });
    need(EMAIL.test(em) && em.length <= 254, 'Please enter a valid email address.');
    need(cats.length > 0, 'Choose at least one type of opportunity.');
    need(f.elements.consent.checked, 'Please tick the consent box to continue.');
    return { email: em, categories: cats, consent: true };
  }, 'Your interest is saved. Email alerts have not started yet, so you will not receive anything today.',
     'This email is already registered. Alerts have not started yet, so nothing will be sent today.');

  wire($('#gport'), 'portfolio_submissions', function (f) {
    var name = val(f, 'full_name'), em = val(f, 'email'), uni = val(f, 'university'), y = year(f), hl = val(f, 'headline'), pf = val(f, 'portfolio_url');
    need(name.length >= 2, 'Please enter your full name.');
    need(EMAIL.test(em), 'Please enter a valid email address.');
    need(uni.length >= 2, 'Please enter your university.');
    need(y, 'Please enter your graduation year.');
    need(hl.length >= 3, 'Please add a short headline.');
    need(httpsOk(pf), 'The portfolio link must start with https://');
    need(f.elements.consent.checked, 'Please tick the permission box to continue.');
    var row = { full_name: name, email: em, university: uni, graduation_year: y, headline: hl, portfolio_url: pf, consent_publish: true };
    if (val(f, 'bio')) row.bio = val(f, 'bio');
    return row;
  }, 'Thank you. Your portfolio is waiting for review by ASA Kenya. It will not appear on the site until approved.');

  /* mentors do not need university / year */
  function syncType() {
    var f = $('#gint'), m = f.elements.interest_type.value === 'mentor';
    $('#gu-l').textContent = m ? 'Practice or organisation (optional)' : 'University';
    $('#gy-w').style.display = m ? 'none' : '';
  }
  $('#gint').elements.interest_type.addEventListener('change', syncType); syncType();
  $$('[data-open]').forEach(function (b) {
    b.onclick = function () { var f = $('#gint'); f.elements.interest_type.value = b.getAttribute('data-open'); syncType(); $('#g-net').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { f.elements.full_name.focus({ preventScroll: true }); }, 450); };
  });

  /* ---------- approved portfolios (public read, safe columns only) ---------- */
  function loadPortfolios() {
    var box = $('#gp');
    if (!DB || !DB.configured()) { box.innerHTML = ''; return; }
    DB.select('portfolio_submissions', 'select=id,full_name,university,graduation_year,headline,bio,portfolio_url&status=eq.approved&order=created_at.desc&limit=48').then(function (rows) {
      box.innerHTML = '';
      if (!rows || !rows.length) { box.appendChild(mk('div', '<b>No portfolios featured yet</b><p>Approved graduate portfolios will appear here.</p>', 'empty')); return; }
      var g = mk('div', '', 'grid3');
      rows.forEach(function (r) {
        g.appendChild(mk('div', '<h3>' + esc(r.full_name) + '</h3><p class="note">' + esc(r.university) + ', ' + esc(r.graduation_year) + '</p><p><b>' + esc(r.headline) + '</b></p>' + (r.bio ? '<p>' + esc(r.bio) + '</p>' : '') + link(/^https:\/\//.test(r.portfolio_url) ? r.portfolio_url : '', 'View portfolio'), 'cell'));
      });
      box.appendChild(g);
    }).catch(function () { box.innerHTML = ''; });
  }

  drawFilters(); drawList(); loadPortfolios();
})();
