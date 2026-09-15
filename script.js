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
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
const showStep = (step) => { document.querySelectorAll('.modal-step').forEach((el) => el.classList.toggle('hidden', el.dataset.step !== step)); document.querySelector('.modal-success').classList.add('hidden'); };
const openModal = () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); showStep('service'); };
document.querySelector('#start-booking').addEventListener('click', openModal);
document.querySelectorAll('.service-book').forEach((btn) => btn.addEventListener('click', () => { openModal(); selected.service = btn.dataset.service; showStep('length'); }));
document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-close-success').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.querySelectorAll('.modal-options button').forEach((btn) => btn.addEventListener('click', () => { selected.service = btn.dataset.value; showStep('length'); }));
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
    document.querySelectorAll('.modal-step').forEach((el) => el.classList.add('hidden')); document.querySelector('.modal-success').classList.remove('hidden');
  } catch (error) { button.disabled = false; button.textContent = 'SUBMIT REQUEST ↗'; alert(error.message); }
});

document.querySelector('#contact-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.currentTarget; const status = form.querySelector('.form-status'); const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Sending…';
  try { const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to send.'); form.reset(); status.textContent = 'Message sent — I’ll be in touch soon.'; } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
