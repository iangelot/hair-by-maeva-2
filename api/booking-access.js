const { clean, env, json, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const token = clean(req.query?.token, 120);
    if (!token) return json(res, 400, { error: 'Missing booking link.' });
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await supabase(`bookings?access_token_hash=eq.${hash}&token_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=booking_number,service_name_snapshot,length_name_snapshot,appointment_date,appointment_time,total_price,reservation_fee,remaining_balance,payment_status,status,created_at`);
    if (!rows.length) return json(res, 404, { error: 'That booking link is invalid or expired.' });
    return json(res, 200, rows[0]);
  } catch (error) { console.error(error); return json(res, 500, { error: 'We could not load that booking.' }); }
};
