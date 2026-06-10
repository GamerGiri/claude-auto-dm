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
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify signature first
  const sig = req.headers['x-hub-signature-256'];
  if (!verifyWebhookSignature(req.body, sig)) {
    console.warn('[webhook] Invalid signature — request rejected');
    return res.sendStatus(401);
  }

  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch {
    return res.sendStatus(400);
  }

  // Respond to Meta immediately (required within 5s)
  res.sendStatus(200);

  // Process asynchronously
  try {
    await processWebhookEvent(body);
  } catch (err) {
    console.error('[webhook] Processing error:', err.message);
  }
});

async function processWebhookEvent(body) {
  if (body.object !== 'instagram') return;

  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      if (change.field !== 'comments') continue;

      const value = change.value;
      const commentText = value.text;
      const commenterId = value.from?.id;
      const commenterName = value.from?.username || value.from?.name || 'unknown';
      const mediaId = value.media?.id;
      const commentId = value.id;

      if (!commenterId || !commentText || !mediaId) continue;

      console.log(`[comment] @${commenterName}: "${commentText}" on media ${mediaId}`);

      // Skip our own comments (prevent loops)
      const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (commenterId === accountId) continue;

      // Check cooldown — don't spam the same user
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

      // Fetch first name for personalisation
      const firstName = await getUserName(commenterId);

      // Render DM with name substitution
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
