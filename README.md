# 🎬 IMDB-TG-POST - Telegram Content Poster

Automatically post movies and TV shows to Telegram channels with rich media previews.

## 🔧 Full Setup Instructions

### 1. Prerequisites
- **Cloudflare Account**: Required for Workers and Pages
- **GitHub Account**: For repository hosting and CI/CD
- **Telegram Account**: For bot and channel creation
- **TMDB Account**: For API access

### 2. Cloudflare Account Setup
1. Create Cloudflare account at [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. Verify your email address
3. Add a payment method (required for Workers beyond free tier)

### 3. Cloudflare API Token Permissions
Create API token with these permissions:
1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Add these additional permissions:
   - **Account**: Workers KV Storage: Edit
   - **Account**: Workers Scripts: Edit
   - **Account**: Workers Tail: Read
   - **Account**: Cloudflare Pages: Edit
   - **Zone**: Cache Purge: Purge
5. Limit token to specific resources:
   - Include: All accounts
   - Include: Specific zone (your domain if using custom domain)
6. Save token securely (will be used in GitHub Secrets)

### 4. Clone Repository
```bash
git clone https://github.com/your-username/imdb-tg-post.git
cd imdb-tg-post
```

### 5. Backend Setup (Cloudflare Worker)
1. Create new Worker:
   - Go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
   - Click "Create application"
   - Choose "Create Worker"
   - Name: `imdb-tg-post-back`

2. Set environment variables:
   - Go to Worker → Settings → Variables
   - Add these variables under "Environment Variables":
     - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
     - `TMDB_API_KEY`: Your TMDB API key
     - `AUTH_TOKEN`: Generated secure token (`openssl rand -hex 32`)
   - Add under "Secrets":
     - Repeat same variables as secrets

### 6. Frontend Configuration
Edit `public/script.js`:
```javascript
// ======= REQUIRED CONFIGURATION ======= //
const workerUrl = 'https://your-worker.your-username.workers.dev';
const AUTH_TOKEN = 'same-as-worker-auth-token';
// ===================================== //
```

### 7. Telegram Configuration
1. Create bot with [@BotFather](https://t.me/BotFather):
   ```text
   /newbot
   Bot name: MyContentBot
   Username: MyContentBot
   ```
2. Save API token
3. Create channel and add bot as admin with:
   - "Post messages" permission
   - "Edit messages" permission (recommended)

4. Set webhook: use terminal (termux)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-worker.your-username.workers.dev/bot"}' \
  "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook"
```

### 8. GitHub Secrets Configuration
Set these in repo → Settings → Secrets → Actions:
| Secret Name          | Value                                  |
|----------------------|----------------------------------------|
| `CF_API_TOKEN`       | Cloudflare API token with permissions  |
| `CF_ACCOUNT_ID`      | Cloudflare account ID                  |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token                     |
| `TMDB_API_KEY`       | TMDB API key                           |
| `AUTH_TOKEN`         | Same token as in worker                |

### 9. Deploy via GitHub Actions
1. Push to main branch:
```bash
git add .
git commit -m "Initial setup"
git push origin main
```
2. Monitor deployment in GitHub → Actions

### 10. Final Configuration
1. Access frontend: `https://your-project.pages.dev`
2. Open settings (⚙️) and enter:
   - Telegram Channel ID
   - (Optional) Default custom domain
3. Save settings

## 🔒 Required Cloudflare Permissions
For the API token, these permissions are required:

| Service           | Permission | Reason |
|-------------------|------------|--------|
| Account Settings  | Read       | Access account info |
| Cloudflare Pages  | Edit       | Deploy frontend |
| Workers Scripts   | Edit       | Deploy worker |
| Workers Secrets   | Edit       | Set environment variables |
| Workers KV Storage| Edit       | Future feature support |
| Zone Cache Purge  | Purge      | Clear cache after deploy |

## 🚀 Usage Guide
1. **Search Content**: Type movie/TV show title
2. **Select Result**: Choose from TMDB results
3. **Add Details** (optional):
   - Season/Episode numbers
   - Custom link
   - Personal note
4. **Post to Telegram**: Click submit button

## ⚠️ Troubleshooting
**Deployment Fails:**
- Verify Cloudflare API token permissions
- Check account limits (free tier has daily limits)
- Ensure secrets are correctly set in GitHub

**Telegram Issues:**
- Check bot is channel admin: `/admin` in channel
- Verify webhook: `https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo`
- Test bot commands in private chat

**TMDB Errors:**
- Validate API key at TMDB
- Check worker logs for failed requests
- Ensure worker has internet access

## 📂 Project Structure
```
imdb-tg-post/
├── README.md
├── .gitignore
├── worker/            # Cloudflare Worker
│    ├── src
│    │     └── worker.js      # Backend logic
│    ├── package.json
│    └── wrangler.toml  # Deployment config
├── public/            # Frontend
│    ├── index.html     # Main UI
│    ├── script.js      # Client logic (configure here)
│    └── style.css      # Styles
└── .github/workflows  # CI/CD
    └── deploy.yml     # Deployment workflow
```

## 📜 License
MIT License - Free for personal and commercial use
