/* ASA Kenya - Student Hub "Submit an opportunity" form.
   Saves to the student_submissions table (visible only to administrators) and, optionally,
   uploads one attachment to the PRIVATE student-submissions bucket. Uses only the publishable key.
   Nothing is shown on the site until an administrator reviews it. */
(function () {
  'use strict';
  var DB = window.ASA_DB, form = document.getElementById('sform');
  if (!form) return;
  var BUCKET = 'student-submissions', MAX = 5 * 1024 * 1024;
  var TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var err = form.querySelector('.err'), ok = form.querySelector('.gok'), btn = form.querySelector('button[type=submit]'), busy = false;

  /* categories = the existing Student Hub categories (everything except the resource library) */
  var cats = (typeof HUB !== 'undefined' ? HUB.map(function (h) { return h[0]; }).filter(function (n) { return n !== 'Resources'; }) : []);
  var sel = document.getElementById('s-cat');
  sel.innerHTML = '<option value="">Choose a category</option>' + cats.map(function (c) { return '<option>' + c.replace(/[&<>"']/g, '') + '</option>'; }).join('');

  function val(n) { var x = form.elements[n]; return x ? x.value.trim() : ''; }
  function need(c, m) { if (!c) throw new Error(m); }
  function httpsOk(u) { return /^https:\/\/[^\s]+$/i.test(u) && u.length <= 2000; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function safeName(name, ext) {
    var base = String(name || 'file').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
    return base + '.' + ext;
  }
  function friendly(e) {
    if (e && e.code === 'not_configured') return 'This form is not available right now. Please use the contact form.';
    if (e && e.code === 'network') return 'Could not reach the server. Check your connection and try again.';
    if (e && e.status === 404) return 'This form is not available yet. Please try again later or use the contact form.';
    if (e && e.status === 413) return 'That file is too large. The limit is 5 MB.';
    return 'Sorry, we could not send that. Please try again in a moment.';
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault(); if (busy) return;
    err.textContent = ''; ok.hidden = true;
    var okText = 'Thank you. Your submission is waiting for review by ASA Kenya. It will not appear on the site until it has been approved.';
    if (val('website')) { ok.textContent = okText; ok.hidden = false; return; }   /* honeypot: pretend success */
    var row, file = form.elements.file.files[0];
    try {
      var t = val('title'), o = val('organisation'), c = val('category'), d = val('description'), u = val('apply_url'), n = val('submitter_name'), em = val('submitter_email'), uni = val('university');
      need(t.length >= 3, 'Please add a title (at least 3 characters).');
      need(o.length >= 2, 'Please tell us which organisation is offering it.');
      need(cats.indexOf(c) >= 0, 'Please choose a category.');
      need(d.length >= 10, 'Please add a description (at least 10 characters).');
      if (u) need(httpsOk(u), 'The application link must start with https://');
      need(n.length >= 2, 'Please enter your name.');
      need(EMAIL.test(em) && em.length <= 254, 'Please enter a valid email address.');
      need(uni.length >= 2, 'Please enter your university.');
      if (file) { need(!!TYPES[file.type], 'Only JPG, PNG, WebP or PDF files can be attached.'); need(file.size > 0 && file.size <= MAX, 'That file is larger than 5 MB.'); }
      need(form.elements.consent.checked, 'Please tick the box to confirm and give your consent.');
      row = { title: t, organisation: o, category: c, description: d, submitter_name: n, submitter_email: em, university: uni, consent: true };
      if (val('location')) row.location = val('location');
      if (val('deadline')) row.deadline = val('deadline');
      if (u) row.apply_url = u;
    } catch (e) { err.textContent = e.message; return; }

    busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = file ? 'Uploading...' : 'Sending...';
    try {
      if (file) {
        var path = uuid() + '/' + safeName(file.name, TYPES[file.type]);
        try {
          await DB.request('/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST', body: file, raw: true, timeout: 60000, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } });
        } catch (e) { err.textContent = 'The file could not be uploaded, so nothing was sent. ' + friendly(e); return; }
        row.attachment_path = path; row.attachment_name = String(file.name).slice(0, 200); row.attachment_type = file.type; row.attachment_size = file.size;
        btn.textContent = 'Sending...';
      }
      try { await DB.insert('student_submissions', row); }
      catch (e) { err.textContent = friendly(e); return; }
      form.reset(); ok.textContent = okText; ok.hidden = false; ok.setAttribute('tabindex', '-1'); ok.focus();
    } finally { busy = false; btn.disabled = false; btn.textContent = label; }
  });
})();
