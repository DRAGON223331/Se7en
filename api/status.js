export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN && (process.env.TELEGRAM_SELLER_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ configured }));
}
