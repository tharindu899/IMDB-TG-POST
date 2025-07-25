# 🎬 IMDB-TG-POST - Telegram Content Poster

Automatically post movies and TV shows to Telegram channels with rich media previews.

## 🌟 Features
- Search TMDB database
- Preview content details
- Customize with episode info, notes & links
- Post directly to Telegram channels
- Multi-user support with channel settings
- Responsive modern UI

## 🔧 Setup Instructions

### 1. Environment Setup
Create a `.dev.vars` file in the worker directory with:
```ini
TELEGRAM_BOT_TOKEN="your_bot_token"
TMDB_API_KEY="your_tmdb_api_key"
AUTH_TOKEN="your_secure_random_token"
```

Generate a secure token with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Telegram Bot
1. Start a chat with [@BotFather](https://t.me/BotFather)
2. Use `/newbot` command to create a bot
3. Save the API token provided

### 3. Configure Telegram Channel
1. Create a Telegram channel
2. Add your bot as administrator with "Post Messages" permission
3. Note your channel ID:
   - For public channels: `@channelname`
   - For private channels: 
     - Forward a message from channel to `@RawDataBot`
     - Look for "Forwarded from chat" ID

### 4. Get TMDB API Key
1. Create account at [TMDB](https://www.themoviedb.org)
2. Go to [API Settings](https://www.themoviedb.org/settings/api)
3. Create new API key (choose "Developer" type)

### 5. Deployment
#### Option 1: Manual Deployment
1. Deploy worker to Cloudflare Workers:
```bash
cd worker
wrangler deploy
```

2. Deploy frontend to any static hosting:
```bash
cd frontend
npm run build
# Upload build directory to hosting
```

#### Option 2: Automated Deployment
Set these GitHub Secrets:
```ini
TELEGRAM_BOT_TOKEN
TMDB_API_KEY
AUTH_TOKEN
CF_API_TOKEN
CF_ACCOUNT_ID
```

Push to main branch to trigger deployment.

## 🚀 Usage Guide

### 1. Access the App
Open the deployed frontend URL in your browser.

### 2. Configure Channel
1. Click ⚙️ Settings button
2. Enter your Telegram Channel ID
3. Click "Save Settings"

### 3. Post Content
1. Search for a movie or TV show
2. Select from results
3. Add optional details:
   - Season/Episode numbers
   - Custom link
   - Personal note
4. Click "Post to Telegram"

## 🔒 Security Features
- Bearer token authentication for API
- Secrets encryption in transit
- Local storage for user settings
- CORS protection
- Secure token generation

## 📂 File Structure
```
cinemahub/
├── worker/
│   ├── worker.js          # Cloudflare worker code
│   └── .dev.vars          # Environment variables
├── public/
│   ├── index.html         # Main application
│   ├── script.js          # Client-side logic
│   └── style.css          # Styling
└── README.md              # This documentation
```

## 🤖 Telegram Message Format
Messages will include:
- Rich media preview (poster image)
- Title, year, and rating
- Content type and language
- Genre information
- Truncated plot with "Read more" link
- Custom buttons:
  - "Watch Here" (custom link)
  - IMDb page (when available)
  - Trailer link (when available)

## ⚠️ Troubleshooting
**Problem:** Messages not posting  
**Solution:** Verify bot has admin permissions in channel

**Problem:** "Unauthorized" error  
**Solution:** Ensure correct AUTH_TOKEN is set in worker and frontend

**Problem:** Images not showing  
**Solution:** Check TMDB API key validity and network access

**Problem:** "Channel ID not set"  
**Solution:** Configure channel ID in settings modal

## 📜 License
MIT License - Free for personal and commercial use
