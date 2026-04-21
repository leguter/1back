const { getEnv } = require('../config/env');

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Raw Telegram Bot API call. Throws AppError on non-ok response.
 */
async function telegramBotRequest(method, body) {
  const { telegramBotToken } = getEnv();
  const res = await fetch(`${TELEGRAM_API}/bot${telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return data;
}

/**
 * Send a push message to a Telegram user by their Telegram user ID.
 * Silently fails — never throws, so it never blocks the main flow.
 */
async function sendPushNotification(telegramUserId, text, options = {}) {
  if (!telegramUserId) return;
  try {
    await telegramBotRequest('sendMessage', {
      chat_id: String(telegramUserId),
      text,
      parse_mode: 'HTML',
      ...options,
    });
  } catch (e) {
    console.warn('[telegram] push notification failed:', e.message);
  }
}

module.exports = { telegramBotRequest, sendPushNotification };
