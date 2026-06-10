const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'rules.json');
const COOLDOWN_FILE = path.join(__dirname, '..', 'data', 'cooldowns.json');

function ensureFile(filePath, defaultData) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

const defaultRules = {
  global: {
    keywords: ['link', 'info', 'send', 'price', 'more'],
    dm: "Hi {{name}}! Thanks for your comment. Here's what you asked for: [your link here]",
    active: true
  },
  reels: []
};

function loadRules() {
  ensureFile(DATA_FILE, defaultRules);
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return defaultRules;
  }
}

function saveRules(rules) {
  ensureFile(DATA_FILE, rules);
  fs.writeFileSync(DATA_FILE, JSON.stringify(rules, null, 2));
}

function loadCooldowns() {
  ensureFile(COOLDOWN_FILE, {});
  try {
    return JSON.parse(fs.readFileSync(COOLDOWN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCooldowns(cooldowns) {
  ensureFile(COOLDOWN_FILE, cooldowns);
  fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2));
}

// Returns true if user is in cooldown (already DMed recently)
function isInCooldown(userId) {
  const cooldowns = loadCooldowns();
  const cooldownMinutes = parseInt(process.env.DM_COOLDOWN_MINUTES || '60');
  const last = cooldowns[userId];
  if (!last) return false;
  const elapsed = (Date.now() - last) / 1000 / 60;
  return elapsed < cooldownMinutes;
}

function setCooldown(userId) {
  const cooldowns = loadCooldowns();
  cooldowns[userId] = Date.now();
  // Clean up old entries (>24h) to keep file small
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const id in cooldowns) {
    if (cooldowns[id] < cutoff) delete cooldowns[id];
  }
  saveCooldowns(cooldowns);
}

module.exports = { loadRules, saveRules, isInCooldown, setCooldown };
