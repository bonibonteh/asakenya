/* ASA Kenya - show the existing hub forms only on demand.
   The forms, fields, validation and submit handlers are untouched: this only hides each form
   container and shows it as a dialog when its button is pressed. No dependencies. */
(function () {
  'use strict';
  var LABELS = { galert: 'Register for alerts', gport: 'Submit your portfolio', gint: 'Join the graduate network', sform: 'Submit an opportunity' };
  var back = document.createElement('div'); back.className = 'gback'; back.hidden = true; document.body.appendChild(back);
  var cur = null, lastFocus = null;

  function close() {
    if (!cur) return;
    cur.classList.remove('open'); cur.removeAttribute('role'); cur.removeAttribute('aria-modal'); back.hidden = true;
    document.body.classList.remove('gm-lock');
    var x = cur.querySelector('.gclose'); if (x) x.remove();
    cur = null; if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function open(cell, from) {
    if (cur) close();
    lastFocus = from || document.activeElement; cur = cell;
    cell.classList.add('open'); cell.setAttribute('role', 'dialog'); cell.setAttribute('aria-modal', 'true');
    var f = cell.querySelector('form'); cell.setAttribute('aria-label', f ? (LABELS[f.id] || 'Form') : 'Form');
    var x = document.createElement('button'); x.type = 'button'; x.className = 'gclose'; x.setAttribute('aria-label', 'Close form'); x.textContent = '×'; x.onclick = close; cell.insertBefore(x, cell.firstChild);
    back.hidden = false; document.body.classList.add('gm-lock');
    var first = cell.querySelector('input:not([type=hidden]):not(.hp),select,textarea'); if (first) first.focus({ preventScroll: true });
  }
  back.onclick = close;
  document.addEventListener('keydown', function (e) {
    if (!cur) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {   /* keep keyboard focus inside the dialog */
      var els = Array.prototype.slice.call(cur.querySelectorAll('button,input:not(.hp),select,textarea,a[href]')).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!els.length) return; var a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  var cells = Array.prototype.slice.call(document.querySelectorAll('.gform'));
  cells.forEach(function (cell, i) {
    var f = cell.querySelector('form'); if (!f) return;
    cell.classList.add('gmodal'); if (!cell.id) cell.id = 'gm-' + f.id;
    if (cell.id === 's-submit') return;                       /* its button already exists on the Student Hub */
    var p = document.createElement('p'); var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.setAttribute('data-modal', cell.id); b.textContent = LABELS[f.id] || 'Open form';
    p.appendChild(b); cell.parentNode.insertBefore(p, cell);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-modal],[data-go="s-submit"],[data-open]'); if (!t) return;
    var id = t.getAttribute('data-modal') || (t.getAttribute('data-go') === 's-submit' ? 's-submit' : t.hasAttribute('data-open') ? 'gm-gint' : '');
    var cell = id && document.getElementById(id); if (cell && cell.classList.contains('gmodal')) { open(cell, t); }
  }, true);
  addEventListener('hashchange', close);
})();
