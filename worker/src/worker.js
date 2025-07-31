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

      if (url.pathname === '/bot' && request.method === 'POST') {
        return handleBotCommand(request, env);
      }

      if (request.method === 'OPTIONS') {
        return handleCors(new Response(null, { status: 204 }));
      }

      const authHeader = request.headers.get('Authorization');
      const expectedToken = `Bearer ${env.AUTH_TOKEN}`;

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

// ============ BOT COMMAND HANDLING ============

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
  const message = `🎬 <b>Welcome to IMDB-TG-POST Bot!</b> 🎬

I help you post new content updates to your channel. Use /help to see available commands and setup instructions.`;

  const buttons = [[
    { text: "📚 Repo", url: "https://github.com/tharindu899/IMDB-TG-POST" },
    { text: "🖇️ Site", url: "https://imdb-tg-post-font.pages.dev" }
  ]];

  await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
  return new Response('OK');
}

async function handleHelpCommand(BOT_TOKEN, chatId) {
  const message = `🤖 <b>Bot Help Center</b>

Here are the available commands:

• /start - Welcome message
• /help - Show this help

<b>How to use:</b>
1. Add me to your channel as admin
2. Visit the site to configure
3. Enter your Channel ID and save
4. Share IMDb or TMDB links in your channel`;

  const buttons = [
    [
      { text: "📚 Owner", url: "https://t.me/SLtharindu1" },
      { text: "🎥 Tutorial", url: "https://example.com/tutorial" }
    ],
    [
      { text: "❓ Support", url: "https://t.me/SLtharindu1" },
      { text: "🐛 Report Issue", url: "https://t.me/SLtharindu1" }
    ]
  ];

  await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
  return new Response('OK');
}

// ============ TELEGRAM POSTING ============

async function sendToTelegram(payload, env) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const TMDB_API_KEY = env.TMDB_API_KEY;
  const settings = payload.settings || {};
  const clientBanner = settings.clientBanner || '';

  const { tmdb_id, media_type, season, episode, custom_link, note, channel_id } = payload;
  const CHANNEL_ID = channel_id || env.TELEGRAM_CHANNEL_ID;
  if (!BOT_TOKEN || !TMDB_API_KEY || !CHANNEL_ID || !tmdb_id || !media_type) {
    throw new Error('Missing required fields');
  }

  const detailRes = await fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}?api_key=${TMDB_API_KEY}`);
  const details = await detailRes.json();
  if (details.status_code === 34) return '❌ Invalid TMDB ID';

  const extRes = await fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`);
  const extIds = await extRes.json();
  const imdbId = extIds.imdb_id;

  const vidsRes = await fetch(`https://api.themoviedb.org/3/${media_type}/${tmdb_id}/videos?api_key=${TMDB_API_KEY}`);
  const vids = await vidsRes.json();
  const trailer = vids.results?.find(v => v.site === "YouTube" && v.type === "Trailer");
  const trailerKey = trailer?.key;

  const title = media_type === 'tv' ? details.name : details.title;
  const year = media_type === 'tv' ? (details.first_air_date || '').split('-')[0] : (details.release_date || '').split('-')[0];
  const language = getLanguageInfo(details.original_language);
  const rating = details.vote_average?.toFixed(1) || 'N/A';
  const genres = details.genres?.map(g => g.name).slice(0, 3).join(', ') || 'N/A';

  let header = '';
  let episodeInfo = '';
  if (media_type === 'tv') {
    if (season && episode) {
      header = '🦠 <b>NEW EPISODE ADDED!</b>';
      episodeInfo = `🔊 <b>S${String(season).padStart(2, '0')} E${String(episode).padStart(2, '0')}</b>`;
    } else if (season) {
      header = '🦠 <b>SEASON COMPLETE!</b>';
      episodeInfo = `🔊 <b>S${String(season).padStart(2, '0')}</b>`;
    } else {
      header = '🌟 <b>NEW SERIES ADDED!</b>';
    }
  } else {
    header = '🌟 <b>NEW MOVIE ADDED!</b>';
  }

  let message = `
${header}
${episodeInfo}
━━━━━━━━━━━━━━━━━━━

🎬 <b>${title}</b> (${year})
📺 <b>Type:</b> ${media_type === 'tv' ? 'TV Series' : 'Movie'}
🗣️ <b>Language:</b> ${language}
⭐ <b>Rating:</b> ${rating}/10
🎭 <b>Genres:</b> ${genres}

📖 <b>Plot:</b> ${escapeHtml(truncatePlot(details.overview, media_type, tmdb_id))}
  `.trim();

  if (note || clientBanner) {
    message += '\n━━━━━━━━━━━━━━━━━━━';
  }
  if (note) {
    message += `\n💬 <b>Note:</b> ${escapeHtml(note)}`;
  }
  if (clientBanner) {
    message += `\n\n${htmlToMarkdown(clientBanner)}`;
  }

  const buttons = [];
  const row = [];

  if (custom_link) row.push({ text: "🔗 Watch Here", url: custom_link });
  if (imdbId) row.push({ text: "📌 IMDb Page", url: `https://www.imdb.com/title/${imdbId}/` });
  else row.push({ text: "ℹ️ TMDB Page", url: `https://www.themoviedb.org/${media_type}/${tmdb_id}` });

  if (row.length) buttons.push(row);
  if (trailerKey) buttons.push([{ text: "🎬 Watch Trailer", url: `https://youtube.com/watch?v=${trailerKey}` }]);

  const posters = [
    `https://image.tmdb.org/t/p/original${details.poster_path}`,
    `https://image.tmdb.org/t/p/w500${details.poster_path}`,
    imdbId ? `https://img.omdbapi.com/?i=${imdbId}&apikey=${TMDB_API_KEY}&h=1000` : null
  ].filter(Boolean);

  for (const url of posters) {
    try {
      const check = await fetch(url, { method: 'HEAD' });
      if (!check.ok) continue;

      const send = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          photo: url,
          caption: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: buttons }
        })
      });

      const result = await send.json();
      if (result.ok) return "✅ Posted to Telegram with poster!";
    } catch (e) {}
  }

  const adminStatus = await checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID);
  if (adminStatus.error) return adminStatus.message;
  if (!adminStatus.isAdmin) {
    return {
      type: 'bot_admin_error',
      message: `❌ Bot is not an admin in your channel.`,
      botUsername: adminStatus.botUsername,
      instructions: [
        `1. Add the bot to your channel`,
        `2. Promote it to admin`,
        `3. Retry post`
      ]
    };
  }

  return await sendTextMessage(BOT_TOKEN, CHANNEL_ID, message, buttons);
}

