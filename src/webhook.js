const express = require('express');
const router = express.Router();
const { verifyWebhookSignature, sendDM, getUserName } = require('./instagram');
const { matchComment, renderDM } = require('./matcher');
const { isInCooldown, setCooldown } = require('./store');
const { appendLog } = require('./logger');

// ── GET /webhook — Meta verification handshake ────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('[webhook] Verified successfully');
    return res.status(200).send(challenge);
  }
  console.warn('[webhook] Verification failed — token mismatch');
  res.sendStatus(403);
});

// ── POST /webhook — incoming comment events ───────────────────────────
// rawBody is attached by the middleware in server.js BEFORE any body parser
router.post('/', async (req, res) => {
  const sig = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody;

  // If META_APP_SECRET is not set, skip signature check (dev mode)
  if (process.env.META_APP_SECRET) {
    if (!rawBody || !verifyWebhookSignature(rawBody, sig)) {
      console.warn('[webhook] Invalid signature — request rejected');
      console.warn('[webhook] sig received:', sig);
      return res.sendStatus(401);
    }
  }

  let body;
  try {
    body = JSON.parse((rawBody || req.body || '').toString());
  } catch {
    console.warn('[webhook] Could not parse body');
    return res.sendStatus(400);
  }

  // Respond to Meta immediately (must be within 5s)
  res.sendStatus(200);

  // Process asynchronously
  try {
    await processWebhookEvent(body);
  } catch (err) {
    console.error('[webhook] Processing error:', err.message);
  }
});

async function processWebhookEvent(body) {
  if (body.object !== 'instagram') {
    console.log('[webhook] Non-instagram event, skipping:', body.object);
    return;
  }

  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      console.log('[webhook] Change field:', change.field);
      if (change.field !== 'comments') continue;

      const value = change.value;
      const commentText = value.text;
      const commenterId = value.from?.id;
      const commenterName = value.from?.username || value.from?.name || 'unknown';
      const mediaId = value.media?.id;

      if (!commenterId || !commentText || !mediaId) {
        console.log('[webhook] Missing fields — commenterId:', commenterId, 'text:', commentText, 'mediaId:', mediaId);
        continue;
      }

      console.log(`[comment] @${commenterName}: "${commentText}" on media ${mediaId}`);

      // Skip our own comments (prevent loops)
      const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (commenterId === accountId) {
        console.log('[webhook] Skipping own comment');
        continue;
      }

      // Check cooldown
      if (isInCooldown(commenterId)) {
        console.log(`[cooldown] Skipping @${commenterName} — DM sent recently`);
        continue;
      }

      // Match against rules
      const match = matchComment(commentText, mediaId);
      if (!match) {
        console.log(`[no-match] No keyword matched for: "${commentText}"`);
        continue;
      }

      // Get first name
      const firstName = await getUserName(commenterId);
      const dmText = renderDM(match.dm, firstName);

      // Send DM
      try {
        await sendDM(commenterId, dmText);
        setCooldown(commenterId);
        appendLog({
          user: '@' + commenterName,
          userId: commenterId,
          comment: commentText,
          keyword: match.matchedKeyword,
          reelTitle: match.reelTitle || 'Global rule',
          mediaId,
          source: match.source
        });
        console.log(`[dm-sent] → @${commenterName} | keyword: "${match.matchedKeyword}" | source: ${match.source}`);
      } catch (err) {
        console.error(`[dm-error] Failed to DM @${commenterName}:`, err.response?.data || err.message);
      }
    }
  }
}

module.exports = router;
