// Update worker URL with your actual Telegram bot endpoint
const workerUrl = '__WORKER_URL__';
const AUTH_TOKEN = '__AUTH_TOKEN__';
let searchResults = [];
let selectedContent = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultSelect = document.getElementById('resultSelect');
const seasonInput = document.getElementById('seasonInput');
const episodeInput = document.getElementById('episodeInput');
const customLink = document.getElementById('customLink');
const noteInput = document.getElementById('noteInput');
const postBtn = document.getElementById('postBtn');
const statusPopupContainer = document.getElementById('statusPopupContainer');

// Preview elements
const moviePoster = document.getElementById('moviePoster');
const movieTitle = document.getElementById('movieTitle');
const movieYear = document.getElementById('movieYear');
const movieRating = document.getElementById('movieRating');
const moviePlot = document.getElementById('moviePlot');
const movieNote = document.getElementById('movieNote');

// Settings elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.querySelector('.close');
const channelIdInput = document.getElementById('channelIdInput');
const clientBannerInput = document.getElementById('clientBannerInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const clearSettingsBtn = document.getElementById('clearSettingsBtn');

// Debug logs
console.log("Using worker URL:", workerUrl);
console.log("Using auth token:", AUTH_TOKEN ? AUTH_TOKEN.substring(0, 5) + '...' : 'undefined');

// Load settings from localStorage
function loadSettings() {
  return JSON.parse(localStorage.getItem('cinemaHubSettings')) || {
    channelId: '',
    clientBanner: '' // Add default banner
  };
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('cinemaHubSettings', JSON.stringify(settings));
  updateStatus('✅ Settings saved!', 'success');
}

// Initialize settings
function initSettings() {
  const settings = loadSettings();
  channelIdInput.value = settings.channelId || '';
  clientBannerInput.value = settings.clientBanner || ''; // Initialize banner
}
  
  // Event listeners
  settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
  });
  
  closeModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  saveSettingsBtn.addEventListener('click', () => {
    const settings = {
      channelId: channelIdInput.value.trim(),
      clientBanner: clientBannerInput.value.trim() // Save banner
    };
    saveSettings(settings);
    setTimeout(() => settingsModal.style.display = 'none', 1000);
  });
  
  clearSettingsBtn.addEventListener('click', () => {
    localStorage.removeItem('cinemaHubSettings');
    channelIdInput.value = '';
    clientBannerInput.value = ''; // Clear banner input
    updateStatus('🧹 Settings cleared', 'success');
  });

// Initialize
function init() {
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  resultSelect.addEventListener('change', updatePreview);
  noteInput.addEventListener('input', updateNote);
  postBtn.addEventListener('click', handlePost);
  
  // Set up collapsible section toggle
  const collapseTitle = document.querySelector('.card-title.collapsible');
  if (collapseTitle) {
    collapseTitle.addEventListener('click', toggleCollapse);
  }
  
  // Initialize custom dropdown
  initCustomDropdown();
  initSettings();
  
  updateStatus('🚀 Ready to search for content...', 'success');
}

// Initialize custom dropdown
function initCustomDropdown() {
  const container = document.querySelector('.custom-select-container');
  if (!container) return;
  
  const customSelect = container.querySelector('.custom-select');
  const selectedText = container.querySelector('.selected-text');
  const customOptions = container.querySelector('.custom-options');
  const originalSelect = document.getElementById('resultSelect');
  const customArrow = container.querySelector('.custom-arrow');

  // Toggle dropdown
  customSelect.addEventListener('click', (e) => {
    if (e.target !== customArrow && !e.target.closest('.custom-arrow')) {
      customSelect.classList.toggle('open');
      
      // Close other open dropdowns
      document.querySelectorAll('.custom-select.open').forEach(dropdown => {
        if (dropdown !== customSelect) dropdown.classList.remove('open');
      });
    }
  });

  // Update dropdown when original select changes
  originalSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    selectedText.textContent = selectedOption.textContent;
    
    // Update selected state in custom options
    customOptions.querySelectorAll('.custom-option').forEach(opt => {
      opt.classList.remove('selected');
      if (opt.dataset.value === this.value) {
        opt.classList.add('selected');
        opt.scrollIntoView({ block: 'nearest' });
      }
    });
    
    // Close dropdown after selection
    customSelect.classList.remove('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove('open');
    }
  });

  // Handle keyboard navigation
  customSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      customSelect.classList.toggle('open');
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      customSelect.classList.remove('open');
    }
  });
  
  // Handle arrow key navigation when dropdown is open
  customOptions.addEventListener('keydown', (e) => {
    if (!customSelect.classList.contains('open')) return;
    
    const options = Array.from(customOptions.querySelectorAll('.custom-option'));
    const currentOption = document.querySelector('.custom-option:focus') || 
                         customOptions.querySelector('.custom-option.selected') || 
                         customOptions.querySelector('.custom-option:first-child');
    
    let currentIndex = options.indexOf(currentOption);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % options.length;
      options[nextIndex].focus();
    }
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + options.length) % options.length;
      options[prevIndex].focus();
    }
    
    if (e.key === 'Enter' && currentOption) {
      e.preventDefault();
      originalSelect.value = currentOption.dataset.value;
      originalSelect.dispatchEvent(new Event('change'));
    }
  });
}

