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
    try { return JSON.parse(req.body || '{}'); }
    catch { throw new HttpError(400, 'بيانات الطلب غير صحيحة.'); }
  }
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 20000) throw new HttpError(413, 'بيانات الطلب كبيرة جدًا.');
  }
  try { return JSON.parse(data || '{}'); }
  catch { throw new HttpError(400, 'بيانات الطلب غير صحيحة.'); }
}

export function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) throw new HttpError(405, 'Method not allowed.');
}
