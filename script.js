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
const selected = { service: '', serviceId: '', length: '', lengthId: '', details: {} };
const catalogOptions = {};
const catalogDetails = {};
const catalogServiceIds = {};
const catalogLengthIds = {};
selected.booking = null;
const catalogImages = { 'Senegalese Twist': './assets/web/gallery-1.jpg', 'Boho Knotless': './assets/web/gallery-2.jpg', 'Soft Locs': './assets/web/gallery-3.jpg' };
const catalogLengths = {
  'Senegalese Twist': { Bob: 200, Middle: 230, Waist: 260, Butt: 300 },
  'Boho Knotless': { Bob: 180, Middle: 210, Waist: 240 },
  'Soft Locs': { Bob: 220, Middle: 250, Waist: 280 },
};
const syncLengthOptions = () => {
  const available = catalogLengths[selected.service] || {};
  let preview = document.querySelector('#selected-service-preview');
  if (!preview) { preview = document.createElement('div'); preview.id = 'selected-service-preview'; preview.className = 'selected-service-preview'; const lengthStep = document.querySelector('.modal-step[data-step="length"]'); lengthStep.querySelector('h2').before(preview); }
  preview.style.backgroundImage = catalogImages[selected.service] ? `url("${catalogImages[selected.service]}")` : '';
  preview.textContent = selected.service || 'Choose a service';
  let detailCopy = document.querySelector('#selected-service-details');
  if (!detailCopy) { detailCopy = document.createElement('div'); detailCopy.id = 'selected-service-details'; detailCopy.className = 'selected-service-details'; preview.after(detailCopy); }
  const details = catalogDetails[selected.service] || {};
  detailCopy.replaceChildren();
  [['Description', details.description], ['Notes', details.notes], ['Preparation', details.preparation_instructions]].filter(([, value]) => value).forEach(([label, value]) => { const paragraph = document.createElement('p'); paragraph.innerHTML = `<strong>${label}</strong> `; paragraph.append(document.createTextNode(value)); detailCopy.append(paragraph); });
  detailCopy.classList.toggle('hidden', !detailCopy.children.length);
  document.querySelectorAll('.length-grid button').forEach((button) => {
    const name = button.dataset.value.split(' — ')[0];
    const price = available[name];
    const lengthId = (catalogLengthIds[selected.service] || {})[name];
    button.hidden = price === undefined;
    if (price !== undefined) {
      button.dataset.value = `${name} — $${price}`;
      button.dataset.lengthId = lengthId || '';
      button.querySelector('small').textContent = `$${price}`;
    }
  });
  selected.length = '';
  selected.lengthId = '';
  document.querySelectorAll('.length-grid button').forEach((button) => button.classList.remove('picked'));
  let optionWrap = document.querySelector('#service-options');
  if (!optionWrap) { optionWrap = document.createElement('div'); optionWrap.id = 'service-options'; optionWrap.className = 'service-options'; document.querySelector('.length-grid').after(optionWrap); }
  optionWrap.replaceChildren();
  (catalogOptions[selected.service] || []).forEach((option) => { const label = document.createElement('label'); label.className = 'service-option'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'service-option'; checkbox.value = option.name; checkbox.dataset.delta = option.price_delta; label.append(checkbox, document.createTextNode(`${option.name}${Number(option.price_delta) ? ` (+$${Number(option.price_delta).toFixed(0)})` : ''}`)); optionWrap.append(label); });
};
const paymentStep = document.createElement('div');
document.querySelector('#submit-booking').textContent = 'PROCEED TO PAYMENT ↗';
paymentStep.className = 'modal-step hidden';
paymentStep.dataset.step = 'payment';
paymentStep.innerHTML = '<p class="eyebrow">07 / 07</p><h2>Choose your<br /><em>payment.</em></h2><p class="provider-line"><strong>Hair by Maeva</strong><br>Chicago, IL</p><div class="payment-method-list" id="payment-method-list"><p class="payment-loading">Loading payment methods…</p></div><div class="payment-instructions hidden" id="payment-instructions"><p class="eyebrow" id="payment-method-name">PAYMENT DETAILS</p><p id="payment-method-copy"></p><a class="pill pill-dark" id="payment-open-link" href="#" target="_blank" rel="noreferrer">OPEN PAYMENT APP ↗</a><button class="modal-next" id="payment-paid">I’VE PAID ↗</button></div>';
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
       paymentStep.querySelector('#payment-method-name').textContent = method.name.toUpperCase();
       const copy = paymentStep.querySelector('#payment-method-copy');
       copy.textContent = method.instructions || 'Send the reservation fee, then return here and confirm payment.';
       let accountDetails = paymentStep.querySelector('#payment-account-details');
       if (!accountDetails) { accountDetails = document.createElement('div'); accountDetails.id = 'payment-account-details'; accountDetails.className = 'payment-account-details'; copy.after(accountDetails); }
       accountDetails.replaceChildren();
       [['Handle', method.handle], ['Email', method.email], ['Phone', method.phone]].filter(([, value]) => value).forEach(([label, value]) => { const line = document.createElement('p'); line.innerHTML = `<span>${label}</span><strong></strong>`; line.querySelector('strong').textContent = value; accountDetails.append(line); });
       if (method.qr_code_url || method.qr_code_path) { const qr = document.createElement('img'); qr.src = method.qr_code_url || method.qr_code_path; qr.alt = `${method.name} payment QR code`; qr.className = 'payment-qr'; accountDetails.append(qr); }
      const link = paymentStep.querySelector('#payment-open-link');
      link.href = method.deep_link || method.payment_url || '#';
      link.classList.toggle('hidden', !(method.deep_link || method.payment_url));
      paymentStep.querySelector('#payment-instructions').classList.remove('hidden');
      selected.paymentMethodId = method.id;
      });
    });
  } catch (error) { list.innerHTML = `<p class="payment-error">Payment options are not enabled yet. Maeva’s payment details will appear here as soon as they are configured.</p>`; }
};
let lastFocusedElement = null;
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); lastFocusedElement?.focus(); };
const previousStep = { length: 'service', date: 'length', time: 'date', details: 'time', review: 'details', payment: 'review' };
document.querySelectorAll('.modal-step').forEach((step) => {
  const target = previousStep[step.dataset.step];
  if (!target) return;
  const back = document.createElement('button'); back.type = 'button'; back.className = 'modal-back'; back.textContent = '← BACK'; back.dataset.back = target; step.prepend(back);
});
const showStep = (step) => { document.querySelectorAll('.modal-step').forEach((el) => el.classList.toggle('hidden', el.dataset.step !== step)); document.querySelector('.modal-success').classList.add('hidden'); };
document.querySelector('.booking-modal').addEventListener('click', (event) => { const back = event.target.closest('[data-back]'); if (back) showStep(back.dataset.back); });
const openModal = () => { lastFocusedElement = document.activeElement; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); showStep('service'); modal.querySelector('.modal-close').focus(); };
document.querySelector('#start-booking').addEventListener('click', () => { selected.service = ''; selected.serviceId = ''; syncLengthOptions(); openModal(); });
document.querySelectorAll('.hero-actions .pill, .drawer-book').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); setDrawer(false); selected.service = ''; selected.serviceId = ''; syncLengthOptions(); openModal(); }));
document.querySelectorAll('.service-book').forEach((btn) => { btn.dataset.bound = 'true'; btn.addEventListener('click', () => { openModal(); selected.service = btn.dataset.service; selected.serviceId = catalogServiceIds[selected.service] || ''; syncLengthOptions(); showStep('length'); }); });
document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-close-success').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.querySelectorAll('.modal-options button').forEach((btn) => { btn.dataset.bound = 'true'; btn.addEventListener('click', () => { selected.service = btn.dataset.value; selected.serviceId = catalogServiceIds[selected.service] || ''; syncLengthOptions(); showStep('length'); }); });
document.querySelectorAll('.length-grid button').forEach((btn) => btn.addEventListener('click', () => { document.querySelectorAll('.length-grid button').forEach((b) => b.classList.remove('picked')); btn.classList.add('picked'); selected.length = btn.dataset.value; selected.lengthId = btn.dataset.lengthId || ''; }));
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
  if (!dateInput.value || !selected.service) { timeSelect.innerHTML = '<option value="">Choose a date first</option>'; return false; }
  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(dateInput.value)}&serviceSlug=${encodeURIComponent(selected.service.toLowerCase().replaceAll(' ', '-'))}`);
    const data = await response.json();
    if (!response.ok || !data.slots?.length) throw new Error('No appointment times are available on this date.');
    timeSelect.innerHTML = '<option value="">Choose an available time</option>' + data.slots.map((slot) => `<option value="${slot}">${slot}</option>`).join('');
    return true;
  } catch (error) { timeSelect.innerHTML = `<option value="">${error.message}</option>`; return false; }
}
dateInput.addEventListener('change', loadAvailability);
document.querySelector('#date-next').addEventListener('click', async () => {
  if (!dateInput.value) return alert('Please choose a date.');
  if (!await loadAvailability()) return;
  showStep('time');
});
document.querySelector('#time-next').addEventListener('click', () => {
  if (!timeSelect.value) return alert('Please choose an available time.');
  showStep('details');
});
async function loadPublicContent() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.policies) && data.policies.length) {
      const policyList = document.querySelector('.policy-list'); policyList.replaceChildren();
      data.policies.forEach((policy, index) => { const detail = document.createElement('details'); if (index === 0) detail.open = true; const summary = document.createElement('summary'); summary.append(policy.title, ' ', Object.assign(document.createElement('span'), { textContent: '＋' })); const body = document.createElement('p'); body.textContent = policy.body; detail.append(summary, body); policyList.append(detail); });
    }
    if (Array.isArray(data.services) && data.services.length) {
      const serviceList = document.querySelector('.service-list');
      const serviceTemplate = serviceList.querySelector('.service-card');
      while (serviceList.children.length < data.services.length) { const clone = serviceTemplate.cloneNode(true); clone.querySelector('.service-book').dataset.bound = ''; serviceList.append(clone); }
      Array.from(serviceList.children).forEach((card, index) => { card.hidden = index >= data.services.length; });
      const optionList = document.querySelector('.modal-options');
      const optionTemplate = optionList.querySelector('button');
      while (optionList.children.length < data.services.length) { const clone = optionTemplate.cloneNode(true); clone.dataset.bound = ''; optionList.append(clone); }
      Array.from(optionList.children).forEach((button, index) => { button.hidden = index >= data.services.length; });
      data.services.forEach((service, index) => {
        const lengths = Object.fromEntries((service.lengths || []).sort((a, b) => a.display_order - b.display_order).map((length) => [length.name, Number(length.price)]));
          catalogLengths[service.name] = lengths;
          catalogDetails[service.name] = { description: service.description, notes: service.notes, preparation_instructions: service.preparation_instructions };
          catalogServiceIds[service.name] = service.id;
          catalogLengthIds[service.name] = Object.fromEntries((service.lengths || []).map((length) => [length.name, length.id]));
        catalogOptions[service.name] = (service.options || []).filter((option) => option.is_active !== false);
        const card = document.querySelectorAll('.service-card')[index];
        if (card) {
          card.querySelector('h3').textContent = service.name;
          card.querySelector('.service-from').textContent = Object.values(lengths).length ? `FROM $${Math.min(...Object.values(lengths))}` : 'PRICING AVAILABLE SOON';
          card.dataset.category = service.category?.slug || card.dataset.category;
          const serviceImage = service.image_url || service.image_path;
          if (serviceImage) { const imagePath = /^https?:\/\//.test(serviceImage) ? serviceImage : `/${String(serviceImage).replace(/^\/+/, '')}`; catalogImages[service.name] = imagePath; card.querySelector('.service-image').style.backgroundImage = `url("${imagePath.replaceAll('"', '')}")`; }
          card.querySelector('.service-image').setAttribute('aria-label', `${service.name} hairstyle`);
          const book = card.querySelector('.service-book'); book.dataset.service = service.name;
          if (book.dataset.bound !== 'true') { book.dataset.bound = 'true'; book.addEventListener('click', () => { openModal(); selected.service = book.dataset.service; selected.serviceId = catalogServiceIds[selected.service] || ''; syncLengthOptions(); showStep('length'); }); }
        }
        const option = document.querySelectorAll('.modal-options button')[index];
        if (option) { option.dataset.value = service.name; option.firstChild.textContent = `${service.name} `; option.querySelector('span').textContent = Object.values(lengths).length ? `FROM $${Math.min(...Object.values(lengths))}` : 'VIEW DETAILS'; if (option.dataset.bound !== 'true') { option.dataset.bound = 'true'; option.addEventListener('click', () => { selected.service = option.dataset.value; selected.serviceId = catalogServiceIds[selected.service] || ''; syncLengthOptions(); showStep('length'); }); } }
      });
    }
    if (Array.isArray(data.categories) && data.categories.length) {
      const filterRow = document.querySelector('.filter-row'); filterRow.replaceChildren();
      const all = document.createElement('button'); all.className = 'filter active'; all.dataset.filter = 'all'; all.setAttribute('role', 'tab'); all.setAttribute('aria-selected', 'true'); all.textContent = 'All'; filterRow.append(all);
      data.categories.forEach((category) => { const button = document.createElement('button'); button.className = 'filter'; button.dataset.filter = category.slug; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', 'false'); button.textContent = category.name; filterRow.append(button); });
      filterRow.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { filterRow.querySelectorAll('.filter').forEach((item) => { item.classList.remove('active'); item.setAttribute('aria-selected', String(item === button)); }); button.classList.add('active'); document.querySelectorAll('.service-card').forEach((card) => { card.style.display = button.dataset.filter === 'all' || card.dataset.category === button.dataset.filter ? '' : 'none'; }); }));
    }
    const heroSection = (data.sections || []).find((section) => section.page_slug === 'home' && section.section_key === 'hero');
    const homeSectionNodes = { hero: document.querySelector('.hero'), services: document.querySelector('#services'), gallery: document.querySelector('#gallery'), policies: document.querySelector('#policies'), contact: document.querySelector('#contact'), booking: document.querySelector('#booking') };
    (data.sections || []).filter((section) => section.page_slug === 'home' && !homeSectionNodes[section.section_key]).forEach((section) => {
      const content = section.content || {}; const node = document.createElement('section'); node.className = 'section cms-section'; node.dataset.sectionKey = section.section_key;
      const heading = document.createElement('div'); heading.className = 'section-heading';
      if (content.eyebrow) { const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = content.eyebrow; heading.append(eyebrow); }
      if (content.title || content.heading) { const title = document.createElement('h2'); title.textContent = content.title || content.heading; heading.append(title); }
      if (heading.children.length) node.append(heading);
      if (content.description || content.body) { const copy = document.createElement('p'); copy.textContent = content.description || content.body; node.append(copy); }
      if (content.image || content.imageUrl) { const image = document.createElement('div'); image.className = 'cms-section-image'; image.setAttribute('role', 'img'); image.setAttribute('aria-label', content.altText || content.title || section.section_key); image.style.backgroundImage = `url("${String(content.image || content.imageUrl).replaceAll('"', '')}")`; node.append(image); }
      if (content.primaryCta && content.primaryCtaLink) { const link = document.createElement('a'); link.className = 'pill pill-dark'; link.href = content.primaryCtaLink; link.textContent = content.primaryCta; node.append(link); }
      homeSectionNodes[section.section_key] = node; document.querySelector('main').append(node);
    });
    (data.sectionVisibility || []).forEach((section) => { const node = homeSectionNodes[section.section_key]; if (node) node.hidden = section.is_visible === false; });
    const mainContent = document.querySelector('main');
    const orderedHomeSections = (data.sectionVisibility || []).filter((section) => section.is_visible !== false && homeSectionNodes[section.section_key]).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    orderedHomeSections.forEach((section) => mainContent.append(homeSectionNodes[section.section_key]));
    if (heroSection?.content) {
      const heroTitle = heroSection.content.title || heroSection.content.headline;
      const heroSubtitle = heroSection.content.subtitle || heroSection.content.tagline;
      if (heroTitle) document.querySelector('.hero h1').textContent = heroTitle;
      if (heroSubtitle) document.querySelector('.hero-copy>p').textContent = heroSubtitle;
      if (heroSection.content.description) document.querySelector('.hero-copy>p').textContent = heroSection.content.description;
      if (heroSection.content.primaryCta) document.querySelector('.hero-actions .pill').firstChild.textContent = `${heroSection.content.primaryCta} `;
      if (heroSection.content.secondaryCta) document.querySelector('.hero-actions .text-link').firstChild.textContent = `${heroSection.content.secondaryCta} `;
      if (heroSection.content.primaryCtaLink) document.querySelector('.hero-actions .pill').href = heroSection.content.primaryCtaLink;
      if (heroSection.content.secondaryCtaLink) document.querySelector('.hero-actions .text-link').href = heroSection.content.secondaryCtaLink;
      if (heroSection.content.heroImage || heroSection.content.heroImageUrl) { const heroImage = heroSection.content.heroImage || heroSection.content.heroImageUrl; document.querySelector('.hero-image').style.backgroundImage = `url("${String(heroImage).replaceAll('"', '')}")`; }
    }
    const servicesSection = (data.sections || []).find((section) => section.page_slug === 'home' && section.section_key === 'services');
    if (servicesSection?.content) { const heading = document.querySelector('#services .section-heading'); if (servicesSection.content.eyebrow) heading.querySelector('.eyebrow').textContent = servicesSection.content.eyebrow; if (servicesSection.content.title) heading.querySelector('h2').textContent = servicesSection.content.title; }
    const bookingSection = (data.sections || []).find((section) => section.page_slug === 'home' && section.section_key === 'booking');
    if (bookingSection?.content) { const heading = document.querySelector('#booking'); if (bookingSection.content.eyebrow) heading.querySelector('.eyebrow').textContent = bookingSection.content.eyebrow; if (bookingSection.content.title) heading.querySelector('h2').textContent = bookingSection.content.title; }
    const contactSection = (data.sections || []).find((section) => section.page_slug === 'contact' && section.section_key === 'contact');
    if (contactSection?.content) { const note = document.querySelector('.contact-note'); if (contactSection.content.location) note.querySelector('p:first-child').textContent = contactSection.content.location; if (contactSection.content.email) note.querySelector('p:last-child').textContent = contactSection.content.email; }
    const seoSection = (data.sections || []).find((section) => section.page_slug === 'home' && section.section_key === 'seo');
    if (seoSection?.content) {
      const title = seoSection.content.title || seoSection.content.pageTitle;
      const description = seoSection.content.description || seoSection.content.metaDescription;
      const image = seoSection.content.image || seoSection.content.socialImage;
      if (title) { document.title = title; document.querySelector('meta[property="og:title"]')?.setAttribute('content', title); }
      if (description) { document.querySelector('meta[name="description"]')?.setAttribute('content', description); document.querySelector('meta[property="og:description"]')?.setAttribute('content', description); }
      if (image) document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    }
    if (Array.isArray(data.gallery) && data.gallery.length) {
      document.querySelectorAll('.gallery-grid .gallery-tile').forEach((tile, index) => {
        const item = data.gallery[index]; if (!item || !/^https:\/\//.test(item.public_url)) return;
        tile.style.backgroundImage = `url("${item.public_url.replaceAll('"', '')}")`;
        tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', item.alt_text || item.caption || 'Hair by Maeva hairstyle');
      });
    }
    if (Array.isArray(data.socials) && data.socials.length) {
      const socialNode = document.querySelector('.contact-note p:nth-child(2)');
      socialNode.replaceChildren();
      data.socials.forEach((social, index) => {
        if (index) socialNode.append(' · ');
        const link = document.createElement('a'); link.href = social.url; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = social.label; socialNode.append(link);
      });
    }
  } catch { /* static Figma copy remains available when the API is offline */ }
}
loadPublicContent();
