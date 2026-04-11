# Telegram Web App marketplace API

Node.js (Express) backend for a Telegram Stars marketplace: Telegram Web App authentication, products, orders, and payment webhooks. Intended for [Vercel](https://vercel.com) serverless and PostgreSQL via [Prisma](https://www.prisma.io).

## Requirements

- Node.js 20+
- PostgreSQL database
- A Telegram bot token (`TELEGRAM_BOT_TOKEN`)

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, and `BASE_URL` (your public API origin, no trailing slash).

2. Install dependencies and apply the schema:

   ```bash
   npm install
   npx prisma migrate deploy
   ```

   For local development without migration history, you can use `npx prisma db push` instead (not recommended for production).

3. Run locally:

   ```bash
   npm run dev
   ```

   The server listens on `PORT` (default `4000`). Health check: `GET /health`.

## Telegram webhook

Point your bot’s updates to:

`POST {BASE_URL}/api/payments/webhook`

Example (replace token and URL):

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<BASE_URL>/api/payments/webhook
```

Use HTTPS. For stronger assurance, configure Bot API `secret_token` and validate the `X-Telegram-Bot-Api-Secret-Token` header in your own deployment policy (not wired to the four core env vars in this repo).

## Deploy on Vercel

1. Connect the repository and set the same environment variables in the Vercel project settings (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `BASE_URL`).
2. The project root for Vercel should be this folder (`back-mrkt` if your repo contains a nested directory).
3. Build runs `prisma generate && prisma migrate deploy`; the database must be reachable from Vercel’s build environment with `DATABASE_URL`.
4. After deploy, call `setWebhook` as above using your production `BASE_URL`.

## API overview

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/telegram` | Body: `{ "initData": "<query string from Telegram.WebApp.initData>" }` |
| `GET` | `/api/products` | No |
| `GET` | `/api/products/:id` | No |
| `POST` | `/api/products` | Bearer JWT (temporary “admin”: any authenticated user) |
| `POST` | `/api/orders` | Bearer JWT — `{ "productId" }` |
| `GET` | `/api/orders/user` | Bearer JWT |
| `POST` | `/api/payments/create` | Bearer JWT — `{ "orderId" }` → `{ invoiceLink }` |
| `POST` | `/api/payments/webhook` | Telegram updates (JSON) |

## Security notes

- **initData** is verified with HMAC-SHA-256 per Telegram’s Web App spec, including a maximum **auth_date** age of 24 hours.
- **JWT** protects user-specific routes; the payload subject is the Telegram user id (string).
- **Payments**: `pre_checkout_query` is answered only if the order is pending, the product is not sold, and the Stars amount matches the product price. Successful payments are **idempotent** using `telegram_payment_charge_id`.

## Project layout

- `api/` — Vercel serverless entry (`api/index.js` exports the Express app)
- `config/` — Environment loading
- `controllers/` — HTTP handlers
- `services/` — Business logic and Telegram/Prisma calls
- `middlewares/` — JWT, validation (Zod), errors
- `utils/` — Prisma client singleton, Telegram initData helper
- `prisma/` — Schema and migrations
