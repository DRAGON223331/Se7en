# Se7en Store — V19: in-site chat + WhatsApp OTP

This version replaces the old `wa.me` handoff with a real **on-site chat interface**, adds WhatsApp one-time-code sign-in, and includes a private support-agent dashboard at `/support.html`.

## Important: the live API integration must be configured before use

The UI and Vercel server routes are included, but OTP delivery and persistent chat will not work until the store owner connects their Meta WhatsApp Business Platform credentials and Supabase database. The public website does not contain API access tokens or a Supabase service-role key.

The in-site chat is a website chat system: customers and the two support agents exchange messages inside Se7en. The agents reply from the Se7en support dashboard. It does **not** mirror the reps' existing WhatsApp personal chats. The two numbers previously supplied for customer care are not used by this site's in-page chat; the two people are mapped to separate agent accounts (`agent1` and `agent2`) and reply from `/support.html`. WhatsApp OTP is sent from the WhatsApp Business Platform sender configured by `WA_PHONE_NUMBER_ID`. If agents must reply from their ordinary WhatsApp apps and have those replies appear in the site, a separate WhatsApp Business API/webhook bridge and message-routing setup is required; that is not activated in this version.

## 1. Create and prepare the database (Supabase)

1. Create a Supabase project.
2. Open **SQL Editor** and run the complete file `sql/schema.sql`.
3. Copy the project URL and the **service_role** key from Supabase project settings. Store the service-role key only in Vercel environment variables; never paste it into frontend code or share it publicly.

## 2. Prepare WhatsApp OTP (Meta)

1. Set up a Meta business portfolio and a WhatsApp Business Account, and add a business phone number to the WhatsApp Business Platform / Cloud API.
2. Create and get approval for an **AUTHENTICATION** message template with the OTP button (Copy Code or approved supported variant). Use the exact approved template name and language code below.
3. Create a server-side access token with `whatsapp_business_messaging` permission and retrieve the Phone Number ID.
4. The sender number used for OTP must belong to the configured WhatsApp Business Account. The two support people are represented as `agent1` and `agent2`; the customer-care phone numbers previously shared are not used to send or route in-site chat messages in this version.

Meta's Cloud API requires a business portfolio, WhatsApp Business Account, business phone number, and access token. See [Meta's WhatsApp Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) and the [WhatsApp Business developer hub](https://whatsappbusiness.com/developers/developer-hub/).

## 3. Add these Environment Variables in Vercel

Add the variables under **Project → Settings → Environment Variables**, for Preview and Production as appropriate:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `SESSION_SECRET` | Random secret of at least 32 characters |
| `OTP_HMAC_SECRET` | Separate random secret of at least 32 characters |
| `WA_ACCESS_TOKEN` | Meta WhatsApp Business Platform access token |
| `WA_PHONE_NUMBER_ID` | WhatsApp Business **Phone Number ID**, not the visible phone number |
| `WA_GRAPH_API_VERSION` | The Graph API version currently supported for your Meta app; set it from Meta documentation/dashboard |
| `WA_OTP_TEMPLATE_NAME` | Exact approved AUTHENTICATION template name |
| `WA_OTP_TEMPLATE_LANGUAGE` | Exact approved template language code shown for your template, e.g. `ar` or `ar_EG` |
| `SUPPORT_AGENT_1_PASSWORD` | Strong private password for support agent 1 |
| `SUPPORT_AGENT_2_PASSWORD` | Different strong private password for support agent 2 |
| `SUPPORT_AGENT_1_NAME` | Optional display name for support agent 1 |
| `SUPPORT_AGENT_2_NAME` | Optional display name for support agent 2 |

Generate different random values for `SESSION_SECRET` and `OTP_HMAC_SECRET`; never use the sample text from this README. After changing environment variables, redeploy the site.

## 4. How to use it

- Customers click **حسابي / الشات**, enter their name and WhatsApp number, receive the OTP via the configured WhatsApp Business sender, verify it, then chat without leaving the website.
- Customers can choose one of the two support-agent accounts before their first message. An existing open conversation stays assigned to its original agent.
- Agent 1 and Agent 2 open `/support.html`, choose their account, and enter their own Vercel-configured password. Each agent sees only their assigned conversations and replies in that dashboard.
- Product inquiry buttons open the embedded chat and prefill a question about the selected shirt at 350 EGP; the user still chooses when to send it.

## Security and limitations

- OTP codes expire after 5 minutes, the same phone cannot request another code for 60 seconds, and verification is limited to 5 attempts per challenge.
- The signed session is stored in an HttpOnly cookie; database and WhatsApp secrets are used only in server routes.
- This is an initial production integration scaffold. Before launch, test the exact approved Meta template, rate limits, account recovery, privacy notice, and agent access in your own business accounts. WhatsApp template approval and Meta setup cannot be done from the website source itself.
- The agent dashboard is the reply interface; a message typed by a support agent there is stored and shown in the customer's site chat. It does not automatically send that reply through the seller's normal WhatsApp app.

## Local testing

This version is not a static-only page. Opening `index.html` directly or using a basic static file server will not enable OTP or chat. Use Vercel's development runtime with environment variables, or deploy to Vercel after completing the setup steps above.

## Deploy on Vercel

- Import or upload the project root (the folder containing `index.html`, `api/`, `lib/`, `sql/`, `support.html`, and `vercel.json`).
- Framework preset: **Other**. No build command is needed.
- Add the environment variables above, then deploy/redeploy.
- The main page shows a setup warning and disables OTP sending while required configuration is missing.
