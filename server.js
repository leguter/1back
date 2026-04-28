const app = require("./app");
const { autoConfirmPaidOrders } = require("./services/order.service");

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// ─── Auto-Confirm Cron ────────────────────────────────────────────────────────
// Runs every hour. Auto-confirms any 'paid' order older than 72 hours
// that has no open dispute — prevents seller funds being locked forever.
const AUTO_CONFIRM_HOURS = 72;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runAutoConfirmCron() {
  try {
    await autoConfirmPaidOrders(AUTO_CONFIRM_HOURS);
  } catch (e) {
    console.error("[auto-confirm cron] Unexpected error:", e.message);
  }
}

// Run once shortly after startup, then on interval
setTimeout(runAutoConfirmCron, 30 * 1000); // 30s after start
setInterval(runAutoConfirmCron, CRON_INTERVAL_MS);
