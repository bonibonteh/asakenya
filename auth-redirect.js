/* If Supabase ever sends a confirmation result to the wrong page (for example the Site URL, the home page or /register),
   forward it to /auth/confirm/ with the hash intact so the student sees the result instead of a broken page.
   Password-recovery links are left alone: /admin handles those itself. */
(function () {
  var h = location.hash || '', q = location.search || '';
  if (!h && !q) return;
  if (location.pathname.indexOf('/auth/confirm') === 0) return;
  if (/type=recovery/.test(h)) return;
  var signupToken = /access_token=/.test(h) && /type=(signup|email_change|invite|magiclink)/.test(h);
  var authError = /(^#|&)error(_code)?=/.test(h) && /error_description=|error_code=/.test(h) && !/type=recovery/.test(h);
  var admin = location.pathname.indexOf('/admin') === 0;
  if (signupToken || (authError && !admin)) location.replace('/auth/confirm/' + q + h);
})();
