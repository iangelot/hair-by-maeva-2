const { body, json, requireAdmin, supabase } = require('./_lib');

// The browser never needs direct database grants. Every admin CMS operation is
// authenticated here, then performed with the server-only service role.
const allowedTables = new Set([
  'bookings', 'customers', 'service_categories', 'services', 'service_lengths',
  'service_options', 'payment_methods', 'availability_rules', 'booking_settings',
  'blocked_dates', 'blocked_times', 'policies', 'website_sections',
  'contact_messages', 'email_templates', 'gallery_items', 'social_links'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req);
    const path = String(input.path || '');
    const table = path.split('?')[0];
    const method = ['GET', 'POST', 'PATCH', 'DELETE'].includes(input.method) ? input.method : 'GET';
    if (!allowedTables.has(table)) return json(res, 400, { error: 'That data source is not available.' });
    const headers = input.headers?.Prefer ? { Prefer: String(input.headers.Prefer).slice(0, 100) } : {};
    const data = await supabase(path, { method, headers, ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}) });
    return json(res, 200, { data });
  } catch (error) {
    console.error(error);
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to load administrator data.' });
  }
};
