const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'activity.json');
const MAX_ENTRIES = 500;

function ensureLog() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]');
}

function appendLog(entry) {
  ensureLog();
  let logs = [];
  try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
  logs.unshift({ ...entry, ts: Date.now() });
  if (logs.length > MAX_ENTRIES) logs = logs.slice(0, MAX_ENTRIES);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function readLog(limit = 50) {
  ensureLog();
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

function getStats() {
  ensureLog();
  let logs = [];
  try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}

  const now = Date.now();
  const oneDay = 86400000;
  const oneWeek = 7 * oneDay;

  const today = logs.filter(l => now - l.ts < oneDay).length;
  const week = logs.filter(l => now - l.ts < oneWeek).length;
  const keywords = [...new Set(logs.map(l => l.keyword))].length;

  return { today, week, total: logs.length, uniqueKeywords: keywords };
}

module.exports = { appendLog, readLog, getStats };
