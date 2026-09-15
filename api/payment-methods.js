const { json, supabasePublic } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const methods = await supabasePublic('payment_methods?is_active=eq.true&select=id,name,handle,email,phone,payment_url,deep_link,instructions,qr_code_path&order=display_order.asc');
    const mediaBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/hair-media/`;
    return json(res, 200, methods.map((method) => ({ ...method, qr_code_url: method.qr_code_path ? (/^https?:\/\//.test(method.qr_code_path) ? method.qr_code_path : `${mediaBase}${String(method.qr_code_path).replace(/^\/+/, '')}`) : '' })));
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Payment methods are temporarily unavailable.' });
  }
};
