const handleCors = (response) => {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      // Handle bot commands
      if (url.pathname === '/bot' && request.method === 'POST') {
        return handleBotCommand(request, env);
      }

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCors(new Response(null, { status: 204 }));
      }

      // Verify authorization header
      const authHeader = request.headers.get('Authorization');
      const expectedToken = `Bearer ${env.AUTH_TOKEN}`;
      
      // Debug logging
      console.log('Expected token:', expectedToken);
      console.log('Received header:', authHeader);
      
      if (!authHeader || authHeader !== expectedToken) {
        return handleCors(
          new Response(JSON.stringify({ 
            error: 'Unauthorized',
            message: 'Token mismatch',
            expected: expectedToken.substring(0, 5) + '...',
            received: authHeader ? authHeader.substring(0, 5) + '...' : 'none'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }

      if (request.method !== 'POST') {
        return handleCors(
          new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }

      try {
        const payload = await request.json();
        const result = await sendToTelegram(payload, env);
        return handleCors(
          new Response(JSON.stringify({ result }), {
            headers: { 'Content-Type': 'application/json' }
          })
        );
      } catch (error) {
        return handleCors(
          new Response(JSON.stringify({ 
            error: 'Bad request',
            message: error.message 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
    } catch (error) {
      return handleCors(
        new Response(JSON.stringify({ 
          error: 'Internal server error',
          details: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    }
  }
};

// New function to handle bot commands
async function handleBotCommand(request, env) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return new Response('Bot token missing', { status: 500 });
  }

  try {
    const update = await request.json();
    
    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      return await handleCallbackQuery(request, env, update.callback_query);
    }
    
    // Handle text messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === '/start') {
        return await handleStartCommand(BOT_TOKEN, chatId);
      } else if (text === '/help') {
        return await handleHelpCommand(BOT_TOKEN, chatId);
      } else if (text === '/setup') {
        return await handleSetupCommand(BOT_TOKEN, chatId);
      }
    }
    
    return new Response('OK');
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 400 });
  }
}

async function handleStartCommand(BOT_TOKEN, chatId) {
  const message = `
🎬 <b><u>Welcome to IMDB-TG-POST Bot!</u></b> 🎬  
Your personal assistant to post the latest movie & series updates to your Telegram channels and groups.

<blockquote expandable>🛠️ <b>Getting Started:</b>  
Follow these simple steps to set things up:

1️⃣ <b>Add your channel or group</b>  
2️⃣ <b>Make the bot an admin</b>  
3️⃣ 🔧 Go to the website and tap the ⚙️  
4️⃣ ➕ Add your <b>channel/group ID</b>, then save  
5️⃣ ✅ <b>Setup complete!</b>  
6️⃣ 🔍 Now you can <b>search and post</b> — test it out and see the bot in action!
</blockquote>
📌 Use the /help command to view all features and commands.

<i><u>🎉 <b>Happy posting!</b></u></i>
  `.trim();

  const buttons = [
    [
      { 
        text: "📚 Repo", 
        url: "https://github.com/tharindu899/IMDB-TG-POST" 
      },
      { 
        text: "🖇️ Site", 
        url: "https://imdb-tg-post-font.pages.dev" 
      }
    ]
  ];

  try {
    await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Failed to send start message to ${chatId}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleHelpCommand(BOT_TOKEN, chatId) {
  const message = `
🤖 <b>Bot Help Center</b>

🔍 <b>Available Commands:</b>
• /start - Welcome message and setup guide
• /help - Show this help message
• /setup - Configure your channel settings

📝 <b>How to Use:</b>
1. <b>Add me to your channel</b> as admin with post permissions
2. <b>Go to our website</b> and explore the features
3. Tap the <b>settings button (⚙️)</b> to configure
4. <b>Add your channel ID</b> and save your configuration

💡<b><i>Example Post Preview:</i></b>

<pre>&lt;blockquote&gt;
&lt;b&gt;📌 JOIN NOW! 👉 &lt;/b&gt;&lt;a href="https://t.me/flixora_site"&gt; 🗨️Flixora_site 🗨️&lt;/a&gt;
&lt;i&gt;📢 ALL NEW SERIES &amp; MOVIES 🔎 &lt;/i&gt;
&lt;tg-spoiler&gt;🌐Visit 👉 &lt;a href="https://toxybox99.eu.org"&gt; FLIXORA 💊&lt;/a&gt;&lt;/tg-spoiler&gt;
&lt;/blockquote&gt;</pre>
  `.trim();

  const buttons = [
    [
      { text: "👤 Owner", url: "https://t.me/SLtharindu1" },
      { text: "🎥 Tutorial", url: "https://example.com/tutorial" }
    ],
    [
      { text: "🆘 Support", url: "https://t.me/SLtharindu1" },
      { text: "🐛 Report Issue", url: "https://t.me/SLtharindu1" }
    ],
    [
      { text: "🌐 Visit Website", url: "https://imdb-tg-post-font.pages.dev" }
    ]
  ];

  try {
    await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Failed to send help message to ${chatId}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSetupCommand(BOT_TOKEN, chatId) {
  const message = `
⚙️ <b>Channel Setup Guide</b>

<b>Step 1:</b> Get Your Channel ID
• Forward any message from your channel to @userinfobot
• Copy the "Forwarded from chat" ID (starts with -100)

<b>Step 2:</b> Add Bot to Channel
• Add @your_bot_username to your channel
• Make bot an admin with "Post Messages" permission

<b>Step 3:</b> Configure Settings
• Go to the website: https://imdb-tg-post-font.pages.dev
• Click the settings button (⚙️)
• Enter your channel ID and save

<b>Step 4:</b> Test the Setup
• Use search site to find content
• Try posting to verify everything works

💡 <b>Need help?</b> Contact @SLtharindu1
  `.trim();

  const buttons = [
    [
      { text: "🌐 Open Website", url: "https://imdb-tg-post-font.pages.dev" },
      { text: "🤖 Get Channel ID", url: "https://t.me/userinfobot" }
    ],
    [
      { text: "💬 Get Support", url: "https://t.me/SLtharindu1" }
    ]
  ];

  try {
    await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Failed to send setup message to ${chatId}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}


async function sendToTelegram(payload, env) {
  // Get environment variables
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const TMDB_API_KEY = env.TMDB_API_KEY;
  const settings = payload.settings || {};
  const clientBanner = settings.clientBanner || '';
  
  
  if (!BOT_TOKEN) {
    throw new Error('Missing Telegram Bot Token');
  }
  
  if (!TMDB_API_KEY) {
    throw new Error('Missing TMDB API key');
  }

  // Extract payload data
  const { 
    tmdb_id,
    media_type,
    season, 
    episode, 
    custom_link, 
    note,
    channel_id
  } = payload;
  
  // Use channel ID from payload if provided
  const CHANNEL_ID = channel_id || env.TELEGRAM_CHANNEL_ID;
  
  if (!CHANNEL_ID) {
    throw new Error('Missing Telegram Channel ID');
  }
  
  if (!tmdb_id || !media_type) {
    throw new Error('Missing TMDB ID or media type');
  }

  // Get full details directly using ID
  const detailsUrl = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}?api_key=${TMDB_API_KEY}`;
  const detailsResponse = await fetch(detailsUrl);
  
  if (!detailsResponse.ok) {
    throw new Error(`TMDB API error: ${detailsResponse.status}`);
  }
  
  const details = await detailsResponse.json();

  // Handle invalid ID
  if (details.status_code === 34) {
    return "❌ Invalid TMDB ID";
  }

  // Get external IDs
  let imdbId = null;
  try {
    const externalIdsUrl = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`;
    const externalResponse = await fetch(externalIdsUrl);
    if (externalResponse.ok) {
      const externalIds = await externalResponse.json();
      imdbId = externalIds.imdb_id;
    }
  } catch (error) {
    console.error("Failed to fetch external IDs:", error);
  }

  // Fetch videos for trailer
  let trailerKey = null;
  try {
    const videosUrl = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}/videos?api_key=${TMDB_API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    if (videosResponse.ok) {
      const videosData = await videosResponse.json();
      
      if (videosData.results?.length > 0) {
        const trailer = videosData.results.find(
          v => v.site === "YouTube" && v.type === "Trailer"
        );
        if (trailer) trailerKey = trailer.key;
      }
    }
  } catch (error) {
    console.error("Failed to fetch videos:", error);
  }

  // Prepare content details
  const isSeries = media_type === 'tv';
  const contentTitle = isSeries ? details.name : details.title;
  
  function getLanguageInfo(code) {
    const languages = {
      en: { name: "English", flag: "🇺🇸" },
      es: { name: "Spanish", flag: "🇪🇸" },
      fr: { name: "French", flag: "🇫🇷" },
      de: { name: "German", flag: "🇩🇪" },
      it: { name: "Italian", flag: "🇮🇹" },
      ja: { name: "Japanese", flag: "🇯🇵" },
      ko: { name: "Korean", flag: "🇰🇷" },
      zh: { name: "Chinese", flag: "🇨🇳" },
      hi: { name: "Hindi", flag: "🇮🇳" },
      ru: { name: "Russian", flag: "🇷🇺" },
      te: { name: "Telugu", flag: "🇮🇳" },
      ta: { name: "Tamil", flag: "🇮🇳" },
      ml: { name: "Malayalam", flag: "🇮🇳" },
    };
  
    const lang = languages[code];
    return lang ? `${lang.flag} ${lang.name}` : `🌐 Unknown`;
  }
  
  const languageInfo = getLanguageInfo(details.original_language);
  const year = isSeries 
    ? (details.first_air_date?.split('-')[0] || 'N/A')
    : (details.release_date?.split('-')[0] || 'N/A');
  
  // Handle series cases
  let headerLine = "";
  let episodeInfo = ""; // Changed variable name for clarity
  
  if (isSeries) {
    const hasSeason = season !== undefined && season !== null && season !== '';
    const hasEpisode = episode !== undefined && episode !== null && episode !== '';
    
    if (hasSeason && hasEpisode) {
      const formattedSeason = String(season).padStart(2, '0');
      const formattedEpisode = String(episode).padStart(2, '0');
      headerLine = `🦠 <b>NEW EPISODE ADDED!</b> 🦠\n`;
      episodeInfo = `🔊 <b>S${formattedSeason} E${formattedEpisode}</b> 🔥\n`;
    } 
    else if (hasSeason) {
      const formattedSeason = String(season).padStart(2, '0');
      headerLine = `🦠 <b>SEASON COMPLETE!</b> 🦠\n`;
      episodeInfo = `🔊 <b>S${formattedSeason}</b> 🔥\n`;
    } 
    else {
      headerLine = `🌟 <b>NEW SERIES ADDED!</b> 🌟\n`;
    }
  } else {
    headerLine = `🌟 <b>NEW MOVIE ADDED!</b> 🌟\n`;
  }

  // Handle links - only use custom links or official sources
  let siteLink = custom_link;
  let imdbButton = null;
  
  if (imdbId) {
    imdbButton = { text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` };
  }

  // Format message
  let message = `
${headerLine}${episodeInfo}━━━━━━━━━━━━━━━━━━━

🎬 <b>${contentTitle}  (${year})</b>
📺 <b>Type:</b> ${isSeries ? 'TV Series' : 'Movie'}
🗣️ <b>Language:</b> ${languageInfo}
⭐ <b>Rating:</b> ${details.vote_average ? details.vote_average.toFixed(1) : 'N/A'}/10
🎭 <b>Genres:</b> ${details.genres?.slice(0, 3).map(g => g.name).join(', ') || 'N/A'}

📖 <b>Plot:</b> ${truncatePlot(details.overview, media_type, tmdb_id)}
  `.trim();

  // Add separator before notes/banners if they exist
  if (note || clientBanner) {
    message += `\n━━━━━━━━━━━━━━━━━━━`;
  }
  
  // Add note if provided
  if (note) {
    message += `\n💬 <b>Note:</b> ${note}`;
  }
  
  // Add client banner if exists
  if (clientBanner) {
    // Convert HTML tags to Markdown
    const markdownBanner = htmlToMarkdown(clientBanner);
    message += `\n${markdownBanner}`;
  }

  // Prepare buttons
  const buttons = [];
  
  // Add custom link if provided
  if (siteLink) {
    buttons.push([{ text: "🔗 Watch Here", url: siteLink }]);
  }
  
  // Add IMDb button if available
  if (imdbButton) {
    if (buttons.length > 0) {
      buttons[0].push(imdbButton);
    } else {
      buttons.push([imdbButton]);
    }
  }
  
  // Add TMDB button as fallback
  if (!imdbButton && !siteLink) {
    buttons.push([{ 
      text: "ℹ️ TMDB Page", 
      url: `https://www.themoviedb.org/${media_type}/${tmdb_id}`
    }]);
  }

  // Add trailer button if available
  if (trailerKey) {
    buttons.push([
      { text: "🎬 Watch Trailer", url: `https://www.youtube.com/watch?v=${trailerKey}` }
    ]);
  }

  // Prepare poster URLs to try in order
  const posterSources = [];
  
  // 1. TMDB original poster (best quality)
  if (details.poster_path) {
    posterSources.push(`https://image.tmdb.org/t/p/original${details.poster_path}`);
  }
  
  // 2. TMDB smaller size (more reliable)
  if (details.poster_path) {
    posterSources.push(`https://image.tmdb.org/t/p/w500${details.poster_path}`);
  }

  // Try all poster sources in sequence
  let lastError = null;
  
  for (const posterUrl of posterSources) {
    try {
      // Test if URL is accessible
      const headResponse = await fetch(posterUrl, { method: 'HEAD' });
      if (!headResponse.ok) continue;
      
      const photoResponse = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: CHANNEL_ID,
              photo: posterUrl,
              caption: message,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: buttons }
            })
          }
        );

      const photoResult = await photoResponse.json();
      if (photoResult.ok) return "✅ Posted to Telegram with poster!";
      
      // Log the specific error from Telegram
      console.error(`Telegram photo error:`, photoResult);
      
    } catch (error) {
      lastError = error;
      console.error(`Poster source failed (${posterUrl}):`, error.message);
      // Continue to next source
    }
  }

  // Verify bot is admin in channel
  const botStatus = await checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID);
  if (botStatus.error) {
    return botStatus.message;
  }
  if (!botStatus.isAdmin) {
    // Return error object instead of JSON string
    return {
      type: 'bot_admin_error',
      message: `❌ Bot is not an admin in your channel.`,
      botUsername: botStatus.botUsername,
      instructions: [
        `1. Add the bot to your channel`,
        `2. Promote it to admin with "Post Messages" permission`,
        `3. Try posting again`
      ]
    };
  }

  // All image sources failed - fallback to text message
  return await sendTextMessage(BOT_TOKEN, CHANNEL_ID, message, buttons);
}

