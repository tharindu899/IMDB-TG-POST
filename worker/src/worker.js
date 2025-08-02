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
    const searchingMsg = await sendTextMessage(BOT_TOKEN, chatId, "🔍 Searching TMDB database...", []);

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

    // Sort by popularity and limit to top 8 (reduced from 10 to avoid message length issues)
    results = results
      .sort((a, b) => 
        (b.popularity || 0) - (a.popularity || 0) ||
        (b.vote_count || 0) - (a.vote_count || 0)
      )
      .slice(0, 8);

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

    // Create a shorter, more compact results message
    let message = `🔍 <b>Found ${results.length} results for:</b> <code>${searchQuery}</code>\n\nTap any result to post:\n`;
    const buttons = [];

    results.forEach((result, index) => {
      const title = result.title || result.name;
      const year = (result.release_date || result.first_air_date)?.split('-')[0] || 'N/A';
      const type = result.media_type === 'tv' ? '📺' : '🎬';
      const rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';
      
      // Create very short display title (max 25 chars)
      const shortTitle = title.length > 25 ? title.substring(0, 25) + '...' : title;
      
      // Add to message (keep it short)
      message += `${index + 1}. ${type} ${shortTitle} (${year})\n`;
      
      // Create callback data - ensure it's valid
      const callbackData = `post_${result.media_type}_${result.id}`;
      
      // Create button text (max 30 chars to be safe)
      const buttonTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
      const buttonText = `${type} ${buttonTitle} (${year})`;
      
      // Add each result as a separate row for better visibility
      buttons.push([{
        text: buttonText,
        callback_data: callbackData
      }]);
    });

    // Keep message short to avoid Telegram limits
    message = message.trim();

    try {
      console.log(`Sending search results with ${buttons.length} buttons`);
      console.log(`Message length: ${message.length} characters`);
      
      const result = await sendTextMessage(BOT_TOKEN, chatId, message, buttons);
      console.log(`Send result: ${result}`);
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error(`Failed to send search results to ${chatId}:`, error);
      
      // Fallback: send numbered list without buttons
      const fallbackMessage = `
🔍 <b>Found ${results.length} results for:</b> <code>${searchQuery}</code>

${results.map((result, index) => {
  const title = result.title || result.name;
  const year = (result.release_date || result.first_air_date)?.split('-')[0] || 'N/A';
  const type = result.media_type === 'tv' ? '📺' : '🎬';
  return `${index + 1}. ${type} ${title} (${year})`;
}).join('\n')}

Sorry, buttons failed to load. Please try a more specific search term or contact support.
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
// Handle callback queries from inline buttons
async function handleCallbackQuery(request, env, callbackQuery) {
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  
  // Safety checks
  if (!callbackQuery || !callbackQuery.message || !callbackQuery.message.chat) {
    console.error('Invalid callback query structure');
    return new Response('OK', { status: 200 });
  }
  
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.callback_data;
  const queryId = callbackQuery.id;

  console.log(`Received callback query: ${data} from chat: ${chatId}`);

  // Safety check for callback_data
  if (!data || typeof data !== 'string') {
    console.error('Invalid callback data:', data);
    return new Response('OK', { status: 200 });
  }

  // Answer the callback query first to stop the loading spinner
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: queryId,
        text: "Processing...",
        show_alert: false
      })
    });
  } catch (error) {
    console.error('Failed to answer callback query:', error);
  }

  try {
    if (data.startsWith('post_')) {
      console.log('Processing post callback');
      
      // Extract media type and ID from callback data
      const parts = data.split('_');
      if (parts.length < 3) {
        console.error('Invalid post callback format:', data);
        await sendTextMessage(BOT_TOKEN, chatId, "❌ Invalid selection. Please try searching again.", []);
        return new Response('OK', { status: 200 });
      }

      const mediaType = parts[1]; // 'movie' or 'tv' 
      const tmdbId = parts[2];

      console.log(`Media type: ${mediaType}, TMDB ID: ${tmdbId}`);

      // Validate media type
      if (!['movie', 'tv'].includes(mediaType)) {
        console.error('Invalid media type:', mediaType);
        await sendTextMessage(BOT_TOKEN, chatId, "❌ Invalid content type. Please try again.", []);
        return new Response('OK', { status: 200 });
      }

      // Validate TMDB ID
      if (!tmdbId || isNaN(parseInt(tmdbId))) {
        console.error('Invalid TMDB ID:', tmdbId);
        await sendTextMessage(BOT_TOKEN, chatId, "❌ Invalid content ID. Please try again.", []);
        return new Response('OK', { status: 200 });
      }

      // Check if we have a default channel ID
      const defaultChannelId = env.TELEGRAM_CHANNEL_ID;
      
      if (!defaultChannelId) {
        console.log('No default channel configured');
        const setupMessage = `
⚙️ <b>Channel Setup Required</b>

To post content, you need to configure your channel first:

<b>Quick Setup Steps:</b>
1️⃣ Get your channel ID from @userinfobot
2️⃣ Add this bot to your channel as admin
3️⃣ Visit the website and configure settings
4️⃣ Try posting again

<b>Website:</b> https://imdb-tg-post-font.pages.dev

💡 <b>Need help?</b> Use /setup for detailed guide
        `.trim();

        const buttons = [
          [
            { text: "🌐 Open Website", url: "https://imdb-tg-post-font.pages.dev" },
            { text: "⚙️ Setup Guide", callback_data: "setup_guide" }
          ],
          [
            { text: "🤖 Get Channel ID", url: "https://t.me/userinfobot" }
          ]
        ];

        await sendTextMessage(BOT_TOKEN, chatId, setupMessage, buttons);
        return new Response('OK', { status: 200 });
      }

      // Send posting message
      console.log('Sending posting message');
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
          clientBanner: env.CLIENT_BANNER || '' // Use env variable if available
        }
      };

      console.log('Posting payload:', JSON.stringify(payload, null, 2));

      // Post to Telegram using existing function
      const result = await sendToTelegram(payload, env);
      console.log('Post result:', result);
      
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
        console.log('Bot admin error detected');
        confirmMessage = `
❌ <b>Bot Setup Required!</b>

The bot needs to be added to your channel as an admin.

<b>Steps to fix:</b>
1. Add @${result.botUsername || 'your_bot'} to your channel
2. Make it admin with "Post Messages" permission
3. Try posting again

💡 <b>Need help?</b> Contact support
        `.trim();

        buttons = [
          [
            { text: "🆘 Get Help", url: "https://t.me/SLtharindu1" },
            { text: "⚙️ Setup Guide", callback_data: "setup_guide" }
          ]
        ];
      } else {
        console.log('Post failed with error:', result);
        confirmMessage = `
❌ <b>Failed to Post</b>

${typeof result === 'object' ? (result.message || 'Unknown error') : result}

<b>Common fixes:</b>
• Ensure bot is admin in channel
• Check "Post Messages" permission
• Verify channel ID is correct

<b>Need help?</b> Contact support
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
      console.log('Showing setup guide');
      return await handleSetupCommand(BOT_TOKEN, chatId);
    } else if (data === 'try_search' || data === 'search_more') {
      console.log('Showing search help');
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

<b>Popular examples:</b>
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

<b>Popular examples:</b>
• <code>/search House of Dragon</code>
• <code>/search Stranger Things</code>
• <code>/search The Boys</code>
• <code>/search Wednesday</code>
      `.trim();
      
      await sendTextMessage(BOT_TOKEN, chatId, message, []);
    } else {
      console.log('Unknown callback data:', data);
    }

    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback query processing error:', error);
    const errorMessage = `
❌ <b>Error:</b> ${error.message}

Something went wrong while processing your request. Please try again or contact support.

<b>What you can try:</b>
• Use /search to search again
• Check /help for commands
• Contact support if issue persists
    `.trim();
    
    await sendTextMessage(BOT_TOKEN, chatId, errorMessage, []);
    return new Response('OK', { status: 200 });
  }
}

// Improved function for sending text messages
async function sendTextMessage(BOT_TOKEN, chatId, message, buttons = []) {
  try {
    // Validate inputs
    if (!BOT_TOKEN || !chatId || !message) {
      console.error('Missing required parameters for sendTextMessage');
      return "❌ Missing required parameters";
    }

    // Ensure message isn't too long (Telegram limit is 4096 characters)
    if (message.length > 4000) {
      message = message.substring(0, 3900) + "...\n\n💡 Message truncated due to length limit.";
    }

    // Ensure buttons array is valid
    if (!Array.isArray(buttons)) {
      console.error('Buttons parameter must be an array');
      buttons = [];
    }

    // Validate button structure and limits
    if (buttons.length > 0) {
      // Telegram allows max 100 buttons per message
      if (buttons.length > 20) {
        console.warn('Too many button rows, truncating to 20');
        buttons = buttons.slice(0, 20);
      }

      // Validate each button row
      buttons = buttons.filter(row => {
        if (!Array.isArray(row) || row.length === 0) {
          console.warn('Invalid button row, skipping:', row);
          return false;
        }
        
        // Validate each button in the row
        row.forEach(button => {
          if (!button.text || (!button.callback_data && !button.url)) {
            console.warn('Invalid button structure:', button);
          }
          
          // Truncate button text if too long
          if (button.text && button.text.length > 64) {
            button.text = button.text.substring(0, 60) + '...';
          }
          
          // Validate callback_data length
          if (button.callback_data && button.callback_data.length > 64) {
            console.warn('Callback data too long, truncating:', button.callback_data);
            button.callback_data = button.callback_data.substring(0, 64);
          }
        });
        
        return true;
      });
    }

    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true // Prevent automatic link previews
    };

    // Only add reply_markup if we have valid buttons
    if (buttons.length > 0) {
      payload.reply_markup = { inline_keyboard: buttons };
    }

    console.log(`Sending message to ${chatId}, length: ${message.length}, buttons: ${buttons.length}`);

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    
    if (result.ok) {
      console.log('Message sent successfully');
      return "✅ Message sent successfully";
    } else {
      console.error('Telegram API error:', result);
      
      // Handle specific error cases
      if (result.error_code === 400) {
        if (result.description?.includes('message is too long')) {
          return "❌ Message too long";
        } else if (result.description?.includes('chat not found')) {
          return "❌ Chat not found - check chat ID";
        } else if (result.description?.includes('bot was blocked')) {
          return "❌ Bot was blocked by user";
        }
      } else if (result.error_code === 403) {
        return "❌ Bot doesn't have permission to send messages";
      } else if (result.error_code === 429) {
        return "❌ Rate limited - please try again later";
      }
      
      return `❌ Telegram error: ${result.description || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Network error in sendTextMessage:', error);
    return `❌ Network error: ${error.message}`;
  }
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