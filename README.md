# Se7en Store — V20: Telegram OTP + in-site customer chat

This project keeps the Se7en sportswear storefront, product gallery, in-site customer chat, and private support dashboard. Customer sign-in now uses a Telegram bot OTP instead of WhatsApp/Meta.

## What the Telegram flow does

1. A customer opens the in-site chat, enters a name, and presses **بدء تسجيل الدخول عبر تيليجرام**.
2. The server creates a random, short-lived sign-in challenge and returns a private Telegram deep link.
3. The customer opens the bot, presses **Start**, and shares their own phone number using Telegram's official `request_contact` button.
4. The bot verifies that the shared contact belongs to the Telegram user, then sends a six-digit one-time code in Telegram.
5. The customer enters the code on Se7en. The server verifies it and creates the signed, HttpOnly customer session.
6. Customer and support-agent chat stays inside the website. Replies are stored in Supabase and appear in `/support.html`.

**Important limitation:** Customers must have Telegram and must open/start the bot before it can message them. Telegram does not permit a bot to start a private conversation with a user who has never started it. Sharing a phone number through the button requires user consent. Telegram sign-in confirms the phone number that the user voluntarily shares from their Telegram account; it does not independently verify legal identity. In-site chat remains in the website and is not a mirror of chats in the sellers' personal messaging apps.

## 1. Supabase

Use the existing project. Open SQL Editor and run `sql/schema.sql` if setting up from scratch. It creates the customer, OTP, conversation and message tables with RLS, and the new private `se7en_telegram_otp_challenges` table. If the existing V19 schema is already installed, the Telegram table is created with `CREATE TABLE IF NOT EXISTS`.

The Vercel server uses `SUPABASE_SECRET_KEY` (`sb_secret_...`) only in server-side functions. Do not use a publishable key for this server variable. Keep secret keys out of browser code and Git.

## 2. Create the Telegram bot

1. Open Telegram and start a chat with **@BotFather**.
2. Send `/newbot`, then follow the prompts for a bot display name and a unique username ending in `bot`.
3. Copy the bot token from BotFather. Treat it like a password; do not paste it into chat or commit it to Git.
4. Use the bot username without the leading `@` for `TELEGRAM_BOT_USERNAME`.

## 3. Configure Vercel variables

Open the project in Vercel → **Settings → Environment Variables**. Set these for Production (and Preview too if you test on preview deployments):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side Supabase secret key beginning `sb_secret_` |
| `SESSION_SECRET` | Unique random secret, at least 32 characters |
| `OTP_HMAC_SECRET` | A different unique random secret, at least 32 characters |
| `TELEGRAM_BOT_TOKEN` | BotFather token; keep secret |
| `TELEGRAM_BOT_USERNAME` | Telegram bot username without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret for the webhook, using only letters, digits, `_`, and `-` |
| `SUPPORT_AGENT_1_PASSWORD` | Strong password for support agent 1 |
| `SUPPORT_AGENT_2_PASSWORD` | Different strong password for support agent 2 |
| `SUPPORT_AGENT_1_NAME` | Optional support-agent display name |
| `SUPPORT_AGENT_2_NAME` | Optional support-agent display name |

Generate different random values for `SESSION_SECRET`, `OTP_HMAC_SECRET`, and `TELEGRAM_WEBHOOK_SECRET`. Do not use the same secret for multiple variables. After saving variables, redeploy the site so the new deployment receives them.

## 4. Register the Telegram webhook

After deploying with the environment variables, set the Telegram webhook URL to your production site's endpoint. Use the active production domain in place of `https://YOUR-DOMAIN`:

On Windows, you can use PowerShell. It will prompt you for the two values instead of saving them into the script. Replace the domain if you use a different production domain:

```powershell
$botToken = Read-Host "Paste BotFather token"
$webhookSecret = Read-Host "Paste TELEGRAM_WEBHOOK_SECRET from Vercel"
$payload = @{
  url = "https://se7en-seven.vercel.app/api/telegram/webhook"
  secret_token = $webhookSecret
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
  -ContentType "application/json" `
  -Body $payload
Remove-Variable botToken, webhookSecret, payload
```

Run the command locally only; do not commit the token or secret to the repository or paste them into chat. The `setWebhook` response should contain `ok: true`. The webhook endpoint checks Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.

To inspect the webhook status, run:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Do not share the response if it contains private deployment information.

## 5. Deploy the site

- Upload/import the project root folder containing `index.html`, `api/`, `lib/`, `sql/`, `support.html`, and `vercel.json`.
- Vercel framework preset: **Other**; no build command is needed.
- Set all environment variables, deploy, then register the webhook.
- Open the site, click **حسابي / الشات**, enter your name, open the bot link, press Start, share your own contact with the bot, then enter the OTP shown in Telegram.
- The support team logs in at `/support.html` using its configured agent account and password.

## Security notes

- Sign-in challenges are random and expire after 10 minutes; the issued OTP expires after 5 minutes.
- The bot accepts only a contact shared by the same Telegram user who started the challenge. A typed phone number is not accepted as proof of ownership.
- OTP verification is limited to five guesses per challenge. The bot also enforces a one-minute cooldown and a five-code hourly window per Telegram account.
- Supabase tables are not granted to the browser's `anon` or `authenticated` roles. Database access runs through server-only Vercel routes.
- Keep bot tokens, Supabase secret keys, session secrets, and webhook secrets private. Rotate them if accidentally disclosed.
- This integration is an initial deployment package. Before public launch, test the bot/webhook with a real Telegram account and check Vercel runtime logs after a test login.

## Support dashboard

The customer-facing chat stores messages in Supabase. Support agents use `/support.html` to see their assigned conversations and answer inside Se7en. Messages typed by agents in this panel show up in the customer's site chat; they are not automatically sent through WhatsApp or Telegram as support-agent messages.