async function sendTextMessage(BOT_TOKEN, CHANNEL_ID, text, buttons) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    })
  });

  const json = await res.json();
  return json.ok ? "✅ Content posted (text only)" : `❌ Telegram error: ${json.description}`;
}

// ============ HELPERS ============

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncatePlot(overview, media_type, tmdb_id) {
  const max = 200;
  if (!overview) return 'No plot available';
  if (overview.length <= max) return overview;
  return `${overview.slice(0, max).trim()}... <a href="https://www.themoviedb.org/${media_type}/${tmdb_id}">Read more</a>`;
}

function getLanguageInfo(code) {
  const map = {
    en: "🇺🇸 English", es: "🇪🇸 Spanish", fr: "🇫🇷 French",
    de: "🇩🇪 German", it: "🇮🇹 Italian", ja: "🇯🇵 Japanese",
    ko: "🇰🇷 Korean", zh: "🇨🇳 Chinese", hi: "🇮🇳 Hindi",
    ru: "🇷🇺 Russian", te: "🇮🇳 Telugu", ta: "🇮🇳 Tamil",
    ml: "🇮🇳 Malayalam"
  };
  return map[code] || `🌐 ${code.toUpperCase()}`;
}

function htmlToMarkdown(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\/?)b>/g, '<$1b>')
    .replace(/<(\/?)i>/g, '<$1i>')
    .replace(/<(\/?)code>/g, '<$1code>')
    .replace(/<(\/?)pre>/g, '<$1pre>')
    .replace(/<spoiler>/g, '<tg-spoiler>').replace(/<\/spoiler>/g, '</tg-spoiler>')
    .replace(/<a\s+href="([^"]*)">([\s\S]*?)<\/a>/g, '<a href="$1">$2</a>');
}

async function checkBotAdminStatus(BOT_TOKEN, CHANNEL_ID) {
  try {
    const botInfo = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)).json();
    if (!botInfo.ok) return { error: true, message: `❌ Failed to get bot info.` };

    const botId = botInfo.result.id;
    const botUsername = botInfo.result.username;

    const memberInfo = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${botId}`)).json();
    if (!memberInfo.ok) {
      if (memberInfo.description?.includes("member list is inaccessible")) {
        return {
          error: true,
          message: `❌ Bot is not in the channel.`,
          botUsername
        };
      }
      return { error: true, message: `❌ Status error`, botUsername };
    }

    const isAdmin = ['administrator', 'creator'].includes(memberInfo.result.status);
    return { error: false, isAdmin, botUsername };
  } catch (err) {
    return { error: true, message: `❌ Check failed: ${err.message}` };
  }
}
