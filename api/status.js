export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  const configured = Boolean(
    process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.SESSION_SECRET?.length >= 32 && process.env.OTP_HMAC_SECRET?.length >= 32 &&
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET &&
    process.env.SUPPORT_AGENT_1_PASSWORD && process.env.SUPPORT_AGENT_2_PASSWORD
  );
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ configured }));
}