// Populate custom dropdown options
function populateCustomDropdown() {
  const container = document.querySelector('.custom-select-container');
  if (!container) return;
  
  const customOptions = container.querySelector('.custom-options');
  const originalSelect = document.getElementById('resultSelect');
  const selectedText = container.querySelector('.selected-text');
  
  customOptions.innerHTML = '';
  
  // Update selected text
  const selectedOption = originalSelect.options[originalSelect.selectedIndex];
  selectedText.textContent = selectedOption ? selectedOption.textContent : '📋 Select Result';
  
  for (let i = 0; i < originalSelect.options.length; i++) {
    const option = originalSelect.options[i];
    const div = document.createElement('div');
    div.className = 'custom-option';
    div.dataset.value = option.value;
    div.textContent = option.textContent;
    div.tabIndex = 0; // Make focusable for keyboard navigation
    
    if (option.selected) {
      div.classList.add('selected');
    }
    
    div.addEventListener('click', (e) => {
      // Prevent event from bubbling up
      e.stopPropagation();
      
      originalSelect.value = option.value;
      originalSelect.dispatchEvent(new Event('change'));
      
      // Close dropdown after selection
      const customSelect = container.querySelector('.custom-select');
      customSelect.classList.remove('open');
    });
    
    div.addEventListener('mouseenter', () => {
      div.focus();
    });
    
    customOptions.appendChild(div);
  }
}

// Handle search
async function handleSearch() {
  const title = searchInput.value.trim();

  if (!title) {
    updateStatus('❌ Please enter a title', 'error');
    return;
  }

  try {
    updateStatus('🔍 Searching TMDB...', 'loading');

    // 1) Extract title + optional year
    const regex = /^(.*?)(?:\s+\((\d{4})\)|\s+(\d{4}))?$/;
    const match = title.match(regex);
    const cleanTitle = (match[1] || title).trim();
    const year = match[2] || match[3] || '';

    // 2) Build TMDB URL
    let apiUrl =
      `https://api.themoviedb.org/3/search/multi` +
      `?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb` +
      `&query=${encodeURIComponent(cleanTitle)}` +
      `&include_adult=false`;
    if (year) apiUrl += `&year=${year}`;

    // 3) Fetch & parse
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    let results = (data.results || [])
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv');

    // 4) If user specified a year, filter to exact-year matches
    if (year) {
      const yearMatches = results.filter(item => {
        const date = item.release_date || item.first_air_date || '';
        return date.startsWith(year + '-');
      });
      // Only use filtered list if we found any
      if (yearMatches.length) {
        results = yearMatches;
      }
    }

    // 5) Sort by popularity & votes, then limit to top 10
    searchResults = results
      .sort((a, b) =>
        (b.popularity || 0) - (a.popularity || 0) ||
        (b.vote_count   || 0) - (a.vote_count   || 0)
      )
      .slice(0, 10);

    // 6) Handle no-results
    if (searchResults.length === 0) {
      updateStatus('❌ No results found', 'error');
      resultSelect.innerHTML = '<option value="">No results found</option>';
      populateCustomDropdown();
      resetPreview();
      return;
    }

    // 7) Populate dropdown for manual selection only
    resultSelect.innerHTML = '<option value="">📋 Select Result</option>';
    searchResults.forEach((result, idx) => {
      const opt = document.createElement('option');
      opt.value        = idx;
      opt.textContent  = formatDropdownOption(result);
      resultSelect.appendChild(opt);
    });
    populateCustomDropdown();

    updateStatus(`✅ Found ${searchResults.length} match${searchResults.length > 1 ? 'es' : ''}`, 'success');
  }
  catch (err) {
    updateStatus(`❌ Error: ${err.message}`, 'error');
    console.error('Search error:', err);
  }
}

