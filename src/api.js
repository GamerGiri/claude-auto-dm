const express = require('express');
const router = express.Router();
const { loadRules, saveRules } = require('./store');
const { readLog, getStats } = require('./logger');

// Simple password middleware
function auth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password === 'changeme') return next(); // skip if not set
  const provided = req.headers['x-admin-password'] || req.query.password;
  if (provided !== password) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(auth);

// ── GET /api/rules — get all rules ────────────────────────────────────
router.get('/rules', (req, res) => {
  res.json(loadRules());
});

// ── PUT /api/rules/global — update global rule ────────────────────────
router.put('/rules/global', express.json(), (req, res) => {
  const rules = loadRules();
  const { keywords, dm, active } = req.body;
  if (keywords !== undefined) rules.global.keywords = keywords;
  if (dm !== undefined) rules.global.dm = dm;
  if (active !== undefined) rules.global.active = active;
  saveRules(rules);
  res.json({ ok: true, global: rules.global });
});

// ── POST /api/rules/reels — add a new reel rule ───────────────────────
router.post('/rules/reels', express.json(), (req, res) => {
  const rules = loadRules();
  const { mediaId, title, keywords, dm, active } = req.body;

  if (!mediaId || !keywords?.length || !dm) {
    return res.status(400).json({ error: 'mediaId, keywords[], and dm are required' });
  }

  // Don't allow duplicate mediaId
  if (rules.reels.find(r => r.mediaId === mediaId)) {
    return res.status(409).json({ error: 'A rule for this reel already exists. Use PUT to update.' });
  }

  const newRule = {
    id: Date.now().toString(),
    mediaId,
    title: title || 'Untitled reel',
    keywords,
    dm,
    active: active !== false,
    createdAt: new Date().toISOString()
  };

  rules.reels.push(newRule);
  saveRules(rules);
  res.status(201).json({ ok: true, rule: newRule });
});

// ── PUT /api/rules/reels/:id — update a reel rule ─────────────────────
router.put('/rules/reels/:id', express.json(), (req, res) => {
  const rules = loadRules();
  const idx = rules.reels.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Rule not found' });

  const { title, keywords, dm, active, mediaId } = req.body;
  if (title !== undefined) rules.reels[idx].title = title;
  if (keywords !== undefined) rules.reels[idx].keywords = keywords;
  if (dm !== undefined) rules.reels[idx].dm = dm;
  if (active !== undefined) rules.reels[idx].active = active;
  if (mediaId !== undefined) rules.reels[idx].mediaId = mediaId;
  rules.reels[idx].updatedAt = new Date().toISOString();

  saveRules(rules);
  res.json({ ok: true, rule: rules.reels[idx] });
});

// ── DELETE /api/rules/reels/:id — remove a reel rule ─────────────────
router.delete('/rules/reels/:id', (req, res) => {
  const rules = loadRules();
  const idx = rules.reels.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Rule not found' });
  rules.reels.splice(idx, 1);
  saveRules(rules);
  res.json({ ok: true });
});

// ── GET /api/log — activity log ───────────────────────────────────────
router.get('/log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(readLog(limit));
});

// ── GET /api/stats — summary counts ──────────────────────────────────
router.get('/stats', (req, res) => {
  res.json(getStats());
});

module.exports = router;
