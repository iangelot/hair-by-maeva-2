const menuButton = document.querySelector('.menu-button');
const drawer = document.querySelector('.nav-drawer');
const drawerClose = document.querySelector('.drawer-close');
const setDrawer = (open) => { drawer.classList.toggle('open', open); menuButton.setAttribute('aria-expanded', String(open)); };
menuButton.addEventListener('click', () => setDrawer(true));
drawerClose.addEventListener('click', () => setDrawer(false));
drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setDrawer(false)));

document.querySelectorAll('.filter').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.service-card').forEach((card) => { card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none'; });
}));

const modal = document.querySelector('#booking-modal');
const selected = { service: '', serviceId: '', length: '', lengthId: '', details: {} };
const catalogOptions = {};
selected.booking = null;
const catalogLengths = {
  'Senegalese Twist': { Bob: 200, Middle: 230, Waist: 260, Butt: 300 },
  'Boho Knotless': { Bob: 180, Middle: 210, Waist: 240 },
  'Soft Locs': { Bob: 220, Middle: 250, Waist: 280 },
};
const syncLengthOptions = () => {
  const available = catalogLengths[selected.service] || {};
  document.querySelectorAll('.length-grid button').forEach((button) => {
    const name = button.dataset.value.split(' — ')[0];
    const price = available[name];
    button.hidden = price === undefined;
    if (price !== undefined) {
      button.dataset.value = `${name} — $${price}`;
      button.querySelector('small').textContent = `$${price}`;
    }
  });
  selected.length = '';
  document.querySelectorAll('.length-grid button').forEach((button) => button.classList.remove('picked'));
  let optionWrap = document.querySelector('#service-options');
  if (!optionWrap) { optionWrap = document.createElement('div'); optionWrap.id = 'service-options'; optionWrap.className = 'service-options'; document.querySelector('.length-grid').after(optionWrap); }
  optionWrap.replaceChildren();
  (catalogOptions[selected.service] || []).forEach((option) => { const label = document.createElement('label'); label.className = 'service-option'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'service-option'; checkbox.value = option.name; checkbox.dataset.delta = option.price_delta; label.append(checkbox, document.createTextNode(`${option.name}${Number(option.price_delta) ? ` (+$${Number(option.price_delta).toFixed(0)})` : ''}`)); optionWrap.append(label); });
};
const paymentStep = document.createElement('div');
paymentStep.className = 'modal-step hidden';
paymentStep.dataset.step = 'payment';
paymentStep.innerHTML = '<p class="eyebrow">05 / 06</p><h2>Choose your<br /><em>payment.</em></h2><div class="payment-method-list" id="payment-method-list"><p class="payment-loading">Loading payment methods…</p></div><div class="payment-instructions hidden" id="payment-instructions"><p class="eyebrow" id="payment-method-name">PAYMENT DETAILS</p><p id="payment-method-copy"></p><a class="pill pill-dark" id="payment-open-link" href="#" target="_blank" rel="noreferrer">OPEN PAYMENT APP ↗</a><button class="modal-next" id="payment-paid">I’VE PAID ↗</button></div>';
document.querySelector('.booking-modal').insertBefore(paymentStep, document.querySelector('.modal-success'));
const paymentMethods = [];
const loadPaymentMethods = async () => {
  const list = paymentStep.querySelector('#payment-method-list');
  try {
    const response = await fetch('/api/payment-methods');
    const methods = await response.json();
    if (!response.ok || !methods.length) throw new Error('Payment methods are not configured yet.');
    paymentMethods.splice(0, paymentMethods.length, ...methods);
    list.innerHTML = methods.map((method) => `<button class="payment-method-option" data-method-id="${method.id}">${method.name}<span>SELECT ↗</span></button>`).join('');
    list.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const method = paymentMethods.find((item) => item.id === button.dataset.methodId);
      if (!method) return;
      paymentStep.querySelector('#payment-method-name').textContent = method.name.toUpperCase();
      paymentStep.querySelector('#payment-method-copy').textContent = method.instructions || [method.handle, method.email, method.phone].filter(Boolean).join(' · ') || 'Use the payment details provided by Maeva.';
      const link = paymentStep.querySelector('#payment-open-link');
      link.href = method.deep_link || method.payment_url || '#';
      link.classList.toggle('hidden', !(method.deep_link || method.payment_url));
      paymentStep.querySelector('#payment-instructions').classList.remove('hidden');
      selected.paymentMethodId = method.id;
    }));
  } catch (error) { list.innerHTML = `<p class="payment-error">${error.message}</p>`; }
};
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
const showStep = (step) => { document.querySelectorAll('.modal-step').forEach((el) => el.classList.toggle('hidden', el.dataset.step !== step)); document.querySelector('.modal-success').classList.add('hidden'); };
const openModal = () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); showStep('service'); };
document.querySelector('#start-booking').addEventListener('click', () => { selected.service = ''; syncLengthOptions(); openModal(); });
document.querySelectorAll('.service-book').forEach((btn) => btn.addEventListener('click', () => { openModal(); selected.service = btn.dataset.service; syncLengthOptions(); showStep('length'); }));
document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-close-success').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.querySelectorAll('.modal-options button').forEach((btn) => btn.addEventListener('click', () => { selected.service = btn.dataset.value; syncLengthOptions(); showStep('length'); }));
document.querySelectorAll('.length-grid button').forEach((btn) => btn.addEventListener('click', () => { document.querySelectorAll('.length-grid button').forEach((b) => b.classList.remove('picked')); btn.classList.add('picked'); selected.length = btn.dataset.value; }));
document.querySelector('.modal-step[data-step="length"] .modal-next').addEventListener('click', () => { if (!selected.length) return alert('Please choose a length.'); showStep('details'); });

