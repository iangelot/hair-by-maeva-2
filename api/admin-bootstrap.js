const { body, env, json, requireAdmin, supabase } = require('./_lib');

const allowedTables = new Set(['bookings', 'customers', 'service_categories', 'services', 'service_lengths', 'service_options', 'payment_methods', 'availability_rules', 'booking_settings', 'blocked_dates', 'blocked_times', 'policies', 'website_sections', 'contact_messages', 'email_templates', 'gallery_items', 'social_links']);

// Link the first authenticated business user to the admin table. This avoids
// making Maeva copy a UUID into SQL while still refusing later self-promotion.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req);
    // Secure CMS data proxy: this keeps the browser out of the database RLS
    // layer while retaining an authenticated administrator check per request.
    if (input.path) {
      await requireAdmin(req);
      const path = String(input.path); const table = path.split('?')[0];
      const method = ['GET', 'POST', 'PATCH', 'DELETE'].includes(input.method) ? input.method : 'GET';
      if (!allowedTables.has(table)) return json(res, 400, { error: 'That data source is not available.' });
      const headers = input.headers?.Prefer ? { Prefer: String(input.headers.Prefer).slice(0, 100) } : {};
      const data = await supabase(path, { method, headers, ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}) });
      return json(res, 200, { data });
    }
    const authorization = String(req.headers.authorization || '');
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return json(res, 401, { error: 'Sign in is required.' });
    const userResponse = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return json(res, 401, { error: 'Your session is no longer valid. Sign in again.' });
    const user = await userResponse.json();
    const existing = await supabase('admin_users?select=user_id&limit=1');
    const allowedEmails = [
      String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
      String(process.env.ADMIN_ROUTING_EMAIL || '').trim().toLowerCase(),
      'maevausa@outlook.com',
      'idrissangelot99@gmail.com'
    ].filter(Boolean);
    const userEmail = String(user.email || '').toLowerCase();
    const isExistingAdmin = (await supabase(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`)).length > 0;
    if (!isExistingAdmin && allowedEmails.length && !allowedEmails.includes(userEmail)) {
      return json(res, 403, { error: 'Administrator access is not enabled for this account.' });
    }
    await supabase('admin_users', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: user.id, display_name: user.user_metadata?.display_name || 'Admin' }) });
    return json(res, 200, { ok: true });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: 'Unable to enable administrator access.' }); }
};
