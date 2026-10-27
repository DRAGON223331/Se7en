import crypto from 'node:crypto';
import { bodyJson, dbRequest, queryPath, json, requireMethod, requireCoreConfig, getOtpHash } from '../../lib/server.js';

async function telegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} request failed with status ${response.status}`);
  return data.result;
}
async function sendMessage(chatId, text, reply_markup) {
  return telegram('sendMessage', { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) });
}
function normalizeSharedPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = `20${phone.slice(1)}`;
  if (phone.length < 10 || phone.length > 15) return '';
  return phone;
}

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    requireCoreConfig();
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET ||
        req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      res.statusCode = 401;
      return res.end('Unauthorized');
    }

    const update = await bodyJson(req);
    const message = update.message;
    if (!message?.chat?.id || !message?.from?.id) return json(res, 200, { ok: true });
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const text = String(message.text || '');

    if (text.startsWith('/start login_')) {
      const challengeId = text.slice('/start login_'.length).trim();
      if (!/^[a-f0-9]{36}$/.test(challengeId)) {
        await sendMessage(chatId, 'افتح طلب تسجيل الدخول من موقع Se7en الأول.');
        return json(res, 200, { ok: true });
      }
      const rows = await dbRequest(queryPath('se7en_telegram_otp_challenges', {
        select: 'challenge_id,pending_name,stage,expires_at', challenge_id: `eq.${challengeId}`, limit: '1'
      }));
      const challenge = rows?.[0];
      if (!challenge || challenge.stage !== 'created' || new Date(challenge.expires_at).getTime() <= Date.now()) {
        await sendMessage(chatId, 'طلب تسجيل الدخول غير صالح أو انتهت صلاحيته. ارجع للموقع وابدأ من جديد.');
        return json(res, 200, { ok: true });
      }
      await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challengeId}` }), {
        method: 'PATCH', prefer: 'return=minimal',
        body: { stage: 'awaiting_contact', telegram_user_id: telegramUserId, telegram_chat_id: chatId }
      });
      await sendMessage(chatId,
        'أهلًا بيك في Se7en. لتأكيد حسابك، اضغط الزر لمشاركة رقم هاتفك. لازم تشارك رقمك أنت من الزر الرسمي.',
        { keyboard: [[{ text: 'مشاركة رقم هاتفي لتأكيد الحساب', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
      );
      return json(res, 200, { ok: true });
    }

    if (message.contact) {
      if (!message.contact.user_id || String(message.contact.user_id) !== telegramUserId) {
        await sendMessage(chatId, 'لازم تشارك رقم هاتفك أنت من زر تيليجرام، مش رقم شخص آخر.');
        return json(res, 200, { ok: true });
      }
      const phone = normalizeSharedPhone(message.contact.phone_number);
      if (!phone) {
        await sendMessage(chatId, 'رقم الهاتف غير صالح. ابدأ من الموقع وحاول مشاركة جهة الاتصال من جديد.');
        return json(res, 200, { ok: true });
      }
      const pending = await dbRequest(queryPath('se7en_telegram_otp_challenges', {
        select: 'challenge_id,pending_name,stage,expires_at,telegram_user_id,telegram_chat_id',
        telegram_user_id: `eq.${telegramUserId}`, stage: 'eq.awaiting_contact',
        order: 'created_at.desc', limit: '1'
      }));
      const challenge = pending?.[0];
      if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.telegram_chat_id !== chatId) {
        await sendMessage(chatId, 'طلب تسجيل الدخول انتهى. ارجع للموقع وابدأ من جديد.');
        return json(res, 200, { ok: true });
      }

      const sinceHour = new Date(Date.now() - 60 * 60_000).toISOString();
      const recent = await dbRequest(queryPath('se7en_telegram_otp_challenges', {
        select: 'challenge_id,sent_at', telegram_user_id: `eq.${telegramUserId}`,
        sent_at: `gte.${sinceHour}`, order: 'sent_at.desc', limit: '6'
      }));
      if ((recent || []).some(item => Date.now() - new Date(item.sent_at).getTime() < 60_000)) {
        await sendMessage(chatId, 'استنى دقيقة قبل ما تطلب كود جديد.');
        return json(res, 200, { ok: true });
      }
      if ((recent || []).length >= 5) {
        await sendMessage(chatId, 'وصلت للحد الأقصى لأكواد الدخول خلال ساعة. حاول لاحقًا.');
        return json(res, 200, { ok: true });
      }

      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const now = Date.now();
      await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challenge.challenge_id}` }), {
        method: 'PATCH', prefer: 'return=minimal',
        body: { phone, code_hash: getOtpHash(phone, code), stage: 'code_sent', attempts: 0,
          telegram_user_id: telegramUserId, telegram_chat_id: chatId,
          sent_at: new Date(now).toISOString(), expires_at: new Date(now + 5 * 60_000).toISOString() }
      });
      try {
        await sendMessage(chatId, `كود تسجيل الدخول إلى Se7en هو: ${code}\nصالح لمدة 5 دقائق. لا تشاركه مع أي شخص.`, { remove_keyboard: true });
      } catch (sendError) {
        await dbRequest(queryPath('se7en_telegram_otp_challenges', { challenge_id: `eq.${challenge.challenge_id}` }), {
          method: 'PATCH', prefer: 'return=minimal',
          body: { phone: null, code_hash: null, stage: 'awaiting_contact' }
        });
        throw sendError;
      }
      return json(res, 200, { ok: true });
    }

    if (text === '/start') await sendMessage(chatId, 'لتسجيل الدخول إلى Se7en، افتح الموقع واضغط «بدء تسجيل الدخول عبر تيليجرام».');
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Telegram webhook processing failed:', error?.message || 'unknown error');
    return json(res, 500, { ok: false });
  }
}
