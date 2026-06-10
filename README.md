# Instagram Comment → DM Auto-Reply Bot

Automatically sends a DM to anyone who comments a trigger keyword on your Instagram reels.

- Per-reel keyword rules + a global fallback rule
- `{{name}}` personalisation in DM templates
- DM cooldown (won't spam the same user)
- Self-pinging keep-alive (prevents Render free tier spin-down)
- Daily Instagram token refresh
- REST API to manage rules and read activity logs

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/you/instagram-dm-bot.git
cd instagram-dm-bot
npm install
cp .env.example .env
```

### 2. Meta / Instagram setup

You need a **Meta Developer App** connected to an **Instagram Professional account**.

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add **Instagram** product to your app
3. Under **Instagram → API setup**, connect your Instagram Professional account
4. Generate a **long-lived access token** (valid 60 days; the bot auto-refreshes it daily)
5. Copy your **Instagram Business Account ID** (shown in the API setup panel)
6. Copy your **App Secret** from App Settings → Basic

### 3. Configure `.env`

```env
INSTAGRAM_ACCESS_TOKEN=EAABsbCS...          # long-lived token
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841412345  # your IG account ID
WEBHOOK_VERIFY_TOKEN=my_random_string_123   # any string you pick
META_APP_SECRET=abc123def456               # from App Settings → Basic
ADMIN_PASSWORD=yourpassword
RENDER_EXTERNAL_URL=https://your-app.onrender.com
```

### 4. Run locally

```bash
npm run dev
```

Expose locally with [ngrok](https://ngrok.com) for webhook testing:

```bash
ngrok http 3000
# copy the https URL e.g. https://abc123.ngrok.io
```

### 5. Register webhook in Meta dashboard

1. In your Meta App → Instagram → Webhooks
2. Callback URL: `https://abc123.ngrok.io/webhook`
3. Verify Token: same value as `WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Subscribe to: **comments**

---

## Deploy to Render

### Option A — render.yaml (recommended)

1. Push your code to GitHub (make sure `data/` and `.env` are in `.gitignore`)
2. In Render dashboard → New → Blueprint → connect your repo
3. Set the secret env vars in the Render dashboard (those marked `sync: false` in `render.yaml`)
4. Deploy

### Option B — manual

1. Render dashboard → New Web Service → connect GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add all env vars from `.env.example` in the Environment tab
5. Deploy

### Preventing spin-down (free tier)

The bot self-pings its own `/health` endpoint every **13 minutes** via `node-cron`.  
Set `RENDER_EXTERNAL_URL` to your Render service URL and it works automatically.

> **Tip:** Upgrading to Render's Starter plan ($7/month) disables spin-down natively and removes the need for self-pinging.

### Update webhook URL after deploy

Once deployed, go back to Meta App → Webhooks and update the callback URL to:
```
https://your-app.onrender.com/webhook
```

---

## API reference

All API routes require the `x-admin-password` header (or `?password=` query param) if `ADMIN_PASSWORD` is set.

### Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rules` | Get all rules (global + reels) |
| `PUT` | `/api/rules/global` | Update the global fallback rule |
| `POST` | `/api/rules/reels` | Add a new reel-specific rule |
| `PUT` | `/api/rules/reels/:id` | Update a reel rule |
| `DELETE` | `/api/rules/reels/:id` | Delete a reel rule |

#### Add reel rule — `POST /api/rules/reels`

```json
{
  "mediaId": "17854360229135492",
  "title": "My product launch reel",
  "keywords": ["link", "price", "send me", "info"],
  "dm": "Hi {{name}}! Here's the link: https://mystore.com 🎉",
  "active": true
}
```

> **How to find mediaId:** Use the Instagram Graph API:  
> `GET https://graph.facebook.com/v19.0/{ig-user-id}/media?fields=id,caption,media_type&access_token={token}`

#### Update global rule — `PUT /api/rules/global`

```json
{
  "keywords": ["link", "send", "info"],
  "dm": "Hi {{name}}! Here you go 👇 https://mylink.bio",
  "active": true
}
```

### Logs & stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/log?limit=50` | Recent activity (default 50 entries) |
| `GET` | `/api/stats` | Counts: today, this week, total |

### Health

```
GET /health
→ { "status": "ok", "uptime": 3600, "ts": "2024-01-15T12:00:00.000Z" }
```

---

## DM template variables

| Placeholder | Replaced with |
|-------------|---------------|
| `{{name}}` | Commenter's first name (falls back to "there") |

Example: `"Hi {{name}}, here's the link!"` → `"Hi Sarah, here's the link!"`

---

## How matching works

1. A comment arrives via webhook
2. Bot checks if there's an **active reel-specific rule** for that media ID
3. If yes and a keyword matches → send that reel's DM
4. If no reel rule matches → check **global rule** keywords
5. If global matches → send global DM
6. If neither matches → do nothing
7. If user was already DM'd within `DM_COOLDOWN_MINUTES` → skip (prevents spam)

---

## File structure

```
instagram-dm-bot/
├── src/
│   ├── server.js       # Express app + startup
│   ├── webhook.js      # Meta webhook handler
│   ├── api.js          # Admin REST API
│   ├── matcher.js      # Keyword matching engine
│   ├── instagram.js    # Graph API client (DM + token refresh)
│   ├── store.js        # JSON file persistence
│   ├── keepalive.js    # Self-ping + token refresh scheduler
│   └── logger.js       # Activity log
├── data/               # Auto-created at runtime (gitignored)
│   ├── rules.json
│   ├── cooldowns.json
│   └── activity.json
├── .env.example
├── render.yaml
└── package.json
```

---

## Meta permissions required

Your Meta app needs these approved permissions:

- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`
- `pages_show_list`
- `pages_read_engagement`

For accounts with followers, Meta may require **App Review** before `instagram_manage_messages` is granted in production.
