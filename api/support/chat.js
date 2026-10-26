import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, readSession, sendError, HttpError } from '../../lib/server.js';

function requireAgent(req) {
  const session = readSession(req);
  if (!session || session.role !== 'support' || !['agent1', 'agent2'].includes(session.agentId)) throw new HttpError(401, 'سجّل دخول خدمة العملاء الأول.');
  return session;
}
async function ownedConversation(agentId, id) {
  const rows = await dbRequest(queryPath('se7en_conversations', {
    select: 'id,customer_phone,customer_name,assigned_agent,status,created_at,last_message_at',
    id: `eq.${id}`, assigned_agent: `eq.${agentId}`, limit: '1'
  }));
  return rows?.[0] || null;
}
async function messagesFor(id) {
  return await dbRequest(queryPath('se7en_messages', {
    select: 'id,conversation_id,sender_role,sender_id,sender_name,body,created_at',
    conversation_id: `eq.${id}`, order: 'created_at.asc', limit: '200'
  })) || [];
}
export default async function handler(req, res) {
  try {
    requireMethod(req, ['GET', 'POST']);
    requireCoreConfig();
    const session = requireAgent(req);
    const agentId = session.agentId;
    if (req.method === 'GET') {
      const id = String(req.query?.conversation_id || '');
      if (id) {
        const conversation = await ownedConversation(agentId, id);
        if (!conversation) throw new HttpError(404, 'المحادثة غير موجودة أو غير تابعة لحسابك.');
        return json(res, 200, { ok: true, conversation, messages: await messagesFor(id) });
      }
      const conversations = await dbRequest(queryPath('se7en_conversations', {
        select: 'id,customer_phone,customer_name,assigned_agent,status,created_at,last_message_at',
        assigned_agent: `eq.${agentId}`, order: 'last_message_at.desc', limit: '100'
      }));
      return json(res, 200, { ok: true, conversations: conversations || [] });
    }
    const body = await bodyJson(req);
    const id = String(body.conversation_id || '');
    const message = String(body.message || '').trim();
    if (!id) throw new HttpError(400, 'اختار محادثة أولًا.');
    if (!message || message.length > 2000) throw new HttpError(400, 'اكتب رسالة من حرف واحد إلى 2000 حرف.');
    const conversation = await ownedConversation(agentId, id);
    if (!conversation) throw new HttpError(404, 'المحادثة غير موجودة أو غير تابعة لحسابك.');
    const inserted = await dbRequest('se7en_messages', {
      method: 'POST', prefer: 'return=representation',
      body: [{ conversation_id: id, sender_role: 'agent', sender_id: agentId, sender_name: session.name || 'خدمة العملاء', body: message }]
    });
    await dbRequest(queryPath('se7en_conversations', { id: `eq.${id}` }), {
      method: 'PATCH', prefer: 'return=minimal', body: { last_message_at: new Date().toISOString() }
    });
    return json(res, 201, { ok: true, message: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) { return sendError(res, error); }
}
