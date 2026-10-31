/* ASAKenya email confirmation callback.
   The current static site uses the Supabase Auth REST API (not supabase-js).
   Handle the implicit-flow tokens returned by Supabase's ConfirmationURL and
   token_hash links from a custom email template, then hand the session to admin.js. */
(function () {
  'use strict';
  var message = document.getElementById('confirm-message');
  var action = document.getElementById('confirm-action');
  var DB = window.ASA_DB;

  function show(text, bad) {
    message.textContent = text;
    message.style.color = bad ? '#b42318' : '#176638';
  }
  function offerSignIn() {
    action.textContent = '';
    var link = document.createElement('a');
    link.href = '/admin';
    link.textContent = 'Continue to sign in';
    action.appendChild(link);
  }
  function cleanAddress() {
    try { history.replaceState(null, document.title, location.pathname); } catch (e) { }
  }
  function makeSession(response) {
    if (!response || !response.access_token || !response.refresh_token) {
      throw new Error('Supabase did not return a complete sign-in session. Please sign in normally.');
    }
    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      expires_at: Number(response.expires_at) || (Math.floor(Date.now() / 1000) + (Number(response.expires_in) || 3600)),
      user: response.user || null
    };
  }

  async function complete() {
    if (!DB || !DB.configured()) throw new Error('The ASAKenya Supabase connection is not configured.');
    var url = new URL(location.href);
    var hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    var errorCode = url.searchParams.get('error_code') || hash.get('error_code');
    var errorText = url.searchParams.get('error_description') || hash.get('error_description') || url.searchParams.get('error') || hash.get('error');
    if (errorCode || errorText) {
      cleanAddress();
      throw new Error(errorText || ('Email confirmation failed (' + errorCode + ').'));
    }

    var session;
    var tokenHash = url.searchParams.get('token_hash');
    if (tokenHash) {
      var type = url.searchParams.get('type') || 'email';
      if (type === 'signup' || type === 'confirmation') type = 'email';
      var verified = await DB.request('/auth/v1/verify', {
        method: 'POST',
        body: { token_hash: tokenHash, type: type }
      });
      session = makeSession(verified);
    } else {
      var accessToken = hash.get('access_token');
      var refreshToken = hash.get('refresh_token');
      if (!accessToken || !refreshToken) {
        cleanAddress();
        if (url.searchParams.get('code')) {
          throw new Error('This link returned a PKCE code, but this static REST sign-up flow has no matching code verifier. Request a fresh confirmation email and use the normal ASAKenya confirmation link.');
        }
        throw new Error('This confirmation link is incomplete or has expired. Request a new confirmation email, then open the newest link.');
      }
      var expiresIn = Number(hash.get('expires_in')) || 3600;
      session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Number(hash.get('expires_at')) || (Math.floor(Date.now() / 1000) + expiresIn),
        user: null
      };
      cleanAddress();
      session.user = await DB.request('/auth/v1/user', { token: accessToken });
    }

    if (!session.user) session.user = await DB.request('/auth/v1/user', { token: session.access_token });
    if (!session.user || !session.user.id) throw new Error('Email verification succeeded, but the account details could not be loaded. Please sign in normally.');
    try {
      sessionStorage.setItem('asa_admin', JSON.stringify(session));
    } catch (e) {
      throw new Error('Your email is verified, but this browser could not save the sign-in session. Continue to sign in manually.');
    }
    cleanAddress();
    show('Your email is confirmed. Opening your ASAKenya workspace…');
    window.setTimeout(function () { location.replace('/admin'); }, 900);
  }

  complete().catch(function (error) {
    cleanAddress();
    show(error && error.message ? error.message : 'We could not complete email confirmation. Please request a new link or sign in.', true);
    offerSignIn();
  });
})();
