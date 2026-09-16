const { adminRecipients, appointmentDateTime, body, brandedEmail, clean, decryptToken, env, escapeHtml, json, requireAdmin, supabase, trySendEmail, trySendTemplatedEmail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req);
    const action = clean(input.action, 30);

    if (action === 'upload_image') {
      const filename = String(input.filename || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
      const folder = String(input.folder || 'services').replace(/[^a-zA-Z0-9_-]/g, '');
      const contentType = String(input.contentType || 'image/jpeg');
      const base64Data = String(input.base64Data || '');

      if (!base64Data) return json(res, 400, { error: 'No image data provided.' });

      const buffer = Buffer.from(base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''), 'base64');
      if (buffer.length > 15 * 1024 * 1024) {
        return json(res, 400, { error: 'File size exceeds 15MB limit.' });
      }

      const uploadPath = `${folder}/${Date.now()}-${filename}`;
      const storageUrl = `${env('SUPABASE_URL')}/storage/v1/object/hair-media/${uploadPath}`;

      const uploadRes = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
          Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: buffer
      });

      const result = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        console.error('Storage upload error:', result);
        return json(res, uploadRes.status || 500, { error: result.message || result.error || 'Failed to upload image to storage.' });
      }

      const publicUrl = `${env('SUPABASE_URL')}/storage/v1/object/public/hair-media/${uploadPath}`;
      return json(res, 200, { path: uploadPath, publicUrl });
    }

    const bookingId = clean(input.bookingId, 80);
    const validActions = ['cancel', 'reschedule', 'delete', 'complete', 'resend_confirmation', 'update_status'];
    if (!bookingId || !validActions.includes(action)) return json(res, 400, { error: 'Invalid booking action.' });

    const booking = (await supabase(`bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,booking_number,customer_id,service_name_snapshot,length_name_snapshot,status,payment_status,appointment_date,appointment_time,duration_minutes,total_price,reservation_fee,remaining_balance,payment_method_id,access_token_ciphertext`))[0];
    if (!booking) return json(res, 404, { error: 'Booking not found.' });

    // 1. DELETE BOOKING
    if (action === 'delete') {
      await supabase(`payments?booking_id=eq.${encodeURIComponent(booking.id)}`, { method: 'DELETE' });
      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, { method: 'DELETE' });
      return json(res, 200, { ok: true, status: 'deleted', message: `Booking ${booking.booking_number} deleted permanently.` });
    }

    // 2. MARK COMPLETED
    if (action === 'complete') {
      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', updated_at: new Date().toISOString() })
      });
      return json(res, 200, { ok: true, status: 'completed' });
    }

    // 3. UPDATE STATUS MANUALLY
    if (action === 'update_status') {
      const newStatus = clean(input.status, 30);
      const newPaymentStatus = clean(input.paymentStatus, 30);
      const patchData = { updated_at: new Date().toISOString() };
      if (newStatus) patchData.status = newStatus;
      if (newPaymentStatus) patchData.payment_status = newPaymentStatus;
      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patchData)
      });
      return json(res, 200, { ok: true, status: newStatus || booking.status });
    }

    // 4. RESEND CLIENT CONFIRMATION EMAIL
    if (action === 'resend_confirmation') {
      const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
      if (!customer?.email) return json(res, 400, { error: 'No customer email on file.' });

      const manageToken = decryptToken(booking.access_token_ciphertext);
      const manageUrl = `${env('PUBLIC_SITE_URL')}/booking?token=${encodeURIComponent(manageToken)}`;
      const location = '1941 West Huron Street, Chicago, IL 60622';
      const method = booking.payment_method_id ? (await supabase(`payment_methods?id=eq.${encodeURIComponent(booking.payment_method_id)}&select=name`))[0] : null;
      const paymentMethod = method?.name || 'Manual payment';

      const details = `<div style="border:1px solid #dcc9ba;background:#fbf7f1;padding:22px;margin:22px 0"><p style="margin:0 0 8px;font-size:20px"><strong>${escapeHtml(booking.service_name_snapshot)}</strong></p><p style="margin:0;color:#765e58">${escapeHtml(booking.length_name_snapshot)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Date</strong><br>${escapeHtml(booking.appointment_date)} at ${escapeHtml(booking.appointment_time)}</p><p><strong>Location</strong><br>${escapeHtml(location)}</p><p><strong>Payment method</strong><br>${escapeHtml(paymentMethod)}</p><p style="border-top:1px solid #e3d7cb;margin:18px 0 0;padding-top:14px"><strong>Total:</strong> $${Number(booking.total_price).toFixed(2)}<br><strong>Deposit paid:</strong> $${Number(booking.reservation_fee).toFixed(2)}<br><strong>Remaining balance:</strong> $${Number(booking.remaining_balance).toFixed(2)}</p></div>`;
      const subject = `Hair by Maeva — Appointment ${booking.booking_number} Details`;
      const variables = {
        booking_number: booking.booking_number,
        customer_name: customer.full_name,
        service: booking.service_name_snapshot,
        length: booking.length_name_snapshot,
        date: booking.appointment_date,
        time: booking.appointment_time,
        total: Number(booking.total_price).toFixed(2),
        deposit: Number(booking.reservation_fee).toFixed(2),
        remaining: Number(booking.remaining_balance).toFixed(2),
        payment_method: paymentMethod,
        payment_status: booking.payment_status,
        location,
        manage_url: manageUrl
      };
      const confirmationHtml = brandedEmail({
        title: 'Appointment confirmation',
        greeting: `Hi ${escapeHtml(customer.full_name)},`,
        content: `<p>Here are your appointment details for booking <strong>${escapeHtml(booking.booking_number)}</strong>.</p>${details}<p style="text-align:center;margin:28px 0"><a href="${manageUrl}" style="display:inline-block;background:#4d2c2e;color:#f5efe6;padding:14px 22px;text-decoration:none">VIEW / MANAGE BOOKING</a></p><p style="font-size:13px;color:#765e58">Please arrive ready for your appointment at the address above. If you need help, reply to this email or contact Maeva.</p>`
      });

      const sent = await trySendTemplatedEmail({
        templateKey: 'payment_confirmed',
        to: customer.email,
        replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined,
        subject,
        html: confirmationHtml,
        variables
      });

      return json(res, 200, { ok: true, emailSent: sent });
    }

    // 5. RESCHEDULE BOOKING
    if (action === 'reschedule') {
      const date = clean(input.date, 10);
      const time = clean(input.time, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(3, 5)) % 30 !== 0) {
        return json(res, 400, { error: 'Choose a valid 30-minute appointment slot.' });
      }
      const requested = appointmentDateTime(date, time);
      if (Number.isNaN(requested.getTime()) || requested < new Date()) {
        return json(res, 400, { error: 'Choose a future appointment time.' });
      }
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const toMinutes = (value) => {
        const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
        return hours * 60 + minutes;
      };

      const [rules, blockedDates, blockedTimes, conflicts] = await Promise.all([
        supabase(`availability_rules?weekday=eq.${weekday}&is_active=eq.true&select=start_time,end_time`),
        supabase(`blocked_dates?blocked_date=eq.${date}&select=id`),
        supabase(`blocked_times?blocked_date=eq.${date}&select=start_time,end_time`),
        supabase(`bookings?appointment_date=eq.${date}&status=not.in.(cancelled)&id=not.eq.${encodeURIComponent(booking.id)}&select=appointment_time,duration_minutes`),
      ]);

      const start = toMinutes(time);
      const end = start + Number(booking.duration_minutes || 180);
      if (blockedDates.length || !rules.some((rule) => start >= toMinutes(rule.start_time) && start <= toMinutes(rule.end_time))) {
        return json(res, 409, { error: 'That date or time is not available.' });
      }
      if (blockedTimes.some((slot) => start < toMinutes(slot.end_time) && end > toMinutes(slot.start_time)) || conflicts.some((item) => {
        const otherStart = toMinutes(item.appointment_time);
        const otherEnd = otherStart + Number(item.duration_minutes || 180);
        return start < otherEnd && end > otherStart;
      })) {
        return json(res, 409, { error: 'That time overlaps an unavailable or booked period.' });
      }

      await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ appointment_date: date, appointment_time: time, status: 'rescheduled', updated_at: new Date().toISOString() })
      });

      const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
      if (customer?.email) {
        const manageToken = decryptToken(booking.access_token_ciphertext);
        const manageUrl = `${env('PUBLIC_SITE_URL')}/booking?token=${encodeURIComponent(manageToken)}`;
        const html = `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been rescheduled to ${escapeHtml(date)} at ${escapeHtml(time)}.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`;
        await trySendTemplatedEmail({
          templateKey: 'rescheduling',
          to: customer.email,
          replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined,
          subject: `Hair by Maeva — Booking ${booking.booking_number} rescheduled`,
          html,
          variables: { booking_number: booking.booking_number, customer_name: customer.full_name, date, time, manage_url: manageUrl }
        });
      }
      return json(res, 200, { ok: true, status: 'rescheduled', date, time });
    }

    // 6. CANCEL BOOKING
    await supabase(`bookings?id=eq.${encodeURIComponent(booking.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() })
    });
    const customer = (await supabase(`customers?id=eq.${encodeURIComponent(booking.customer_id)}&select=full_name,email`))[0];
    if (customer?.email) {
      const manageToken = decryptToken(booking.access_token_ciphertext);
      const manageUrl = `${env('PUBLIC_SITE_URL')}/booking?token=${encodeURIComponent(manageToken)}`;
      await trySendTemplatedEmail({
        templateKey: 'cancellation',
        to: customer.email,
        replyTo: process.env.ADMIN_ROUTING_EMAIL || undefined,
        subject: `Hair by Maeva — Booking ${booking.booking_number} cancelled`,
        html: `<p>Hi ${escapeHtml(customer.full_name)},</p><p>Your booking <strong>${escapeHtml(booking.booking_number)}</strong> has been cancelled by Hair by Maeva. Please contact us if you have questions.</p><p><a href="${manageUrl}">View / manage my booking</a></p>`,
        variables: { booking_number: booking.booking_number, customer_name: customer.full_name, manage_url: manageUrl }
      });
    }
    if (process.env.ADMIN_EMAIL) {
      await trySendEmail({ to: adminRecipients(), subject: `Booking cancelled — ${booking.booking_number}`, html: `<p>Booking ${escapeHtml(booking.booking_number)} was cancelled from Admin.</p>` });
    }
    return json(res, 200, { ok: true, status: 'cancelled' });

  } catch (error) {
    console.error(error);
    if (/overlap|already booked|existing booking/i.test(error.message || '')) {
      return json(res, 409, { error: 'That appointment time was just taken.' });
    }
    return json(res, error.statusCode || 500, { error: error.message || 'We could not update that booking.' });
  }
};
