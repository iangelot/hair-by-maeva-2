const menuButton = document.querySelector('.menu-button');
const drawer = document.querySelector('.nav-drawer');
const drawerClose = document.querySelector('.drawer-close');
const setDrawer = (open) => { drawer.classList.toggle('open', open); menuButton.setAttribute('aria-expanded', String(open)); };
menuButton.addEventListener('click', () => setDrawer(true));
drawerClose.addEventListener('click', () => setDrawer(false));
drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setDrawer(false)));

document.querySelectorAll('.filter').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', String(b === btn)); });
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.service-card').forEach((card) => { card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none'; });
}));

const modal = document.querySelector('#booking-modal');
const selected = { service: '', serviceId: '', length: '', lengthId: '', details: {}, entryPoint: 'general' };
const bookingStepNumbers = { service: '01 / 07', length: '02 / 07', date: '03 / 07', time: '04 / 07', details: '05 / 07', review: '06 / 07' };
Object.entries(bookingStepNumbers).forEach(([step, label]) => { const eyebrow = document.querySelector(`.modal-step[data-step="${step}"] .eyebrow`); if (eyebrow) eyebrow.textContent = label; });
const catalogOptions = {};
const catalogDetails = {};
const catalogServiceIds = {};
const catalogLengthIds = {};
selected.booking = null;
const catalogImageFallbacks = {
  'Senegalese Twist': './assets/styles/senegalese-twist.png', 'French Curly': './assets/styles/french-curly-long.jpeg', 'Ponytail': './assets/styles/pony-tail.jpeg',
  'Fulani Braids': './assets/styles/braid-parting.jpeg', 'Miracles Knotless Braids': './assets/styles/long-box-braids.png', 'Box Braids': './assets/styles/box-braids.png',
  'Jumbo Knotless': './assets/styles/long-box-braids.png', 'Small Knotless': './assets/styles/stitch-braids.jpeg', 'Medium Knotless': './assets/styles/senegalese-twist.png',
  'Xsmall Knotless': './assets/styles/long-braids-ponytail.jpeg', 'Bora Bora Braids': './assets/styles/curly-boho.png', 'Half Side Stitch Braid': './assets/styles/half-side-stitch.jpeg',
  'Micro Twist': './assets/styles/micro-twist.jpeg', 'Boho Knotless': './assets/styles/french-curly.jpeg', 'Soft Locs': './assets/web/gallery-3.jpg'
};
const catalogImages = { ...catalogImageFallbacks };
const applyBackgroundImage = (element, source, fallback) => {
  const safeSource = String(source || '').replaceAll('"', '');
  const safeFallback = String(fallback || '').replaceAll('"', '');
  if (!safeSource) { element.style.backgroundImage = safeFallback ? `url("${safeFallback}")` : ''; return; }
  element.style.backgroundImage = `url("${safeSource}")`;
  if (!safeFallback || safeSource === safeFallback) return;
  const probe = new Image();
  probe.onload = () => { element.style.backgroundImage = `url("${safeSource}")`; };
  probe.onerror = () => { element.style.backgroundImage = `url("${safeFallback}")`; };
  probe.src = safeSource;
};
const catalogLengths = {
  'Senegalese Twist': { Bob: 200, Middle: 230, Waist: 260, Butt: 300 },
  'French Curly': { Medium: 200, Small: 250, Xsmall: 300 },
  'Boho Knotless': { Bob: 230, Middle: 250, Waist: 270, Butt: 330 },
  'Miracles Knotless Braids': { Medium: 180, Small: 220, Xsmall: 250 },
  'Box Braids': { Bob: 200, Middle: 230, Waist: 260, Butt: 300 },
  'Jumbo Knotless': { Bob: 120, Middle: 150, Waist: 200, Butt: 220 },
  'Small Knotless': { Bob: 200, Middle: 220, Waist: 260, Butt: 300 },
  'Medium Knotless': { Bob: 180, Middle: 200, Waist: 230, Butt: 260 },
  'Xsmall Knotless': { Bob: 220, Middle: 250, Waist: 300, Butt: 350 },
  'Bora Bora Braids': { Medium: 250, Small: 300, Xsmall: 350 },
  'Ponytail': { 'Stitch braid': 220, 'Regular braids': 180 },
  'Fulani Braids': { 'Stitch braid': 220, 'Regular braids': 200 },
  'Half Side Stitch Braid': { 'Half side stitch braid': 220 }, 'Micro Twist': { 'Micro twist': 300 },
  'Soft Locs': { Bob: 220, Middle: 250, Waist: 280 },
};
const syncLengthOptions = () => {
  const available = catalogLengths[selected.service] || {};
  const directChoice = ['Ponytail', 'Fulani Braids', 'Half Side Stitch Braid', 'Micro Twist'].includes(selected.service);
  const lengthHeading = document.querySelector('.modal-step[data-step="length"] h2');
  if (lengthHeading) lengthHeading.innerHTML = `Choose your<br /><em>${directChoice ? 'option' : 'length'}.</em>`;
  let preview = document.querySelector('#selected-service-preview');
  if (!preview) { preview = document.createElement('div'); preview.id = 'selected-service-preview'; preview.className = 'selected-service-preview'; const lengthStep = document.querySelector('.modal-step[data-step="length"]'); lengthStep.querySelector('h2').before(preview); }
  applyBackgroundImage(preview, catalogImages[selected.service], catalogImageFallbacks[selected.service]);
  preview.textContent = selected.service || 'Choose a service';
  let detailCopy = document.querySelector('#selected-service-details');
  if (!detailCopy) { detailCopy = document.createElement('div'); detailCopy.id = 'selected-service-details'; detailCopy.className = 'selected-service-details'; preview.after(detailCopy); }
  const details = catalogDetails[selected.service] || {};
  detailCopy.replaceChildren();
  [['Description', details.description], ['Notes', details.notes], ['Preparation', details.preparation_instructions]].filter(([, value]) => value).forEach(([label, value]) => { const paragraph = document.createElement('p'); paragraph.innerHTML = `<strong>${label}</strong> `; paragraph.append(document.createTextNode(value)); detailCopy.append(paragraph); });
  detailCopy.classList.toggle('hidden', !detailCopy.children.length);
  const lengthGrid = document.querySelector('.length-grid');
  lengthGrid.replaceChildren();
  Object.entries(available).forEach(([name, price]) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.value = `${name} — $${price}`; button.dataset.lengthId = (catalogLengthIds[selected.service] || {})[name] || '';
    button.append(document.createTextNode(name.toUpperCase()), Object.assign(document.createElement('small'), { textContent: `$${price}` }));
    lengthGrid.append(button);
  });
  selected.length = '';
  selected.lengthId = '';
  document.querySelectorAll('.length-grid button').forEach((button) => button.classList.remove('picked'));
  let optionWrap = document.querySelector('#service-options');
  if (!optionWrap) { optionWrap = document.createElement('div'); optionWrap.id = 'service-options'; optionWrap.className = 'service-options'; document.querySelector('.length-grid').after(optionWrap); }
  optionWrap.replaceChildren();
  (catalogOptions[selected.service] || []).forEach((option) => { const label = document.createElement('label'); label.className = 'service-option'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'service-option'; checkbox.value = option.name; checkbox.dataset.delta = option.price_delta; checkbox.addEventListener('change', () => label.classList.toggle('is-selected', checkbox.checked)); label.append(checkbox, document.createTextNode(`${option.name}${Number(option.price_delta) ? ` (+$${Number(option.price_delta).toFixed(0)})` : ''}`)); optionWrap.append(label); });
};
const paymentStep = document.createElement('div');
document.querySelector('#submit-booking').textContent = 'PROCEED TO PAYMENT ↗';
paymentStep.className = 'modal-step hidden';
paymentStep.dataset.step = 'payment';
paymentStep.innerHTML = '<p class="eyebrow">07 / 07</p><h2>Choose your<br /><em>payment.</em></h2><p class="provider-line"><strong>Hair by Maeva</strong><br>Chicago, IL</p><div class="payment-method-picker" id="payment-method-picker"><div class="payment-method-list" id="payment-method-list"><p class="payment-loading">Loading payment methods…</p></div></div><div class="payment-instructions hidden" id="payment-instructions"><button type="button" class="payment-details-back" id="payment-details-back">← PAYMENT METHODS</button><p class="eyebrow" id="payment-method-name">PAYMENT DETAILS</p><p id="payment-method-copy"></p><div id="payment-account-details" class="payment-account-details"></div><a class="pill pill-dark" id="payment-open-link" href="#" target="_blank" rel="noreferrer">OPEN PAYMENT APP ↗</a><button class="modal-next" id="payment-paid">I’VE PAID ↗</button></div>';
const paymentBack = document.createElement('button'); paymentBack.type = 'button'; paymentBack.className = 'modal-back'; paymentBack.textContent = '← BACK'; paymentBack.dataset.back = 'review'; paymentStep.prepend(paymentBack);
document.querySelector('.booking-modal').insertBefore(paymentStep, document.querySelector('.modal-success'));
const paymentMethods = [];
const loadPaymentMethods = async () => {
  const list = paymentStep.querySelector('#payment-method-list');
  try {
    const response = await fetch('/api/payment-methods');
    const methods = await response.json();
    if (!response.ok || !methods.length) throw new Error('Payment methods are not configured yet.');
    paymentMethods.splice(0, paymentMethods.length, ...methods);
    list.replaceChildren();
    methods.forEach((method) => {
      const methodButton = document.createElement('button'); methodButton.type = 'button'; methodButton.className = 'payment-method-option'; methodButton.dataset.methodId = method.id;
      methodButton.append(document.createTextNode(method.name || 'Payment method'), Object.assign(document.createElement('span'), { textContent: 'SELECT ↗' })); list.append(methodButton);
      methodButton.addEventListener('click', () => {
      const method = paymentMethods.find((item) => item.id === methodButton.dataset.methodId);
      if (!method) return;
       list.querySelectorAll('.payment-method-option').forEach((item) => item.classList.remove('is-selected'));
       methodButton.classList.add('is-selected');
       paymentStep.querySelector('#payment-method-name').textContent = method.name.toUpperCase();
       const copy = paymentStep.querySelector('#payment-method-copy');
       copy.textContent = method.instructions || 'Send the reservation fee, then return here and confirm payment.';
       const accountDetails = paymentStep.querySelector('#payment-account-details');
       accountDetails.replaceChildren();
       [['Handle', method.handle], ['Email', method.email], ['Phone', method.phone]].filter(([, value]) => value).forEach(([label, value]) => {
         const line = document.createElement('div'); line.className = 'payment-account-line';
         const labelNode = document.createElement('span'); labelNode.textContent = label;
         const valueNode = document.createElement('strong'); valueNode.textContent = value;
         const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.className = 'copy-payment'; copyButton.textContent = 'COPY';
         copyButton.addEventListener('click', async () => { try { await navigator.clipboard.writeText(String(value)); copyButton.textContent = 'COPIED'; setTimeout(() => { copyButton.textContent = 'COPY'; }, 1400); } catch { copyButton.textContent = 'SELECT & COPY'; } });
         line.append(labelNode, valueNode, copyButton); accountDetails.append(line);
       });
       if (method.qr_code_url || method.qr_code_path) { const qr = document.createElement('img'); qr.src = method.qr_code_url || method.qr_code_path; qr.alt = `${method.name} payment QR code`; qr.className = 'payment-qr'; accountDetails.append(qr); }
      const link = paymentStep.querySelector('#payment-open-link');
      link.href = method.deep_link || method.payment_url || '#';
       link.classList.toggle('hidden', !(method.deep_link || method.payment_url));
       paymentStep.querySelector('#payment-method-picker').classList.add('hidden');
       paymentStep.querySelector('#payment-instructions').classList.remove('hidden');
      selected.paymentMethodId = method.id;
      });
    });
    if (!methods.some((method) => /cash\s*app/i.test(method.name || ''))) {
      const unavailable = document.createElement('button'); unavailable.type = 'button'; unavailable.className = 'payment-method-option is-unavailable'; unavailable.disabled = true;
      unavailable.append(document.createTextNode('Cash App'), Object.assign(document.createElement('span'), { textContent: 'DETAILS COMING SOON' })); list.append(unavailable);
    }
  } catch (error) { list.innerHTML = `<p class="payment-error">Payment options are not enabled yet. Maeva’s payment details will appear here as soon as they are configured.</p>`; }
};
paymentStep.querySelector('#payment-details-back').addEventListener('click', () => { paymentStep.querySelector('#payment-instructions').classList.add('hidden'); paymentStep.querySelector('#payment-method-picker').classList.remove('hidden'); });
let lastFocusedElement = null;
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); lastFocusedElement?.focus(); };
const previousStep = { length: 'service', date: 'length', time: 'date', details: 'time', review: 'details', payment: 'review' };
document.querySelectorAll('.modal-step').forEach((step) => {
  const target = previousStep[step.dataset.step];
  if (!target) return;
  const back = document.createElement('button'); back.type = 'button'; back.className = 'modal-back'; back.textContent = '← BACK'; back.dataset.back = target; step.prepend(back);
});
const showStep = (step) => { document.querySelectorAll('.modal-step').forEach((el) => el.classList.toggle('hidden', el.dataset.step !== step)); document.querySelector('.modal-success').classList.add('hidden'); };
document.querySelector('.booking-modal').addEventListener('click', (event) => { const back = event.target.closest('[data-back]'); if (!back) return; if (back.dataset.back === 'service' && selected.entryPoint === 'service-card') { closeModal(); return; } showStep(back.dataset.back); });
const openModal = (entryPoint = 'general') => { selected.entryPoint = entryPoint; lastFocusedElement = document.activeElement; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); showStep('service'); modal.querySelector('.modal-close').focus(); };
const scrollToBooking = () => {
  const bookingSec = document.getElementById('booking');
  if (bookingSec) bookingSec.scrollIntoView({ behavior: 'smooth' });
};
document.querySelector('#start-booking')?.addEventListener('click', (e) => { e.preventDefault(); scrollToBooking(); });
document.querySelectorAll('.hero-actions .pill, .drawer-book').forEach((link) => link.addEventListener('click', (event) => { if (link.getAttribute('href') === '#booking') { event.preventDefault(); setDrawer(false); scrollToBooking(); } }));
document.querySelectorAll('.service-book').forEach((btn) => { btn.dataset.bound = 'true'; btn.addEventListener('click', (e) => { e.preventDefault(); scrollToBooking(); }); });
document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-close-success').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.querySelectorAll('.modal-options button').forEach((btn) => { btn.dataset.bound = 'true'; btn.addEventListener('click', () => { selected.entryPoint = 'general'; document.querySelectorAll('.modal-options button').forEach((item) => item.classList.remove('is-selected')); btn.classList.add('is-selected'); selected.service = btn.dataset.value; selected.serviceId = catalogServiceIds[selected.service] || ''; syncLengthOptions(); showStep('length'); }); });
document.querySelector('.length-grid').addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn) return; document.querySelectorAll('.length-grid button').forEach((item) => item.classList.remove('picked')); btn.classList.add('picked'); selected.length = btn.dataset.value; selected.lengthId = btn.dataset.lengthId || ''; });
document.querySelector('.modal-step[data-step="length"] .modal-next').addEventListener('click', () => { if (!selected.length) return alert('Please choose a length.'); showStep('date'); });