// Format dropdown option text
function formatDropdownOption(result) {
  const title = result.title || result.name || 'Untitled';
  const year = result.release_date?.split('-')[0] || result.first_air_date?.split('-')[0] || 'N/A';
  const type = result.media_type === 'movie' ? '🎬' : '📺';
  
  // Truncate long titles to prevent layout issues
  const maxTitleLength = 50;
  const truncatedTitle = title.length > maxTitleLength 
    ? title.substring(0, maxTitleLength) + '...' 
    : title;
  
  return `${type} ${truncatedTitle} (${year})`;
}

// Update preview card
function updatePreview() {
  const index = parseInt(resultSelect.value);
  const note = noteInput.value.trim();

  if (isNaN(index) || !searchResults[index]) {
    resetPreview();
    postBtn.disabled = true;
    return;
  }

  selectedContent = searchResults[index];
  const posterPath = selectedContent.poster_path 
    ? `https://image.tmdb.org/t/p/w500${selectedContent.poster_path}`
    : null;

  // Update poster
  if (posterPath) {
    moviePoster.style.backgroundImage = `url('${posterPath}')`;
    moviePoster.classList.add('has-image');
  } else {
    moviePoster.style.backgroundImage = '';
    moviePoster.classList.remove('has-image');
  }

  // Update text content
  movieTitle.textContent = selectedContent.title || selectedContent.name || 'Untitled';
  movieRating.textContent = selectedContent.vote_average ? `${selectedContent.vote_average.toFixed(1)}/10` : 'N/A';
  
  // Set plot text with fallback
  const plotText = selectedContent.overview || 'No overview available.';
  moviePlot.textContent = plotText;
  
  const date = selectedContent.release_date || selectedContent.first_air_date || 'Unknown';
  const year = date.split('-')[0];
  const type = selectedContent.media_type === 'movie' ? 'Movie' : 'TV Show';
  movieYear.textContent = `${type} • ${year}`;
  
  updateNote();
  postBtn.disabled = false;
}

// Reset preview to default state
function resetPreview() {
  moviePoster.style.backgroundImage = '';
  moviePoster.classList.remove('has-image');
  movieTitle.textContent = 'Select Content';
  movieYear.textContent = 'Year';
  movieRating.textContent = 'N/A';
  moviePlot.textContent = 'Search and select a movie or series to see details here';
  movieNote.style.display = 'none';
  postBtn.disabled = true;
  
  // Reset custom dropdown
  const selectedText = document.querySelector('.selected-text');
  if (selectedText) {
    selectedText.textContent = '📋 Select Result';
  }
}

// Update note in preview
function updateNote() {
  const note = noteInput.value.trim();
  if (note) {
    movieNote.textContent = note;
    movieNote.style.display = 'block';
  } else {
    movieNote.style.display = 'none';
  }
}

// Handle post to Telegram
async function handlePost() {
  const title = searchInput.value.trim();
  const season = seasonInput.value.trim();
  const episode = episodeInput.value.trim();
  const customLinkValue = customLink.value.trim();
  const note = noteInput.value.trim();
  
  updateStatus('📤 Posting to Telegram...', 'loading');

  if (!title || searchResults.length === 0) {
    updateStatus('❌ Please search for a title first', 'error');
    return;
  }

  const choiceIdx = parseInt(resultSelect.value);
  if (isNaN(choiceIdx)) {
    updateStatus('❌ Please select a valid result', 'error');
    return;
  }
  
  const settings = loadSettings();
  const channelId = settings.channelId;
  const clientBanner = settings.clientBanner || '';
  
  if (!channelId) {
    updateStatus('❌ Please set a Channel ID in Settings', 'error');
    settingsModal.style.display = 'block';
    return;
  }
  
  // Get selected content
  const selected = searchResults[choiceIdx];
  
  // Construct payload with TMDB ID and media type
  const payload = {
    title,
    choice_idx: choiceIdx.toString(),
    tmdb_id: selected.id,
    media_type: selected.media_type,
    season,
    episode,
    custom_link: customLinkValue,
    note,
    channel_id: channelId,
    settings: {
      clientBanner: clientBanner
    }
  };

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Handle non-JSON responses
      throw new Error(`Invalid server response: ${responseText.slice(0, 100)}`);
    }

    // Handle different response formats
    let resultMessage = responseData;
    if (typeof responseData === 'object' && responseData.result) {
      resultMessage = responseData.result;
    }

    // Handle bot admin errors
    if (typeof resultMessage === 'object' && resultMessage.type === 'bot_admin_error') {
      createBotAdminPopup(resultMessage);
      return;
    }
    if (typeof resultMessage === 'string' && resultMessage.includes('bot_admin_error')) {
      try {
        // Try to parse the error JSON
        const errorData = JSON.parse(resultMessage);
        createBotAdminPopup(errorData);
        return;
      } catch (e) {
        // If parsing fails, show raw message
        createBotAdminPopup({
          message: resultMessage,
          botUsername: 'your_bot'
        });
        return;
      }
    }

    if (!response.ok) {
      throw new Error(responseData.error || `Failed to post: ${response.status}`);
    }

    // Reset form only on success
    if (resultMessage && resultMessage.startsWith('✅')) {
      searchInput.value = '';
      resultSelect.innerHTML = '<option value="">❌ Search Frist</option>';
      seasonInput.value = '';
      episodeInput.value = '';
      customLink.value = '';
      noteInput.value = '';
      resetPreview();
      populateCustomDropdown();
      updateStatus(resultMessage, 'success');
    } else if (resultMessage && resultMessage.startsWith('❌')) {
      updateStatus(resultMessage, 'error');
    }
    
    // Handle legacy string-based admin errors
    if (resultMessage && (resultMessage.includes('Bot is not in your channel') || 
        resultMessage.includes('not an admin'))) {
      // Extract bot username from the error message
      const botUsernameMatch = resultMessage.match(/@(\w+)/);
      const botUsername = botUsernameMatch ? botUsernameMatch[0] : 'your_bot';
      
      createBotAdminPopup({
        message: resultMessage,
        botUsername: botUsername
      });
    }
    
  } catch (error) {
    updateStatus(`❌ Error: ${error.message}`, 'error');
    console.error('Posting error:', error);
  }
}

