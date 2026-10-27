import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export async function bodyJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  }
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 20000) throw new HttpError(413, 'Request is too large.');
  }
  try { return JSON.parse(data || '{}'); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

export function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) {
    throw new HttpError(405, 'Method not allowed.');
  }
}

export function normalizePhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = `20${phone.slice(1)}`;
  if (phone.length < 10 || phone.length > 15) throw new HttpError(400, 'رقم الهاتف غير صحيح.');
  return phone;
}

function config(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(503, 'الخدمة لم تُضبط بعد. أكمل إعدادات Vercel الموضحة في README ثم أعد النشر.');
  return value;
}

export function requireCoreConfig() {
  config('SUPABASE_URL');
  // Prefer Supabase's current server-only secret key (sb_secret_...).
  // Keep the legacy service_role variable as a backwards-compatible fallback.
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'أضف SUPABASE_SECRET_KEY في إعدادات Vercel باستخدام المفتاح السري sb_secret_ من Supabase.');
  }
  if (config('SESSION_SECRET').length < 32) throw new HttpError(503, 'SESSION_SECRET لازم يكون 32 حرفًا على الأقل.');
  if (config('OTP_HMAC_SECRET').length < 32) throw new HttpError(503, 'OTP_HMAC_SECRET لازم يكون 32 حرفًا على الأقل.');
}

export async function dbRequest(path, options = {}) {
  const base = config('SUPABASE_URL').replace(/\/$/, '');
  // New sb_secret_ keys are not JWTs: send them in `apikey` only.
  // Legacy service_role keys are JWTs and continue to use the Authorization header.
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = secretKey || legacyServiceKey;
  if (!apiKey) throw new HttpError(503, 'أضف SUPABASE_SECRET_KEY في إعدادات Vercel.');
  const headers = { apikey: apiKey, Accept: 'application/json' };
  if (!secretKey) headers.Authorization = `Bearer ${legacyServiceKey}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.prefer) headers.Prefer = options.prefer;
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    console.error('Supabase REST request failed:', response.status, data);
    throw new HttpError(500, 'تعذر الوصول إلى قاعدة البيانات. راجع إعداد Supabase وملف SQL.');
  }
  return data;
}

export function queryPath(table, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return `${table}?${query.toString()}`;
}

function cookieName() { return 'se7en_session'; }
function signature(data) {
  const secret = config('SESSION_SECRET');
  if (secret.length < 32) throw new HttpError(503, 'SESSION_SECRET لازم يكون 32 حرفًا على الأقل.');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(payload, ttlSeconds = 60 * 60 * 24 * 7) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${data}.${signature(data)}`;
}

export function readSession(req) {
  const cookieHeader = String(req.headers.cookie || '');
  const prefix = `${cookieName()}=`;
  const entry = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
  if (!entry) return null;
  const token = entry.slice(prefix.length);
  const splitAt = token.lastIndexOf('.');
  if (splitAt < 1) return null;
  const data = token.slice(0, splitAt);
  const suppliedSignature = token.slice(splitAt + 1);
  let expected;
  try { expected = signature(data); } catch { return null; }
  const a = Buffer.from(suppliedSignature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function setSessionCookie(req, res, token) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
  const bits = [`${cookieName()}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=604800'];
  if (isHttps) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

export function clearSessionCookie(req, res) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
  const bits = [`${cookieName()}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

export function getOtpHash(phone, code) {
  const secret = config('OTP_HMAC_SECRET');
  if (secret.length < 32) throw new HttpError(503, 'OTP_HMAC_SECRET لازم يكون 32 حرفًا على الأقل.');
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export function safeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function normalizeName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw new HttpError(400, 'اكتب اسمًا صحيحًا من حرفين إلى 80 حرفًا.');
  return name;
}

export function sendError(res, error) {
  if (error instanceof HttpError) return json(res, error.status, { ok: false, error: error.message });
  console.error(error);
  return json(res, 500, { ok: false, error: 'حصلت مشكلة غير متوقعة. حاول مرة أخرى.' });
}