document.querySelector('#booking-form').addEventListener('submit', (e) => {
  e.preventDefault(); selected.details = Object.fromEntries(new FormData(e.target)); selected.details.date = dateInput.value; selected.details.time = timeSelect.value; selected.details.options = [...document.querySelectorAll('input[name="service-option"]:checked')].map((input) => input.value);
  document.querySelector('#review-service').textContent = selected.service;
  document.querySelector('#review-length').textContent = selected.length;
  document.querySelector('#review-date').textContent = selected.details.date;
  document.querySelector('#review-time').textContent = selected.details.time;
  const reviewCard = document.querySelector('.review-card');
  const customerLine = document.querySelector('#review-customer') || Object.assign(document.createElement('p'), { id: 'review-customer' });
  customerLine.textContent = `${selected.details.name} · ${selected.details.email} · ${selected.details.phone}`;
  if (!customerLine.parentElement) reviewCard.append(customerLine);
  const locationLine = document.querySelector('#review-location') || Object.assign(document.createElement('p'), { id: 'review-location' });
  locationLine.textContent = selected.details.location ? `Location: ${selected.details.location}` : '';
  locationLine.classList.toggle('hidden', !selected.details.location);
  if (!locationLine.parentElement) reviewCard.append(locationLine);
  const notesLine = document.querySelector('#review-notes') || Object.assign(document.createElement('p'), { id: 'review-notes' });
  notesLine.textContent = selected.details.notes ? `Notes: ${selected.details.notes}` : '';
  notesLine.classList.toggle('hidden', !selected.details.notes);
  if (!notesLine.parentElement) reviewCard.append(notesLine);
  const servicePrice = Number((selected.length.match(/\$(\d+(?:\.\d+)?)/) || [0, 0])[1]); const optionTotal = (catalogOptions[selected.service] || []).filter((option) => selected.details.options.includes(option.name)).reduce((sum, option) => sum + Number(option.price_delta || 0), 0);
  document.querySelector('#review-options')?.remove();
  if (selected.details.options.length) { const optionLine = document.createElement('p'); optionLine.id = 'review-options'; optionLine.textContent = `Options: ${selected.details.options.join(', ')}`; reviewCard.insertBefore(optionLine, reviewCard.querySelector('.review-line')); }
  document.querySelector('#review-total')?.remove(); document.querySelector('#review-remaining')?.remove();
  const totalLine = document.createElement('p'); totalLine.id = 'review-total'; totalLine.className = 'review-line'; totalLine.innerHTML = `<span>Total</span><strong>$${(servicePrice + optionTotal).toFixed(2)}</strong>`; reviewCard.insertBefore(totalLine, reviewCard.querySelector('.review-line'));
  const remainingLine = document.createElement('p'); remainingLine.id = 'review-remaining'; remainingLine.className = 'review-line'; remainingLine.innerHTML = `<span>Remaining balance</span><strong>$${Math.max(0, servicePrice + optionTotal - 20).toFixed(2)}</strong>`; reviewCard.insertBefore(remainingLine, reviewCard.querySelector('.review-line'));
  showStep('review');
});

