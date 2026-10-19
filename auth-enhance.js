/* ASAKenya authentication UX: password visibility, dedicated registration page, welcome message. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function addPasswordControl(input) {
    if (!input || input.dataset.visibilityReady) return;
    input.dataset.visibilityReady = '1';
    input.id = input.id || 'asa-password-' + Math.random().toString(36).slice(2, 8);
    var wrap = document.createElement('div');
    wrap.className = 'asa-password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn o s'; btn.textContent = 'Show password';
    btn.style.marginTop = '6px'; btn.style.width = '100%';
    btn.setAttribute('aria-controls', input.id); btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-pressed', String(show));
      input.focus();
    });
    wrap.appendChild(btn);
  }
  function enhanceLogin() {
    var form = document.getElementById('lf');
    if (!form || form.dataset.authEnhanced) return;
    form.dataset.authEnhanced = '1';
    addPasswordControl(form.elements.password);
    var card = form.closest('.login');
    if (!card) return;
    var intro = document.createElement('p');
    intro.className = 'note';
    intro.textContent = 'Welcome to the ASAKenya workspace. Sign in to continue, or create your account.';
    card.insertBefore(intro, form);
    var link = document.createElement('a');
    link.href = '/register';
    link.className = 'btn o';
    link.style.cssText = 'display:block;text-align:center;text-decoration:none;width:100%;margin-top:12px;box-sizing:border-box';
    link.textContent = 'Create an account';
    form.insertAdjacentElement('afterend', link);
  }
  function enhanceRegistration() {
    document.querySelectorAll('#asa-register-form input[type="password"]').forEach(addPasswordControl);
  }
  function apply() { enhanceLogin(); enhanceRegistration(); }
  if (window.MutationObserver) new MutationObserver(apply).observe(app, { childList: true, subtree: true });
  apply();
})();