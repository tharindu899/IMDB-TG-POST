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

// Handle bot commands
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
      const text = update.message.text.trim();

      if (!text) {
        return new Response('OK');
      }

      if (text === '/start') {
        return await handleStartCommand(BOT_TOKEN, chatId);
      } else if (text === '/help') {
        return await handleHelpCommand(BOT_TOKEN, chatId);
      } else if (text === '/setup') {
        return await handleSetupCommand(BOT_TOKEN, chatId);
      } else if (text === '/post') {
        return await handlePostCommand(BOT_TOKEN, chatId);
      } else if (text.startsWith('/search')) {
        return await handleSearchCommand(BOT_TOKEN, chatId, text, env);
      }
    }
    
    return new Response('OK');
  } catch (error) {
    console.error('Bot command error:', error);
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
• /post - Create a new content post
• /search - Find movies/series to share

📝 <b>How to Use:</b>
1. <b>Add me to your channel</b> as admin with post permissions
2. <b>Go to our website</b> and explore the features
3. Tap the <b>settings button (⚙️)</b> to configure
4. <b>Add your channel ID</b> and save your configuration
5. Use <b>/search</b> to find content and post directly to your channel

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
• Use /search command to find content
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

async function handlePostCommand(BOT_TOKEN, chatId) {
  const message = `
📝 <b>Create New Post</b>

To create a new post, you have two options:

<b>Option 1: Use the Website</b>
• Visit our website
• Search for movies/series
• Click "Post to Channel"
• Customize your message

<b>Option 2: Use Search Command</b>
• Type: <code>/search movie name</code>
• Example: <code>/search Avengers</code>
• Select from search results
• Post directly to your channel

<b>Required Setup:</b>
✅ Bot added to channel as admin
✅ Channel ID configured on website
✅ TMDB API access enabled

💡 <b>Tip:</b> Use /setup if you haven't configured your channel yet!
  `.trim();

  const buttons = [
    [
      { text: "🌐 Open Website", url: "https://imdb-tg-post-font.pages.dev" }
    ],
    [
      { text: "⚙️ Setup Guide", callback_data: "setup_guide" },
      { text: "🔍 Try Search", callback_data: "try_search" }
    ]
  ];

  try {
    await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Failed to send post message to ${chatId}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSearchCommand(BOT_TOKEN, chatId, text, env) {
  // Safety check for text parameter
  if (!text || typeof text !== 'string') {
    const message = "❌ Invalid search command. Please try again.";
    await sendTextMessage(BOT_TOKEN, chatId, message, []);
    return new Response('OK', { status: 200 });
  }

  const searchQuery = text.replace('/search', '').trim();
  
  if (!searchQuery) {
    const message = `
🔍 <b>Search Movies & Series</b>

<b>How to search:</b>
• Type: <code>/search [movie/series name]</code>
• Example: <code>/search Spider-Man</code>
• Example: <code>/search Breaking Bad</code>

<b>What happens next:</b>
1. Bot searches TMDB database
2. Shows you matching results
3. You can select and post to your channel

💡 <b>Tip:</b> Be specific with movie/series names for better results!
    `.trim();

    const buttons = [
      [
        { text: "🎬 Search Movies", callback_data: "search_movies" },
        { text: "📺 Search Series", callback_data: "search_series" }
      ]
    ];

    try {
      await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error(`Failed to send search help to ${chatId}:`, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // Perform actual search
  try {
    const TMDB_API_KEY = env?.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      await sendTextMessage(BOT_TOKEN, chatId, "❌ TMDB API not configured. Please contact admin.", []);
      return new Response('OK', { status: 200 });
    }

    // Send "searching..." message first
    await sendTextMessage(BOT_TOKEN, chatId, "🔍 Searching TMDB database...", []);

    // Enhanced search with better filtering
    const regex = /^(.*?)(?:\s+\((\d{4})\)|\s+(\d{4}))?$/;
    const match = searchQuery.match(regex);
    const cleanTitle = (match[1] || searchQuery).trim();
    const year = match[2] || match[3] || '';

    let apiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&include_adult=false`;
    if (year) apiUrl += `&year=${year}`;

    const searchResponse = await fetch(apiUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`TMDB API error: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    let results = (searchData.results || [])
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv');

    // Filter by year if specified
    if (year) {
      const yearMatches = results.filter(item => {
        const date = item.release_date || item.first_air_date || '';
        return date.startsWith(year + '-');
      });
      if (yearMatches.length) {
        results = yearMatches;
      }
    }

    // Sort by popularity and limit to top 10
    results = results
      .sort((a, b) => 
        (b.popularity || 0) - (a.popularity || 0) ||
        (b.vote_count || 0) - (a.vote_count || 0)
      )
      .slice(0, 10);

    if (results.length === 0) {
      const message = `
🔍 <b>Search Results</b>

❌ No results found for: <code>${searchQuery}</code>

<b>Try:</b>
• Check spelling
• Use different keywords
• Search for alternative titles

<b>Examples:</b>
• <code>/search Avengers Endgame</code>
• <code>/search Breaking Bad</code>
• <code>/search Spider-Man 2021</code>
      `.trim();

      await sendTextMessage(BOT_TOKEN, chatId, message, []);
      return new Response('OK', { status: 200 });
    }

    // Format search results with better presentation
    let message = `🔍 <b>Search Results for:</b> <code>${searchQuery}</code>\n\n`;
    const buttons = [];

    results.forEach((result, index) => {
      const title = result.title || result.name;
      const year = (result.release_date || result.first_air_date)?.split('-')[0] || 'N/A';
      const type = result.media_type === 'tv' ? '📺' : '🎬';
      const rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';
      
      // Truncate long titles for display
      const displayTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
      
      message += `${index + 1}. ${type} <b>${displayTitle}</b> (${year}) - ⭐${rating}\n`;
      
      // Create callback data with safe encoding
      const callbackData = `post_${result.media_type}_${result.id}`;
      
      // Add inline button for each result
      buttons.push([{
        text: `${type} ${displayTitle} (${year})`,
        callback_data: callbackData
      }]);
    });

    message += `\n💡 <b>Click any result to post to your channel</b>`;

    try {
      await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error(`Failed to send search results to ${chatId}:`, error);
      
      // Fallback: send results without buttons if message too long
      const fallbackMessage = `
🔍 <b>Found ${results.length} results for:</b> <code>${searchQuery}</code>

Unfortunately, the results list is too long to display with buttons. Please try a more specific search term.

<b>Examples:</b>
• Include the year: <code>/search Avatar 2022</code>
• Be more specific: <code>/search The Batman</code>
      `.trim();
      
      await sendTextMessage(BOT_TOKEN, chatId, fallbackMessage, []);
      return new Response('OK', { status: 200 });
    }

  } catch (error) {
    console.error('Search error:', error);
    
    const errorMessage = `
❌ <b>Search failed:</b> ${error.message}

<b>Please try:</b>
• Check your internet connection
• Try a different search term
• Contact support if the issue persists

<b>Need help?</b> Use /help command
    `.trim();
    
    await sendTextMessage(BOT_TOKEN, chatId, errorMessage, []);
    return new Response('OK', { status: 200 });
  }
}

// Handle callback queries from inline buttons
async function handleCallbackQuery(request, env, callbackQuery) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  
  // Safety checks
  if (!callbackQuery || !callbackQuery.message || !callbackQuery.message.chat) {
    return new Response('OK', { status: 200 });
  }
  
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.callback_data;
  const queryId = callbackQuery.id;

  // Safety check for callback_data
  if (!data || typeof data !== 'string') {
    return new Response('OK', { status: 200 });
  }

  // Answer the callback query first
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: queryId,
        text: "Processing your request..."
      })
    });
  } catch (error) {
    console.error('Failed to answer callback query:', error);
  }

  try {
    if (data.startsWith('post_')) {
      // Extract media type and ID from callback data
      const parts = data.split('_');
      if (parts.length < 3) {
        await sendTextMessage(BOT_TOKEN, chatId, "❌ Invalid selection. Please try again.", []);
        return new Response('OK', { status: 200 });
      }

      const mediaType = parts[1]; // 'movie' or 'tv' 
      const tmdbId = parts[2];

      // Validate media type
      if (!['movie', 'tv'].includes(mediaType)) {
        await sendTextMessage(BOT_TOKEN, chatId, "❌ Invalid content type. Please try again.", []);
        return new Response('OK', { status: 200 });
      }

      // Check if we have a default channel ID or if user needs to configure
      const defaultChannelId = env.TELEGRAM_CHANNEL_ID;
      
      if (!defaultChannelId) {
        const setupMessage = `
⚙️ <b>Channel Setup Required</b>

To post content, you need to configure your channel first:

<b>Step 1:</b> Get your channel ID
• Forward any message from your channel to @userinfobot
• Copy the "Forwarded from chat" ID (starts with -100)

<b>Step 2:</b> Add bot to your channel
• Add this bot to your channel as admin
• Grant "Post Messages" permission

<b>Step 3:</b> Use the website to configure
• Visit: https://imdb-tg-post-font.pages.dev
• Click settings (⚙️) and enter your channel ID

<b>Step 4:</b> Try posting again
• Once configured, use /search to find and post content

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

        await sendTextMessage(BOT_TOKEN, chatId, setupMessage, buttons);
        return new Response('OK', { status: 200 });
      }

      // Send posting message
      await sendTextMessage(BOT_TOKEN, chatId, "📤 Posting to your channel...", []);

      // Create payload for posting
      const payload = {
        tmdb_id: parseInt(tmdbId),
        media_type: mediaType,
        channel_id: defaultChannelId,
        season: '',
        episode: '',
        custom_link: '',
        note: '',
        settings: {
          clientBanner: '' // You can set a default banner here if needed
        }
      };

      // Post to Telegram using existing function
      const result = await sendToTelegram(payload, env);
      
      // Send confirmation message
      let confirmMessage;
      let buttons = [];

      if (typeof result === 'string' && result.includes('✅')) {
        confirmMessage = `
✅ <b>Posted Successfully!</b>

Your content has been posted to the channel.

<b>Want to post more?</b>
Use /search to find more movies and series!
        `.trim();

        buttons = [
          [
            { text: "🔍 Search More", callback_data: "search_more" }
          ]
        ];
      } else if (typeof result === 'object' && result.type === 'bot_admin_error') {
        confirmMessage = `
❌ <b>Bot Setup Required!</b>

${result.message}

<b>Please follow these steps:</b>
1. Add bot to your channel: @${result.botUsername || 'your_bot'}
2. Go to Channel Info > Administrators > Add Admin
3. Grant "Post Messages" permission
4. Try posting again

💡 <b>Need help?</b> Contact @SLtharindu1
        `.trim();

        buttons = [
          [
            { text: "🆘 Get Help", url: "https://t.me/SLtharindu1" }
          ]
        ];
      } else {
        confirmMessage = `
❌ <b>Failed to Post</b>

${typeof result === 'object' ? (result.message || 'Unknown error') : result}

<b>Common issues:</b>
• Bot not added to channel as admin
• Missing "Post Messages" permission
• Invalid channel ID

<b>Need help?</b> Contact @SLtharindu1
        `.trim();

        buttons = [
          [
            { text: "⚙️ Setup Guide", callback_data: "setup_guide" },
            { text: "🆘 Get Help", url: "https://t.me/SLtharindu1" }
          ]
        ];
      }

      await sendTextMessage(BOT_TOKEN, chatId, confirmMessage, buttons);
      
    } else if (data === 'setup_guide') {
      return await handleSetupCommand(BOT_TOKEN, chatId);
    } else if (data === 'try_search' || data === 'search_more') {
      const message = `
🔍 <b>Search for Content</b>

Type: <code>/search [movie/series name]</code>

<b>Examples:</b>
• <code>/search Avengers</code>
• <code>/search Breaking Bad</code>
• <code>/search Spider-Man 2021</code>
• <code>/search The Batman</code>

💡 <b>Tip:</b> Include the year for more accurate results!
      `.trim();
      
      await sendTextMessage(BOT_TOKEN, chatId, message, []);
    } else if (data === 'search_movies') {
      const message = `
🎬 <b>Search Movies</b>

Type: <code>/search [movie name]</code>

<b>Popular movie examples:</b>
• <code>/search Avatar 2022</code>
• <code>/search Top Gun Maverick</code>
• <code>/search Black Panther</code>
• <code>/search Dune 2021</code>
      `.trim();
      
      await sendTextMessage(BOT_TOKEN, chatId, message, []);
    } else if (data === 'search_series') {
      const message = `
📺 <b>Search TV Series</b>

Type: <code>/search [series name]</code>

<b>Popular series examples:</b>
• <code>/search House of Dragon</code>
• <code>/search Stranger Things</code>
• <code>/search The Boys</code>
• <code>/search Wednesday</code>
      `.trim();
      
      await sendTextMessage(BOT_TOKEN, chatId, message, []);
    }

    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback query error:', error);
    const errorMessage = `
❌ <b>Error:</b> ${error.message}

Please try again or contact support if the issue persists.

<b>Need help?</b> Contact @SLtharindu1
    `.trim();
    
    await sendTextMessage(BOT_TOKEN, chatId, errorMessage, []);
    return new Response('OK', { status: 200 });
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

  const maxChars = 265; // Approx. 3 lines in Telegram
  const readMoreLink = `https://www.themoviedb.org/${media_type}/${tmdb_id}`;
  
  // Escape HTML special characters
  const safeOverview = overview
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (safeOverview.length <= maxChars) {
    return `<blockquote expandable>${safeOverview}</blockquote>`;
  }

  const truncated = safeOverview.slice(0, maxChars).trim();
  return `<blockquote expandable>${truncated}... <a href="${readMoreLink}">Read more</a></blockquote>`;
}

// Helper to escape markdown characters
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\    // Enhanced search');
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