const crypto = require('node:crypto');

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

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (raw.length > 100_000) throw new Error('Request body is too large');
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

async function sendEmail({ to, subject, html, replyTo }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('RESEND_FROM_EMAIL'), to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) throw new Error(`Resend request failed (${response.status})`);
  return response.json();
}

async function trySendEmail(options) {
  try { await sendEmail(options); return true; } catch (error) { console.error('Transactional email failed:', error.message); return false; }
}

function adminRecipients() {
  return [env('ADMIN_EMAIL'), ...(process.env.ADMIN_ROUTING_EMAIL ? [process.env.ADMIN_ROUTING_EMAIL] : [])];
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

module.exports = { adminRecipients, body, clean, decryptToken, env, json, requireAdmin, sendEmail, supabase, supabasePublic, tokenPair, trySendEmail };
