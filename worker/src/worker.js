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
      
      // Handle CORS preflight first
      if (request.method === 'OPTIONS') {
        return handleCors(new Response(null, { status: 204 }));
      }

      // Handle bot commands
      if (url.pathname === '/bot' && request.method === 'POST') {
        const response = await handleBotCommand(request, env);
        return handleCors(response);
      }

      // Verify authorization for other endpoints
      const authHeader = request.headers.get('Authorization');
      const expectedToken = `Bearer ${env.AUTH_TOKEN}`;
      
      if (!authHeader || authHeader !== expectedToken) {
        return handleCors(
          new Response(JSON.stringify({ 
            error: 'Unauthorized',
            message: 'Invalid authentication token'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }

      // Process POST requests
      if (request.method === 'POST') {
        const payload = await request.json();
        const result = await sendToTelegram(payload, env);
        return handleCors(
          new Response(JSON.stringify({ result }), {
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }

      // Handle unsupported methods
      return handleCors(
        new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        })
      );
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
}

async function handleBotCommand(request, env) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return new Response('Bot token missing', { status: 500 });
  }

  try {
    const update = await request.json();
    
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      switch (text.split(' ')[0]) {
        case '/start':
          return handleStartCommand(BOT_TOKEN, chatId);
        case '/help':
          return handleHelpCommand(BOT_TOKEN, chatId);
        default:
          return new Response('OK'); // Ignore unsupported commands
      }
    }
    
    return new Response('OK');
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 400 });
  }
}

async function handleStartCommand(BOT_TOKEN, chatId) {
  const message = `🎬 *Welcome to IMDB-TG-POST Bot!* 🎬\n\nI help you post new content updates to your channel. Use /help to see available commands and setup instructions.`;
  
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

  await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
  return new Response('OK');
}

async function handleHelpCommand(BOT_TOKEN, chatId) {
  const message = `🤖 *Bot Help Center*\n\nHere are the available commands:\n\n` +
    `• /start - Welcome IMDB-TG-POST\n` +
    `• /help - Show this help message\n\n` +
    `*How to use:*\n` +
    `1. Add me to your channel as admin\n` +
    `2. Go to site & explore\n` +
    `3. Add your channel ID form the top setting botton\n\n` +
    `4. save and use your imdb and link share to Telegram channel:`;
  
  const buttons = [
    [
      { text: "📚 Owner",
        url: "https://t.me/SLtharindu1" },
      { text: "🎥 Tutorial",
        url: "https://example.com/tutorial" }
    ],
    [
      { text: "❓ Support",
        url: "https://t.me/SLtharindu1" },
      { text: "🐛 Report Issue", 
        url: "https://t.me/SLtharindu1" }
    ]
  ];

  await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
  return new Response('OK');
}

