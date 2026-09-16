const { adminRecipients, body, brandedEmail, clean, decryptToken, env, escapeHtml, json, requireAdmin, supabase, trySendEmail, trySendTemplatedEmail } = require('./_lib');

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
    let clientEmailSent = false;
    if (customer?.email) {
      const manageToken = decryptToken(booking.access_token_ciphertext); const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(manageToken)}`; const location = '1941 West Huron Street, Chicago, IL 60622'; const paymentMethod = method?.name || 'Manual payment';
      const details = `<div style="border:1px solid #dcc9ba;background:#fbf7f1;padding:22px;margin:22px 0"><p style="margin:0 0 8px;font-size:20px"><strong>${escapeHtml(booking.service_name_snapshot)}</strong></p><p style="margin:0;color:#765e58">${escapeHtml(booking.length_name_snapshot)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Date</strong><br>${escapeHtml(booking.appointment_date)} at ${escapeHtml(booking.appointment_time)}</p><p><strong>Location</strong><br>${escapeHtml(location)}</p><p><strong>Payment method</strong><br>${escapeHtml(paymentMethod)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Total:</strong> $${Number(booking.total_price).toFixed(2)}<br><strong>Deposit paid:</strong> $${Number(booking.reservation_fee).toFixed(2)}<br><strong>Remaining balance:</strong> $${Number(booking.remaining_balance).toFixed(2)}</p></div>`;
      const subject = confirmed ? `Hair by Maeva — Appointment ${booking.booking_number} Confirmed` : `Hair by Maeva — Payment not received for ${booking.booking_number}`;
      const message = confirmed ? 'Your payment has been verified and your appointment is confirmed.' : 'We could not verify this payment. Please contact Maeva if you believe this is an error.';
      const variables = { booking_number: booking.booking_number, customer_name: customer.full_name, service: booking.service_name_snapshot, length: booking.length_name_snapshot, date: booking.appointment_date, time: booking.appointment_time, total: Number(booking.total_price).toFixed(2), deposit: Number(booking.reservation_fee).toFixed(2), remaining: Number(booking.remaining_balance).toFixed(2), payment_method: paymentMethod, payment_status: status, location, manage_url: manageUrl };
      const confirmationHtml = brandedEmail({ title: confirmed ? 'Appointment confirmed' : 'Payment update', greeting: `Hi ${escapeHtml(customer.full_name)},`, content: `<p>${message}</p>${details}<p style="text-align:center;margin:28px 0"><a href="${manageUrl}" style="display:inline-block;background:#4d2c2e;color:#f5efe6;padding:14px 22px;text-decoration:none">VIEW / MANAGE BOOKING</a></p><p style="font-size:13px;color:#765e58">Please arrive ready for your appointment at the address above. If you need help, reply to this email or contact Maeva.</p>` });
      if (confirmed) clientEmailSent = await trySendTemplatedEmail({ templateKey: 'payment_confirmed', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject, html: confirmationHtml, variables });
      else clientEmailSent = await trySendEmail({ to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject, html: confirmationHtml });
    }
    if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), subject: `${confirmed ? 'Payment confirmed' : 'Payment not received'} — ${booking.booking_number}`, html: `<p>Booking ${escapeHtml(booking.booking_number)} was updated to ${escapeHtml(status)}.</p>` });
    return json(res, 200, { ok: true, status, clientEmailSent });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to update payment.' }); }
};
