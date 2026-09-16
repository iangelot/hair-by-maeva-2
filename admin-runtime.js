/* Hair by Maeva 2 - Complete Admin Runtime Client & CMS Controller */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://ebljbhjtnazslbdkpmbu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_1xA2v-KNZH11UpcmzzaHCQ_pAg7KMzd';
  const TOKEN_KEY = 'hair-by-maeva-admin-token';

  // Helper for auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`
    };
  };

  // REST and bootstrap request wrapper
  async function proxyRequest(path, options = {}) {
    const response = await fetch('/api/admin-bootstrap', {
      method: 'POST',
      headers: {
        Authorization: getAuthHeaders().Authorization,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path,
        method: options.method || 'GET',
        body: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
        headers: options.headers || {}
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { data: null, error: new Error(data.error || 'Request failed.') };
    }
    return { data: data.data, error: null };
  }

  // Supabase query builder
  function createQuery(table) {
    const state = { table, params: [], method: 'GET', body: null, wantSingle: false, wantMaybe: false, headers: {} };
    const builder = {
      select(cols = '*') { state.params.push(`select=${encodeURIComponent(cols)}`); return builder; },
      order(col, opts = {}) { state.params.push(`order=${encodeURIComponent(col)}.${opts.ascending === false ? 'desc' : 'asc'}`); return builder; },
      limit(val) { state.params.push(`limit=${encodeURIComponent(val)}`); return builder; },
      eq(col, val) { state.params.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`); return builder; },
      in(col, vals) { state.params.push(`${encodeURIComponent(col)}=in.(${vals.map(v => encodeURIComponent(v)).join(',')})`); return builder; },
      is(col, val) { state.params.push(`${encodeURIComponent(col)}=is.${encodeURIComponent(val)}`); return builder; },
      single() { state.wantSingle = true; return builder; },
      maybeSingle() { state.wantMaybe = true; return builder; },
      insert(val) { state.method = 'POST'; state.body = val; state.headers.Prefer = 'return=representation'; return builder; },
      update(val) { state.method = 'PATCH'; state.body = val; state.headers.Prefer = 'return=representation'; return builder; },
      delete() { state.method = 'DELETE'; state.headers.Prefer = 'return=representation'; return builder; },
      then(resolve, reject) {
        const queryPath = state.table + (state.params.length ? `?${state.params.join('&')}` : '');
        return proxyRequest(queryPath, { method: state.method, body: state.body, headers: state.headers }).then(res => {
          if (res.error) return res;
          const rows = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
          if (state.wantSingle) {
            return { data: rows[0] || null, error: rows[0] ? null : new Error('No row returned.') };
          }
          if (state.wantMaybe) {
            return { data: rows[0] || null, error: null };
          }
          return { data: res.data, error: null };
        }).then(resolve, reject);
      }
    };
    return builder;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async function compressImageIfNeeded(file, maxDimension = 1600, quality = 0.85) {
    if (!file || !file.type || !file.type.startsWith('image/') || file.size < 300 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }

  // Supabase Client Object
  const client = {
    from: createQuery,
    auth: {
      async signInWithPassword({ email, password }) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { data: null, error: new Error(data.error_description || data.msg || 'Unable to sign in.') };
        localStorage.setItem(TOKEN_KEY, data.access_token);
        return { data: { session: data }, error: null };
      },
      async getSession() {
        const token = localStorage.getItem(TOKEN_KEY);
        return { data: { session: token ? { access_token: token } : null }, error: null };
      },
      async getUser() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return { data: { user: null }, error: null };
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => null);
        return res.ok ? { data: { user: data }, error: null } : { data: { user: null }, error: new Error('Session expired.') };
      },
      async signOut() {
        localStorage.removeItem(TOKEN_KEY);
        return { error: null };
      }
    },
    storage: {
      from(bucket) {
        return {
          getPublicUrl(path) {
            if (!path) return { data: { publicUrl: '' } };
            if (/^https?:\/\//i.test(path)) {
              return { data: { publicUrl: path } };
            }
            if (/^(\.\/|\/)?assets\//i.test(path)) {
              return { data: { publicUrl: `/${path.replace(/^(\.\/|\/)+/, '')}` } };
            }
            return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, '')}` } };
          },
          async upload(path, file, options = {}) {
            try {
              const processedFile = await compressImageIfNeeded(file);
              const base64Data = await fileToBase64(processedFile);
              const folder = path.split('/')[0] || 'services';
              const filename = path.split('/').slice(1).join('/') || processedFile.name || 'image.jpg';

              const res = await fetch('/api/admin-booking-action', {
                method: 'POST',
                headers: {
                  Authorization: getAuthHeaders().Authorization,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  action: 'upload_image',
                  folder,
                  filename,
                  contentType: processedFile.type || 'image/jpeg',
                  base64Data
                })
              });

              const result = await res.json().catch(() => ({}));
              if (res.ok && result.path) {
                return { data: { path: result.path, publicUrl: result.publicUrl }, error: null };
              }
              throw new Error(result.error || 'Upload endpoint returned an error.');
            } catch (err) {
              console.warn('Backend upload proxy failed, attempting direct Supabase upload:', err.message);
              const token = localStorage.getItem(TOKEN_KEY);
              const directRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
                method: 'POST',
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${token || SUPABASE_KEY}`,
                  'Content-Type': options.contentType || file.type || 'application/octet-stream',
                  'x-upsert': String(Boolean(options.upsert))
                },
                body: file
              });
              const directData = await directRes.json().catch(() => ({}));
              return directRes.ok ? { data: { path }, error: null } : { data: null, error: new Error(directData.message || directData.error || err.message || 'Image upload failed.') };
            }
          },
          async remove(paths) {
            const token = localStorage.getItem(TOKEN_KEY);
            const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${token || SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ prefixes: paths })
            });
            const data = await res.json().catch(() => ({}));
            return res.ok ? { data: paths, error: null } : { data: null, error: new Error(data.message || data.error || 'Image removal failed.') };
          }
        };
      }
    }
  };

  window.supabase = { createClient: () => client };

  // UI Utilities
  const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast-banner' + (isError ? ' error' : '') + ' show';
    clearTimeout(window.__toastTimeout);
    window.__toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  // Tab Navigation Setup
  function initTabs() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(`tab-${targetTab}`);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  }

  // Dashboard Data Loader
  let cachedSections = [];
  let cachedServices = [];
  let cachedCategories = [];

  async function loadDashboard() {
    if (window.__dashboardLoading) return;
    window.__dashboardLoading = true;

    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      // 1. Fetch Bookings & Stats
      const { data: bookings, error: bookingsError } = await client.from('bookings')
        .select('id,booking_number,service_name_snapshot,length_name_snapshot,appointment_date,appointment_time,total_price,reservation_fee,remaining_balance,admin_notes,payment_status,status,customers(full_name,email,phone)')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(100);

      if (bookingsError) throw bookingsError;
      const rows = bookings || [];

      // Update Top Stats
      const todayCount = rows.filter(b => b.appointment_date === today && b.status !== 'cancelled').length;
      const paymentCount = rows.filter(b => b.payment_status === 'payment_submitted').length;
      const upcomingCount = rows.filter(b => b.appointment_date >= today && b.status !== 'cancelled').length;
      const depositTotal = rows.filter(b => b.payment_status === 'payment_verified' || b.status === 'confirmed')
        .reduce((sum, b) => sum + Number(b.reservation_fee || 0), 0);

      const elToday = document.getElementById('today-count');
      const elPayment = document.getElementById('payment-count');
      const elUpcoming = document.getElementById('upcoming-count');
      const elDeposit = document.getElementById('deposit-total');

      if (elToday) elToday.textContent = todayCount;
      if (elPayment) elPayment.textContent = paymentCount;
      if (elUpcoming) elUpcoming.textContent = upcomingCount;
      if (elDeposit) elDeposit.textContent = `$${depositTotal.toFixed(2)}`;

      // Render Bookings Table
      renderBookingsTable(rows);

      // 2. Fetch Customers
      const { data: customers } = await client.from('customers').select('*').order('created_at', { ascending: false }).limit(50);
      renderCustomers(customers || []);

      // 3. Fetch Categories & Services
      const { data: categories } = await client.from('service_categories').select('*').order('display_order');
      cachedCategories = categories || [];
      renderCategories(cachedCategories);

      const { data: services } = await client.from('services')
        .select('id,name,slug,category_id,description,notes,preparation_instructions,duration_minutes,image_path,is_active,display_order,service_lengths(id,name,price,display_order),service_options(id,name,price_delta,display_order,is_active)')
        .order('display_order');
      cachedServices = services || [];
      renderServices(cachedServices, cachedCategories);

      // 4. Fetch Website Sections (Hero, Section Headings, Contact & Footer)
      const { data: sections } = await client.from('website_sections').select('*').eq('page_slug', 'home').order('display_order');
      cachedSections = sections || [];
      populateWebsiteContent(cachedSections);

      // 5. Fetch Gallery Items
      const { data: gallery } = await client.from('gallery_items').select('*').order('display_order');
      renderGallery(gallery || []);

      // 6. Fetch Policies
      const { data: policies } = await client.from('policies').select('*').order('display_order');
      renderPolicies(policies || []);

      // 7. Fetch Availability & Rules
      const { data: bookingSettings } = await client.from('booking_settings').select('*').eq('id', 1).maybeSingle();
      if (bookingSettings) {
        const settingsForm = document.getElementById('booking-settings-form');
        if (settingsForm) {
          if (settingsForm.minimum_notice_hours) settingsForm.minimum_notice_hours.value = bookingSettings.minimum_notice_hours;
          if (settingsForm.maximum_advance_days) settingsForm.maximum_advance_days.value = bookingSettings.maximum_advance_days;
        }
      }

      const { data: rules } = await client.from('availability_rules').select('*').order('weekday').order('start_time');
      renderAvailabilityRules(rules || []);

      const { data: blockedDates } = await client.from('blocked_dates').select('*').order('blocked_date');
      renderBlockedDates(blockedDates || []);

      const { data: blockedTimes } = await client.from('blocked_times').select('*').order('blocked_date').order('start_time');
      renderBlockedTimes(blockedTimes || []);

      // 8. Fetch Payment Methods
      const { data: methods } = await client.from('payment_methods').select('*').order('display_order');
      renderPaymentMethods(methods || []);

      // 9. Fetch Social Links & Messages
      const { data: socials } = await client.from('social_links').select('*').order('display_order');
      renderSocials(socials || []);

      const { data: messages } = await client.from('contact_messages').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(30);
      renderMessages(messages || []);

    } catch (err) {
      console.error('Error loading dashboard:', err);
      showToast(err.message || 'Error loading dashboard data.', true);
    } finally {
      window.__dashboardLoading = false;
    }
  }

  // --- 1. Bookings UI & Actions ---
  function renderBookingsTable(rows) {
    const tbody = document.getElementById('booking-rows');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px;">No bookings found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(b => {
      const isPendingVerification = b.payment_status === 'payment_submitted';
      const isConfirmed = b.status === 'confirmed' || b.payment_status === 'payment_verified';
      const isCompleted = b.status === 'completed';
      const isCancelled = b.status === 'cancelled';
      const statusPillClass = isConfirmed ? 'status-payment_verified' : (isPendingVerification ? 'status-payment_submitted' : '');

      return `
        <tr class="booking-row booking-row-${escapeHtml(b.payment_status)} booking-row-${escapeHtml(b.status)}" data-id="${b.id}">
          <td>
            <strong>${escapeHtml(b.booking_number)}</strong>
            <small style="color:#765e58;">${escapeHtml(b.service_name_snapshot)} · ${escapeHtml(b.length_name_snapshot)}</small>
            <small style="color:#765e58;">Total: $${Number(b.total_price || 0).toFixed(2)} (Deposit: $${Number(b.reservation_fee || 0).toFixed(2)})</small>
          </td>
          <td>
            <strong>${escapeHtml(b.customers?.full_name || 'Client')}</strong>
            <small>${escapeHtml(b.customers?.email || '')}</small>
            <small>${escapeHtml(b.customers?.phone || '')}</small>
          </td>
          <td>
            <strong>${escapeHtml(b.appointment_date)}</strong>
            <small>${escapeHtml(b.appointment_time)}</small>
          </td>
          <td>
            <span class="status-pill ${statusPillClass}">${escapeHtml((b.payment_status || b.status).replace(/_/g, ' '))}</span>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              ${isPendingVerification ? `
                <div style="display:flex; gap:4px; margin-bottom:2px;">
                  <button type="button" class="cms-btn cms-btn-primary btn-confirm-payment" data-id="${b.id}" style="padding:4px 8px; font-size:10px;">CONFIRM PAYMENT</button>
                  <button type="button" class="cms-btn cms-btn-danger btn-reject-payment" data-id="${b.id}" style="padding:4px 8px; font-size:10px;">NOT RECEIVED</button>
                </div>
              ` : `
                <span style="font-family:var(--mono); font-size:11px; text-transform:uppercase; color:${isConfirmed ? '#2d7a38' : (isCompleted ? '#4a6fa5' : (isCancelled ? '#a23939' : '#583636'))}; font-weight:600;">
                  ${escapeHtml(b.status.replace(/_/g, ' '))}
                </span>
              `}
              <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="text-link btn-details" data-id="${b.id}" style="font-size:10px;">DETAILS ▾</button>
                <button type="button" class="text-link btn-note" data-id="${b.id}" data-note="${escapeHtml(b.admin_notes || '')}" style="font-size:10px;">${b.admin_notes ? 'EDIT NOTE' : 'ADD NOTE'}</button>
                ${!isCancelled && !isCompleted ? `
                  <button type="button" class="text-link btn-reschedule" data-id="${b.id}" style="font-size:10px;">RESCHEDULE</button>
                  <button type="button" class="text-link btn-complete-booking" data-id="${b.id}" style="font-size:10px; color:#2d7a38;">COMPLETE ✓</button>
                  <button type="button" class="text-link danger btn-cancel-booking" data-id="${b.id}" style="font-size:10px; color:#a23939;">CANCEL</button>
                ` : ''}
                ${isConfirmed ? `
                  <button type="button" class="text-link btn-resend-email" data-id="${b.id}" style="font-size:10px; color:#583636;">RESEND EMAIL ✉</button>
                ` : ''}
                <button type="button" class="text-link danger btn-delete-booking" data-id="${b.id}" style="font-size:10px; color:#a23939; font-weight:600;">DELETE ✕</button>
              </div>
              <div class="booking-detail-box hidden" id="details-${b.id}" style="margin-top:6px; padding:10px; background:#fff; border:1px solid rgba(88,54,54,0.15); border-radius:4px; font-size:11px; width:100%; box-sizing:border-box;">
                <strong>Booking #:</strong> ${escapeHtml(b.booking_number)}<br>
                <strong>Service:</strong> ${escapeHtml(b.service_name_snapshot)} (${escapeHtml(b.length_name_snapshot)})<br>
                <strong>Total Price:</strong> $${Number(b.total_price || 0).toFixed(2)}<br>
                <strong>Deposit:</strong> $${Number(b.reservation_fee || 0).toFixed(2)}<br>
                <strong>Remaining Balance Due:</strong> $${Number(b.remaining_balance || 0).toFixed(2)}<br>
                ${b.admin_notes ? `<strong>Internal Note:</strong> ${escapeHtml(b.admin_notes)}<br>` : ''}
                <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(88,54,54,0.1); display:flex; gap:6px;">
                  <button type="button" class="cms-btn cms-btn-outline btn-quick-confirm" data-id="${b.id}" style="padding:3px 6px; font-size:9px;">FORCE CONFIRM</button>
                  <button type="button" class="cms-btn cms-btn-outline btn-quick-pending" data-id="${b.id}" style="padding:3px 6px; font-size:9px;">MARK PENDING</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Event Handlers
    tbody.querySelectorAll('.btn-confirm-payment').forEach(btn => {
      btn.addEventListener('click', () => updatePayment(btn.dataset.id, 'confirm'));
    });
    tbody.querySelectorAll('.btn-reject-payment').forEach(btn => {
      btn.addEventListener('click', () => updatePayment(btn.dataset.id, 'reject'));
    });
    tbody.querySelectorAll('.btn-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const detailBox = document.getElementById(`details-${btn.dataset.id}`);
        if (detailBox) detailBox.classList.toggle('hidden');
      });
    });
    tbody.querySelectorAll('.btn-note').forEach(btn => {
      btn.addEventListener('click', () => editBookingNote(btn.dataset.id, btn.dataset.note));
    });
    tbody.querySelectorAll('.btn-reschedule').forEach(btn => {
      btn.addEventListener('click', () => rescheduleBooking(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-complete-booking').forEach(btn => {
      btn.addEventListener('click', () => completeBooking(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-cancel-booking').forEach(btn => {
      btn.addEventListener('click', () => cancelBooking(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-resend-email').forEach(btn => {
      btn.addEventListener('click', () => resendConfirmationEmail(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-delete-booking').forEach(btn => {
      btn.addEventListener('click', () => deleteBooking(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-quick-confirm').forEach(btn => {
      btn.addEventListener('click', () => updateBookingStatus(btn.dataset.id, 'confirmed', 'payment_verified'));
    });
    tbody.querySelectorAll('.btn-quick-pending').forEach(btn => {
      btn.addEventListener('click', () => updateBookingStatus(btn.dataset.id, 'pending_payment', 'unpaid'));
    });
  }

  function initBookingFilters() {
    const searchInput = document.getElementById('booking-search');
    const statusSelect = document.getElementById('booking-status-filter');

    const applyFilter = () => {
      const q = (searchInput?.value || '').toLowerCase().trim();
      const statusFilter = statusSelect?.value || '';
      const rows = document.querySelectorAll('#booking-rows tr');

      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        const matchesQuery = !q || text.includes(q);
        const matchesStatus = !statusFilter || (r.className || '').includes(statusFilter);
        r.style.display = matchesQuery && matchesStatus ? '' : 'none';
      });
    };

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (statusSelect) statusSelect.addEventListener('change', applyFilter);
  }

  async function updatePayment(id, action) {
    showToast('Processing payment update…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to update payment.', true);
    } else {
      showToast(action === 'confirm' ? 'Payment confirmed! Confirmation email sent to client.' : 'Payment marked not received.');
      loadDashboard();
    }
  }

  async function deleteBooking(id) {
    if (!confirm('Are you sure you want to permanently DELETE this booking? This will remove the booking and its payment records completely. This action cannot be undone.')) return;
    showToast('Deleting booking…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'delete' })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to delete booking.', true);
    } else {
      showToast('Booking permanently deleted.');
      loadDashboard();
    }
  }

  async function completeBooking(id) {
    showToast('Marking appointment as completed…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'complete' })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to mark completed.', true);
    } else {
      showToast('Appointment marked completed.');
      loadDashboard();
    }
  }

  async function resendConfirmationEmail(id) {
    showToast('Resending confirmation email…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'resend_confirmation' })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to resend email.', true);
    } else {
      showToast('Confirmation email sent to client.');
    }
  }

  async function updateBookingStatus(id, newStatus, newPaymentStatus) {
    showToast('Updating status…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'update_status', status: newStatus, paymentStatus: newPaymentStatus })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to update status.', true);
    } else {
      showToast('Booking status updated.');
      loadDashboard();
    }
  }

  async function cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    showToast('Cancelling booking…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'cancel' })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to cancel booking.', true);
    } else {
      showToast('Booking cancelled.');
      loadDashboard();
    }
  }

  async function rescheduleBooking(id) {
    const date = prompt('New appointment date (YYYY-MM-DD):');
    if (!date) return;
    const time = prompt('New appointment time (HH:MM e.g. 10:00, 13:30):');
    if (!time) return;
    showToast('Rescheduling booking…');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin-booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ bookingId: id, action: 'reschedule', date, time })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.error || 'Unable to reschedule booking.', true);
    } else {
      showToast(`Booking rescheduled to ${result.date} at ${result.time}.`);
      loadDashboard();
    }
  }

  async function editBookingNote(id, existingNote) {
    const note = prompt('Admin note (internal only):', existingNote || '');
    if (note === null) return;
    const { error } = await client.from('bookings').update({ admin_notes: note.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      showToast(error.message, true);
    } else {
      showToast('Internal note saved.');
      loadDashboard();
    }
  }

  function renderCustomers(customers) {
    const el = document.getElementById('customer-list');
    if (!el) return;
    if (!customers.length) {
      el.innerHTML = '<p style="color:#765e58; margin:0;">No registered customers yet.</p>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.full_name)}</strong></td>
                <td>${escapeHtml(c.email)}<small>${escapeHtml(c.phone || '')}</small></td>
                <td>${escapeHtml(c.location || '—')}</td>
                <td>${escapeHtml(String(c.created_at || '').slice(0, 10))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- 2. Hairstyles & Catalog UI & Actions ---
  function renderCategories(categories) {
    const select = document.getElementById('new-service-category');
    if (select) {
      select.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') || '<option value="">No categories created</option>';
    }

    const catList = document.getElementById('category-list');
    if (catList) {
      if (!categories.length) {
        catList.innerHTML = '<p style="color:#765e58;">No categories yet. Add one above.</p>';
        return;
      }
      catList.innerHTML = `
        <div class="cms-grid-2">
          ${categories.map(c => {
            const count = (cachedServices || []).filter(s => s.category_id === c.id).length;
            return `
              <form class="category-edit-form" data-id="${c.id}" style="display:flex; align-items:center; gap:8px; background:#fff; padding:10px 12px; border:1px solid var(--admin-border); border-radius:4px;">
                <div style="flex:2;">
                  <input name="name" value="${escapeHtml(c.name)}" placeholder="Category name" required style="width:100%; padding:6px 8px; font-size:13px; font-weight:600; border:1px solid var(--admin-border); border-radius:4px;">
                  <span style="font-size:10px; color:#765e58; font-family:var(--mono);">${count} hairstyle${count === 1 ? '' : 's'} linked</span>
                </div>
                <div style="width:65px;">
                  <input name="display_order" type="number" value="${Number(c.display_order || 0)}" title="Display order" style="width:100%; padding:6px; font-size:12px; border:1px solid var(--admin-border); border-radius:4px;">
                </div>
                <label class="check-label" style="font-size:11px; margin:0;" title="Visible on website tab bar">
                  <input type="checkbox" name="is_active" ${c.is_active !== false ? 'checked' : ''}> Active
                </label>
                <button type="submit" class="cms-btn cms-btn-outline" style="padding:6px 8px; font-size:11px;">SAVE</button>
                <button type="button" class="cms-btn cms-btn-danger btn-delete-cat" data-id="${c.id}" style="padding:6px 8px; font-size:11px;">DEL</button>
              </form>
            `;
          }).join('')}
        </div>
      `;

      catList.querySelectorAll('.category-edit-form').forEach(f => {
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          showToast('Updating category…');
          const fd = new FormData(f);
          const name = fd.get('name')?.toString().trim();
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const { error } = await client.from('service_categories').update({
            name,
            slug,
            display_order: Number(fd.get('display_order')),
            is_active: Boolean(fd.get('is_active'))
          }).eq('id', f.dataset.id);
          if (error) showToast(error.message, true);
          else { showToast(`Category "${name}" updated.`); loadDashboard(); }
        });
      });

      catList.querySelectorAll('.btn-delete-cat').forEach(b => {
        b.addEventListener('click', async () => {
          const cat = categories.find(c => c.id === b.dataset.id);
          const count = (cachedServices || []).filter(s => s.category_id === b.dataset.id).length;
          const msg = count > 0 
            ? `Delete category "${cat?.name || ''}"? The ${count} linked hairstyle(s) will stay in your catalog but become uncategorized.`
            : `Delete category "${cat?.name || ''}"?`;
          if (!confirm(msg)) return;
          showToast('Deleting category…');
          await client.from('services').update({ category_id: null }).eq('category_id', b.dataset.id);
          const { error } = await client.from('service_categories').delete().eq('id', b.dataset.id);
          if (error) showToast(error.message, true);
          else { showToast('Category deleted.'); loadDashboard(); }
        });
      });
    }
  }

  function renderServices(services, categories) {
    const manualServiceSelect = document.getElementById('manual-booking-service');
    const manualLengthSelect = document.getElementById('manual-booking-length');
    if (manualServiceSelect && manualLengthSelect) {
      manualServiceSelect.innerHTML = services.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      const syncLengths = () => {
        const cur = services.find(s => s.id === manualServiceSelect.value);
        manualLengthSelect.innerHTML = (cur?.service_lengths || []).map(l => `<option value="${l.id}">${escapeHtml(l.name)} — $${Number(l.price).toFixed(0)}</option>`).join('');
      };
      manualServiceSelect.onchange = syncLengths;
      syncLengths();
    }

    const list = document.getElementById('service-list');
    if (!list) return;

    if (!services.length) {
      list.innerHTML = '<p style="color:#765e58;">No hairstyles created yet.</p>';
      return;
    }

    list.innerHTML = services.map(s => {
      const imgUrl = s.image_path ? client.storage.from('hair-media').getPublicUrl(s.image_path).data.publicUrl : '';
      return `
        <details class="cms-card" style="margin-bottom:14px; padding:16px;">
          <summary style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-family:var(--display); font-size:18px;">
            <span>${escapeHtml(s.name)}</span>
            <span style="font-family:var(--mono); font-size:11px; color:${s.is_active ? '#2d7a38' : '#a23939'}">${s.is_active ? 'ACTIVE' : 'HIDDEN'} ▾</span>
          </summary>
          <form class="service-edit-form" data-id="${s.id}" data-current-img="${escapeHtml(s.image_path || '')}" style="margin-top:16px;">
            <div class="cms-grid-2">
              <div class="form-group">
                <label>STYLE NAME</label>
                <input required name="name" value="${escapeHtml(s.name)}">
              </div>
              <div class="form-group">
                <label>CATEGORY</label>
                <div style="display:flex; gap:6px;">
                  <select name="category_id" style="flex:1;">
                    <option value="">-- No Category --</option>
                    ${categories.map(c => `<option value="${c.id}" ${c.id === s.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                  <button type="button" class="cms-btn cms-btn-outline btn-quick-cat" style="padding:6px 10px; font-size:11px; white-space:nowrap;">＋ NEW</button>
                </div>
              </div>
            </div>
            <div class="cms-grid-2">
              <div class="form-group">
                <label>DURATION (MINUTES)</label>
                <input required type="number" min="30" step="30" name="duration_minutes" value="${Number(s.duration_minutes || 240)}">
              </div>
              <div class="form-group">
                <label>DISPLAY ORDER</label>
                <input required type="number" min="0" name="display_order" value="${Number(s.display_order || 0)}">
              </div>
            </div>
            <div class="form-group">
              <label>DESCRIPTION</label>
              <textarea name="description" rows="2">${escapeHtml(s.description || '')}</textarea>
            </div>
            <div class="form-group">
              <label>NOTES (e.g. Hair is included / not included)</label>
              <input name="notes" value="${escapeHtml(s.notes || '')}">
            </div>
            <div class="form-group">
              <label>PREPARATION INSTRUCTIONS</label>
              <textarea name="preparation_instructions" rows="2">${escapeHtml(s.preparation_instructions || '')}</textarea>
            </div>
            <div class="cms-grid-2" style="align-items:center;">
              <div class="form-group">
                <label>REPLACE IMAGE FILE</label>
                <input type="file" name="image_file" accept="image/*">
              </div>
              <div>
                ${imgUrl ? `<img src="${imgUrl}" alt="${escapeHtml(s.name)}" style="width:70px; height:70px; object-fit:cover; border-radius:4px; border:1px solid var(--admin-border);">` : '<span style="font-size:11px; color:#765e58;">No image attached</span>'}
              </div>
            </div>

            <!-- Lengths & Options -->
            <div style="border-top:1px solid var(--admin-border); margin:16px 0; padding-top:14px;">
              <p class="eyebrow" style="margin-top:0;">LENGTHS / PRICING OPTIONS (${(s.service_lengths || []).length})</p>
              <div class="cms-grid-2" style="margin-bottom:12px;">
                ${(s.service_lengths || []).map(l => `
                  <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; background:#fff; padding:6px 8px; border:1px solid var(--admin-border); border-radius:4px;">
                    <input required name="length-name-${l.id}" value="${escapeHtml(l.name)}" placeholder="Length label" style="flex:2; padding:6px 8px; font-size:13px;">
                    <span style="font-size:12px; font-weight:bold;">$</span>
                    <input required type="number" min="0" step="1" name="length-price-${l.id}" value="${Number(l.price)}" style="width:70px; padding:6px 8px; font-size:13px;">
                    <button type="button" class="cms-btn cms-btn-danger btn-del-length" data-id="${l.id}" title="Delete length" style="padding:6px 8px; font-size:10px;">✕</button>
                  </div>
                `).join('') || '<p style="font-size:12px; color:#765e58;">No lengths configured yet.</p>'}
              </div>

              <!-- Inline Add Length Option for this hairstyle -->
              <div style="background:#faf8f5; border:1px dashed var(--admin-border); border-radius:4px; padding:10px 12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="font-size:11px; font-family:var(--mono); color:#765e58; font-weight:bold;">＋ ADD LENGTH / PRICE:</span>
                <input placeholder="Option name (e.g. Waist, 30 in, Small)" class="inline-new-length-name" data-service-id="${s.id}" style="flex:2; min-width:140px; padding:6px 8px; font-size:12px;">
                <span style="font-size:12px;">$</span>
                <input type="number" min="0" step="1" placeholder="250" class="inline-new-length-price" data-service-id="${s.id}" style="width:70px; padding:6px 8px; font-size:12px;">
                <button type="button" class="cms-btn cms-btn-primary btn-add-length-inline" data-service-id="${s.id}" style="padding:6px 12px; font-size:11px; white-space:nowrap;">ADD LENGTH</button>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; flex-wrap:wrap; gap:10px;">
              <label class="check-label" style="font-size:12px;">
                <input type="checkbox" name="is_active" ${s.is_active ? 'checked' : ''}> PUBLICLY VISIBLE ON SITE
              </label>
              <div style="display:flex; gap:8px;">
                <button type="submit" class="cms-btn cms-btn-primary">SAVE HAIRSTYLE</button>
                <button type="button" class="cms-btn cms-btn-outline btn-dup-service" data-id="${s.id}">DUPLICATE</button>
                <button type="button" class="cms-btn cms-btn-danger btn-del-service" data-id="${s.id}">DELETE</button>
              </div>
            </div>
          </form>
        </details>
      `;
    }).join('');

    // Attach form submit and button handlers
    list.querySelectorAll('.service-edit-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Saving hairstyle…');
        const serviceId = form.dataset.id;
        const currentImg = form.dataset.currentImg;
        const fd = new FormData(form);

        let imagePath = currentImg;
        const imageFile = fd.get('image_file');
        if (imageFile && imageFile.size > 0) {
          const uploadPath = `services/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
          const upload = await client.storage.from('hair-media').upload(uploadPath, imageFile, { contentType: imageFile.type, upsert: false });
          if (upload.error) {
            showToast(upload.error.message, true);
            return;
          }
          imagePath = uploadPath;
        }

        const { error } = await client.from('services').update({
          name: fd.get('name'),
          category_id: fd.get('category_id') || null,
          description: fd.get('description'),
          notes: fd.get('notes'),
          preparation_instructions: fd.get('preparation_instructions'),
          duration_minutes: Number(fd.get('duration_minutes')),
          image_path: imagePath || null,
          display_order: Number(fd.get('display_order')),
          is_active: Boolean(fd.get('is_active'))
        }).eq('id', serviceId);

        if (error) {
          showToast(error.message, true);
          return;
        }

        // Save lengths
        const lengthUpdates = [];
        for (const [key, val] of fd.entries()) {
          if (key.startsWith('length-name-')) {
            const lengthId = key.replace('length-name-', '');
            const price = Number(fd.get(`length-price-${lengthId}`));
            lengthUpdates.push(client.from('service_lengths').update({ name: String(val).trim(), price }).eq('id', lengthId));
          }
        }
        await Promise.all(lengthUpdates);

        showToast('Hairstyle updated successfully!');
        await loadDashboard();
        const card = document.querySelector(`.service-edit-form[data-id="${serviceId}"]`)?.closest('details');
        if (card) card.open = true;
      });
    });

    // Inline Add Length Button handler
    list.querySelectorAll('.btn-add-length-inline').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const serviceId = btn.dataset.serviceId;
        const nameInput = list.querySelector(`.inline-new-length-name[data-service-id="${serviceId}"]`);
        const priceInput = list.querySelector(`.inline-new-length-price[data-service-id="${serviceId}"]`);
        const name = nameInput?.value?.trim();
        const price = Number(priceInput?.value);
        if (!name) {
          showToast('Please enter a length or option name.', true);
          nameInput?.focus();
          return;
        }
        if (isNaN(price) || price < 0) {
          showToast('Please enter a valid price.', true);
          priceInput?.focus();
          return;
        }
        showToast('Adding length option…');
        const { data: existing } = await client.from('service_lengths').select('display_order').eq('service_id', serviceId).order('display_order', { ascending: false }).limit(1);
        const nextOrder = Number(existing?.[0]?.display_order || 0) + 1;
        const { error } = await client.from('service_lengths').insert({
          service_id: serviceId,
          name,
          price,
          display_order: nextOrder
        });
        if (error) {
          showToast(error.message, true);
        } else {
          showToast(`Added length "${name} — $${price}"!`);
          await loadDashboard();
          const card = document.querySelector(`.service-edit-form[data-id="${serviceId}"]`)?.closest('details');
          if (card) card.open = true;
        }
      });
    });

    list.querySelectorAll('.btn-del-length').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        const serviceId = b.closest('.service-edit-form')?.dataset.id;
        if (!confirm('Remove this length/price option?')) return;
        const { error } = await client.from('service_lengths').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else {
          showToast('Length removed.');
          await loadDashboard();
          if (serviceId) {
            const card = document.querySelector(`.service-edit-form[data-id="${serviceId}"]`)?.closest('details');
            if (card) card.open = true;
          }
        }
      });
    });

    list.querySelectorAll('.btn-dup-service').forEach(b => {
      b.addEventListener('click', async () => {
        const s = cachedServices.find(item => item.id === b.dataset.id);
        if (!s) return;
        showToast('Duplicating hairstyle…');
        const name = `${s.name} Copy`;
        const slug = `${s.slug}-copy-${Date.now().toString(36)}`;
        const { data: copy, error } = await client.from('services').insert({
          name,
          slug,
          category_id: s.category_id,
          description: s.description,
          notes: s.notes,
          preparation_instructions: s.preparation_instructions,
          duration_minutes: s.duration_minutes,
          image_path: s.image_path,
          display_order: 99,
          is_active: false
        }).select('id').single();

        if (error) { showToast(error.message, true); return; }

        if (s.service_lengths?.length) {
          await client.from('service_lengths').insert(s.service_lengths.map(l => ({
            service_id: copy.id,
            name: l.name,
            price: l.price,
            display_order: l.display_order
          })));
        }

        showToast('Hairstyle duplicated as a hidden draft!');
        loadDashboard();
      });
    });

    list.querySelectorAll('.btn-del-service').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this hairstyle? (If it has associated bookings, hide it instead of deleting).')) return;
        const { error } = await client.from('services').delete().eq('id', b.dataset.id);
        if (error) showToast('Could not delete: hairstyle may be referenced in bookings. You can hide it instead.', true);
        else { showToast('Hairstyle deleted.'); loadDashboard(); }
      });
    });
  }

  // --- 3. Website Text & Sections (Human-Friendly CMS) ---
  function populateWebsiteContent(sections) {
    const hero = sections.find(s => s.section_key === 'hero')?.content || {};
    const services = sections.find(s => s.section_key === 'services')?.content || {};
    const gallery = sections.find(s => s.section_key === 'gallery')?.content || {};
    const policies = sections.find(s => s.section_key === 'policies')?.content || {};
    const booking = sections.find(s => s.section_key === 'booking')?.content || {};
    const contact = sections.find(s => s.section_key === 'contact')?.content || {};
    const footer = sections.find(s => s.section_key === 'footer')?.content || {};

    // Hero Fields
    const elHeroTitle = document.getElementById('hero-title');
    const elHeroEyebrow = document.getElementById('hero-eyebrow');
    const elHeroDesc = document.getElementById('hero-desc');
    const elHeroCta1T = document.getElementById('hero-cta1-text');
    const elHeroCta1U = document.getElementById('hero-cta1-url');
    const elHeroCta2T = document.getElementById('hero-cta2-text');
    const elHeroCta2U = document.getElementById('hero-cta2-url');
    const elHeroImgUrl = document.getElementById('hero-img-url');
    const elHeroPreview = document.getElementById('hero-img-preview');

    if (elHeroTitle) elHeroTitle.value = hero.title || '';
    if (elHeroEyebrow) elHeroEyebrow.value = hero.eyebrow || '';
    if (elHeroDesc) elHeroDesc.value = hero.description || '';
    if (elHeroCta1T) elHeroCta1T.value = hero.primaryCtaText || 'BOOK AN APPOINTMENT';
    if (elHeroCta1U) elHeroCta1U.value = hero.primaryCtaUrl || '#booking';
    if (elHeroCta2T) elHeroCta2T.value = hero.secondaryCtaText || 'VIEW SERVICES ↓';
    if (elHeroCta2U) elHeroCta2U.value = hero.secondaryCtaUrl || '#services';
    if (elHeroImgUrl) elHeroImgUrl.value = hero.imageUrl || '';
    if (elHeroPreview && hero.imageUrl) {
      elHeroPreview.style.backgroundImage = `url('${hero.imageUrl}')`;
      elHeroPreview.textContent = '';
    }

    // Section Headings
    const elServEye = document.getElementById('heading-services-eyebrow');
    const elServTit = document.getElementById('heading-services-title');
    const elGalEye = document.getElementById('heading-gallery-eyebrow');
    const elGalTit = document.getElementById('heading-gallery-title');
    const elPolEye = document.getElementById('heading-policies-eyebrow');
    const elPolTit = document.getElementById('heading-policies-title');
    const elBkEye = document.getElementById('heading-booking-eyebrow');
    const elBkTit = document.getElementById('heading-booking-title');
    const elBkBtn = document.getElementById('heading-booking-btn');

    if (elServEye) elServEye.value = services.eyebrow || '';
    if (elServTit) elServTit.value = services.title || '';
    if (elGalEye) elGalEye.value = gallery.eyebrow || '';
    if (elGalTit) elGalTit.value = gallery.title || '';
    if (elPolEye) elPolEye.value = policies.eyebrow || '';
    if (elPolTit) elPolTit.value = policies.title || '';
    if (elBkEye) elBkEye.value = booking.eyebrow || '';
    if (elBkTit) elBkTit.value = booking.title || '';
    if (elBkBtn) elBkBtn.value = booking.buttonText || 'START BOOKING ↗';

    // Contact & Footer
    const elCity = document.getElementById('contact-city');
    const elEmail = document.getElementById('contact-email');
    const elDesc = document.getElementById('contact-desc');
    const elCopy = document.getElementById('footer-copyright');

    if (elCity) elCity.value = contact.city || '';
    if (elEmail) elEmail.value = contact.email || '';
    if (elDesc) elDesc.value = contact.description || '';
    if (elCopy) elCopy.value = footer.copyright || '';
  }

  function initContentSaveHandlers() {
    // Save Hero
    const saveHeroBtn = document.getElementById('save-hero-btn');
    if (saveHeroBtn) {
      saveHeroBtn.addEventListener('click', async () => {
        showToast('Saving Hero Banner…');
        const fileInput = document.getElementById('hero-img-file');
        let imageUrl = document.getElementById('hero-img-url')?.value || './assets/web/hero.jpg';

        if (fileInput?.files?.[0]) {
          const file = fileInput.files[0];
          const uploadPath = `hero/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
          const upload = await client.storage.from('hair-media').upload(uploadPath, file, { contentType: file.type, upsert: false });
          if (upload.error) {
            showToast(upload.error.message, true);
            return;
          }
          imageUrl = client.storage.from('hair-media').getPublicUrl(uploadPath).data.publicUrl;
        }

        const heroContent = {
          eyebrow: document.getElementById('hero-eyebrow')?.value || '',
          title: document.getElementById('hero-title')?.value || '',
          description: document.getElementById('hero-desc')?.value || '',
          primaryCtaText: document.getElementById('hero-cta1-text')?.value || 'BOOK AN APPOINTMENT',
          primaryCtaUrl: document.getElementById('hero-cta1-url')?.value || '#booking',
          secondaryCtaText: document.getElementById('hero-cta2-text')?.value || 'VIEW SERVICES ↓',
          secondaryCtaUrl: document.getElementById('hero-cta2-url')?.value || '#services',
          imageUrl
        };

        const existingHero = cachedSections.find(s => s.section_key === 'hero');
        let error = null;
        if (existingHero) {
          const res = await client.from('website_sections').update({ content: heroContent }).eq('id', existingHero.id);
          error = res.error;
        } else {
          const res = await client.from('website_sections').insert({ page_slug: 'home', section_key: 'hero', content: heroContent, display_order: 1, is_visible: true });
          error = res.error;
        }

        if (error) showToast(error.message, true);
        else {
          showToast('Hero section saved successfully!');
          const preview = document.getElementById('hero-img-preview');
          if (preview) { preview.style.backgroundImage = `url('${imageUrl}')`; preview.textContent = ''; }
        }
      });
    }

    // Save Section Headings
    const saveHeadingsBtn = document.getElementById('save-headings-btn');
    if (saveHeadingsBtn) {
      saveHeadingsBtn.addEventListener('click', async () => {
        showToast('Saving Section Headings…');
        const updates = [
          {
            key: 'services',
            content: {
              eyebrow: document.getElementById('heading-services-eyebrow')?.value || '',
              title: document.getElementById('heading-services-title')?.value || ''
            },
            order: 2
          },
          {
            key: 'gallery',
            content: {
              eyebrow: document.getElementById('heading-gallery-eyebrow')?.value || '',
              title: document.getElementById('heading-gallery-title')?.value || ''
            },
            order: 3
          },
          {
            key: 'policies',
            content: {
              eyebrow: document.getElementById('heading-policies-eyebrow')?.value || '',
              title: document.getElementById('heading-policies-title')?.value || ''
            },
            order: 4
          },
          {
            key: 'booking',
            content: {
              eyebrow: document.getElementById('heading-booking-eyebrow')?.value || '',
              title: document.getElementById('heading-booking-title')?.value || '',
              buttonText: document.getElementById('heading-booking-btn')?.value || 'START BOOKING ↗'
            },
            order: 5
          }
        ];

        for (const item of updates) {
          const existing = cachedSections.find(s => s.section_key === item.key);
          if (existing) {
            await client.from('website_sections').update({ content: item.content }).eq('id', existing.id);
          } else {
            await client.from('website_sections').insert({ page_slug: 'home', section_key: item.key, content: item.content, display_order: item.order, is_visible: true });
          }
        }

        showToast('Section headings saved!');
      });
    }

    // Save Contact & Footer
    const saveContactBtn = document.getElementById('save-contact-btn');
    if (saveContactBtn) {
      saveContactBtn.addEventListener('click', async () => {
        showToast('Saving Contact & Footer…');
        const contactContent = {
          city: document.getElementById('contact-city')?.value || '',
          email: document.getElementById('contact-email')?.value || '',
          description: document.getElementById('contact-desc')?.value || ''
        };
        const footerContent = {
          copyright: document.getElementById('footer-copyright')?.value || ''
        };

        const existingContact = cachedSections.find(s => s.section_key === 'contact');
        if (existingContact) {
          await client.from('website_sections').update({ content: contactContent }).eq('id', existingContact.id);
        } else {
          await client.from('website_sections').insert({ page_slug: 'home', section_key: 'contact', content: contactContent, display_order: 6, is_visible: true });
        }

        const existingFooter = cachedSections.find(s => s.section_key === 'footer');
        if (existingFooter) {
          await client.from('website_sections').update({ content: footerContent }).eq('id', existingFooter.id);
        } else {
          await client.from('website_sections').insert({ page_slug: 'home', section_key: 'footer', content: footerContent, display_order: 7, is_visible: true });
        }

        showToast('Contact & Footer info saved!');
      });
    }
  }

  // --- 4. Gallery Media UI & Actions ---
  function renderGallery(items) {
    const grid = document.getElementById('gallery-grid-list');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<p style="color:#765e58;">No gallery photos uploaded yet.</p>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const url = client.storage.from('hair-media').getPublicUrl(item.image_path).data.publicUrl;
      return `
        <div class="gallery-admin-item" data-id="${item.id}" data-path="${escapeHtml(item.image_path)}">
          <img src="${url}" alt="${escapeHtml(item.alt_text || '')}">
          <form class="gallery-item-form" style="display:flex; flex-direction:column; gap:6px;">
            <input name="caption" value="${escapeHtml(item.caption || '')}" placeholder="Caption" style="font-size:12px; padding:4px 6px;">
            <input name="alt_text" required value="${escapeHtml(item.alt_text || '')}" placeholder="Alt text" style="font-size:12px; padding:4px 6px;">
            <div style="display:flex; gap:6px;">
              <input name="category" value="${escapeHtml(item.category || '')}" placeholder="Braids" style="font-size:12px; padding:4px 6px; flex:2;">
              <input name="display_order" type="number" value="${Number(item.display_order || 0)}" style="font-size:12px; padding:4px 6px; width:50px;">
            </div>
            <label class="check-label" style="font-size:11px;"><input type="checkbox" name="is_active" ${item.is_active !== false ? 'checked' : ''}> Visible</label>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <button type="submit" class="cms-btn cms-btn-primary" style="flex:1; padding:6px; font-size:10px;">SAVE</button>
              <button type="button" class="cms-btn cms-btn-danger btn-del-gallery" data-id="${item.id}" data-path="${escapeHtml(item.image_path)}" style="padding:6px 10px; font-size:10px;">DEL</button>
            </div>
          </form>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.gallery-item-form').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const parent = f.closest('.gallery-admin-item');
        const id = parent.dataset.id;
        const fd = new FormData(f);
        const { error } = await client.from('gallery_items').update({
          caption: fd.get('caption'),
          alt_text: fd.get('alt_text'),
          category: fd.get('category'),
          display_order: Number(fd.get('display_order')),
          is_active: Boolean(fd.get('is_active'))
        }).eq('id', id);

        if (error) showToast(error.message, true);
        else showToast('Gallery photo updated!');
      });
    });

    grid.querySelectorAll('.btn-del-gallery').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this photo from gallery?')) return;
        const id = b.dataset.id;
        const path = b.dataset.path;
        const { error } = await client.from('gallery_items').delete().eq('id', id);
        if (error) {
          showToast(error.message, true);
        } else {
          if (path && !path.startsWith('assets/')) {
            await client.storage.from('hair-media').remove([path]);
          }
          showToast('Photo removed from gallery.');
          loadDashboard();
        }
      });
    });
  }

  // --- 5. Policies UI & Actions ---
  function renderPolicies(policies) {
    const list = document.getElementById('policies-admin-list');
    if (!list) return;

    if (!policies.length) {
      list.innerHTML = '<p style="color:#765e58;">No policies found.</p>';
      return;
    }

    list.innerHTML = policies.map(p => `
      <div class="policy-admin-row">
        <form class="policy-edit-form" data-id="${p.id}">
          <div class="cms-grid-2">
            <div class="form-group"><label>POLICY TITLE</label><input required name="title" value="${escapeHtml(p.title)}"></div>
            <div class="form-group"><label>DISPLAY ORDER</label><input required type="number" min="0" name="display_order" value="${Number(p.display_order || 0)}"></div>
          </div>
          <div class="form-group"><label>DETAILS / BODY</label><textarea required name="body" rows="3">${escapeHtml(p.body)}</textarea></div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="check-label" style="font-size:12px;"><input type="checkbox" name="is_visible" ${p.is_visible !== false ? 'checked' : ''}> VISIBLE ON SITE</label>
            <div style="display:flex; gap:8px;">
              <button type="submit" class="cms-btn cms-btn-primary">SAVE POLICY</button>
              <button type="button" class="cms-btn cms-btn-danger btn-del-policy" data-id="${p.id}">DELETE</button>
            </div>
          </div>
        </form>
      </div>
    `).join('');

    list.querySelectorAll('.policy-edit-form').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const { error } = await client.from('policies').update({
          title: fd.get('title'),
          body: fd.get('body'),
          display_order: Number(fd.get('display_order')),
          is_visible: Boolean(fd.get('is_visible'))
        }).eq('id', f.dataset.id);

        if (error) showToast(error.message, true);
        else { showToast('Policy saved.'); loadDashboard(); }
      });
    });

    list.querySelectorAll('.btn-del-policy').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this policy?')) return;
        const { error } = await client.from('policies').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else { showToast('Policy deleted.'); loadDashboard(); }
      });
    });
  }

  // --- 6. Availability & Hours UI & Actions ---
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function renderAvailabilityRules(rules) {
    const list = document.getElementById('availability-rules-list');
    if (!list) return;

    list.innerHTML = rules.map(r => `
      <form class="availability-rule-form" data-id="${r.id}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border:1px solid var(--admin-border); border-radius:4px; margin-bottom:8px; background:#faf8f5; flex-wrap:wrap; gap:10px;">
        <strong style="width:110px; font-family:var(--mono); font-size:13px;">${dayNames[r.weekday]}</strong>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:11px; font-family:var(--mono); color:#765e58;">OPEN</label>
          <input required type="time" name="start_time" value="${String(r.start_time).slice(0, 5)}" style="padding:4px 8px; border:1px solid var(--admin-border); border-radius:4px;">
          <label style="font-size:11px; font-family:var(--mono); color:#765e58;">CLOSE</label>
          <input required type="time" name="end_time" value="${String(r.end_time).slice(0, 5)}" max="16:00" style="padding:4px 8px; border:1px solid var(--admin-border); border-radius:4px;">
        </div>
        <label class="check-label" style="font-size:12px; font-family:var(--mono);">
          <input type="checkbox" name="is_active" ${r.is_active ? 'checked' : ''}> OPEN
        </label>
        <button type="submit" class="cms-btn cms-btn-outline" style="padding:6px 12px; font-size:10px;">SAVE</button>
      </form>
    `).join('') || '<p style="color:#765e58;">No hours configured.</p>';

    list.querySelectorAll('.availability-rule-form').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const endTime = fd.get('end_time');
        if (endTime > '16:00') {
          showToast('Closing time cannot exceed 4:00 PM (16:00).', true);
          return;
        }

        const { error } = await client.from('availability_rules').update({
          start_time: fd.get('start_time'),
          end_time: endTime,
          is_active: Boolean(fd.get('is_active'))
        }).eq('id', f.dataset.id);

        if (error) showToast(error.message, true);
        else showToast('Working hours saved.');
      });
    });
  }

  function renderBlockedDates(dates) {
    const list = document.getElementById('blocked-date-list');
    if (!list) return;

    list.innerHTML = dates.map(d => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border:1px solid var(--admin-border); border-radius:4px; margin-bottom:6px; background:#faf8f5;">
        <div>
          <strong style="font-size:13px;">${escapeHtml(d.blocked_date)}</strong>
          <span style="font-size:12px; color:#765e58; margin-left:8px;">${escapeHtml(d.reason || 'Blocked')}</span>
        </div>
        <button type="button" class="cms-btn cms-btn-danger btn-del-blocked-date" data-id="${d.id}" style="padding:4px 8px; font-size:10px;">REMOVE</button>
      </div>
    `).join('') || '<p style="color:#765e58; font-size:12px;">No blocked dates.</p>';

    list.querySelectorAll('.btn-del-blocked-date').forEach(b => {
      b.addEventListener('click', async () => {
        const { error } = await client.from('blocked_dates').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else { showToast('Blocked date removed.'); loadDashboard(); }
      });
    });
  }

  function renderBlockedTimes(times) {
    const list = document.getElementById('blocked-time-list');
    if (!list) return;

    list.innerHTML = times.map(t => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border:1px solid var(--admin-border); border-radius:4px; margin-bottom:6px; background:#faf8f5;">
        <div>
          <strong style="font-size:13px;">${escapeHtml(t.blocked_date)} (${escapeHtml(String(t.start_time).slice(0,5))}–${escapeHtml(String(t.end_time).slice(0,5))})</strong>
          <span style="font-size:12px; color:#765e58; margin-left:8px;">${escapeHtml(t.reason || 'Blocked')}</span>
        </div>
        <button type="button" class="cms-btn cms-btn-danger btn-del-blocked-time" data-id="${t.id}" style="padding:4px 8px; font-size:10px;">REMOVE</button>
      </div>
    `).join('') || '<p style="color:#765e58; font-size:12px;">No blocked times.</p>';

    list.querySelectorAll('.btn-del-blocked-time').forEach(b => {
      b.addEventListener('click', async () => {
        const { error } = await client.from('blocked_times').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else { showToast('Blocked time removed.'); loadDashboard(); }
      });
    });
  }

  // --- 7. Payment Methods UI & Actions ---
  function renderPaymentMethods(methods) {
    const list = document.getElementById('payment-methods-list');
    if (!list) return;

    if (!methods.length) {
      list.innerHTML = '<p style="color:#765e58;">No payment methods configured.</p>';
      return;
    }

    list.innerHTML = methods.map(m => `
      <details class="cms-card" style="margin-bottom:12px; padding:16px;">
        <summary style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-family:var(--display); font-size:18px;">
          <span>${escapeHtml(m.name)}</span>
          <span style="font-family:var(--mono); font-size:11px; color:${m.is_active ? '#2d7a38' : '#a23939'}">${m.is_active ? 'ACTIVE' : 'DISABLED'} ▾</span>
        </summary>
        <form class="payment-method-edit-form" data-id="${m.id}" style="margin-top:16px;">
          <div class="cms-grid-3">
            <div class="form-group"><label>NAME</label><input required name="name" value="${escapeHtml(m.name)}"></div>
            <div class="form-group"><label>HANDLE / CASHTAG</label><input name="handle" value="${escapeHtml(m.handle || '')}"></div>
            <div class="form-group"><label>EMAIL</label><input name="email" type="email" value="${escapeHtml(m.email || '')}"></div>
          </div>
          <div class="cms-grid-3">
            <div class="form-group"><label>PHONE</label><input name="phone" value="${escapeHtml(m.phone || '')}"></div>
            <div class="form-group"><label>PAYMENT URL</label><input name="payment_url" type="url" value="${escapeHtml(m.payment_url || '')}"></div>
            <div class="form-group"><label>DISPLAY ORDER</label><input type="number" min="0" name="display_order" value="${Number(m.display_order || 0)}"></div>
          </div>
          <div class="form-group"><label>INSTRUCTIONS FOR CLIENT</label><textarea name="instructions" rows="2">${escapeHtml(m.instructions || '')}</textarea></div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="check-label" style="font-size:12px;"><input type="checkbox" name="is_active" ${m.is_active ? 'checked' : ''}> ACTIVE IN BOOKING CHECKOUT</label>
            <div style="display:flex; gap:8px;">
              <button type="submit" class="cms-btn cms-btn-primary">SAVE METHOD</button>
              <button type="button" class="cms-btn cms-btn-danger btn-del-pm" data-id="${m.id}">DELETE</button>
            </div>
          </div>
        </form>
      </details>
    `).join('');

    list.querySelectorAll('.payment-method-edit-form').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const { error } = await client.from('payment_methods').update({
          name: fd.get('name'),
          handle: fd.get('handle'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          payment_url: fd.get('payment_url'),
          instructions: fd.get('instructions'),
          display_order: Number(fd.get('display_order')),
          is_active: Boolean(fd.get('is_active'))
        }).eq('id', f.dataset.id);

        if (error) showToast(error.message, true);
        else { showToast('Payment method saved.'); loadDashboard(); }
      });
    });

    list.querySelectorAll('.btn-del-pm').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this payment method?')) return;
        const { error } = await client.from('payment_methods').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else { showToast('Payment method deleted.'); loadDashboard(); }
      });
    });
  }

  // --- 8. Social Links & Messages UI & Actions ---
  function renderSocials(socials) {
    const list = document.getElementById('social-links-list');
    if (!list) return;

    list.innerHTML = socials.map(s => `
      <form class="social-edit-form" data-id="${s.id}" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <input name="label" required value="${escapeHtml(s.label)}" style="flex:1; padding:6px 8px; font-size:12px;">
        <input name="url" required type="url" value="${escapeHtml(s.url)}" style="flex:2; padding:6px 8px; font-size:12px;">
        <input name="display_order" type="number" value="${Number(s.display_order || 0)}" style="width:50px; padding:6px 8px; font-size:12px;">
        <label class="check-label" style="font-size:11px;"><input type="checkbox" name="is_active" ${s.is_active !== false ? 'checked' : ''}> Active</label>
        <button type="submit" class="cms-btn cms-btn-outline" style="padding:6px 8px; font-size:10px;">SAVE</button>
        <button type="button" class="cms-btn cms-btn-danger btn-del-social" data-id="${s.id}" style="padding:6px 8px; font-size:10px;">DEL</button>
      </form>
    `).join('') || '<p style="color:#765e58; font-size:12px;">No social links configured.</p>';

    list.querySelectorAll('.social-edit-form').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const { error } = await client.from('social_links').update({
          label: fd.get('label'),
          url: fd.get('url'),
          display_order: Number(fd.get('display_order')),
          is_active: Boolean(fd.get('is_active'))
        }).eq('id', f.dataset.id);

        if (error) showToast(error.message, true);
        else showToast('Social link saved.');
      });
    });

    list.querySelectorAll('.btn-del-social').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Remove this social link?')) return;
        const { error } = await client.from('social_links').delete().eq('id', b.dataset.id);
        if (error) showToast(error.message, true);
        else { showToast('Social link removed.'); loadDashboard(); }
      });
    });
  }

  function renderMessages(messages) {
    const list = document.getElementById('contact-messages-list');
    if (!list) return;

    if (!messages.length) {
      list.innerHTML = '<p style="color:#765e58; font-size:12px;">No incoming messages.</p>';
      return;
    }

    list.innerHTML = messages.map(m => `
      <div style="border:1px solid var(--admin-border); border-radius:6px; padding:12px; margin-bottom:10px; background:${m.is_read ? '#fff' : '#faf3ea'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <strong>${escapeHtml(m.name)} <span style="font-weight:400; color:#765e58;">(${escapeHtml(m.email)})</span></strong>
          <span style="font-family:var(--mono); font-size:10px; color:#765e58;">${new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <p style="margin:4px 0 2px; font-family:var(--mono); font-size:11px; color:#583636;">Topic: ${escapeHtml(m.topic || 'General')}</p>
        <p style="margin:8px 0; font-size:13px; line-height:1.4;">${escapeHtml(m.message)}</p>
        <div style="display:flex; gap:8px; margin-top:8px;">
          ${!m.is_read ? `<button type="button" class="cms-btn cms-btn-outline btn-read-msg" data-id="${m.id}" style="padding:4px 8px; font-size:10px;">MARK READ</button>` : ''}
          <button type="button" class="cms-btn cms-btn-outline btn-archive-msg" data-id="${m.id}" style="padding:4px 8px; font-size:10px;">ARCHIVE</button>
          <button type="button" class="cms-btn cms-btn-danger btn-del-msg" data-id="${m.id}" style="padding:4px 8px; font-size:10px;">DELETE</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-read-msg').forEach(b => {
      b.addEventListener('click', async () => {
        await client.from('contact_messages').update({ is_read: true }).eq('id', b.dataset.id);
        loadDashboard();
      });
    });

    list.querySelectorAll('.btn-archive-msg').forEach(b => {
      b.addEventListener('click', async () => {
        await client.from('contact_messages').update({ archived_at: new Date().toISOString(), is_read: true }).eq('id', b.dataset.id);
        showToast('Message archived.');
        loadDashboard();
      });
    });

    list.querySelectorAll('.btn-del-msg').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Permanently delete this message?')) return;
        await client.from('contact_messages').delete().eq('id', b.dataset.id);
        showToast('Message deleted.');
        loadDashboard();
      });
    });
  }

  // --- Initialize All Forms & Event Listeners ---
  function initForms() {
    // 1. Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('login-status');
        if (status) status.textContent = 'Signing in…';
        const result = await client.auth.signInWithPassword({
          email: loginForm.email.value,
          password: loginForm.password.value
        });
        if (result.error) {
          if (status) status.textContent = result.error.message;
        } else {
          document.getElementById('login-panel')?.classList.add('hidden');
          document.getElementById('dashboard')?.classList.remove('hidden');
          await checkAuthAndBootstrap();
        }
      });
    }

    // 2. Logout Button
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await client.auth.signOut();
        document.getElementById('dashboard')?.classList.add('hidden');
        document.getElementById('login-panel')?.classList.remove('hidden');
      });
    }

    // 3. Refresh All Button
    const refreshBtn = document.getElementById('refresh-all-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        showToast('Refreshing dashboard data…');
        loadDashboard();
      });
    }

    // 4. Toggle & Add Manual Booking
    const toggleBookingBtn = document.getElementById('toggle-manual-booking');
    const manualBookingForm = document.getElementById('manual-booking-form');
    if (toggleBookingBtn && manualBookingForm) {
      toggleBookingBtn.addEventListener('click', () => {
        manualBookingForm.classList.toggle('hidden');
      });

      manualBookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Creating booking…');
        const fd = new FormData(manualBookingForm);
        const values = Object.fromEntries(fd);
        const { data: sessionData } = await client.auth.getSession();

        const res = await fetch('/api/admin-booking-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token || ''}`
          },
          body: JSON.stringify(values)
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(result.error || 'Failed to create booking.', true);
        } else {
          showToast(`Booking ${result.bookingNumber} created successfully!`);
          manualBookingForm.reset();
          manualBookingForm.classList.add('hidden');
          loadDashboard();
        }
      });
    }

    // 5. Toggle & Add New Hairstyle
    const addServiceToggle = document.getElementById('add-service-toggle');
    const newServiceForm = document.getElementById('new-service-form');
    if (addServiceToggle && newServiceForm) {
      addServiceToggle.addEventListener('click', () => {
        newServiceForm.classList.toggle('hidden');
      });

      newServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Creating new hairstyle…');
        const fd = new FormData(newServiceForm);
        const values = Object.fromEntries(fd);

        let imagePath = null;
        const imageFile = fd.get('image_file');
        if (imageFile && imageFile.size > 0) {
          imagePath = `services/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
          const upload = await client.storage.from('hair-media').upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
          if (upload.error) {
            showToast(upload.error.message, true);
            return;
          }
        }

        const slug = `${values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
        const { data: service, error } = await client.from('services').insert({
          name: values.name,
          slug,
          category_id: values.category_id,
          description: values.description,
          notes: values.notes,
          duration_minutes: Number(values.duration_minutes),
          image_path: imagePath,
          display_order: Number(values.display_order),
          is_active: Boolean(values.is_active)
        }).select('id').single();

        if (error) {
          showToast(error.message, true);
          return;
        }

        // Add first length / price option
        await client.from('service_lengths').insert({
          service_id: service.id,
          name: values.price_name,
          price: Number(values.price),
          display_order: 1
        });

        showToast('Hairstyle created successfully!');
        newServiceForm.reset();
        newServiceForm.classList.add('hidden');
        loadDashboard();
      });
    }

    // 6. Add Category Form
    const newCategoryForm = document.getElementById('new-category-form');
    if (newCategoryForm) {
      newCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(newCategoryForm);
        const name = fd.get('name')?.toString().trim();
        if (!name) return;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        showToast('Adding category…');
        const { error } = await client.from('service_categories').insert({
          name,
          slug,
          display_order: 99,
          is_active: true
        });
        if (error) showToast(error.message, true);
        else {
          showToast(`Category "${name}" added!`);
          newCategoryForm.reset();
          loadDashboard();
        }
      });
    }

    // 7. Global delegation for Quick Add Category buttons
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-quick-cat');
      if (!btn) return;
      e.preventDefault();
      const catName = prompt('Enter new category name (e.g. Ponytails, Locs, Weaves):');
      if (!catName || !catName.trim()) return;
      const name = catName.trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      showToast('Creating category…');
      const { data, error } = await client.from('service_categories').insert({
        name,
        slug,
        display_order: 99,
        is_active: true
      }).select('id, name').single();
      if (error) {
        showToast(error.message, true);
      } else {
        showToast(`Category "${name}" created!`);
        await loadDashboard();
        const select = btn.previousElementSibling;
        if (select && select.tagName === 'SELECT' && data?.id) {
          select.value = data.id;
        }
      }
    });

    // 8. New Gallery Form
    const newGalleryForm = document.getElementById('new-gallery-form');
    if (newGalleryForm) {
      newGalleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Uploading photo to gallery…');
        const fd = new FormData(newGalleryForm);
        const file = fd.get('image');
        if (!file || file.size === 0) {
          showToast('Please choose an image file to upload.', true);
          return;
        }

        const path = `gallery/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const upload = await client.storage.from('hair-media').upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) {
          showToast(upload.error.message, true);
          return;
        }

        const { error } = await client.from('gallery_items').insert({
          image_path: path,
          caption: fd.get('caption'),
          alt_text: fd.get('alt_text'),
          category: fd.get('category'),
          display_order: Number(fd.get('display_order') || 10),
          is_active: true
        });

        if (error) {
          await client.storage.from('hair-media').remove([path]);
          showToast(error.message, true);
        } else {
          showToast('Photo uploaded to gallery!');
          newGalleryForm.reset();
          loadDashboard();
        }
      });
    }

    // 9. New Policy Form
    const togglePolicyBtn = document.getElementById('toggle-policy-form');
    const newPolicyForm = document.getElementById('new-policy-form');
    if (togglePolicyBtn && newPolicyForm) {
      togglePolicyBtn.addEventListener('click', () => {
        newPolicyForm.classList.toggle('hidden');
      });

      newPolicyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(newPolicyForm);
        const { error } = await client.from('policies').insert({
          title: fd.get('title'),
          policy_key: fd.get('policy_key'),
          body: fd.get('body'),
          display_order: Number(fd.get('display_order') || 10),
          is_visible: Boolean(fd.get('is_visible'))
        });

        if (error) showToast(error.message, true);
        else {
          showToast('Policy created.');
          newPolicyForm.reset();
          newPolicyForm.classList.add('hidden');
          loadDashboard();
        }
      });
    }

    // 10. Booking Settings Form
    const bookingSettingsForm = document.getElementById('booking-settings-form');
    if (bookingSettingsForm) {
      bookingSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(bookingSettingsForm);
        const { error } = await client.from('booking_settings').update({
          minimum_notice_hours: Number(fd.get('minimum_notice_hours')),
          maximum_advance_days: Number(fd.get('maximum_advance_days')),
          updated_at: new Date().toISOString()
        }).eq('id', 1);

        if (error) showToast(error.message, true);
        else showToast('Advance notice rules saved!');
      });
    }

    // 11. Block Date Form
    const blockDateForm = document.getElementById('block-date-form');
    if (blockDateForm) {
      blockDateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(blockDateForm);
        const { error } = await client.from('blocked_dates').insert({
          blocked_date: fd.get('blocked_date'),
          reason: fd.get('reason') || 'Unavailable'
        });

        if (error) showToast(error.message, true);
        else {
          showToast('Date blocked.');
          blockDateForm.reset();
          loadDashboard();
        }
      });
    }

    // 12. Block Time Form
    const blockTimeForm = document.getElementById('block-time-form');
    if (blockTimeForm) {
      blockTimeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(blockTimeForm);
        const startTime = fd.get('start_time');
        const endTime = fd.get('end_time');
        if (endTime <= startTime) {
          showToast('End time must be after start time.', true);
          return;
        }

        const { error } = await client.from('blocked_times').insert({
          blocked_date: fd.get('blocked_date'),
          start_time: startTime,
          end_time: endTime,
          reason: fd.get('reason') || 'Unavailable'
        });

        if (error) showToast(error.message, true);
        else {
          showToast('Time blocked.');
          blockTimeForm.reset();
          loadDashboard();
        }
      });
    }

    // 13. New Payment Method Form
    const togglePaymentBtn = document.getElementById('toggle-payment-form');
    const newPaymentForm = document.getElementById('new-payment-form');
    if (togglePaymentBtn && newPaymentForm) {
      togglePaymentBtn.addEventListener('click', () => {
        newPaymentForm.classList.toggle('hidden');
      });

      newPaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(newPaymentForm);
        const { error } = await client.from('payment_methods').insert({
          name: fd.get('name'),
          handle: fd.get('handle') || null,
          email: fd.get('email') || null,
          phone: fd.get('phone') || null,
          payment_url: fd.get('payment_url') || null,
          instructions: fd.get('instructions') || null,
          display_order: 99,
          is_active: true
        });

        if (error) showToast(error.message, true);
        else {
          showToast('Payment method added.');
          newPaymentForm.reset();
          newPaymentForm.classList.add('hidden');
          loadDashboard();
        }
      });
    }

    // 14. New Social Link Form
    const newSocialForm = document.getElementById('new-social-form');
    if (newSocialForm) {
      newSocialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(newSocialForm);
        const { error } = await client.from('social_links').insert({
          label: fd.get('label'),
          url: fd.get('url'),
          display_order: 99,
          is_active: true
        });

        if (error) showToast(error.message, true);
        else {
          showToast('Social link added.');
          newSocialForm.reset();
          loadDashboard();
        }
      });
    }

    // Hero image file preview handler
    const heroFileInput = document.getElementById('hero-img-file');
    const heroPreview = document.getElementById('hero-img-preview');
    if (heroFileInput && heroPreview) {
      heroFileInput.addEventListener('change', () => {
        const file = heroFileInput.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            heroPreview.style.backgroundImage = `url('${e.target.result}')`;
            heroPreview.textContent = '';
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  // Auth & Startup Check
  async function checkAuthAndBootstrap() {
    const { data } = await client.auth.getUser();
    if (data?.user) {
      document.getElementById('login-panel')?.classList.add('hidden');
      document.getElementById('dashboard')?.classList.remove('hidden');

      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        await fetch('/api/admin-bootstrap', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
      loadDashboard();
    } else {
      document.getElementById('dashboard')?.classList.add('hidden');
      document.getElementById('login-panel')?.classList.remove('hidden');
    }
  }

  // Initialize runtime when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    initBookingFilters();
    initContentSaveHandlers();
    checkAuthAndBootstrap();
  });

})();
