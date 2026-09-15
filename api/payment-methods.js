const { json, supabasePublic } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const methods = await supabasePublic('payment_methods?is_active=eq.true&select=id,name,handle,email,phone,payment_url,deep_link,instructions,qr_code_path&order=display_order.asc');
    return json(res, 200, methods);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Payment methods are temporarily unavailable.' });
  }
};
