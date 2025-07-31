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

  // Helper to truncate long plots
  function truncatePlot(text) {
    if (!text) return 'N/A';
    return text.length > 400 ? text.slice(0, 397) + '…' : text;
  }

  // Fetch details
  const detailsUrl = `https://api.themoviedb.org/3/${media_type}/${tmdb_id}?api_key=${TMDB_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) throw new Error(`TMDB lookup failed: ${detailsRes.statusText}`);
  const details = await detailsRes.json();

  // Handle invalid ID
  if (details.status_code === 34) {
    return "❌ Invalid TMDB ID";
  }

  // Fetch external IDs for IMDb
  let imdbId = null;
  try {
    const ext = await (await fetch(
      `https://api.themoviedb.org/3/${media_type}/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`
    )).json();
    imdbId = ext.imdb_id;
  } catch (err) {
    console.warn("Failed to fetch external IDs:", err);
  }

  // Fetch trailer key
  let trailerKey = null;
  try {
    const vids = await (await fetch(
      `https://api.themoviedb.org/3/${media_type}/${tmdb_id}/videos?api_key=${TMDB_API_KEY}`
    )).json();
    if (Array.isArray(vids.results)) {
      const tr = vids.results.find(v => v.site === "YouTube" && v.type === "Trailer");
      if (tr) trailerKey = tr.key;
    }
  } catch (err) {
    console.warn("Failed to fetch videos:", err);
  }

  // Prepare basic info
  const isSeries = media_type === 'tv';
  const contentTitle = isSeries ? details.name : details.title;
  const year = isSeries
    ? (details.first_air_date?.split('-')[0] || 'N/A')
    : (details.release_date?.split('-')[0] || 'N/A');

  // Language mapping
  function getLanguageInfo(code) {
    const langs = {
      en: ["English","🇺🇸"], es: ["Spanish","🇪🇸"], fr: ["French","🇫🇷"],
      de: ["German","🇩🇪"], it: ["Italian","🇮🇹"], ja: ["Japanese","🇯🇵"],
      ko: ["Korean","🇰🇷"], zh: ["Chinese","🇨🇳"], hi: ["Hindi","🇮🇳"],
      ru: ["Russian","🇷🇺"], te: ["Telugu","🇮🇳"], ta: ["Tamil","🇮🇳"],
      ml: ["Malayalam","🇮🇳"]
    };
    const info = langs[code];
    return info ? `${info[1]} ${info[0]}` : `🌐 Unknown`;
  }
  const languageInfo = getLanguageInfo(details.original_language);

  // --- NEW HEADER & EPISODE LOGIC ---
  let headerLine = "";
  let episodeDisplay = "";

  if (isSeries) {
    const hasSeason = season !== undefined && season !== null && season !== '';
    const hasEpisode = episode !== undefined && episode !== null && episode !== '';

    if (hasSeason && hasEpisode) {
      const s = String(season).padStart(2, '0');
      const e = String(episode).padStart(2, '0');
      headerLine = `🦠 *NEW EPISODE ADDED!* 🦠\n━━━━━━━━━━━━━━━━━━━\n`;
      episodeDisplay = `🔊 *S${s} E${e}* 🔥\n`;
    }
    else if (hasSeason) {
      const s = String(season).padStart(2, '0');
      headerLine = `🦠 *SEASON COMPLETE!* 🦠\n━━━━━━━━━━━━━━━━━━━\n`;
      episodeDisplay = `🔊 *S${s}* 🔥\n`;
    }
    else {
      headerLine = `🌟 *NEW SERIES ADDED!* 🌟\n━━━━━━━━━━━━━━━━━━━\n`;
    }
  } else {
    headerLine = `🌟 *NEW MOVIE ADDED!* 🌟\n━━━━━━━━━━━━━━━━━━━\n`;
  }

    // Build core message with plot separator
  let message = `
${headerLine}🎬 *${contentTitle}* (${year})
${episodeDisplay}📺 *Type:* ${isSeries ? 'TV Series' : 'Movie'}
🗣️ *Language:* ${languageInfo}
⭐ *Rating:* ${details.vote_average?.toFixed(1) || 'N/A'}/10
🎭 *Genres:* ${details.genres?.slice(0,3).map(g=>g.name).join(', ') || 'N/A'}

📖 *Plot:* ${truncatePlot(details.overview)}
`.trim();

  // Only show a bottom-of-plot separator if we have a banner or note to follow
  if (clientBanner || note) {
    message += `\n━━━━━━━━━━━━━━━━━`;
  }

  // Append banner & note
  if (note) {
    message += `\n\n💬 *Note:* ${note}`;
  }
  if (clientBanner) {
    message += `\n\n${clientBanner}`;
  }

  // Build inline buttons
  const buttons = [];
  if (custom_link) {
    buttons.push([{ text: "🔗 Watch Here", url: custom_link }]);
  }
  if (imdbId) {
    const btn = { text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` };
    buttons.length ? buttons[0].push(btn) : buttons.push([btn]);
  }
  if (!custom_link && !imdbId) {
    buttons.push([{
      text: "ℹ️ TMDB Page",
      url: `https://www.themoviedb.org/${media_type}/${tmdb_id}`
    }]);
  }
  if (trailerKey) {
    buttons.push([{ text: "🎬 Watch Trailer", url: `https://www.youtube.com/watch?v=${trailerKey}` }]);
  }

  // Poster sources to try
  const posterSources = [];
  if (details.poster_path) {
    posterSources.push(
      `https://image.tmdb.org/t/p/original${details.poster_path}`,
      `https://image.tmdb.org/t/p/w500${details.poster_path}`
    );
  }
  if (imdbId) {
    posterSources.push(`https://img.omdbapi.com/?i=${imdbId}&apikey=${TMDB_API_KEY}&h=1000`);
  }
  // Last resort: fetch via TMDB images endpoint
  posterSources.push(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/images?api_key=${TMDB_API_KEY}`);

  // Try sending photo
  for (const url of posterSources) {
    try {
      let photoUrl = url;
      if (url.includes('/images?')) {
        const imgs = await (await fetch(url)).json();
        const list = imgs.posters || imgs.backdrops;
        if (Array.isArray(list) && list.length) {
          list.sort((a,b)=>b.width*b.height - a.width*a.height);
          photoUrl = `https://image.tmdb.org/t/p/original${list[0].file_path}`;
        } else {
          continue;
        }
      }
      // HEAD check for direct URLs
      if (!url.includes('/images?')) {
        const head = await fetch(photoUrl, { method: 'HEAD' });
        if (!head.ok) continue;
      }

      const resp = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHANNEL_ID,
            photo: photoUrl,
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
          })
        }
      );
      const data = await resp.json();
      if (data.ok) return "✅ Posted to Telegram with poster!";
    } catch (err) {
      console.warn(`Poster try failed (${url}):`, err.message);
      continue;
    }
  }

  // Check bot admin status (assuming you have this helper)
  const botStatus = await checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID);
  if (botStatus.error) return botStatus.message;
  if (!botStatus.isAdmin) {
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

  // Fallback to text-only
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