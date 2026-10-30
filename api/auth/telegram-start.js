import crypto from 'node:crypto';
import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, normalizeName, sendError, HttpError, checkRateLimit } from '../../lib/server.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    requireCoreConfig();
    checkRateLimit(req, { action: 'telegram_start', max: 6, windowMs: 300000 });
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
    if (!botToken || !/^[A-Za-z0-9_]{5,32}$/.test(botUsername) || !process.env.TELEGRAM_WEBHOOK_SECRET) {
      throw new HttpError(503, 'إعدادات بوت تيليجرام غير مكتملة في Vercel.');
    }
    const body = await bodyJson(req);
    const name = normalizeName(body.name);
    const cleanupBefore = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    await dbRequest(queryPath('se7en_telegram_otp_challenges', { created_at: `lt.${cleanupBefore}` }), { method: 'DELETE' });
    const challengeId = crypto.randomBytes(18).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await dbRequest('se7en_telegram_otp_challenges', {
      method: 'POST', prefer: 'return=minimal',
      body: { challenge_id: challengeId, pending_name: name, stage: 'created', expires_at: expiresAt }
    });
    return json(res, 200, {
      ok: true,
      challenge_id: challengeId,
      telegram_url: `https://t.me/${botUsername}?start=login_${challengeId}`,
      message: 'افتح بوت تيليجرام واضغط Start ثم شارك رقمك لتستقبل كود الدخول.'
    });
  } catch (error) { return sendError(res, error); }
}
