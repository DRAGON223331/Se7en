# Se7en Store — Direct Telegram Orders

This version has **no customer registration, no OTP, and no customer account**.
Customers select a product, fill in their order details, and the server sends the complete order to the seller's private Telegram chat using the bot.

## Current catalog

- T60 bags: 450 EGP — navy, black, red
- Shirts: 250 EGP — Batman black, Spider black, Spider navy
- Little Bag: 280 EGP — Pink or Red

Prices are validated on the server in `api/order.js`, so changing a price in the browser does not change the price sent to the seller.

## Vercel environment variables

Add only these server-side variables:

- `TELEGRAM_BOT_TOKEN` — the token from BotFather
- `TELEGRAM_SELLER_CHAT_ID` — the Telegram chat ID that should receive orders

`TELEGRAM_ADMIN_CHAT_ID` is also accepted as a fallback name for the seller chat ID.

## How to get the seller chat ID

1. Open the bot in Telegram from the seller's Telegram account and press **Start** / send any message.
2. If an old webhook is still registered from a previous version, remove it first from Telegram's Bot API (`deleteWebhook`).
3. Call Telegram's `getUpdates` endpoint locally using the bot token and find `message.chat.id` for the seller's message.
4. Put that numeric ID in `TELEGRAM_SELLER_CHAT_ID` in Vercel.
5. Redeploy after saving environment variables.

Do not paste or commit the real bot token into this project.

## Order data sent to the seller

The Telegram order message includes: order ID, buyer name, phone, product, color, shirt size when applicable, quantity, server-validated price, total before shipping, delivery method, area, detailed address when shipping, notes, and order time.

## Deploy

Import/upload the project to Vercel with Framework Preset **Other**. There is no build command. After setting the environment variables and redeploying, submit a test order from the site and confirm it appears in the seller's Telegram chat.
