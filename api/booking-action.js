const crypto = require('node:crypto');
const { adminRecipients, appointmentDateTime, body, clean, env, escapeHtml, json, supabase, trySendEmail, trySendTemplatedEmail } = require('./_lib');

const getBooking = async (token) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const rows = await supabase(`bookings?access_token_hash=eq.${encodeURIComponent(hash)}&token_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,booking_number,customer_id,service_name_snapshot,length_name_snapshot,appointment_date,appointment_time,duration_minutes,total_price,reservation_fee,remaining_balance,payment_status,status`);
  return rows[0];
};
const toMinutes = (time) => { const [hours, mins] = time.split(':').map(Number); return hours * 60 + mins; };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req); const token = clean(input.token, 120); const action = clean(input.action, 20);
    if (!token || !['cancel', 'reschedule'].includes(action)) return json(res, 400, { error: 'Invalid booking action.' });
    const booking = await getBooking(token);
    if (!booking) return json(res, 404, { error: 'That booking link is invalid or expired.' });
    if (['cancelled', 'completed'].includes(booking.status)) return json(res, 409, { error: 'This booking can no longer be changed.' });
    if (action === 'cancel') {
      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }) });
      const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
      if (customer?.email) { const manageUrl = `${env('PUBLIC_SITE_URL')}/booking?token=${encodeURIComponent(token)}`; await trySendTemplatedEmail({ templateKey: 'cancellation', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number} cancelled`, html: `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been cancelled as requested.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`, variables: { booking_number: booking.booking_number, customer_name: customer.full_name, payment_status: booking.payment_status, manage_url: manageUrl } }); }
      if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), replyTo: customer?.email, subject: `Booking cancelled — ${booking.booking_number}`, html: `<p>Booking ${escapeHtml(booking.booking_number)} was cancelled by the customer.</p>` });
      return json(res, 200, { ok: true, status: 'cancelled' });
    }
    const date = clean(input.date, 10); const time = clean(input.time, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json(res, 400, { error: 'Choose a valid new date and time.' });
    if (Number(time.slice(3, 5)) % 30 !== 0) return json(res, 400, { error: 'Please choose a 30-minute appointment slot.' });
    const requested = appointmentDateTime(date, time); if (Number.isNaN(requested.getTime()) || requested < new Date()) return json(res, 400, { error: 'Choose a future appointment time.' });
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const [rules, blocked, blockedTimes, conflicts] = await Promise.all([
      supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`),
      supabase(`blocked_dates?blocked_date=eq.${date}&select=id`),
      supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`),
      supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&id=not.eq.${encodeURIComponent(booking.id)}&select=appointment_time,duration_minutes`),
    ]);
    const start = toMinutes(time); const end = start + Number(booking.duration_minutes || 180);
    if (blocked.length || !rules.some((rule) => start >= toMinutes(String(rule.start_time).slice(0, 5)) && start <= toMinutes(String(rule.end_time).slice(0, 5)))) return json(res, 409, { error: 'That date or time is not available.' });
    if (blockedTimes.some((slot) => start < toMinutes(String(slot.end_time).slice(0, 5)) && end > toMinutes(String(slot.start_time).slice(0, 5)))) return json(res, 409, { error: 'That time is blocked.' });
    if (conflicts.some((item) => { const otherStart = toMinutes(String(item.appointment_time).slice(0, 5)); const otherEnd = otherStart + Number(item.duration_minutes || 180); return start < otherEnd && end > otherStart; })) return json(res, 409, { error: 'That time was just taken.' });
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ appointment_date: date, appointment_time: time, status: 'rescheduled', updated_at: new Date().toISOString() }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) {
      const manageUrl = `${env('PUBLIC_SITE_URL')}/booking?token=${encodeURIComponent(token)}`;
      const html = `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been moved to ${escapeHtml(date)} at ${escapeHtml(time)}.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`;
      await trySendTemplatedEmail({ templateKey: 'rescheduling', to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number} rescheduled`, html, variables: { booking_number: booking.booking_number, customer_name: customer.full_name, date, time, manage_url: manageUrl } });
      if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), replyTo: customer.email, subject: `Booking rescheduled — ${booking.booking_number}`, html });
    }
    return json(res, 200, { ok: true, status: 'rescheduled', date, time });
  } catch (error) { console.error(error); if (/overlap|already booked|existing booking/i.test(error.message || '')) return json(res, 409, { error: 'That time was just taken. Please choose another appointment slot.' }); return json(res, 500, { error: 'We could not update that booking.' }); }
};
