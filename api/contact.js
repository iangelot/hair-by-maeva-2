const { adminRecipients, body, clean, escapeHtml, json, supabase, trySendTemplatedEmail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req);
    const name = clean(input.name, 120); const email = clean(input.email, 160).toLowerCase(); const phone = clean(input.phone, 40); const bookingNumber = clean(input.bookingNumber, 40); const topic = clean(input.topic, 80).replace(/[\r\n]/g, ' '); const message = clean(input.message, 3000);
    if (!name || !email || !topic || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Please complete the required fields with a valid email.' });
    await supabase('contact_messages', { method: 'POST', body: JSON.stringify({ name, email, phone, topic, message, booking_number: bookingNumber }) });
    const contactDetails = `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) sent a message.</p>${phone ? `<p>Phone: ${escapeHtml(phone)}</p>` : ''}${bookingNumber ? `<p>Booking number: ${escapeHtml(bookingNumber)}</p>` : ''}`;
    const renderedMessage = `${contactDetails}<p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>`;
    const emailSent = await trySendTemplatedEmail({ templateKey: 'contact_notification', to: adminRecipients(), replyTo: email, subject: `Hair by Maeva contact — ${topic}`, html: renderedMessage, variables: { customer_name: name, customer_email: email, phone, topic, message, booking_number: bookingNumber } });
    return json(res, 201, { ok: true, emailSent });
  } catch (error) { console.error(error); return json(res, 500, { error: 'We could not send your message.' }); }
};
