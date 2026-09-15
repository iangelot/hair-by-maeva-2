const crypto = require('node:crypto');
const { adminRecipients, body, clean, env, escapeHtml, json, supabase, trySendEmail, trySendTemplatedEmail } = require('./_lib');

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
    if (['cancelled', 'completed'].includes(booking.status)) return json(res, 409, { error: 'This booking can no longer accept payment updates.' });
    if (booking.payment_status === 'payment_submitted' || booking.payment_status === 'payment_verified') return json(res, 200, { ok: true, status: booking.payment_status, bookingNumber: booking.booking_number });
    const methods = await supabase(`payment_methods?id=eq.${encodeURIComponent(methodId)}&is_active=eq.true&select=id,name`);
    const method = methods[0];
    if (!method) return json(res, 400, { error: 'That payment method is not available.' });
    const paymentRows = await supabase(`payments?booking_id=eq.${encodeURIComponent(booking.id)}&select=id&order=created_at.desc&limit=1`);
    const paymentPayload = { booking_id: booking.id, amount: booking.reservation_fee, method_id: method.id, status: 'payment_submitted', submitted_at: new Date().toISOString(), note: clean(input.note, 500) };
    if (paymentRows[0]) await supabase(`payments?id=eq.${encodeURIComponent(paymentRows[0].id)}`, { method: 'PATCH', body: JSON.stringify(paymentPayload) });
    else await supabase('payments', { method: 'POST', body: JSON.stringify(paymentPayload) });
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ payment_method_id: method.id, payment_status: 'payment_submitted', status: 'payment_submitted', updated_at: new Date().toISOString() }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) {
      const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(token)}`;
      const details = `<p>${escapeHtml(booking.service_name_snapshot)} · ${escapeHtml(booking.length_name_snapshot)}<br>${escapeHtml(booking.appointment_date)} at ${escapeHtml(booking.appointment_time)}<br>Total: $${Number(booking.total_price).toFixed(2)} · Deposit: $${Number(booking.reservation_fee).toFixed(2)} · Remaining: $${Number(booking.remaining_balance).toFixed(2)}</p>`;
      await trySendTemplatedEmail({ templateKey: 'payment_submitted', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: 'Hair by Maeva — Payment Submitted', html: `<p>Hi ${escapeHtml(customer.full_name)},</p><p>We received your payment submission for booking <strong>${escapeHtml(booking.booking_number)}</strong>. It is awaiting manual verification.</p>${details}<p>Payment method: ${escapeHtml(method.name)}</p><p><a href="${manageUrl}">View / manage my booking</a></p>`, variables: { booking_number: booking.booking_number, customer_name: customer.full_name, service: booking.service_name_snapshot, length: booking.length_name_snapshot, date: booking.appointment_date, time: booking.appointment_time, total: Number(booking.total_price).toFixed(2), deposit: Number(booking.reservation_fee).toFixed(2), remaining: Number(booking.remaining_balance).toFixed(2), payment_method: method.name, manage_url: manageUrl } });
      if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), replyTo: customer.email, subject: `Payment submitted — ${booking.booking_number}`, html: `<p>${escapeHtml(customer.full_name)} submitted a ${escapeHtml(method.name)} payment for booking ${escapeHtml(booking.booking_number)}.</p>${details}` });
    }
    return json(res, 200, { ok: true, status: 'payment_submitted', bookingNumber: booking.booking_number });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'We could not submit the payment status. Please try again.' });
  }
};
