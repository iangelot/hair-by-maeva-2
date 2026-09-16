const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabaseHeaders() {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function supabase(path, options = {}) {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase request failed (${response.status})`);
  return data;
}

async function supabasePublic(path, options = {}) {
  const key = env('SUPABASE_PUBLISHABLE_KEY');
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase request failed (${response.status})`);
  return data;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function body(req, maxLimit = 20_000_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxLimit) throw new Error('Request body is too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function tokenPair() {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const key = crypto.createHash('sha256').update(env('SUPABASE_SERVICE_ROLE_KEY')).digest();
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { token, hash, ciphertext: `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}` };
}

function decryptToken(ciphertext) {
  const [ivValue, tagValue, encryptedValue] = String(ciphertext || '').split('.');
  if (!ivValue || !tagValue || !encryptedValue) return '';
  const key = crypto.createHash('sha256').update(env('SUPABASE_SERVICE_ROLE_KEY')).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url')); decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function appointmentDateTime(date, time = '00:00') {
  const match = /^(\d{4})-(\d{2})-(\d{2})T?(\d{2}):(\d{2})/.exec(`${date}T${time}`);
  if (!match) return new Date(NaN);
  const [, year, month, day, hour, minute] = match;
  const guess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const chicagoAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(guess + (guess - chicagoAsUtc));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Email clients vary widely in their support for custom fonts. Apple Mail and
// some Outlook clients can load the brand font below; Gmail reliably uses the
// carefully chosen fallbacks instead.
function brandedEmail({ eyebrow = 'HAIR BY MAEVA', title, greeting = '', content, footer = 'With love,<br><strong>Maeva</strong>' }) {
  const fontUrl = `${env('PUBLIC_SITE_URL').replace(/\/$/, '')}/Blowreph.ttf`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:'Blowreph';src:url('${fontUrl}') format('truetype');font-weight:400;font-style:normal}.email-wrap{background:#f5efe6;padding:28px 12px}.email-card{max-width:620px;margin:0 auto;background:#fffaf4;color:#4d2c2e}.email-brand{background:#4d2c2e;color:#f5efe6;padding:28px;text-align:center}.email-eyebrow{font:12px/1.3 'Blowreph',Georgia,serif;letter-spacing:3px;margin:0}.email-title{font:32px/1.15 'Blowreph',Georgia,serif;margin:16px 0 0}.email-body{padding:30px 28px;font:16px/1.65 Arial,sans-serif}.email-body h2{font:25px/1.2 'Blowreph',Georgia,serif;margin:0 0 16px}.email-footer{padding:20px;text-align:center;color:#765e58;font:13px/1.5 Arial,sans-serif}.email-footer strong{color:#4d2c2e;font-family:'Blowreph',Georgia,serif}@media(max-width:620px){.email-wrap{padding:0}.email-body{padding:24px 20px}.email-brand{padding:24px 20px}}</style></head><body style="margin:0;padding:0;background:#f5efe6"><div class="email-wrap"><div class="email-card"><div class="email-brand"><p class="email-eyebrow">${eyebrow}</p><h1 class="email-title">${title}</h1></div><div class="email-body">${greeting ? `<p style="margin-top:0;font-size:18px">${greeting}</p>` : ''}${content}</div><div class="email-footer">${footer}</div></div></div></body></html>`;
}

function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const plainText = text || htmlToPlainText(html);
  if (process.env.GMAIL_SMTP_EMAIL && process.env.GMAIL_SMTP_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: env('GMAIL_SMTP_EMAIL'), pass: env('GMAIL_SMTP_APP_PASSWORD') } });
    return transporter.sendMail({ from: `Hair by Maeva <${env('GMAIL_SMTP_EMAIL')}>`, to, subject, html, text: plainText, ...(replyTo ? { replyTo } : {}) });
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('RESEND_FROM_EMAIL'), to, subject, html, text: plainText, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) throw new Error(`Resend request failed (${response.status})`);
  return response.json();
}

async function trySendEmail(options) {
  try { await sendEmail(options); return true; } catch (error) { console.error('Transactional email failed:', error.message); return false; }
}

async function trySendTemplatedEmail({ templateKey, variables = {}, ...fallback }) {
  let message = fallback;
  try {
    const templates = await supabase(`email_templates?template_key=eq.${encodeURIComponent(templateKey)}&is_active=eq.true&select=subject,html_body&limit=1`);
    if (templates[0]) {
      const replace = (value) => String(value || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => escapeHtml(variables[key] ?? ''));
      const renderedHtml = replace(templates[0].html_body);
      // Keep the secure access link and booking identifier in transactional mail even
      // when an older CMS template does not yet contain those variables.
      const requiredMarkers = ['booking_number', 'manage_url', 'message', 'topic'].filter((key) => variables[key] && !renderedHtml.includes(String(variables[key])));
      // Seed templates may contain only placeholder copy. When they omit the
      // booking-specific markers, use the complete server-generated fallback
      // so customers always receive the actionable details and secure link.
      message = { ...fallback, subject: replace(templates[0].subject), html: requiredMarkers.length && fallback.html ? fallback.html : renderedHtml };
    }
  } catch (error) { console.error('Email template lookup failed:', error.message); }
  return trySendEmail(message);
}

function adminRecipients() {
  return [...new Set([env('ADMIN_EMAIL'), ...(process.env.ADMIN_ROUTING_EMAIL ? [process.env.ADMIN_ROUTING_EMAIL] : [])].filter(Boolean))];
}

async function requireAdmin(req) {
  const authorization = req.headers?.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  const userResponse = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${accessToken}` } });
  if (!userResponse.ok) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  const user = await userResponse.json();
  const admins = await supabase(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!admins.length) throw Object.assign(new Error('Administrator access required.'), { statusCode: 403 });
  return user;
}

module.exports = { adminRecipients, appointmentDateTime, body, brandedEmail, clean, decryptToken, env, escapeHtml, json, requireAdmin, sendEmail, supabase, supabasePublic, tokenPair, trySendEmail, trySendTemplatedEmail };
