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
}

// New function to handle bot commands
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

      if (text === '/start') {
        return handleStartCommand(BOT_TOKEN, chatId);
      } else if (text === '/help') {
        return handleHelpCommand(BOT_TOKEN, chatId);
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
  // Get environment variables
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const TMDB_API_KEY = env.TMDB_API_KEY;
  
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
    const externalIds = await externalResponse.json();
    imdbId = externalIds.imdb_id;
  } catch (error) {
    console.error("Failed to fetch external IDs:", error);
  }

  // Fetch videos for trailer
  let trailerKey = null;
  try {
    const videosUrl = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}/videos?api_key=${TMDB_API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    if (videosData.results?.length > 0) {
      const trailer = videosData.results.find(
        v => v.site === "YouTube" && v.type === "Trailer"
      );
      if (trailer) trailerKey = trailer.key;
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
  let episodeDisplay = "";
  
  if (isSeries) {
    const hasSeason = season !== undefined && season !== null && season !== '';
    const hasEpisode = episode !== undefined && episode !== null && episode !== '';
    
    if (hasSeason && hasEpisode) {
      const formattedSeason = String(season).padStart(2, '0');
      const formattedEpisode = String(episode).padStart(2, '0');
      headerLine = `🦠 *New Episode Added!* - 🔊 S${formattedSeason} E${formattedEpisode} 🔥\n\n`;
      episodeDisplay = `🔊 S${formattedSeason} E${formattedEpisode} 🔥\n`;
    } 
    else if (hasSeason) {
      const formattedSeason = String(season).padStart(2, '0');
      headerLine = `🦠 *Season Complete!* - 🔊 S${formattedSeason} 🔥\n\n`;
      episodeDisplay = `🔊 S${formattedSeason} 🔥\n`;
    } 
    else {
      headerLine = "🌟 *New Series Added!*\n\n";
    }
  }

  // Handle links - only use custom links or official sources
  let siteLink = custom_link;
  let imdbButton = null;
  
  if (imdbId) {
    imdbButton = { text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` };
  }

  // Format message
  let message = `
${headerLine}🎬 *${contentTitle}* (${year})
${episodeDisplay}📺 *Type:* ${isSeries ? 'TV Series' : 'Movie'}
🗣️ *Language:* ${languageInfo}
⭐ *Rating:* ${details.vote_average ? details.vote_average.toFixed(1) : 'N/A'}/10
🎭 *Genres:* ${details.genres?.slice(0, 3).map(g => g.name).join(', ') || 'N/A'}

📖 *Plot:* ${truncatePlot(details.overview, media_type, tmdb_id)}
  `.trim();

  // Add note if provided
  if (note) {
    message += `\n\n💬 *Note:* ${note}`;
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
  
  // 3. IMDB poster (if available)
  if (imdbId) {
    posterSources.push(`https://img.omdbapi.com/?i=${imdbId}&apikey=${TMDB_API_KEY}&h=1000`);
  }
  
  // 4. Fallback to TMDB API image
  posterSources.push(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/images?api_key=${TMDB_API_KEY}`);

  // Try all poster sources in sequence
  let lastError = null;
  
  for (const posterUrl of posterSources) {
    try {
      // Special handling for TMDB images API
      if (posterUrl.includes('/images?')) {
        const imagesResponse = await fetch(posterUrl);
        const imagesData = await imagesResponse.json();
        const posters = imagesData.posters || imagesData.backdrops;
        
        if (posters && posters.length > 0) {
          // Sort by highest resolution
          posters.sort((a, b) => (b.width * b.height) - (a.width * a.height));
          const bestPoster = posters[0];
          const imageUrl = `https://image.tmdb.org/t/p/original${bestPoster.file_path}`;
          
          const photoResponse = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: CHANNEL_ID,
                photo: imageUrl,
                caption: message,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: buttons }
              })
            }
          );
          
          const photoResult = await photoResponse.json();
          if (photoResult.ok) return "✅ Posted to Telegram with poster!";
        }
      } 
      // Direct image URLs
      else {
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
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: buttons }
              })
            }
          );

        const photoResult = await photoResponse.json();
        if (photoResult.ok) return "✅ Posted to Telegram with poster!";
      }
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
      if (memberInfo.description.includes("member list is inaccessible")) {
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
      parse_mode: "Markdown",
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

  const maxChars = 200; // Approx. 4 lines in Telegram
  if (overview.length <= maxChars) {
    return overview;
  }

  const truncated = overview.slice(0, maxChars).trim().replace(/\s+$/, '');
  const readMoreLink = `https://www.themoviedb.org/${media_type}/${tmdb_id}`;
  return `${truncated}... [Read more](${readMoreLink})`;
}