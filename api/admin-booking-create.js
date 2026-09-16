const { appointmentDateTime, body, clean, env, escapeHtml, json, requireAdmin, supabase, tokenPair, trySendTemplatedEmail } = require('./_lib');

const minutes = (value) => { const [hours, mins] = String(value).slice(0, 5).split(':').map(Number); return hours * 60 + mins; };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req); const serviceId = clean(input.serviceId, 80); const lengthId = clean(input.lengthId, 80); const date = clean(input.date, 10); const time = clean(input.time, 5); const fullName = clean(input.fullName, 120); const email = clean(input.email, 160).toLowerCase(); const phone = clean(input.phone, 40);
    if (!serviceId || !lengthId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(3, 5)) % 30 !== 0 || !fullName || !email || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Complete the customer, service, date, and time fields.' });
    const requested = appointmentDateTime(date, time); if (Number.isNaN(requested.getTime()) || requested < new Date()) return json(res, 400, { error: 'Choose a future appointment time.' });
    const service = (await supabase(`services?id=eq.${encodeURIComponent(serviceId)}&is_active=eq.true&select=id,name,duration_minutes`))[0];
    const length = service ? (await supabase(`service_lengths?id=eq.${encodeURIComponent(lengthId)}&service_id=eq.${encodeURIComponent(service.id)}&is_active=eq.true&select=id,name,price`))[0] : null;
    if (!service || !length) return json(res, 400, { error: 'That service or length is unavailable.' });
    const settings = (await supabase('booking_settings?id=eq.1&select=minimum_notice_hours,maximum_advance_days&limit=1'))[0] || {};
    if (requested < new Date(Date.now() + Number(settings.minimum_notice_hours || 0) * 3600000) || requested > new Date(Date.now() + Number(settings.maximum_advance_days || 365) * 86400000)) return json(res, 400, { error: 'That appointment is outside the configured booking window.' });
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); const start = minutes(time); const end = start + Number(service.duration_minutes || 180);
    const [rules, blockedDates, blockedTimes, conflicts] = await Promise.all([
      supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`),
      supabase(`blocked_dates?blocked_date=eq.${date}&select=id`),
      supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`),
      supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&select=appointment_time,duration_minutes`),
    ]);
    if (blockedDates.length || !rules.some((rule) => start >= minutes(rule.start_time) && start <= minutes(rule.end_time)) || blockedTimes.some((slot) => start < minutes(slot.end_time) && end > minutes(slot.start_time)) || conflicts.some((item) => { const other = minutes(item.appointment_time); const otherEnd = other + Number(item.duration_minutes || 180); return start < otherEnd && end > other; })) return json(res, 409, { error: 'That appointment time is not available.' });
    const [existing] = await supabase(`customers?email=eq.${encodeURIComponent(email)}&select=id`); const customer = existing || (await supabase('customers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ full_name: fullName, email, phone }) }))[0];
    const { token, hash, ciphertext } = tokenPair(); const fee = 20; const total = Number(length.price); const booking = (await supabase('bookings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ customer_id: customer.id, service_id: service.id, service_name_snapshot: service.name, length_name_snapshot: length.name, appointment_date: date, appointment_time: time, duration_minutes: service.duration_minutes, total_price: total, reservation_fee: fee, remaining_balance: Math.max(0, total - fee), access_token_hash: hash, access_token_ciphertext: ciphertext, customer_notes: clean(input.notes, 1000) }) }))[0];
    await supabase('payments', { method: 'POST', body: JSON.stringify({ booking_id: booking.id, amount: fee, status: 'unpaid' }) });
    if (customer.email) { const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(token)}`; const totalValue = total.toFixed(2); await trySendTemplatedEmail({ templateKey: 'booking_confirmation', to: customer.email, subject: `Hair by Maeva — Booking ${booking.booking_number}`, html: `<p>Hi ${escapeHtml(fullName)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> was created for ${escapeHtml(date)} at ${escapeHtml(time)}.</p><p>${escapeHtml(service.name)} · ${escapeHtml(length.name)}<br>Total: $${totalValue} · Reservation fee: $${fee.toFixed(2)}</p><p><a href="${manageUrl}">View / manage my booking</a></p>`, variables: { booking_number: booking.booking_number, customer_name: fullName, service: service.name, length: length.name, date, time, total: totalValue, deposit: fee.toFixed(2), remaining: Math.max(0, total - fee).toFixed(2), payment_status: 'unpaid', manage_url: manageUrl } }); }
    return json(res, 201, { ok: true, bookingNumber: booking.booking_number });
  } catch (error) { console.error(error); if (/overlap|already booked|existing booking/i.test(error.message || '')) return json(res, 409, { error: 'That appointment time was just taken.' }); return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to create booking.' }); }
};
