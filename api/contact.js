const { body, clean, env, json, sendEmail, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const input = await body(req);
    const name = clean(input.name, 120); const email = clean(input.email, 160).toLowerCase(); const topic = clean(input.topic, 80); const message = clean(input.message, 3000);
    if (!name || !email || !topic || !message) return json(res, 400, { error: 'Please complete the required fields.' });
    await supabase('contact_messages', { method: 'POST', body: JSON.stringify({ name, email, phone: clean(input.phone, 40), topic, message, booking_number: clean(input.bookingNumber, 40) }) });
    await sendEmail({ to: env('ADMIN_EMAIL'), replyTo: email, subject: `Hair by Maeva contact — ${topic}`, html: `<p><strong>${name}</strong> (${email}) sent a message.</p><p>${message.replaceAll('\n', '<br>')}</p>` });
    return json(res, 201, { ok: true });
  } catch (error) { console.error(error); return json(res, 500, { error: 'We could not send your message.' }); }
};