document.querySelector('#booking-form').addEventListener('submit', (e) => {
  e.preventDefault(); selected.details = Object.fromEntries(new FormData(e.target)); selected.details.options = [...document.querySelectorAll('input[name="service-option"]:checked')].map((input) => input.value);
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
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selected.details, serviceSlug: selected.service.toLowerCase().replaceAll(' ', '-'), lengthName: selected.length.split(' — ')[0], fullName: selected.details.name }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Booking request failed.');
    selected.booking = result;
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
const dateInput = document.querySelector('input[name="date"]');
dateInput.min = new Date().toISOString().slice(0, 10);
const timeInput = document.querySelector('input[name="time"]');
const timeSelect = document.createElement('select');
timeSelect.name = 'time'; timeSelect.required = true; timeSelect.setAttribute('aria-label', 'Available appointment time');
timeSelect.innerHTML = '<option value="">Choose a date first</option>';
timeInput.replaceWith(timeSelect);
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
  if (!dateInput.value || !selected.service) { timeSelect.innerHTML = '<option value="">Choose a date first</option>'; return; }
  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(dateInput.value)}&serviceSlug=${encodeURIComponent(selected.service.toLowerCase().replaceAll(' ', '-'))}`);
    const data = await response.json();
    if (!response.ok || !data.slots?.length) throw new Error('No appointment times are available on this date.');
    timeSelect.innerHTML = '<option value="">Choose an available time</option>' + data.slots.map((slot) => `<option value="${slot}">${slot}</option>`).join('');
  } catch (error) { timeSelect.innerHTML = `<option value="">${error.message}</option>`; }
}
dateInput.addEventListener('change', loadAvailability);
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
      data.services.forEach((service, index) => {
        const lengths = Object.fromEntries((service.lengths || []).sort((a, b) => a.display_order - b.display_order).map((length) => [length.name, Number(length.price)]));
        catalogLengths[service.name] = lengths;
        catalogOptions[service.name] = (service.options || []).filter((option) => option.is_active !== false);
        const card = document.querySelectorAll('.service-card')[index];
        if (card) {
          card.querySelector('h3').textContent = service.name;
          card.querySelector('.service-from').textContent = Object.values(lengths).length ? `FROM $${Math.min(...Object.values(lengths))}` : 'PRICING AVAILABLE SOON';
          const book = card.querySelector('.service-book'); book.dataset.service = service.name;
        }
        const option = document.querySelectorAll('.modal-options button')[index];
        if (option) { option.dataset.value = service.name; option.firstChild.textContent = `${service.name} `; option.querySelector('span').textContent = Object.values(lengths).length ? `FROM $${Math.min(...Object.values(lengths))}` : 'VIEW DETAILS'; }
      });
    }
    if (Array.isArray(data.categories) && data.categories.length) {
      const filterRow = document.querySelector('.filter-row'); filterRow.replaceChildren();
      const all = document.createElement('button'); all.className = 'filter active'; all.dataset.filter = 'all'; all.textContent = 'All'; filterRow.append(all);
      data.categories.forEach((category) => { const button = document.createElement('button'); button.className = 'filter'; button.dataset.filter = category.slug; button.textContent = category.name; filterRow.append(button); });
      filterRow.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { filterRow.querySelectorAll('.filter').forEach((item) => item.classList.remove('active')); button.classList.add('active'); document.querySelectorAll('.service-card').forEach((card) => { card.style.display = button.dataset.filter === 'all' || card.dataset.category === button.dataset.filter ? '' : 'none'; }); }));
    }
    const heroSection = (data.sections || []).find((section) => section.page_slug === 'home' && section.section_key === 'hero');
    if (heroSection?.content) {
      if (heroSection.content.description) document.querySelector('.hero-copy>p').textContent = heroSection.content.description;
      if (heroSection.content.primaryCta) document.querySelector('.hero-actions .pill').firstChild.textContent = `${heroSection.content.primaryCta} `;
      if (heroSection.content.secondaryCta) document.querySelector('.hero-actions .text-link').firstChild.textContent = `${heroSection.content.secondaryCta} `;
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
