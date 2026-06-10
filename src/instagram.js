const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://graph.facebook.com/v19.0';

function getToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN;
}

// ── Send a DM to a user via Instagram Messaging API ──────────────────
async function sendDM(recipientId, message) {
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const url = `${BASE_URL}/${accountId}/messages`;

  const payload = {
    recipient: { id: recipientId },
    message: { text: message },
    messaging_type: 'RESPONSE'
  };

  const response = await axios.post(url, payload, {
    params: { access_token: getToken() },
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data;
}

// ── Get user's first name from their profile ─────────────────────────
async function getUserName(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/${userId}`, {
      params: {
        fields: 'name',
        access_token: getToken()
      }
    });
    const full = response.data.name || '';
    return full.split(' ')[0] || 'there';
  } catch {
    return 'there';
  }
}

// ── Verify that webhook payload came from Meta ───────────────────────
function verifyWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // skip if not configured (dev mode)

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ── Refresh long-lived token before it expires ───────────────────────
async function refreshToken() {
  try {
    const response = await axios.get(`${BASE_URL}/oauth/access_token`, {
      params: {
        grant_type: 'ig_refresh_token',
        access_token: getToken()
      }
    });
    console.log('[token] Refreshed. Expires in:', response.data.expires_in, 'seconds');
    // In production, you'd persist this new token to env or a secrets manager
    return response.data.access_token;
  } catch (err) {
    console.error('[token] Refresh failed:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { sendDM, getUserName, verifyWebhookSignature, refreshToken };
