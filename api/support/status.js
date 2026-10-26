import { json, readSession } from '../../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed.' });
  const session = readSession(req);
  if (!session || session.role !== 'support' || !['agent1', 'agent2'].includes(session.agentId)) return json(res, 200, { ok: true, loggedIn: false });
  return json(res, 200, { ok: true, loggedIn: true, agent: { id: session.agentId, name: session.name || 'خدمة العملاء' } });
}
