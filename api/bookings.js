const { adminRecipients, body, clean, env, json, sendEmail, supabase, tokenPair } = require('./_lib');

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
    if ((!serviceId && !serviceSlug) || (!lengthId && !lengthName) || !date || !time || !fullName || !email || !phone) return json(res, 400, { error: 'Please complete all required booking details.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json(res, 400, { error: 'Invalid appointment date or time.' });
    const requestedAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(requestedAt.getTime()) || requestedAt.getTime() < Date.now() - 5 * 60 * 1000) return json(res, 400, { error: 'Please choose a future appointment date and time.' });

    const services = await supabase(`services?${serviceId ? `id=eq.${encodeURIComponent(serviceId)}` : `slug=eq.${encodeURIComponent(serviceSlug)}`}&is_active=eq.true&select=id,name,slug,duration_minutes`);
    const service = services[0];
    const lengths = service ? await supabase(`service_lengths?service_id=eq.${encodeURIComponent(service.id)}&${lengthId ? `id=eq.${encodeURIComponent(lengthId)}` : `name=eq.${encodeURIComponent(lengthName)}`}&is_active=eq.true&select=id,name,price`) : [];
    const length = lengths[0];
    if (!service || !length) return json(res, 400, { error: 'That service or length is no longer available.' });
    const blocked = await supabase(`blocked_dates?blocked_date=eq.${date}&select=id`);
    if (blocked.length) return json(res, 409, { error: 'That date is not available.' });
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const rules = await supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`);
    const inRule = rules.some((rule) => String(time) >= String(rule.start_time).slice(0, 5) && String(time) < String(rule.end_time).slice(0, 5));
    if (!inRule) return json(res, 409, { error: 'That time is outside Maeva’s availability.' });
    const blockedTimes = await supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`);
    if (blockedTimes.some((slot) => String(time) >= String(slot.start_time).slice(0, 5) && String(time) < String(slot.end_time).slice(0, 5))) return json(res, 409, { error: 'That time is not available.' });
    const [hours, minutes] = time.split(':').map(Number);
    const requestedStart = hours * 60 + minutes;
    const requestedEnd = requestedStart + Number(service.duration_minutes || 180);
    const conflicts = await supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&select=appointment_time,duration_minutes`);
    if (conflicts.some((item) => { const [h, m] = String(item.appointment_time).slice(0, 5).split(':').map(Number); const start = h * 60 + m; const end = start + Number(item.duration_minutes || 180); return requestedStart < end && requestedEnd > start; })) return json(res, 409, { error: 'That time overlaps another appointment. Please choose another slot.' });

    const [existing] = await supabase(`customers?email=eq.${encodeURIComponent(email)}&select=id`);
    const customer = existing || (await supabase('customers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ full_name: fullName, email, phone, location: clean(input.location, 180) }) }))[0];
    if (!existing) await supabase(`customers?id=eq.${customer.id}`, { method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }) });
    const { token, hash } = tokenPair();
    const total = Number(length.price);
    const reservationFee = Number(input.reservationFee || 20);
    const booking = (await supabase('bookings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ customer_id: customer.id, service_id: service.id, service_name_snapshot: service.name, length_name_snapshot: length.name, appointment_date: date, appointment_time: time, duration_minutes: service.duration_minutes, total_price: total, reservation_fee: reservationFee, remaining_balance: Math.max(0, total - reservationFee), access_token_hash: hash, customer_notes: clean(input.notes, 1000) }) }))[0];
    await supabase('payments', { method: 'POST', body: JSON.stringify({ booking_id: booking.id, amount: reservationFee, status: 'unpaid' }) });
    const manageUrl = `${env('PUBLIC_SITE_URL')}/booking.html?token=${encodeURIComponent(token)}`;
    const html = `<p>Hi ${fullName},</p><p>Your Hair by Maeva booking request <strong>${booking.booking_number}</strong> has been received.</p><p>${service.name} · ${length.name}<br>${date} at ${time}<br>Total: $${total.toFixed(2)} · Reservation fee: $${reservationFee.toFixed(2)}</p><p>Payment is not confirmed yet. Use the secure link below to view your booking:</p><p><a href="${manageUrl}">View / manage my booking</a></p>`;
    await sendEmail({ to: email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number}`, html });
    if (process.env.ADMIN_EMAIL) await sendEmail({ to: adminRecipients(), replyTo: email, subject: `New Hair by Maeva booking — ${booking.booking_number}`, html: `<p>New booking from ${fullName} (${email}).</p>${html}` });
    return json(res, 201, { bookingNumber: booking.booking_number, status: booking.status, accessUrl: manageUrl });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'We could not save that booking. Please try again.' });
  }
};
