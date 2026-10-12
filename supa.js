/* ASA Kenya - tiny Supabase client (no libraries).
   Talks to Supabase's REST API with fetch. Uses ONLY the publishable key.
   Shared by the public site (read published opportunities, send graduate forms) and the admin page. */
(function () {
  'use strict';
  var C = window.ASA_CONFIG || {};
  var BASE = (C.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY = C.SUPABASE_PUBLISHABLE_KEY || '';

  function configured() { return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(BASE) && KEY.length > 20; }

  function headers(token, extra) {
    var h = { apikey: KEY };
    if (token) h.Authorization = 'Bearer ' + token;   /* a logged-in user's session token; never the key itself */
    for (var k in extra) h[k] = extra[k];
    return h;
  }

  /* Low-level request. Throws Error with .status, .code, .detail on failure. */
  async function request(path, o) {
    o = o || {};
    if (!configured()) { var e0 = new Error('Supabase is not configured yet.'); e0.status = 0; e0.code = 'not_configured'; throw e0; }
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, o.timeout || 15000);
    var init = { method: o.method || 'GET', headers: headers(o.token, o.headers), signal: ctl.signal };
    if (o.body !== undefined) {
      if (o.raw) init.body = o.body;                  /* file uploads */
      else { init.body = JSON.stringify(o.body); init.headers['Content-Type'] = 'application/json'; }
    }
    var res;
    try { res = await fetch(BASE + path, init); }
    catch (e) { var en = new Error(e && e.name === 'AbortError' ? 'The request timed out.' : 'Could not reach the server. Check your connection.'); en.status = 0; en.code = 'network'; throw en; }
    finally { clearTimeout(timer); }
    var text = await res.text(), data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      var m = data && (data.message || data.msg || data.error_description || data.error) || ('Request failed (' + res.status + ')');
      var err = new Error(m); err.status = res.status; err.code = data && (data.code || data.error_code || data.error) || ''; err.detail = data && data.details || ''; throw err;
    }
    return data;
  }

  /* PostgREST helpers. `query` is a query string such as "select=id,title&status=eq.published". */
  function select(table, query, token) { return request('/rest/v1/' + table + (query ? '?' + query : ''), { token: token }); }
  function insert(table, row, token, returning) {
    return request('/rest/v1/' + table, { method: 'POST', token: token, body: row, headers: { Prefer: returning ? 'return=representation' : 'return=minimal' } });
  }
  function update(table, filter, patch, token) {
    return request('/rest/v1/' + table + '?' + filter, { method: 'PATCH', token: token, body: patch, headers: { Prefer: 'return=representation' } });
  }
  function remove(table, filter, token) {
    return request('/rest/v1/' + table + '?' + filter, { method: 'DELETE', token: token, headers: { Prefer: 'return=representation' } });
  }
  function rpc(fn, args, token) { return request('/rest/v1/rpc/' + fn, { method: 'POST', token: token, body: args || {} }); }

  /* Public columns of an opportunity (matches the columns anonymous visitors are allowed to read). */
  var OPP_COLS = 'id,title,organisation,category,description,location,apply_url,deadline,file_url,eligibility,audience,status,published_at,created_at,updated_at';

  window.ASA_DB = {
    configured: configured, request: request, select: select, insert: insert, update: update, remove: remove, rpc: rpc,
    OPP_COLS: OPP_COLS, BASE: BASE,
    publicFileUrl: function (path) { return BASE + '/storage/v1/object/public/' + (C.OPPORTUNITY_BUCKET || 'opportunity-files') + '/' + path.split('/').map(encodeURIComponent).join('/'); }
  };
})();
