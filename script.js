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
  e.preventDefault(); selected.details = Object.fromEntries(new FormData(e.target));
  document.querySelector('#review-service').textContent = selected.service;
  document.querySelector('#review-length').textContent = selected.length;
  document.querySelector('#review-date').textContent = selected.details.date;
  document.querySelector('#review-time').textContent = selected.details.time;
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
async function loadPublicContent() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.policies) && data.policies.length) {
      document.querySelectorAll('.policy-list details').forEach((detail, index) => {
        const policy = data.policies[index];
        if (!policy) return;
        detail.querySelector('summary').firstChild.textContent = policy.title + ' ';
        detail.querySelector('p').textContent = policy.body;
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
