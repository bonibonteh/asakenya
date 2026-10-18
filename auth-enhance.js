/* ASAKenya admin authentication enhancements: password visibility, self-registration and welcome message.
   Registration creates a Supabase Auth account only; it does not grant staff/admin privileges. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app || !window.ASA_DB || !window.ASA_DB.configured()) return;
  var busy = false;

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function message(s, bad) {
    var el = document.getElementById('msg');
    if (el) el.innerHTML = '<p class="m ' + (bad ? 'er' : 'ok') + '">' + esc(s) + '</p>';
  }
  function togglePassword(input, button) {
    if (!input || !button || button.dataset.passwordToggle) return;
    button.dataset.passwordToggle = '1';
    button.type = 'button';
    button.className = 'btn o s';
    button.setAttribute('aria-controls', input.id);
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Show password';
    button.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide password' : 'Show password';
      button.setAttribute('aria-pressed', String(show));
      input.focus();
    });
  }
  function addPasswordControl(label, input) {
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
    wrap.appendChild(btn);
    togglePassword(input, btn);
  }
  function enhanceLogin() {
    var form = document.getElementById('lf');
    if (!form || form.dataset.authEnhanced) return;
    form.dataset.authEnhanced = '1';
    var password = form.elements.password;
    addPasswordControl('Password', password);

    var card = form.closest('.login');
    if (!card) return;
    var intro = document.createElement('p');
    intro.className = 'note';
    intro.textContent = 'Welcome to the ASAKenya workspace. Sign in to continue, or create an account below.';
    card.insertBefore(intro, form);

    var signupToggle = document.createElement('button');
    signupToggle.type = 'button'; signupToggle.className = 'btn o'; signupToggle.style.width = '100%';
    signupToggle.style.marginTop = '10px'; signupToggle.textContent = 'Create an account';
    form.insertAdjacentElement('afterend', signupToggle);

    var signup = document.createElement('form');
    signup.id = 'asa-register-form'; signup.hidden = true;
    signup.style.marginTop = '18px';
    signup.innerHTML = '<h3>Create your ASAKenya account</h3>' +
      '<p class="note">Use your email address and a password with at least 8 characters. Account registration does not automatically grant staff or administrator access.</p>' +
      '<label>Full name<input name="full_name" type="text" autocomplete="name" maxlength="120" required></label>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<label>Confirm password<input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<button class="btn" type="submit" style="width:100%">Register account</button>' +
      '<button class="btn o" id="asa-cancel-register" type="button" style="width:100%;margin-top:8px">Back to sign in</button>' +
      '<p class="note" id="asa-register-msg" role="status" aria-live="polite"></p>';
    signupToggle.insertAdjacentElement('afterend', signup);
    addPasswordControl('Password', signup.elements.password);
    addPasswordControl('Confirm password', signup.elements.confirm_password);
    signupToggle.addEventListener('click', function () {
      signup.hidden = !signup.hidden;
      form.hidden = !signup.hidden;
      signupToggle.hidden = !signup.hidden;
      if (!signup.hidden) signup.elements.full_name.focus();
    });
    signup.querySelector('#asa-cancel-register').addEventListener('click', function () {
      signup.hidden = true; form.hidden = false; signupToggle.hidden = false; form.elements.email.focus();
    });
    signup.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var f = signup, btn = f.querySelector('button[type="submit"]');
      var name = f.elements.full_name.value.trim();
      var email = f.elements.email.value.trim();
      var pass = f.elements.password.value;
      var confirm = f.elements.confirm_password.value;
      var out = f.querySelector('#asa-register-msg');
      out.textContent = '';
      if (name.length < 2) { out.textContent = 'Please enter your full name.'; return; }
      if (pass.length < 8) { out.textContent = 'Use a password with at least 8 characters.'; return; }
      if (pass !== confirm) { out.textContent = 'The passwords do not match.'; return; }
      busy = true; btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        var result = await window.ASA_DB.request('/auth/v1/signup', {
          method: 'POST',
          body: { email: email, password: pass, data: { full_name: name, name: name } }
        });
        if (result && result.access_token) {
          out.textContent = 'Account created. For security, it has not been granted staff/admin access. Please sign in and ask an administrator to assign any required role.';
        } else {
          out.textContent = 'Registration received. Check your email for a verification link if email confirmation is enabled. Once verified, sign in. Registration does not grant staff/admin access.';
        }
        f.reset();
        message('Welcome to ASAKenya. Your account registration was submitted.', false);
      } catch (err) {
        var em = err && err.message ? err.message : 'Registration failed. Please try again.';
        if (/already registered|already exists|user already/i.test(em)) em = 'An account may already exist for this email. Try signing in or use password recovery.';
        out.textContent = em;
      } finally {
        busy = false; btn.disabled = false; btn.textContent = 'Register account';
      }
    });
  }

  function addWelcome() {
    var shell = app.querySelector('.shell');
    if (!shell || app.querySelector('#asa-welcome-banner')) return;
    var name = (document.getElementById('who') || {}).textContent || '';
    name = name.split(' (')[0].trim();
    var first = name.includes('@') ? name.split('@')[0].replace(/[._-]+/g, ' ') : name;
    first = first ? first.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : 'there';
    var banner = document.createElement('section');
    banner.id = 'asa-welcome-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'margin:0 0 22px;padding:22px 24px;border:1px solid #cbdcc9;border-radius:16px;background:linear-gradient(120deg,#edf5e9,#fffdf8);box-shadow:0 8px 24px rgba(16,56,36,.06)';
    banner.innerHTML = '<p style="margin:0 0 5px;font-size:.75rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#176638">ASAKenya workspace</p><h2 style="margin:0 0 7px;font-size:clamp(1.35rem,3vw,2rem)">Welcome' + (first ? ', ' + esc(first) : '') + '!</h2><p style="margin:0;color:#637267">Good to have you here. Your ASAKenya workspace is ready. Choose an item from the dashboard to get started.</p>';
    shell.parentNode.insertBefore(banner, shell);
  }
  function apply() {
    enhanceLogin();
    addWelcome();
  }
  if (window.MutationObserver) new MutationObserver(function () { apply(); }).observe(app, { childList: true, subtree: true });
  apply();
})();