document.querySelector('#submit-booking').addEventListener('click', async () => {
  const button = document.querySelector('#submit-booking'); button.disabled = true; button.textContent = 'SENDING…';
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selected.details, serviceId: selected.serviceId || undefined, serviceSlug: selected.service.toLowerCase().replaceAll(' ', '-'), lengthId: selected.lengthId || undefined, lengthName: selected.length.split(' — ')[0], fullName: selected.details.name }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Booking request failed.');
    selected.booking = result;
    if (Number.isFinite(Number(result.totalPrice))) {
      const totalLine = document.querySelector('#review-total strong');
      const feeLine = [...document.querySelectorAll('.review-card .review-line')].find((line) => line.querySelector('span')?.textContent.trim().toLowerCase() === 'reservation fee')?.querySelector('strong');
      const remainingLine = document.querySelector('#review-remaining strong');
      if (totalLine) totalLine.textContent = `$${Number(result.totalPrice).toFixed(2)}`;
      if (feeLine && Number.isFinite(Number(result.reservationFee))) feeLine.textContent = `$${Number(result.reservationFee).toFixed(2)}`;
      if (remainingLine && Number.isFinite(Number(result.remainingBalance))) remainingLine.textContent = `$${Number(result.remainingBalance).toFixed(2)}`;
    }
    button.disabled = false; button.textContent = 'PROCEED TO PAYMENT ↗';
    await loadPaymentMethods(); showStep('payment');
  } catch (error) { button.disabled = false; button.textContent = 'PROCEED TO PAYMENT ↗'; alert(error.message); }
});

