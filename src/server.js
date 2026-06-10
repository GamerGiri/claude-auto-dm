require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const webhookRouter = require('./webhook');
const apiRouter = require('./api');
const keepAlive = require('./keepalive');
const { refreshToken } = require('./instagram');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Rate limit all API routes (not webhook — Meta needs unrestricted access)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
});
app.use('/api', limiter);

// ── Parse JSON for API routes (webhook parses its own raw body) ───────
app.use('/api', express.json());

// ── Routes ────────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

// ── Static frontend (served from /public) ────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Health check — used by keep-alive pinger ──────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Instagram DM Bot running on port ${PORT}`);
  console.log(`   Webhook:  POST /webhook`);
  console.log(`   Health:   GET  /health`);
  console.log(`   API:      GET  /api/rules\n`);

  // Start keep-alive self-pinger
  keepAlive.start();

  // Schedule daily token refresh
  keepAlive.scheduleTokenRefresh(refreshToken);
});

module.exports = app;
