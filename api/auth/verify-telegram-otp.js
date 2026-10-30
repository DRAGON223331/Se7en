import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, normalizePhone, getOtpHash, safeEqualText, createSessionToken, setSessionCookie, sendError, HttpError, checkRateLimit } from '../../lib/server.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    requireCoreConfig();
    checkRateLimit(req, { action: 'verify_otp', max: 10, windowMs: 60000 });
    const body = await bodyJson(req);
    const challengeId = String(body.challenge_id || '');
    const code = String(body.code || '').replace(/\D/g, '');
    if (!/^[a-f0-9]{36}$/.test(challengeId)) throw new HttpError(400, 'ابدأ تسجيل الدخول من جديد.');
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'اكتب كود التحقق المكوّن من 6 أرقام.');

    const rows = await dbRequest(queryPath('se7en_telegram_otp_challenges', {
      select: 'challenge_id,pending_name,phone,code_hash,stage,expires_at,attempts',
      challenge_id: `eq.${challengeId}`, limit: '1'
    }));
    const challenge = rows?.[0];
    if (!challenge || challenge.stage !== 'code_sent' || !challenge.phone || !challenge.code_hash) {
      throw new HttpError(400, 'افتح بوت Se7en على تيليجرام واطلب كود الدخول الأول.');
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challengeId}` }), { method: 'PATCH', prefer: 'return=minimal', body: { stage: 'blocked', code_hash: null } });
      throw new HttpError(400, 'انتهت صلاحية الكود. ابدأ تسجيل الدخول من جديد.');
    }
    if (Number(challenge.attempts || 0) >= 5) throw new HttpError(429, 'وصلت للحد الأقصى للمحاولات. ابدأ طلبًا جديدًا.');
    const phone = normalizePhone(challenge.phone);
    if (!safeEqualText(challenge.code_hash, getOtpHash(phone, code))) {
      await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challengeId}` }), {
        method: 'PATCH', prefer: 'return=minimal', body: { attempts: Number(challenge.attempts || 0) + 1 }
      });
      throw new HttpError(400, 'كود التحقق غير صحيح.');
    }

    const name = String(challenge.pending_name || 'عميل Se7en').slice(0, 80);
    await dbRequest(queryPath('se7en_customers', { on_conflict: 'phone' }), {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { phone, name, last_login_at: new Date().toISOString() }
    });
    await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challengeId}` }), { method: 'PATCH', prefer: 'return=minimal', body: { stage: 'verified', code_hash: null } });
    const token = createSessionToken({ role: 'customer', phone, name });
    setSessionCookie(req, res, token);
    return json(res, 200, { ok: true, user: { phone: `+${phone}`, name } });
  } catch (error) { return sendError(res, error); }
}
