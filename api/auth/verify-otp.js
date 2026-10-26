import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, normalizePhone, getOtpHash, safeEqualText, createSessionToken, setSessionCookie, sendError, HttpError } from '../../lib/server.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    requireCoreConfig();
    const body = await bodyJson(req);
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'اكتب كود التحقق المكوّن من 6 أرقام.');

    const rows = await dbRequest(queryPath('se7en_otp_challenges', {
      select: 'phone,pending_name,code_hash,expires_at,attempts', phone: `eq.${phone}`, limit: '1'
    }));
    const challenge = rows?.[0];
    if (!challenge) throw new HttpError(400, 'اطلب كود تحقق جديد الأول.');
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await dbRequest(queryPath('se7en_otp_challenges', { phone: `eq.${phone}` }), { method: 'DELETE' });
      throw new HttpError(400, 'الكود انتهت صلاحيته. اطلب كودًا جديدًا.');
    }
    if (Number(challenge.attempts || 0) >= 5) throw new HttpError(429, 'وصلت للحد الأقصى للمحاولات. اطلب كودًا جديدًا بعد دقيقة.');
    if (!safeEqualText(challenge.code_hash, getOtpHash(phone, code))) {
      await dbRequest(queryPath('se7en_otp_challenges', { phone: `eq.${phone}` }), {
        method: 'PATCH', prefer: 'return=minimal', body: { attempts: Number(challenge.attempts || 0) + 1 }
      });
      throw new HttpError(400, 'كود التحقق غير صحيح.');
    }

    const name = String(challenge.pending_name || 'عميل Se7en').slice(0, 80);
    await dbRequest(queryPath('se7en_customers', { on_conflict: 'phone' }), {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { phone, name, last_login_at: new Date().toISOString() }
    });
    await dbRequest(queryPath('se7en_otp_challenges', { phone: `eq.${phone}` }), { method: 'DELETE' });
    const token = createSessionToken({ role: 'customer', phone, name });
    setSessionCookie(req, res, token);
    return json(res, 200, { ok: true, user: { phone: `+${phone}`, name } });
  } catch (error) { return sendError(res, error); }
}
