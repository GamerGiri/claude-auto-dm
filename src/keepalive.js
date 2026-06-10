const cron = require('node-cron');
const axios = require('axios');

let keepAliveJob = null;

function start() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    console.log('[keepalive] RENDER_EXTERNAL_URL not set — skipping keep-alive pings.');
    return;
  }

  const intervalMinutes = parseInt(process.env.KEEPALIVE_INTERVAL_MINUTES || '13');

  // node-cron syntax: run every N minutes
  const cronExpr = `*/${intervalMinutes} * * * *`;

  keepAliveJob = cron.schedule(cronExpr, async () => {
    try {
      const start = Date.now();
      await axios.get(`${url}/health`, { timeout: 10000 });
      console.log(`[keepalive] Pinged ${url}/health — ${Date.now() - start}ms`);
    } catch (err) {
      console.warn('[keepalive] Ping failed:', err.message);
    }
  });

  console.log(`[keepalive] Scheduled self-ping every ${intervalMinutes} minutes → ${url}/health`);
}

function stop() {
  if (keepAliveJob) {
    keepAliveJob.stop();
    keepAliveJob = null;
  }
}

// Also schedule a daily token refresh (Instagram tokens expire every 60 days;
// refreshing daily keeps it alive indefinitely)
function scheduleTokenRefresh(refreshFn) {
  cron.schedule('0 3 * * *', async () => {
    console.log('[token] Running daily token refresh...');
    await refreshFn();
  });
  console.log('[token] Daily token refresh scheduled at 03:00 UTC');
}

module.exports = { start, stop, scheduleTokenRefresh };
