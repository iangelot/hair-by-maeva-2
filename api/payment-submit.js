const crypto = require('node:crypto');
const { adminRecipients, body, clean, env, json, sendEmail, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req);
    const token = clean(input.token, 120);
    const methodId = clean(input.methodId, 80);
    if (!token || !methodId) return json(res, 400, { error: 'Choose a payment method first.' });
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const bookings = await supabase(`bookings?access_token_hash=eq.${encodeURIComponent(hash)}&token_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,booking_number,customer_id,service_name_snapshot,length_name_snapshot,appointment_date,appointment_time,total_price,reservation_fee,remaining_balance,payment_status,status`);
    const booking = bookings[0];
    if (!booking) return json(res, 404, { error: 'That booking link is invalid or expired.' });
    if (booking.payment_status === 'payment_submitted' || booking.payment_status === 'payment_verified') return json(res, 200, { ok: true, status: booking.payment_status, bookingNumber: booking.booking_number });
    const methods = await supabase(`payment_methods?id=eq.${encodeURIComponent(methodId)}&is_active=eq.true&select=id,name`);
    const method = methods[0];
    if (!method) return json(res, 400, { error: 'That payment method is not available.' });
    await supabase(`payments?booking_id=eq.${encodeURIComponent(booking.id)}&status=eq.unpaid`, { method: 'PATCH', body: JSON.stringify({ method_id: method.id, status: 'payment_submitted', submitted_at: new Date().toISOString(), note: clean(input.note, 500) }) });
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ payment_method_id: method.id, payment_status: 'payment_submitted', status: 'payment_submitted', updated_at: new Date().toISOString() }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) {
      const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(token)}`;
      const details = `<p>${booking.service_name_snapshot} · ${booking.length_name_snapshot}<br>${booking.appointment_date} at ${booking.appointment_time}<br>Total: $${Number(booking.total_price).toFixed(2)} · Deposit: $${Number(booking.reservation_fee).toFixed(2)} · Remaining: $${Number(booking.remaining_balance).toFixed(2)}</p>`;
      await sendEmail({ to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: 'Hair by Maeva — Payment Submitted', html: `<p>Hi ${customer.full_name},</p><p>We received your payment submission for booking <strong>${booking.booking_number}</strong>. It is awaiting manual verification.</p>${details}<p>Payment method: ${method.name}</p><p><a href="${manageUrl}">View / manage my booking</a></p>` });
      if (process.env.ADMIN_EMAIL) await sendEmail({ to: adminRecipients(), replyTo: customer.email, subject: `Payment submitted — ${booking.booking_number}`, html: `<p>${customer.full_name} submitted a ${method.name} payment for booking ${booking.booking_number}.</p>${details}` });
    }
    return json(res, 200, { ok: true, status: 'payment_submitted', bookingNumber: booking.booking_number });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'We could not submit the payment status. Please try again.' });
  }
};