async function sendToTelegram(payload, env) {
  // Validate required parameters
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const TMDB_API_KEY = env.TMDB_API_KEY;
  
  if (!BOT_TOKEN) throw new Error('Missing Telegram Bot Token');
  if (!TMDB_API_KEY) throw new Error('Missing TMDB API key');

  const { 
    tmdb_id,
    media_type,
    season, 
    episode, 
    custom_link, 
    note,
    channel_id
  } = payload;
  
  const CHANNEL_ID = channel_id || env.TELEGRAM_CHANNEL_ID;
  if (!CHANNEL_ID) throw new Error('Missing Telegram Channel ID');
  if (!tmdb_id || !media_type) throw new Error('Missing TMDB ID or media type');

  // Verify bot admin status first to avoid unnecessary work
  const botStatus = await checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID);
  if (!botStatus.isAdmin) {
    return {
      error: 'bot_admin_error',
      message: `❌ Bot is not an admin in your channel`,
      botUsername: botStatus.botUsername,
      instructions: [
        `1. Add @${botStatus.botUsername} to your channel`,
        `2. Promote it to admin with "Post Messages" permission`,
        `3. Try posting again`
      ]
    };
  }

  // Fetch all data in parallel
  const [detailsRes, externalRes, videosRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}?api_key=${TMDB_API_KEY}`),
    fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`),
    fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/videos?api_key=${TMDB_API_KEY}`)
  ]);

  const [details, externalIds, videosData] = await Promise.all([
    detailsRes.json(),
    externalRes.json(),
    videosRes.json()
  ]);

  // Handle invalid ID
  if (details.status_code === 34) return "❌ Invalid TMDB ID";

  // Process trailer
  const trailer = videosData.results?.find(v => 
    v.site === "YouTube" && v.type === "Trailer"
  );
  const trailerKey = trailer?.key;

  // Prepare content details
  const isSeries = media_type === 'tv';
  const contentTitle = isSeries ? details.name : details.title;
  
  // Language mapping with flags
  const languageInfo = getLanguageInfo(details.original_language);
  
  const year = isSeries 
    ? (details.first_air_date?.split('-')[0] || 'N/A')
    : (details.release_date?.split('-')[0] || 'N/A');
  
  // Header and episode info
  let headerLine = "";
  let episodeInfo = "";
  const hasSeason = season !== undefined && season !== null && season !== '';
  const hasEpisode = episode !== undefined && episode !== null && episode !== '';

  if (isSeries) {
    if (hasSeason && hasEpisode) {
      const formattedSeason = String(season).padStart(2, '0');
      const formattedEpisode = String(episode).padStart(2, '0');
      headerLine = `🦠 *NEW EPISODE ADDED!* 🦠\n`;
      episodeInfo = `🔊 *S${formattedSeason} E${formattedEpisode}* 🔥\n`;
    } 
    else if (hasSeason) {
      const formattedSeason = String(season).padStart(2, '0');
      headerLine = `🦠 *SEASON COMPLETE!* 🦠\n`;
      episodeInfo = `🔊 *S${formattedSeason}* 🔥\n`;
    } 
    else {
      headerLine = `🌟 *NEW SERIES ADDED!* 🌟\n`;
    }
  } else {
    headerLine = `🌟 *NEW MOVIE ADDED!* 🌟\n`;
  }

  // Format message
  const settings = payload.settings || {};
  const clientBanner = settings.clientBanner || '';
  
  let message = `
${headerLine}${episodeInfo}━━━━━━━━━━━━━━━━━━━

🎬 *${escapeHtml(contentTitle)}* (${year})
📺 *Type:* ${isSeries ? 'TV Series' : 'Movie'}
🗣️ *Language:* ${languageInfo}
⭐ *Rating:* ${details.vote_average ? details.vote_average.toFixed(1) : 'N/A'}/10
🎭 *Genres:* ${details.genres?.slice(0, 3).map(g => g.name).join(', ') || 'N/A'}

