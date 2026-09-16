const { body, env, json, supabase } = require('./_lib');

// Link the first authenticated business user to the admin table. This avoids
// making Maeva copy a UUID into SQL while still refusing later self-promotion.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const authorization = String(req.headers.authorization || '');
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return json(res, 401, { error: 'Sign in is required.' });
    const userResponse = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return json(res, 401, { error: 'Your session is no longer valid. Sign in again.' });
    const user = await userResponse.json();
    const existing = await supabase('admin_users?select=user_id&limit=1');
    const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (existing.length && configuredEmail && String(user.email || '').toLowerCase() !== configuredEmail) return json(res, 403, { error: 'Administrator access is not enabled for this account.' });
    await supabase('admin_users', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: user.id, display_name: 'Maeva' }) });
    return json(res, 200, { ok: true });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: 'Unable to enable administrator access.' }); }
};
