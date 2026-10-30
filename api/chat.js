import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, readSession, sendError, HttpError, checkRateLimit } from '../lib/server.js';

async function getOwnedConversation(phone, conversationId) {
  const params = { select: 'id,customer_phone,customer_name,assigned_agent,status,created_at,last_message_at', customer_phone: `eq.${phone}`, limit: '1' };
  if (conversationId) params.id = `eq.${conversationId}`;
  else { params.status = 'eq.open'; params.order = 'last_message_at.desc'; }
  const rows = await dbRequest(queryPath('se7en_conversations', params));
  return rows?.[0] || null;
}

async function getMessages(conversationId) {
  return await dbRequest(queryPath('se7en_messages', {
    select: 'id,conversation_id,sender_role,sender_id,sender_name,body,created_at',
    conversation_id: `eq.${conversationId}`, order: 'created_at.asc', limit: '200'
  })) || [];
}

export default async function handler(req, res) {
  checkRateLimit(req, { action: 'chat_user', max: 40, windowMs: 60000 });
  try {
    requireMethod(req, ['GET', 'POST']);
    requireCoreConfig();
    const session = readSession(req);
    if (!session || session.role !== 'customer') throw new HttpError(401, 'سجّل الدخول بتيليجرام الأول.');
    const phone = String(session.phone || '');
    if (req.method === 'GET') {
      const conversationId = String(req.query?.conversation_id || '');
      const conversation = await getOwnedConversation(phone, conversationId);
      if (!conversation) return json(res, 200, { ok: true, conversation: null, messages: [] });
      return json(res, 200, { ok: true, conversation, messages: await getMessages(conversation.id) });
    }

    const body = await bodyJson(req);
    const message = String(body.message || '').trim();
    if (!message || message.length > 2000) throw new HttpError(400, 'اكتب رسالة من حرف واحد إلى 2000 حرف.');
    const name = String(session.name || 'عميل Se7en').slice(0, 80);
    const requestedAgent = body.assigned_agent === 'agent2' ? 'agent2' : 'agent1';
    let conversation = await getOwnedConversation(phone, body.conversation_id || undefined);
    if (!conversation || conversation.status !== 'open') {
      const created = await dbRequest('se7en_conversations', {
        method: 'POST', prefer: 'return=representation',
        body: [{ customer_phone: phone, customer_name: name, assigned_agent: requestedAgent, status: 'open', last_message_at: new Date().toISOString() }]
      });
      conversation = Array.isArray(created) ? created[0] : created;
      if (!conversation?.id) throw new HttpError(500, 'تعذر بدء المحادثة. حاول مرة أخرى.');
    }
    const inserted = await dbRequest('se7en_messages', {
      method: 'POST', prefer: 'return=representation',
      body: [{ conversation_id: conversation.id, sender_role: 'customer', sender_id: phone, sender_name: name, body: message }]
    });
    await dbRequest(queryPath('se7en_conversations', { id: `eq.${conversation.id}` }), {
      method: 'PATCH', prefer: 'return=minimal', body: { last_message_at: new Date().toISOString() }
    });
    return json(res, 201, { ok: true, conversation, message: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) { return sendError(res, error); }
}
