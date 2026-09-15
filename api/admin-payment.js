const { adminRecipients, body, clean, decryptToken, env, escapeHtml, json, requireAdmin, supabase, trySendEmail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const adminUser = await requireAdmin(req);
    const input = await body(req); const bookingId = clean(input.bookingId, 80); const action = clean(input.action, 20);
    if (!bookingId || !['confirm', 'reject'].includes(action)) return json(res, 400, { error: 'Invalid payment action.' });
    const confirmed = action === 'confirm';
    const rows = await supabase(`bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,booking_number,customer_id,service_name_snapshot,length_name_snapshot,appointment_date,appointment_time,total_price,reservation_fee,remaining_balance,payment_method_id,access_token_ciphertext,payment_status,status`);
    const booking = rows[0]; if (!booking) return json(res, 404, { error: 'Booking not found.' });
    if (booking.payment_status !== 'payment_submitted') return json(res, 409, { error: 'Only payments awaiting verification can be updated.' });
    const status = confirmed ? 'payment_verified' : 'payment_not_received';
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ payment_status: status, status: confirmed ? 'confirmed' : 'pending_payment', confirmed_at: confirmed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }) });
    await supabase(`payments?booking_id=eq.${encodeURIComponent(booking.id)}&status=eq.payment_submitted`, { method: 'PATCH', body: JSON.stringify({ status, verified_at: confirmed ? new Date().toISOString() : null, verified_by: confirmed ? adminUser.id : null }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    const method = booking.payment_method_id ? (await supabase(`payment_methods?id=eq.${encodeURIComponent(booking.payment_method_id)}&select=name`))[0] : null;
    if (customer?.email) {
      const manageToken = decryptToken(booking.access_token_ciphertext); const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(manageToken)}`; const details = `<p>${escapeHtml(booking.service_name_snapshot)} · ${escapeHtml(booking.length_name_snapshot)}<br>${escapeHtml(booking.appointment_date)} at ${escapeHtml(booking.appointment_time)}<br>Total: $${Number(booking.total_price).toFixed(2)} · Deposit: $${Number(booking.reservation_fee).toFixed(2)} · Remaining: $${Number(booking.remaining_balance).toFixed(2)}</p>`;
      const subject = confirmed ? `Hair by Maeva — Appointment ${booking.booking_number} Confirmed` : `Hair by Maeva — Payment not received for ${booking.booking_number}`;
      const message = confirmed ? 'Your payment has been verified and your appointment is confirmed.' : 'We could not verify this payment. Please contact Maeva if you believe this is an error.';
      await trySendEmail({ to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject, html: `<p>Hi ${escapeHtml(customer.full_name)},</p><p>${message}</p>${details}<p>Payment method: ${escapeHtml(method?.name || 'Manual payment')}</p><p><a href="${manageUrl}">View / manage my booking</a></p>` });
    }
    if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), subject: `${confirmed ? 'Payment confirmed' : 'Payment not received'} — ${booking.booking_number}`, html: `<p>Booking ${escapeHtml(booking.booking_number)} was updated to ${escapeHtml(status)}.</p>` });
    return json(res, 200, { ok: true, status });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to update payment.' }); }
};