📖 *Plot:* ${truncatePlot(details.overview, media_type, tmdb_id)}
  `.trim();

  // Add separator if needed
  if (note || clientBanner) {
    message += `\n━━━━━━━━━━━━━━━━━━━`;
  }
  
  // Add note if provided
  if (note) {
    message += `\n💬 *Note:* ${escapeHtml(note)}`;
  }
  
  // Add client banner if exists
  if (clientBanner) {
    message += `\n\n${htmlToMarkdown(clientBanner)}`;
  }

  // Prepare buttons
  const buttons = [];
  const imdbId = externalIds.imdb_id;
  
  // Add custom link if provided
  if (custom_link) {
    buttons.push([{ text: "🔗 Watch Here", url: custom_link }]);
  }
  
  // Add IMDb button if available
  if (imdbId) {
    if (buttons.length > 0 && buttons[0].length < 2) {
      buttons[0].push({ text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` });
    } else {
      buttons.push([{ text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` }]);
    }
  }
  
  // Add trailer button if available
  if (trailerKey) {
    buttons.push([
      { text: "🎬 Watch Trailer", url: `https://www.youtube.com/watch?v=${trailerKey}` }
    ]);
  }

  // Prepare poster URLs
  const posterSources = [];
  if (details.poster_path) {
    posterSources.push(`https://image.tmdb.org/t/p/original${details.poster_path}`);
    posterSources.push(`https://image.tmdb.org/t/p/w500${details.poster_path}`);
  }

  // Try poster sources
  for (const posterUrl of posterSources) {
    try {
      // Check if image exists
      const headRes = await fetch(posterUrl, { method: 'HEAD' });
      if (headRes.status !== 200) continue;
      
      // Send to Telegram
      const result = await sendTelegramPhoto(
        BOT_TOKEN,
        CHANNEL_ID,
        posterUrl,
        message,
        buttons
      );
      
      if (result.ok) return "✅ Content posted successfully!";
    } catch (error) {
      console.warn(`Poster failed: ${posterUrl}`, error);
    }
  }

  // Fallback to text message
  return await sendTextMessage(BOT_TOKEN, CHANNEL_ID, message, buttons);
}

async function checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID) {
  try {
    // Get bot info
    const botInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botInfo = await botInfoRes.json();
    
    if (!botInfo.ok) {
      return {
        error: true,
        message: `❌ Failed to get bot info: ${botInfo.description || 'Unknown error'}`
      };
    }
    
    const botUsername = botInfo.result.username;
    const botId = botInfo.result.id;
    
    // Check bot's status in the channel
    const memberRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${botId}`
    );
    const memberInfo = await memberRes.json();
    
    if (!memberInfo.ok) {
      if (memberInfo.description.includes("member list is inaccessible")) {
        return {
          error: true,
          message: `❌ Bot is not in your channel. Please add @${botUsername} first!`,
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

async function sendTelegramPhoto(botToken, chatId, photoUrl, caption, buttons) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons }
      })
    }
  );
  return await response.json();
}

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

function getLanguageInfo(code) {
  const languages = {
    en: "🇺🇸 English",
    es: "🇪🇸 Spanish",
    fr: "🇫🇷 French",
    de: "🇩🇪 German",
    it: "🇮🇹 Italian",
    ja: "🇯🇵 Japanese",
    ko: "🇰🇷 Korean",
    zh: "🇨🇳 Chinese",
    hi: "🇮🇳 Hindi",
    ru: "🇷🇺 Russian",
    te: "🇮🇳 Telugu",
    ta: "🇮🇳 Tamil",
    ml: "🇮🇳 Malayalam",
  };
  
  return languages[code] || `🌐 ${code || 'Unknown'}`;
}

function truncatePlot(overview, media_type, tmdb_id) {
  if (!overview) return 'No plot available';

  const maxChars = 200;
  if (overview.length <= maxChars) {
    return escapeHtml(overview);
  }

  const truncated = overview.slice(0, maxChars).trim();
  const readMoreLink = `https://www.themoviedb.org/${media_type}/${tmdb_id}`;
  return `${escapeHtml(truncated)}... <a href="${readMoreLink}">Read more</a>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToMarkdown(html) {
  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Convert supported tags to Telegram-safe HTML
  return html
    .replace(/<b>/g, '<b>').replace(/<\/b>/g, '</b>')
    .replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>')
    .replace(/<i>/g, '<i>').replace(/<\/i>/g, '</i>')
    .replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>')
    .replace(/<code>/g, '<code>').replace(/<\/code>/g, '</code>')
    .replace(/<pre>/g, '<pre>').replace(/<\/pre>/g, '</pre>')
    .replace(/<spoiler>/g, '<tg-spoiler>').replace(/<\/spoiler>/g, '</tg-spoiler>')
    .replace(
      /<a\s+href="([^"]*)">([\s\S]*?)<\/a>/g,
      '<a href="$1">$2</a>'
    );
}