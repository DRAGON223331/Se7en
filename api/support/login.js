import { bodyJson, json, requireMethod, createSessionToken, setSessionCookie, safeEqualText, sendError, HttpError } from '../../lib/server.js';
const AGENTS = {
  agent1: { label: process.env.SUPPORT_AGENT_1_NAME || 'مسؤول خدمة العملاء الأول', passwordEnv: 'SUPPORT_AGENT_1_PASSWORD' },
  agent2: { label: process.env.SUPPORT_AGENT_2_NAME || 'مسؤول خدمة العملاء الثاني', passwordEnv: 'SUPPORT_AGENT_2_PASSWORD' }
};
export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    const body = await bodyJson(req);
    const agentId = body.agent === 'agent2' ? 'agent2' : body.agent === 'agent1' ? 'agent1' : '';
    if (!agentId) throw new HttpError(400, 'اختار حساب خدمة العملاء.');
    const agent = AGENTS[agentId];
    const configuredPassword = process.env[agent.passwordEnv];
    if (!process.env.SESSION_SECRET || !configuredPassword) throw new HttpError(503, 'حسابات خدمة العملاء لم تُضبط بعد في إعدادات Vercel.');
    if (!safeEqualText(String(body.password || ''), configuredPassword)) throw new HttpError(401, 'كلمة المرور غير صحيحة.');
    const token = createSessionToken({ role: 'support', agentId, name: agent.label }, 60 * 60 * 12);
    setSessionCookie(req, res, token);
    return json(res, 200, { ok: true, agent: { id: agentId, name: agent.label } });
  } catch (error) { return sendError(res, error); }
}
