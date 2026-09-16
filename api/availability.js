const { appointmentDateTime, clean, json, supabase } = require('./_lib');

function minutes(value) {
  const [hours, mins] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + mins;
}

function formatTime(total) {
  const hours = Math.floor(total / 60).toString().padStart(2, '0');
  const mins = (total % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const date = clean(req.query?.date, 10);
    const serviceSlug = clean(req.query?.serviceSlug, 120);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceSlug) return json(res, 400, { error: 'Choose a date and service.' });
    const settings = (await supabase('booking_settings?id=eq.1&select=minimum_notice_hours,maximum_advance_days&limit=1'))[0] || {};
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const requestedDay = appointmentDateTime(date, '00:00');
    const minNotice = Number(settings.minimum_notice_hours ?? process.env.BOOKING_MIN_NOTICE_HOURS ?? 0);
    const maxAdvanceDays = Number(settings.maximum_advance_days ?? process.env.BOOKING_MAX_ADVANCE_DAYS ?? 365);
    if (Number.isNaN(requestedDay.getTime()) || requestedDay.getTime() > Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000) return json(res, 200, { date, slots: [] });
    const [rules, blockedDates, blockedTimes, services, bookings] = await Promise.all([
      supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`),
      supabase(`blocked_dates?blocked_date=eq.${date}&select=id`),
      supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`),
      supabase(`services?slug=eq.${encodeURIComponent(serviceSlug)}&is_active=eq.true&select=duration_minutes`),
      supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&select=appointment_time,duration_minutes`),
    ]);
    if (blockedDates.length || !services.length) return json(res, 200, { date, slots: [] });
    const duration = Number(services[0].duration_minutes || 180);
    const busy = bookings.map((booking) => ({ start: minutes(booking.appointment_time), end: minutes(booking.appointment_time) + Number(booking.duration_minutes || duration) }));
    const blocked = blockedTimes.map((slot) => ({ start: minutes(slot.start_time), end: minutes(slot.end_time) }));
    const slots = [];
    for (const rule of rules) {
      const start = minutes(rule.start_time); const end = minutes(rule.end_time);
      // Maeva's hours define selectable appointment start times. A service may
      // finish after the final start-time boundary, so keep the complete
      // 07:00–16:00 (or configured) start-time window visible to customers.
      for (let slot = start; slot <= end; slot += 30) {
        const slotTime = appointmentDateTime(date, formatTime(slot)).getTime();
        if (slotTime < Date.now() + minNotice * 60 * 60 * 1000) continue;
        const slotEnd = slot + duration;
        if (!busy.some((item) => slot < item.end && slotEnd > item.start) && !blocked.some((item) => slot < item.end && slotEnd > item.start)) slots.push(formatTime(slot));
      }
    }
    return json(res, 200, { date, duration, slots: [...new Set(slots)].sort() });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Availability is temporarily unavailable.' });
  }
};
