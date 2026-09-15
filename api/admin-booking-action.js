const { adminRecipients, body, clean, json, requireAdmin, supabase, trySendEmail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req); const bookingId = clean(input.bookingId, 80); const action = clean(input.action, 20);
    if (!bookingId || action !== 'cancel') return json(res, 400, { error: 'Invalid booking action.' });
    const booking = (await supabase(`bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,booking_number,customer_id,status`))[0];
    if (!booking) return json(res, 404, { error: 'Booking not found.' });
    if (['cancelled', 'completed'].includes(booking.status)) return json(res, 409, { error: 'This booking can no longer be changed.' });
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }) });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) await trySendEmail({ to: customer.email, replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined, subject: `Hair by Maeva — Booking ${booking.booking_number} cancelled`, html: `<p>Hi ${customer.full_name},</p><p>Your booking <strong>${booking.booking_number}</strong> has been cancelled by Hair by Maeva. Please contact us if you have questions.</p>` });
    if (process.env.ADMIN_EMAIL) await trySendEmail({ to: adminRecipients(), subject: `Booking cancelled — ${booking.booking_number}`, html: `<p>Booking ${booking.booking_number} was cancelled from Admin.</p>` });
    return json(res, 200, { ok: true, status: 'cancelled' });
  } catch (error) { console.error(error); return json(res, error.statusCode || 500, { error: error.message || 'We could not update that booking.' }); }
};