paymentStep.querySelector('#payment-paid').addEventListener('click', async () => {
  if (!selected.booking?.accessUrl || !selected.paymentMethodId) return alert('Choose a payment method first.');
  const button = paymentStep.querySelector('#payment-paid'); button.disabled = true; button.textContent = 'SUBMITTING…';
  try {
    const token = new URL(selected.booking.accessUrl, location.origin).searchParams.get('token');
    const response = await fetch('/api/payment-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, methodId: selected.paymentMethodId }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Payment submission failed.');
    document.querySelectorAll('.modal-step').forEach((el) => el.classList.add('hidden')); document.querySelector('.modal-success').classList.remove('hidden');
    document.querySelector('.modal-success .eyebrow').textContent = 'PAYMENT SUBMITTED';
    document.querySelector('.modal-success p:not(.eyebrow)').textContent = 'Thank you. Your payment is awaiting manual verification. Check your email for updates.';
  } catch (error) { button.disabled = false; button.textContent = 'I’VE PAID ↗'; alert(error.message); }
});

document.querySelector('#contact-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.currentTarget; const status = form.querySelector('.form-status'); const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Sending…';
  try { const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to send.'); form.reset(); status.textContent = 'Message sent — I’ll be in touch soon.'; } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
});
document.addEventListener('keydown', (e) => {
  if (!modal.classList.contains('open')) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter((item) => !item.closest('.hidden'));
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
const dateInput = document.querySelector('input[name="date"]');
dateInput.min = new Date().toISOString().slice(0, 10);
const timeSelect = document.querySelector('select[name="time"]');
timeSelect.setAttribute('aria-label', 'Available appointment time');
const timeOptions = document.querySelector('#time-options');
const dateHelper = document.querySelector('.modal-step[data-step="date"] .step-helper');
const dateNext = document.querySelector('#date-next');
const detailsForm = document.querySelector('#booking-form');
const phoneField = detailsForm.querySelector('input[name="phone"]');
if (!detailsForm.querySelector('[name="location"]')) {
  const locationLabel = document.createElement('label'); locationLabel.textContent = 'LOCATION / ADDRESS (OPTIONAL)';
  const locationInput = document.createElement('input'); locationInput.name = 'location'; locationInput.placeholder = 'Your preferred location'; locationLabel.append(locationInput); phoneField.closest('label').after(locationLabel);
  const notesLabel = document.createElement('label'); notesLabel.textContent = 'ADDITIONAL NOTES (OPTIONAL)';
  const notesInput = document.createElement('textarea'); notesInput.name = 'notes'; notesInput.rows = 3; notesInput.placeholder = 'Anything Maeva should know?'; notesLabel.append(notesInput); locationLabel.after(notesLabel);
}
async function loadAvailability() {
  timeSelect.innerHTML = '<option value="">Loading available times…</option>';
  timeOptions.replaceChildren();
  dateNext.disabled = true;
  if (dateHelper) { dateHelper.textContent = 'Checking available appointment times…'; dateHelper.classList.remove('availability-error'); }
  if (!dateInput.value || !selected.service) { timeSelect.innerHTML = '<option value="">Choose a date first</option>'; return false; }
  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(dateInput.value)}&serviceSlug=${encodeURIComponent(selected.service.toLowerCase().replaceAll(' ', '-'))}`);
    const data = await response.json();
    if (!response.ok || !data.slots?.length) throw new Error('No appointment times are available on this date.');
    timeSelect.innerHTML = '<option value="">Choose an available time</option>' + data.slots.map((slot) => `<option value="${slot}">${slot}</option>`).join('');
    data.slots.forEach((slot) => {
      const option = document.createElement('button');
      option.type = 'button'; option.className = 'time-option'; option.textContent = slot;
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      option.addEventListener('click', () => {
        timeSelect.value = slot;
        timeOptions.querySelectorAll('.time-option').forEach((item) => { item.classList.remove('is-selected'); item.setAttribute('aria-selected', 'false'); });
        option.classList.add('is-selected'); option.setAttribute('aria-selected', 'true');
      });
      timeOptions.append(option);
    });
    if (dateHelper) dateHelper.textContent = 'Times found — choose one to continue.';
    dateNext.disabled = false;
    return true;
  } catch (error) { timeSelect.innerHTML = `<option value="">${error.message}</option>`; if (dateHelper) { dateHelper.textContent = error.message; dateHelper.classList.add('availability-error'); } return false; }
}
dateInput.addEventListener('change', loadAvailability);
dateNext.addEventListener('click', async () => {
  if (!dateInput.value) return alert('Please choose a date.');
  if (!await loadAvailability()) return;
  showStep('time');
});
document.querySelector('#time-next').addEventListener('click', () => {
  if (!timeSelect.value) return alert('Please choose an available time.');
  showStep('details');
});

function renderFormattedHeading(text, fallbackEm = true) {
  if (!text) return '';
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 1) return lines[0];
  if (lines.length === 2 && fallbackEm) {
    return `${lines[0]}<br /><em>${lines[1]}</em>`;
  }
  if (lines.length >= 3 && fallbackEm) {
    return `${lines[0]}<br /><em>${lines[1]}</em><br />${lines.slice(2).join('<br />')}`;
  }
  return lines.join('<br />');
}

async function loadPublicContent() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const data = await response.json();

    // 1. Policies Accordion
    if (Array.isArray(data.policies) && data.policies.length) {
      const policyList = document.querySelector('.policy-list');
      if (policyList) {
        policyList.replaceChildren();
        data.policies.forEach((policy, index) => {
          const detail = document.createElement('details');
          if (index === 0) detail.open = true;
          const summary = document.createElement('summary');
          summary.append(document.createTextNode(policy.title), ' ', Object.assign(document.createElement('span'), { textContent: '＋' }));
          const body = document.createElement('p');
          body.textContent = policy.body;
          detail.append(summary, body);
          policyList.append(detail);
        });
      }
    }

    // 2. Services List & Dynamic Catalog
    if (Array.isArray(data.services) && data.services.length) {
      const serviceList = document.querySelector('.service-list');
      if (serviceList) {
        serviceList.replaceChildren();
        data.services.forEach((service) => {
          const lengths = Object.fromEntries((service.lengths || []).sort((a, b) => a.display_order - b.display_order).map((l) => [l.name, Number(l.price)]));
          catalogLengths[service.name] = lengths;
          catalogDetails[service.name] = { description: service.description, notes: service.notes, preparation_instructions: service.preparation_instructions };
          catalogServiceIds[service.name] = service.id;
          catalogLengthIds[service.name] = Object.fromEntries((service.lengths || []).map((l) => [l.name, l.id]));
          catalogOptions[service.name] = (service.options || []).filter((opt) => opt.is_active !== false);

          const card = document.createElement('article');
          card.className = 'service-card';
          card.dataset.category = service.category?.slug || 'braids';

          const imageDiv = document.createElement('div');
          imageDiv.className = 'service-image';
          imageDiv.setAttribute('role', 'img');
          imageDiv.setAttribute('aria-label', `${service.name} hairstyle`);
          const serviceImage = service.image_url || service.image_path;
          if (serviceImage) {
            const imagePath = /^https?:\/\//.test(serviceImage) ? serviceImage : `/${String(serviceImage).replace(/^\/+/, '')}`;
            catalogImages[service.name] = imagePath;
            applyBackgroundImage(imageDiv, imagePath, catalogImageFallbacks[service.name]);
          }

          const infoDiv = document.createElement('div');
          infoDiv.className = 'service-info';
          const title = document.createElement('h3');
          title.textContent = service.name;
          const priceP = document.createElement('p');
          priceP.className = 'service-from';
          const prices = Object.values(lengths);
          priceP.textContent = prices.length ? `FROM $${Math.min(...prices)}` : 'PRICING AVAILABLE SOON';

          const bookBtn = document.createElement('button');
          bookBtn.className = 'service-book';
          bookBtn.dataset.service = service.name;
          bookBtn.dataset.bound = 'true';
          bookBtn.innerHTML = 'BOOK NOW <span>↗</span>';
          bookBtn.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToBooking();
          });

          infoDiv.append(title, priceP, bookBtn);
          card.append(imageDiv, infoDiv);
          serviceList.append(card);
        });
      }

      // Modal service options list
      const optionList = document.querySelector('.modal-options');
      if (optionList) {
        optionList.replaceChildren();
        data.services.forEach((service) => {
          const lengths = Object.values(catalogLengths[service.name] || {});
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.value = service.name;
          button.dataset.bound = 'true';
          button.append(document.createTextNode(`${service.name} `), Object.assign(document.createElement('span'), { textContent: lengths.length ? `FROM $${Math.min(...lengths)}` : 'VIEW DETAILS' }));
          button.addEventListener('click', () => {
            selected.entryPoint = 'general';
            selected.service = button.dataset.value;
            selected.serviceId = catalogServiceIds[selected.service] || '';
            syncLengthOptions();
            showStep('length');
          });
          optionList.append(button);
        });
      }
    }

    // 3. Category Filter Tabs
    if (Array.isArray(data.categories) && data.categories.length) {
      const filterRow = document.querySelector('.filter-row');
      if (filterRow) {
        filterRow.replaceChildren();
        const all = document.createElement('button');
        all.className = 'filter active';
        all.dataset.filter = 'all';
        all.setAttribute('role', 'tab');
        all.setAttribute('aria-selected', 'true');
        all.textContent = 'All';
        filterRow.append(all);
        data.categories.forEach((category) => {
          const button = document.createElement('button');
          button.className = 'filter';
          button.dataset.filter = category.slug;
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', 'false');
          button.textContent = category.name;
          filterRow.append(button);
        });
        filterRow.querySelectorAll('.filter').forEach((button) => {
          button.addEventListener('click', () => {
            filterRow.querySelectorAll('.filter').forEach((item) => {
              item.classList.remove('active');
              item.setAttribute('aria-selected', String(item === button));
            });
            button.classList.add('active');
            document.querySelectorAll('.service-card').forEach((card) => {
              card.style.display = button.dataset.filter === 'all' || card.dataset.category === button.dataset.filter ? '' : 'none';
            });
          });
        });
      }
    }

    // 4. Section Headings & Text
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const heroSection = sections.find((s) => s.section_key === 'hero');
    if (heroSection?.content) {
      const hc = heroSection.content;
      if (hc.eyebrow) {
        const eyebrow = document.querySelector('.hero-mark');
        if (eyebrow) eyebrow.textContent = hc.eyebrow;
      }
      if (hc.title) {
        const h1 = document.querySelector('.hero h1');
        if (h1) h1.innerHTML = renderFormattedHeading(hc.title);
      }
      if (hc.description || hc.subtitle) {
        const p = document.querySelector('.hero-copy > p');
        if (p) p.textContent = hc.description || hc.subtitle;
      }
      if (hc.primaryCtaText || hc.primaryCta) {
        const pCta = document.querySelector('.hero-actions .pill');
        if (pCta) pCta.textContent = hc.primaryCtaText || hc.primaryCta;
      }
      if (hc.secondaryCtaText || hc.secondaryCta) {
        const sCta = document.querySelector('.hero-actions .text-link');
        if (sCta) sCta.innerHTML = `${hc.secondaryCtaText || hc.secondaryCta} <span>↓</span>`;
      }
      if (hc.imageUrl || hc.image) {
        const heroImg = document.querySelector('.hero-image');
        if (heroImg) applyBackgroundImage(heroImg, hc.imageUrl || hc.image, './assets/web/hero.jpg');
      }
    }

    const servicesSection = sections.find((s) => s.section_key === 'services');
    if (servicesSection?.content) {
      const heading = document.querySelector('#services .section-heading');
      if (heading) {
        if (servicesSection.content.eyebrow) heading.querySelector('.eyebrow').textContent = servicesSection.content.eyebrow;
        if (servicesSection.content.title) heading.querySelector('h2').innerHTML = renderFormattedHeading(servicesSection.content.title);
      }
    }

    const gallerySection = sections.find((s) => s.section_key === 'gallery');
    if (gallerySection?.content) {
      const heading = document.querySelector('#gallery .section-heading');
      if (heading) {
        if (gallerySection.content.eyebrow) heading.querySelector('.eyebrow').textContent = gallerySection.content.eyebrow;
        if (gallerySection.content.title) heading.querySelector('h2').innerHTML = renderFormattedHeading(gallerySection.content.title);
      }
    }

    const policiesSection = sections.find((s) => s.section_key === 'policies');
    if (policiesSection?.content) {
      const heading = document.querySelector('#policies .section-heading');
      if (heading) {
        if (policiesSection.content.eyebrow) heading.querySelector('.eyebrow').textContent = policiesSection.content.eyebrow;
        if (policiesSection.content.title) heading.querySelector('h2').innerHTML = renderFormattedHeading(policiesSection.content.title);
      }
    }

    const bookingSection = sections.find((s) => s.section_key === 'booking');
    if (bookingSection?.content) {
      const panel = document.querySelector('#booking');
      if (panel) {
        if (bookingSection.content.eyebrow) panel.querySelector('.eyebrow').textContent = bookingSection.content.eyebrow;
        if (bookingSection.content.title) panel.querySelector('h2').innerHTML = renderFormattedHeading(bookingSection.content.title);
        if (bookingSection.content.buttonText) panel.querySelector('button').innerHTML = `${bookingSection.content.buttonText} <span>↗</span>`;
      }
    }

    const contactSection = sections.find((s) => s.section_key === 'contact');
    if (contactSection?.content) {
      const cc = contactSection.content;
      const copy = document.querySelector('.contact-copy');
      if (copy) {
        if (cc.eyebrow) copy.querySelector('.eyebrow').textContent = cc.eyebrow;
        if (cc.title) copy.querySelector('h2').innerHTML = renderFormattedHeading(cc.title);
        if (cc.description) {
          const descP = copy.querySelector('p:not(.eyebrow):not(.form-status)');
          if (descP) descP.textContent = cc.description;
        }
      }
      const note = document.querySelector('.contact-note');
      if (note) {
        if (cc.city) note.querySelector('p:first-child').textContent = cc.city;
        if (cc.email) note.querySelector('p:last-child').textContent = cc.email;
      }
    }

    const footerSection = sections.find((s) => s.section_key === 'footer');
    if (footerSection?.content) {
      const footer = document.querySelector('footer');
      if (footer) {
        if (footerSection.content.brandName) footer.querySelector('span:first-child').textContent = footerSection.content.brandName;
        const copyText = footerSection.content.copyright || footerSection.content.copyrightText;
        if (copyText) footer.querySelector('span:last-child').textContent = copyText;
      }
    }

    // 5. Dynamic Gallery Grid
    if (Array.isArray(data.gallery) && data.gallery.length) {
      const galleryGrid = document.querySelector('.gallery-grid');
      if (galleryGrid) {
        galleryGrid.replaceChildren();
        data.gallery.forEach((item, index) => {
          const figure = document.createElement('figure');
          let tileClass = 'gallery-tile';
          if (index === 0) tileClass += ' gallery-tile-feature';
          else if (index === 3) tileClass += ' gallery-tile-wide';
          else if (index === 5) tileClass += ' gallery-tile-tall';
          figure.className = tileClass;

          const img = document.createElement('img');
          const imageSrc = item.public_url || item.image_path;
          img.src = /^https?:\/\//.test(imageSrc) ? imageSrc : `/${String(imageSrc).replace(/^\/+/, '')}`;
          img.alt = item.alt_text || item.caption || 'Hair by Maeva hairstyle';
          img.loading = 'lazy';
          figure.append(img);
          galleryGrid.append(figure);
        });
      }
    }

    // 6. Dynamic Social Links
    if (Array.isArray(data.socials) && data.socials.length) {
      const socialNode = document.querySelector('.contact-note p:nth-child(2)');
      if (socialNode) {
        socialNode.replaceChildren();
        data.socials.forEach((social, index) => {
          if (index) socialNode.append(' · ');
          const link = document.createElement('a');
          link.href = social.url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = social.label;
          socialNode.append(link);
        });
      }
    }

    // 7. SEO Meta Tags
    const seoSection = sections.find((s) => s.section_key === 'seo');
    if (seoSection?.content) {
      const title = seoSection.content.title || seoSection.content.pageTitle;
      const description = seoSection.content.description || seoSection.content.metaDescription;
      const image = seoSection.content.image || seoSection.content.socialImage;
      if (title) { document.title = title; document.querySelector('meta[property="og:title"]')?.setAttribute('content', title); }
      if (description) { document.querySelector('meta[name="description"]')?.setAttribute('content', description); document.querySelector('meta[property="og:description"]')?.setAttribute('content', description); }
      if (image) document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    }
  } catch (error) {
    console.warn('Using offline fallback content:', error);
  }
}
loadPublicContent();
