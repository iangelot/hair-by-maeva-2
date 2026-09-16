const { adminRecipients, appointmentDateTime, body, clean, decryptToken, env, escapeHtml, json, requireAdmin, supabase, trySendEmail, trySendTemplatedEmail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req); const bookingId = clean(input.bookingId, 80); const action = clean(input.action, 20);
    if (!bookingId || !['cancel', 'reschedule'].includes(action)) return json(res, 400, { error: 'Invalid booking action.' });
    const booking = (await supabase(`bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,booking_number,customer_id,status,appointment_date,appointment_time,duration_minutes,access_token_ciphertext`))[0];
    if (!booking) return json(res, 404, { error: 'Booking not found.' });
    if (['cancelled', 'completed'].includes(booking.status)) return json(res, 409, { error: 'This booking can no longer be changed.' });
    if (action === 'reschedule') {
      const date = clean(input.date, 10); const time = clean(input.time, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(3, 5)) % 30 !== 0) return json(res, 400, { error: 'Choose a valid 30-minute appointment slot.' });
      const requested = appointmentDateTime(date, time); if (Number.isNaN(requested.getTime()) || requested < new Date()) return json(res, 400, { error: 'Choose a future appointment time.' });
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); const toMinutes = (value) => { const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number); return hours * 60 + minutes; };
      const [rules, blockedDates, blockedTimes, conflicts] = await Promise.all([
        supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`),
        supabase(`blocked_dates?blocked_date=eq.${date}&select=id`),
        supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`),
        supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&id=not.eq.${encodeURIComponent(booking.id)}&select=appointment_time,duration_minutes`),
      ]);
      const start = toMinutes(time); const end = start + Number(booking.duration_minutes || 180);
      if (blockedDates.length || !rules.some((rule) => start >= toMinutes(rule.start_time) && end <= toMinutes(rule.end_time))) return json(res, 409, { error: 'That date or time is not available.' });
      if (blockedTimes.some((slot) => start < toMinutes(slot.end_time) && end > toMinutes(slot.start_time)) || conflicts.some((item) => { const otherStart = toMinutes(item.appointment_time); const otherEnd = otherStart + Number(item.duration_minutes || 180); return start < otherEnd && end > otherStart; })) return json(res, 409, { error: 'That time overlaps an unavailable or booked period.' });
      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ appointment_date: date, appointment_time: time, status: 'rescheduled', updated_at: new Date().toISOString() }) });
      const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
      if (customer?.email) { const manageToken = decryptToken(booking.access_token_ciphertext); const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(manageToken)}`; const html = `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been rescheduled to ${escapeHtml(date)} at ${escapeHtml(time)}.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`; await trySendTemplatedEmail({ templateKey: 'rescheduling', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number} rescheduled`, html, variables: { booking_number: booking.booking_number, customer_name: customer.full_name, date, time, manage_url: manageUrl } }); }
      return json(res, 200, { ok: true, status: 'rescheduled', date, time });
    }
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) { const manageToken = decryptToken(booking.access_token_ciphertext); const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(manageToken)}`; await trySendTemplatedEmail({ templateKey: 'cancellation', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number} cancelled`, html: `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been cancelled by Hair by Maeva. Please contact us if you have questions.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`, variables: { booking_number: booking.booking_number, customer_name: customer.full_name, manage_url: manageUrl } }); }
    if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), subject: `Booking cancelled — ${booking.booking_number}`, html: `<p>Booking ${escapeHtml(booking.booking_number)} was cancelled from Admin.</p>` });
    return json(res, 200, { ok: true, status: 'cancelled' });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: error.message || 'We could not update that booking.' }); }
};
