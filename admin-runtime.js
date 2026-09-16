/* Small browser client for the REST/Auth/Storage calls used by the admin CMS. */
(function () {
  const base = 'https://ebljbhjtnazslbdkpmbu.supabase.co';
  const key = 'sb_publishable_1xA2v-KNZH11UpcmzzaHCQ_pAg7KMzd';
  const tokenKey = 'hair-by-maeva-admin-token';
  const authHeaders = () => { const token = localStorage.getItem(tokenKey); return { apikey: key, Authorization: `Bearer ${token || key}` }; };
  async function request(path, options = {}) {
    const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const text = await response.text(); let data = text ? JSON.parse(text) : null;
    if (!response.ok) return { data: null, error: new Error(data?.message || data?.hint || data?.error_description || data?.error || `Request failed (${response.status})`) };
    return { data, error: null };
  }
  function query(table) {
    const state = { table, params: [], method: 'GET', payload: null, wantSingle: false, wantMaybeSingle: false, headers: {} };
    const builder = {
      select(columns = '*') { state.params.push(`select=${encodeURIComponent(columns)}`); return builder; },
      order(column, options = {}) { state.params.push(`order=${encodeURIComponent(column)}.${options.ascending === false ? 'desc' : 'asc'}`); return builder; },
      limit(value) { state.params.push(`limit=${encodeURIComponent(value)}`); return builder; },
      eq(column, value) { state.params.push(`${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`); return builder; },
      in(column, values) { state.params.push(`${encodeURIComponent(column)}=in.(${values.map((value) => encodeURIComponent(value)).join(',')})`); return builder; },
      is(column, value) { state.params.push(`${encodeURIComponent(column)}=is.${encodeURIComponent(value)}`); return builder; },
      single() { state.wantSingle = true; return builder; },
      maybeSingle() { state.wantMaybeSingle = true; return builder; },
      insert(payload) { state.method = 'POST'; state.payload = payload; state.headers.Prefer = 'return=representation'; return builder; },
      update(payload) { state.method = 'PATCH'; state.payload = payload; state.headers.Prefer = 'return=representation'; return builder; },
      delete() { state.method = 'DELETE'; state.headers.Prefer = 'return=representation'; return builder; },
      then(resolve, reject) { return request(`${state.table}${state.params.length ? `?${state.params.join('&')}` : ''}`, { method: state.method, body: state.payload ? JSON.stringify(state.payload) : undefined, headers: state.headers }).then((result) => { if (result.error) return result; const rows = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []); if (state.wantSingle) return { data: rows[0] || null, error: rows[0] ? null : new Error('No row returned.') }; if (state.wantMaybeSingle) return { data: rows[0] || null, error: null }; return { data: result.data, error: null }; }).then(resolve, reject); }
    }; return builder;
  }
  const client = {
    from: query,
    auth: {
      async signInWithPassword({ email, password }) { const response = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) return { data: null, error: new Error(data.error_description || data.msg || 'Unable to sign in.') }; localStorage.setItem(tokenKey, data.access_token); return { data: { session: data }, error: null }; },
      async getSession() { const token = localStorage.getItem(tokenKey); return { data: { session: token ? { access_token: token } : null }, error: null }; },
      async getUser() { const token = localStorage.getItem(tokenKey); if (!token) return { data: { user: null }, error: null }; const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => null); return response.ok ? { data: { user: data }, error: null } : { data: { user: null }, error: new Error('Session expired.') }; },
      async signOut() { localStorage.removeItem(tokenKey); return { error: null }; }
    },
    storage: { from(bucket) { return { getPublicUrl(path) { return { data: { publicUrl: `${base}/storage/v1/object/public/${bucket}/${path}` } }; }, async upload(path, file, options = {}) { const token = localStorage.getItem(tokenKey); const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': options.contentType || file.type, 'x-upsert': String(Boolean(options.upsert)) }, body: file }); return { data: response.ok ? { path } : null, error: response.ok ? null : new Error('Image upload failed.') }; }, async remove(paths) { const token = localStorage.getItem(tokenKey); const response = await fetch(`${base}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) }); return { data: response.ok ? paths : null, error: response.ok ? null : new Error('Image removal failed.') }; } }; } }
  };
  window.supabase = { createClient: () => client };
})();


