/* ASAKenya email confirmation callback (/auth/confirm/).
   The site talks to Supabase Auth over REST (no supabase-js), so sign-up uses the implicit flow, not PKCE.
   This page accepts every shape Supabase can send back:
     1. #access_token=...&refresh_token=...&type=signup   (the default {{ .ConfirmationURL }} email link)
     2. ?token_hash=...&type=email                          (a custom token-hash email template)
     3. #error=...&error_code=otp_expired                   (expired or already-used link)
     4. ?code=...                                           (PKCE; explained, because the REST sign-up has no code verifier)
   It confirms the account, shows a success message and sends the student to the login page.
   It deliberately does NOT sign the student in: the message says "you can now log in". Tokens are never stored,
   and are removed from the address bar before any network request. No secret key is used anywhere. */
(function () {
  'use strict';
  var title = document.getElementById('confirm-title');
  var message = document.getElementById('confirm-message');
  var action = document.getElementById('confirm-action');
  var resend = document.getElementById('confirm-resend');
  var DB = window.ASA_DB;
  var LOGIN = '/admin';
  var SUCCESS = 'Your email has been verified successfully. You can now log in to ASA Kenya.';

  function show(text, state) {
    message.textContent = text;
    message.className = state ? 'confirm-' + state : '';
  }
  function loginButton(label) {
    action.textContent = '';
    var a = document.createElement('a');
    a.href = LOGIN; a.className = 'btn'; a.textContent = label || 'Go to login';
    a.style.cssText = 'display:inline-block;text-decoration:none;color:#fff';
    action.appendChild(a);
  }
  function cleanAddress() { try { history.replaceState(null, document.title, location.pathname); } catch (e) { } }

  function explain(code, text) {
    var s = (String(code || '') + ' ' + String(text || '')).toLowerCase();
    if (/otp_expired|expired/.test(s)) return { text: 'This confirmation link has expired. Enter your email below and we will send you a new one.', resend: true };
    if (/access_denied|invalid|used|not found|bad_jwt/.test(s)) return { text: 'This confirmation link is invalid or has already been used. If you already confirmed your email, you can log in. Otherwise request a new link below.', resend: true, login: true };
    if (/rate|too many/.test(s)) return { text: 'Too many attempts. Please wait a minute and try again.', resend: false, login: true };
    return { text: 'We could not verify your email. Request a new confirmation link below, or try logging in.', resend: true, login: true };
  }
  function fail(code, text) {
    cleanAddress();
    var e = explain(code, text);
    if (title) title.textContent = 'Email not verified';
    show(e.text, 'error');
    if (e.login) loginButton('Go to login'); else action.textContent = '';
    if (e.resend && resend) resend.hidden = false;
  }
  function done() {
    cleanAddress();
    if (title) title.textContent = 'Email verified';
    show(SUCCESS, 'ok');
    loginButton('Log in to ASA Kenya');
    window.setTimeout(function () { location.replace(LOGIN); }, 4000);
  }

  async function complete() {
    if (!DB || !DB.configured()) throw { code: 'config', message: 'The ASA Kenya connection is not configured. Please contact an administrator.' };
    var url = new URL(location.href);
    var hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    var errorCode = url.searchParams.get('error_code') || hash.get('error_code');
    var errorText = url.searchParams.get('error_description') || hash.get('error_description') || url.searchParams.get('error') || hash.get('error');
    var tokenHash = url.searchParams.get('token_hash');
    var accessToken = hash.get('access_token');
    var authCode = url.searchParams.get('code');
    cleanAddress(); /* one-time tokens leave the address bar before anything else happens */

    if (errorCode || errorText) throw { code: errorCode || 'error', message: errorText || '' };

    if (tokenHash) {
      var type = url.searchParams.get('type') || 'email';
      if (type === 'signup' || type === 'confirmation') type = 'email';
      await DB.request('/auth/v1/verify', { method: 'POST', body: { token_hash: tokenHash, type: type } });
      return;
    }
    if (accessToken) {
      /* Supabase already verified the email before redirecting here. Confirm the token is real, then discard it. */
      var user = await DB.request('/auth/v1/user', { token: accessToken });
      if (!user || !user.id) throw { code: 'invalid', message: 'invalid' };
      return;
    }
    if (authCode) throw { code: 'pkce', message: 'This link used a PKCE code, which the ASA Kenya sign-up form does not use. Request a new confirmation email below and open the newest link.' };
    throw { code: 'invalid', message: 'This confirmation link is incomplete.' };
  }

  complete().then(done).catch(function (err) {
    if (err && err.code === 'pkce') { cleanAddress(); if (title) title.textContent = 'Email not verified'; show(err.message, 'error'); if (resend) resend.hidden = false; loginButton('Go to login'); return; }
    if (err && err.code === 'config') { cleanAddress(); show(err.message, 'error'); return; }
    if (err && err.status === 0) { show('We could not reach the server. Check your connection and reload this page.', 'error'); return; }
    fail(err && (err.code || err.status), err && err.message);
  });

  /* Resend a confirmation email. One request per click; the answer never reveals whether an address has an account. */
  var form = document.getElementById('resend-form');
  if (form && DB) {
    var busy = false;
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var email = form.elements.email.value.trim();
      var out = document.getElementById('resend-message');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { out.textContent = 'Please enter a valid email address.'; out.className = 'confirm-error'; return; }
      busy = true; form.querySelector('button').disabled = true;
      try {
        await DB.request('/auth/v1/resend?redirect_to=' + encodeURIComponent(location.origin + '/auth/confirm/'), { method: 'POST', body: { type: 'signup', email: email } });
        out.textContent = 'If that email has an unconfirmed ASA Kenya account, a new confirmation link is on its way. Open the newest email.';
        out.className = 'confirm-ok';
      } catch (e) {
        out.textContent = (e && (e.status === 429 || /rate|seconds/i.test(e.message || ''))) ? 'Please wait a minute before requesting another email.' : 'We could not send a new link right now. Please try again shortly.';
        out.className = 'confirm-error';
      }
      window.setTimeout(function () { busy = false; form.querySelector('button').disabled = false; }, 60000);
    });
  }
})();