async function checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID) {
  try {
    // Get bot info
    const botInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
    const botInfoResponse = await fetch(botInfoUrl);
    const botInfo = await botInfoResponse.json();
    
    if (!botInfo.ok) {
      return {
        error: true,
        message: `❌ Failed to get bot info: ${botInfo.description || 'Unknown error'}`
      };
    }
    
    const botUsername = botInfo.result.username;
    const botId = botInfo.result.id;
    
    // Check bot's status in the channel
    const memberInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL_ID)}&user_id=${botId}`;
    const memberResponse = await fetch(memberInfoUrl);
    const memberInfo = await memberResponse.json();
    
    if (!memberInfo.ok) {
      // Handle specific "member list inaccessible" error
      if (memberInfo.description && memberInfo.description.includes("member list is inaccessible")) {
        return {
          error: true,
          message: `❌ Bot is not in your channel. Please add @${botUsername} to your channel first!`,
          botUsername
        };
      }
      return {
        error: true,
        message: `❌ Failed to check bot status: ${memberInfo.description || 'Unknown error'}`,
        botUsername
      };
    }
    
    const isAdmin = ["administrator", "creator"].includes(memberInfo.result.status);
    return {
      isAdmin,
      botUsername,
      error: false
    };
  } catch (error) {
    return {
      error: true,
      message: `❌ Error checking bot status: ${error.message}`
    };
  }
}

// Dedicated function for sending text messages
async function sendTextMessage(BOT_TOKEN, CHANNEL_ID, message, buttons) {
  try {
    const payload = {
      chat_id: CHANNEL_ID,
      text: message,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    };
    
    const textResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const textResult = await textResponse.json();
    if (textResult.ok) return "✅ Content posted to Telegram (text only)";
    return `❌ Telegram error: ${textResult.description || 'Unknown error'}`;
  } catch (e) {
    return `❌ Network error: ${e.message}`;
  }
}

function truncatePlot(overview, media_type, tmdb_id) {
  if (!overview) return 'No plot available';

  // Escape HTML special characters
  const safeOverview = overview
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Always show full plot in expandable block
  return `<blockquote expandable>${safeOverview}</blockquote>`;
}

// Helper to escape markdown characters
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}

function htmlToMarkdown(html) {
  // 1. Remove any HTML comments entirely
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Convert supported tags (open + close) to Telegram-safe HTML
  return html
    // bold
    .replace(/<b>/g, '<b>').replace(/<\/b>/g, '</b>')
    .replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>')
    // italic
    .replace(/<i>/g, '<i>').replace(/<\/i>/g, '</i>')
    .replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>')
    // code / pre
    .replace(/<code>/g, '<code>').replace(/<\/code>/g, '</code>')
    .replace(/<pre>/g, '<pre>').replace(/<\/pre>/g, '</pre>')
    // spoiler
    .replace(/<spoiler>/g, '<tg-spoiler>').replace(/<\/spoiler>/g, '</tg-spoiler>')
    // links
    .replace(
      /<a\s+href="([^"]*)">([\s\S]*?)<\/a>/g,
      '<a href="$1">$2</a>'
    );
}

// Handle callback queries from inline buttons
async function handleCallbackQuery(request, env, callbackQuery) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.callback_data;
  const queryId = callbackQuery.id;

  // Answer the callback query first
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: queryId,
      text: "Processing your request..."
    })
  });

  try {
    if (data.startsWith('post_')) {
      // Extract media type and ID from callback data
      const parts = data.split('_');
      const mediaType = parts[1]; // 'movie' or 'tv' 
      const tmdbId = parts[2];

      // Create payload for posting
      const payload = {
        tmdb_id: tmdbId,
        media_type: mediaType,
        channel_id: env.TELEGRAM_CHANNEL_ID, // Use default channel or get from user settings
        settings: {}
      };

      // Post to Telegram using existing function
      const result = await sendToTelegram(payload, env);
      
      // Send confirmation message
      let confirmMessage;
      if (typeof result === 'string' && result.includes('✅')) {
        confirmMessage = `✅ <b>Posted successfully!</b>\n\nContent has been posted to your channel.`;
      } else {
        confirmMessage = `❌ <b>Failed to post:</b>\n\n${typeof result === 'object' ? result.message : result}`;
      }

      await sendTextMessage(BOT_TOKEN, chatId, confirmMessage, []);
      
    } else if (data === 'setup_guide') {
      return await handleSetupCommand(BOT_TOKEN, chatId);
    }

    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback query error:', error);
    const errorMessage = `❌ <b>Error:</b> ${error.message}`;
    await sendTextMessage(BOT_TOKEN, chatId, errorMessage, []);
    return new Response('OK', { status: 200 });
  }
}