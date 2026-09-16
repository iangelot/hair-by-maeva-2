const crypto = require('node:crypto');
const { adminRecipients, body, brandedEmail, clean, env, escapeHtml, json, supabase, trySendEmail } = require('./_lib');

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
      const location = '1941 West Huron Street, Chicago, IL 60622';
      const details = `<div style="border:1px solid #dcc9ba;background:#fbf7f1;padding:22px;margin:22px 0"><p style="margin:0 0 8px;font-size:20px"><strong>${escapeHtml(booking.service_name_snapshot)}</strong></p><p style="margin:0;color:#765e58">${escapeHtml(booking.length_name_snapshot)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Date</strong><br>${escapeHtml(booking.appointment_date)} at ${escapeHtml(booking.appointment_time)}</p><p><strong>Location</strong><br>${escapeHtml(location)}</p><p><strong>Payment method</strong><br>${escapeHtml(method.name)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Total:</strong> $${Number(booking.total_price).toFixed(2)}<br><strong>Deposit submitted:</strong> $${Number(booking.reservation_fee).toFixed(2)}<br><strong>Remaining balance:</strong> $${Number(booking.remaining_balance).toFixed(2)}</p></div>`;
      const customerHtml = brandedEmail({ title: 'Payment received', greeting: `Hi ${escapeHtml(customer.full_name)},`, content: `<p>We received your payment submission for booking <strong>${escapeHtml(booking.booking_number)}</strong>. Maeva will verify the payment manually. Your appointment is not confirmed until that verification is complete.</p>${details}<p style="text-align:center;margin:28px 0"><a href="${manageUrl}" style="display:inline-block;background:#4d2c2e;color:#f5efe6;padding:14px 22px;text-decoration:none">VIEW / MANAGE BOOKING</a></p>` });
      await trySendEmail({ to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Payment received for ${booking.booking_number}`, html: customerHtml });
      if (process.env.ADMIN_EMAIL) {
        const adminHtml = brandedEmail({ eyebrow: 'HAIR BY MAEVA · ADMIN', title: 'Payment to verify', content: `<p style="font-size:18px;margin-top:0">A client submitted a payment.</p><p><strong>${escapeHtml(customer.full_name)}</strong> submitted a ${escapeHtml(method.name)} payment for booking <strong>${escapeHtml(booking.booking_number)}</strong>.</p>${details}<p><strong>Next step:</strong> Open Admin, cross-check the payment in the payment app, then click <strong>CONFIRM PAYMENT</strong>. The client will receive the final confirmation email automatically.</p><p style="text-align:center;margin:28px 0"><a href="${env('PUBLIC_SITE_URL')}/admin.html" style="display:inline-block;background:#4d2c2e;color:#f5efe6;padding:14px 22px;text-decoration:none">OPEN ADMIN BOOKINGS</a></p>` });
        await trySendEmail({ to: adminRecipients(), replyTo: customer.email, subject: `Payment to verify — ${booking.booking_number}`, html: adminHtml });
      }
    }
    return json(res, 200, { ok: true, status: 'payment_submitted', bookingNumber: booking.booking_number });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'We could not submit the payment status. Please try again.' });
  }
};
