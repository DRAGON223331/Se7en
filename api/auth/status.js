import { json, requireMethod, readSession } from '../../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed.' });
  const session = readSession(req);
  if (!session || session.role !== 'customer') return json(res, 200, { ok: true, loggedIn: false });
  return json(res, 200, { ok: true, loggedIn: true, user: { phone: `+${session.phone}`, name: session.name || 'عميل Se7en' } });
}
