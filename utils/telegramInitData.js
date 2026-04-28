const crypto = require("crypto");

const AUTH_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

/**
 * Validates Telegram Web App initData (query string).
 * @see https://core.telegram.org/bots/webapp#validating-data-received-via-the-mini-app
 * @returns {{ id: string, username?: string, first_name: string } | null} user on success
 */
function parseAndVerifyInitData(initDataString, botToken) {
  if (!initDataString || typeof initDataString !== "string") {
    return { ok: false, error: "missing_init_data" };
  }

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, error: "missing_hash" };
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    return { ok: false, error: "missing_auth_date" };
  }
  const authDate = parseInt(authDateRaw, 10);
  if (!Number.isFinite(authDate)) {
    return { ok: false, error: "invalid_auth_date" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > AUTH_MAX_AGE_SEC) {
    return { ok: false, error: "auth_date_expired" };
  }

  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push([key, value]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "invalid_hash" };
  }

  const userJson = params.get("user");
  if (!userJson) {
    return { ok: false, error: "missing_user" };
  }

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    return { ok: false, error: "invalid_user_json" };
  }

  if (!user || typeof user.id !== "number" || !Number.isFinite(user.id)) {
    return { ok: false, error: "invalid_user_id" };
  }

  const firstName = typeof user.first_name === "string" ? user.first_name : "";
  // Note: first_name is optional — Telegram allows accounts with no first name set.
  // Do NOT reject auth based on first_name absence.

  return {
    ok: true,
    user: {
      id: String(user.id),
      username: typeof user.username === "string" ? user.username : undefined,
      first_name: firstName,
    },
  };
}

module.exports = { parseAndVerifyInitData, AUTH_MAX_AGE_SEC };
