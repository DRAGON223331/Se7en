export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  const configured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SESSION_SECRET?.length >= 32 && process.env.OTP_HMAC_SECRET?.length >= 32 &&
    process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID &&
    process.env.WA_OTP_TEMPLATE_NAME && process.env.WA_GRAPH_API_VERSION && process.env.WA_OTP_TEMPLATE_LANGUAGE &&
    process.env.SUPPORT_AGENT_1_PASSWORD && process.env.SUPPORT_AGENT_2_PASSWORD
  );
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ configured }));
}
