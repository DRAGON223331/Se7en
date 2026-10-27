import crypto from 'node:crypto';
import { bodyJson, json, HttpError, requireMethod } from '../lib/server.js';

const CATALOG = {
  't60-navy': { name: 'T60 — كحلي', price: 450, category: 't60', colors: ['كحلي'] },
  't60-black': { name: 'T60 — أسود', price: 450, category: 't60', colors: ['أسود'] },
  't60-red': { name: 'T60 — أحمر', price: 450, category: 't60', colors: ['أحمر'] },
  'shirt-batman': { name: 'Batman Shirt', price: 250, category: 'shirts', colors: ['أسود'] },
  'shirt-spider-black': { name: 'Spider Shirt — Black', price: 250, category: 'shirts', colors: ['أسود'] },
  'shirt-spider-navy': { name: 'Spider Shirt — Navy', price: 250, category: 'shirts', colors: ['كحلي'] },
  'little-bag': { name: 'Little Bag', price: 280, category: 'littlebag', colors: ['Pink', 'Red'] }
};

function clean(value, max = 200) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function required(value, label, max = 200) {
  const result = clean(value, max);
  if (!result) throw new HttpError(400, `اكتب ${label}.`);
  return result;
}

function phone(value) {
  const raw = clean(value, 30);
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new HttpError(400, 'رقم الموبايل غير صحيح.');
  return raw;
}

function cairoTime() {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SELLER_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) throw new HttpError(503, 'إرسال الطلبات غير مفعّل بعد. راجع إعدادات البوت في Vercel.');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    console.error('Telegram order delivery failed', response.status, result?.description || 'Unknown Telegram error');
    throw new HttpError(502, 'تعذر إرسال الطلب للبياع حاليًا. حاول مرة أخرى.');
  }
}

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    const data = await bodyJson(req);
    if (clean(data.website, 100)) return json(res, 200, { ok: true, order_id: 'S7-OK' });

    const productId = clean(data.product_id, 60);
    const product = CATALOG[productId];
    if (!product) throw new HttpError(400, 'اختار منتج صحيح.');

    const name = required(data.name, 'اسم المشتري', 80);
    const buyerPhone = phone(data.phone);
    const area = required(data.area, 'المحافظة أو المنطقة', 80);
    const quantity = Number.parseInt(data.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new HttpError(400, 'الكمية لازم تكون من 1 إلى 20.');

    const color = clean(data.color, 30) || product.colors[0];
    if (!product.colors.includes(color)) throw new HttpError(400, 'اللون المختار غير متاح للمنتج ده.');

    const size = clean(data.size, 30);
    if (product.category === 'shirts' && !size) throw new HttpError(400, 'اكتب مقاس التيشيرت المطلوب.');

    const delivery = data.delivery_method === 'pickup' ? 'استلام من المكان' : 'شحن للعنوان';
    const address = clean(data.address, 240);
    if (data.delivery_method !== 'pickup' && !address) throw new HttpError(400, 'اكتب عنوان الشحن بالتفصيل.');
    const notes = clean(data.notes, 400);

    const total = product.price * quantity;
    const orderId = `S7-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const text = [
      `🛒 طلب جديد من موقع Se7en — ${orderId}`,
      '',
      `👤 المشتري: ${name}`,
      `📞 الموبايل: ${buyerPhone}`,
      `📦 المنتج: ${product.name}`,
      `🎨 اللون: ${color}`,
      ...(product.category === 'shirts' ? [`📏 المقاس: ${size}`] : []),
      `🔢 الكمية: ${quantity}`,
      `💵 سعر القطعة: ${product.price} جنيه`,
      `💰 إجمالي المنتجات: ${total} جنيه (قبل الشحن)`,
      `🚚 الاستلام: ${delivery}`,
      `📍 المحافظة / المنطقة: ${area}`,
      ...(address ? [`🏠 العنوان: ${address}`] : []),
      ...(notes ? [`📝 ملاحظات: ${notes}`] : []),
      '',
      `🕒 وقت الطلب: ${cairoTime()}`
    ].join('\n');

    await sendTelegram(text);
    return json(res, 200, { ok: true, order_id: orderId, total });
  } catch (error) {
    if (error instanceof HttpError) return json(res, error.status, { ok: false, error: error.message });
    console.error(error);
    return json(res, 500, { ok: false, error: 'حصلت مشكلة غير متوقعة. حاول مرة أخرى.' });
  }
}