function createBotAdminPopup(errorData) {
  // Ensure we have a valid bot username
  const botUsername = errorData.botUsername || 'your_bot';
  
  const popup = document.createElement('div');
  popup.className = 'status-popup error';
  
  popup.innerHTML = `
    <div class="status-popup-content">
      <div class="status-icon">❌</div>
      <div class="status-text">
        <strong>Bot Setup Required!</strong>
        <p>${errorData.message}</p>
        <p>Please follow these steps:</p>
        <ol>
          <li>Add bot to your channel: 
            <a href="https://t.me/${botUsername.replace('@', '')}" 
               target="_blank" 
               class="bot-link">
              ${botUsername}
            </a>
          </li>
          <li>Go to Channel Info > Administrators > Add Admin</li>
          <li>Search for <strong>${botUsername}</strong></li>
          <li>Grant <strong>"Post Messages"</strong> permission</li>
          <li>Make sure to click <strong>"Save"</strong></li>
        </ol>
        <div class="try-again">Try posting again after adding the bot</div>
      </div>
      <button class="close-popup">×</button>
    </div>
  `;
  
  // Clear existing popups
  statusPopupContainer.innerHTML = '';
  statusPopupContainer.appendChild(popup);
  
  // Add close functionality
  popup.querySelector('.close-popup').addEventListener('click', () => {
    statusPopupContainer.removeChild(popup);
  });
  
  // Show immediately
  setTimeout(() => {
    popup.classList.add('show');
  }, 10);
}

// Update status with popup
function updateStatus(message, type = '') {
  // Clear existing popup
  while (statusPopupContainer.firstChild) {
    statusPopupContainer.removeChild(statusPopupContainer.firstChild);
  }

  // Create popup element
  const popup = document.createElement('div');
  popup.className = `status-popup ${type}`;
  
  const popupContent = document.createElement('div');
  popupContent.className = 'status-popup-content';
  
  // Set icon based on status type
  let icon = 'ℹ️';
  if (type === 'loading') icon = '';
  else if (type === 'success') icon = '';
  else if (type === 'error') icon = '';
  
  popupContent.innerHTML = `
    <div class="status-icon">${icon}</div>
    <div class="status-text">${message}</div>
  `;
  
  // Add timer bar
  const timerBar = document.createElement('div');
  timerBar.className = 'status-popup-timer';
  popup.appendChild(timerBar);
  popup.appendChild(popupContent);
  
  // Add to container
  statusPopupContainer.appendChild(popup);
  
  // Trigger animation
  setTimeout(() => {
    popup.classList.add('show');
    
    // Animate timer bar
    timerBar.style.transition = 'transform 5s linear';
    timerBar.style.transform = 'scaleX(0)';
  }, 10);
  
  // Remove after 5 seconds
  setTimeout(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translateX(120%)';
    
    // Remove element after animation completes
    setTimeout(() => {
      if (popup.parentNode === statusPopupContainer) {
        statusPopupContainer.removeChild(popup);
      }
    }, 400);
  }, 5000);
}

// Toggle collapsible section
function toggleCollapse() {
  const content = document.getElementById("collapse-content");
  const icon = document.getElementById("toggle-icon");
  content.classList.toggle("expanded");
  icon.textContent = content.classList.contains("expanded") ? "▲" : "▼";
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);