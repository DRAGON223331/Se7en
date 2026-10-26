import crypto from 'node:crypto';
import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, normalizePhone, normalizeName, getOtpHash, sendError, HttpError } from '../../lib/server.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    requireCoreConfig();
    const body = await bodyJson(req);
    const phone = normalizePhone(body.phone);
    const name = normalizeName(body.name);
    const waToken = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    const templateName = process.env.WA_OTP_TEMPLATE_NAME;
    const graphVersion = process.env.WA_GRAPH_API_VERSION;
    const templateLanguage = process.env.WA_OTP_TEMPLATE_LANGUAGE;
    if (!waToken || !phoneNumberId || !templateName || !graphVersion || !templateLanguage || !process.env.OTP_HMAC_SECRET) {
      throw new HttpError(503, 'تسجيل واتساب غير مفعّل. أكمل إعداد WhatsApp Business Platform في Vercel.');
    }

    const oldRows = await dbRequest(queryPath('se7en_otp_challenges', {
      select: 'phone,sent_at,attempts,send_count,window_started_at', phone: `eq.${phone}`, limit: '1'
    }));
    const oldChallenge = oldRows?.[0];
    const nowMs = Date.now();
    if (oldChallenge?.sent_at) {
      const elapsed = nowMs - new Date(oldChallenge.sent_at).getTime();
      if (elapsed >= 0 && elapsed < 60_000) throw new HttpError(429, 'استنى دقيقة قبل ما تطلب كود جديد.');
    }
    const windowStart = oldChallenge?.window_started_at ? new Date(oldChallenge.window_started_at).getTime() : 0;
    const insideWindow = windowStart > 0 && nowMs - windowStart < 60 * 60_000;
    const sendCount = insideWindow ? Number(oldChallenge?.send_count || 0) : 0;
    if (sendCount >= 5) throw new HttpError(429, 'وصلت للحد الأقصى لأكواد التحقق خلال ساعة. حاول لاحقًا.');
    const nextWindowStart = insideWindow ? new Date(windowStart).toISOString() : new Date(nowMs).toISOString();

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = getOtpHash(phone, code);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await dbRequest(queryPath('se7en_otp_challenges', { on_conflict: 'phone' }), {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { phone, pending_name: name, code_hash: codeHash, expires_at: expiresAt, attempts: 0, sent_at: new Date(nowMs).toISOString(), window_started_at: nextWindowStart, send_count: sendCount + 1 }
    });

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }
          ]
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('WhatsApp OTP send failed:', response.status, result);
      throw new HttpError(502, 'واتساب لم يرسل كود التحقق. راجع القالب المعتمد ورقم الإرسال وإعدادات Meta.');
    }
    return json(res, 200, { ok: true, message: 'بعتنالك كود التحقق على واتساب. الكود صالح لمدة 5 دقائق.' });
  } catch (error) { return sendError(res, error); }
}
