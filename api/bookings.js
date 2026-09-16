const { adminRecipients, appointmentDateTime, body, clean, env, escapeHtml, json, supabase, tokenPair, trySendEmail, trySendTemplatedEmail } = require('./_lib');

// The reservation fee is a business rule, not a value the browser is allowed
// to choose. Keep it server-owned until an admin-configurable setting exists.
const RESERVATION_FEE = 20;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req);
    const serviceId = clean(input.serviceId, 80);
    const serviceSlug = clean(input.serviceSlug, 120);
    const lengthId = clean(input.lengthId, 80);
    const lengthName = clean(input.lengthName, 80);
    const date = clean(input.date, 10);
    const time = clean(input.time, 8);
    const fullName = clean(input.fullName, 120);
    const email = clean(input.email, 160).toLowerCase();
    const phone = clean(input.phone, 40);
    if ((!serviceId && !serviceSlug) || (!lengthId && !lengthName) || !date || !time || !fullName || !email || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Please complete all required booking details with a valid email.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json(res, 400, { error: 'Invalid appointment date or time.' });
    if (Number(time.slice(3, 5)) % 30 !== 0) return json(res, 400, { error: 'Please choose a 30-minute appointment slot.' });
    const requestedAt = appointmentDateTime(date, time);
    const settings = (await supabase('booking_settings?id=eq.1&select=minimum_notice_hours,maximum_advance_days&limit=1'))[0] || {};
    const maxAdvanceDays = Number(settings.maximum_advance_days ?? process.env.BOOKING_MAX_ADVANCE_DAYS ?? 365);
    const minimumNoticeHours = Number(settings.minimum_notice_hours ?? process.env.BOOKING_MIN_NOTICE_HOURS ?? 0);
    if (Number.isNaN(requestedAt.getTime()) || requestedAt.getTime() < Date.now() + minimumNoticeHours * 60 * 60 * 1000) return json(res, 400, { error: minimumNoticeHours ? `Bookings require at least ${minimumNoticeHours} hours notice.` : 'Please choose a future appointment date and time.' });
    if (requestedAt.getTime() > Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000) return json(res, 400, { error: `Bookings can be made up to ${maxAdvanceDays} days in advance.` });

    const services = await supabase(`services?${serviceId ? `id=eq.${encodeURIComponent(serviceId)}` : `slug=eq.${encodeURIComponent(serviceSlug)}`}&is_active=eq.true&select=id,name,slug,duration_minutes`);
    const service = services[0];
    const lengths = service ? await supabase(`service_lengths?service_id=eq.${encodeURIComponent(service.id)}&${lengthId ? `id=eq.${encodeURIComponent(lengthId)}` : `name=eq.${encodeURIComponent(lengthName)}`}&is_active=eq.true&select=id,name,price`) : [];
    const length = lengths[0];
    if (!service || !length) return json(res, 400, { error: 'That service or length is no longer available.' });
    const requestedOptions = Array.isArray(input.options) ? input.options.filter((item) => typeof item === 'string').slice(0, 20) : [];
    const configuredOptions = await supabase(`service_options?service_id=eq.${encodeURIComponent(service.id)}&is_active=eq.true&select=name,price_delta`);
    const optionsSnapshot = configuredOptions.filter((option) => requestedOptions.includes(option.name)).map((option) => ({ name: option.name, price_delta: Number(option.price_delta) }));
    const blocked = await supabase(`blocked_dates?blocked_date=eq.${date}&select=id`);
    if (blocked.length) return json(res, 409, { error: 'That date is not available.' });
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const rules = await supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`);
    const [hours, minutes] = time.split(':').map(Number);
    const requestedStart = hours * 60 + minutes;
    const requestedEnd = requestedStart + Number(service.duration_minutes || 180);
    const inRule = rules.some((rule) => requestedStart >= toMinutes(rule.start_time) && requestedEnd <= toMinutes(rule.end_time));
    if (!inRule) return json(res, 409, { error: 'That time is outside Maeva’s availability.' });
    const blockedTimes = await supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`);
    if (blockedTimes.some((slot) => requestedStart < toMinutes(slot.end_time) && requestedEnd > toMinutes(slot.start_time))) return json(res, 409, { error: 'That time is not available.' });
    const conflicts = await supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&select=appointment_time,duration_minutes`);
    if (conflicts.some((item) => { const [h, m] = String(item.appointment_time).slice(0, 5).split(':').map(Number); const start = h * 60 + m; const end = start + Number(item.duration_minutes || 180); return requestedStart < end && requestedEnd > start; })) return json(res, 409, { error: 'That time overlaps another appointment. Please choose another slot.' });

    const [existing] = await supabase(`customers?email=eq.${encodeURIComponent(email)}&select=id`);
    const customer = existing || (await supabase('customers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ full_name: fullName, email, phone, location: clean(input.location, 180) }) }))[0];
    if (!existing) await supabase(`customers?id=eq.${customer.id}`, { method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }) });
    const { token, hash, ciphertext } = tokenPair();
    const total = Number(length.price) + optionsSnapshot.reduce((sum, option) => sum + option.price_delta, 0);
    const reservationFee = RESERVATION_FEE;
    const booking = (await supabase('bookings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ customer_id: customer.id, service_id: service.id, service_name_snapshot: service.name, length_name_snapshot: length.name, options_snapshot: optionsSnapshot, appointment_date: date, appointment_time: time, duration_minutes: service.duration_minutes, total_price: total, reservation_fee: reservationFee, remaining_balance: Math.max(0, total - reservationFee), access_token_hash: hash, access_token_ciphertext: ciphertext, customer_notes: clean(input.notes, 1000) }) }))[0];
    await supabase('payments', { method: 'POST', body: JSON.stringify({ booking_id: booking.id, amount: reservationFee, status: 'unpaid' }) });
    const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(token)}`;
    const html = `<p>Hi ${escapeHtml(fullName)},</p><p>Your Hair by Maeva booking request <strong>${escapeHtml(booking.booking_number)}</strong> has been received.</p><p>${escapeHtml(service.name)} · ${escapeHtml(length.name)}<br>${escapeHtml(date)} at ${escapeHtml(time)}<br>Total: $${total.toFixed(2)} · Reservation fee: $${reservationFee.toFixed(2)}</p><p>Payment is not confirmed yet. Use the secure link below to view your booking:</p><p><a href="${manageUrl}">View / manage my booking</a></p>`;
    const customerEmailSent = await trySendTemplatedEmail({ templateKey: 'booking_confirmation', to: email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number}`, html, variables: { booking_number: booking.booking_number, customer_name: fullName, service: service.name, length: length.name, date, time, total: total.toFixed(2), deposit: reservationFee.toFixed(2), remaining: Math.max(0, total - reservationFee).toFixed(2), payment_status: 'unpaid', manage_url: manageUrl } });
    const adminEmailSent = process.env.ADMIN_EMAIL ? await trySendEmail({ to: adminRecipients(), replyTo: email, subject: `New Hair by Maeva booking — ${booking.booking_number}`, html: `<p>New booking from ${escapeHtml(fullName)} (${escapeHtml(email)}).</p>${html}` }) : false;
    return json(res, 201, { bookingNumber: booking.booking_number, status: booking.status, accessUrl: manageUrl, totalPrice: total, reservationFee, remainingBalance: Math.max(0, total - reservationFee), emailSent: customerEmailSent, adminEmailSent });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'We could not save that booking. Please try again.' });
  }
};

function toMinutes(value) {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}
