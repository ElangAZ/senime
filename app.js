// API Base and Proxy Fallback system
const API_BASE = 'https://www.sankavollerei.com/anime';

// List of popular genres to populate sidebar and modal
const GENRES_LIST = [
    { title: 'Action', id: 'action' },
    { title: 'Adventure', id: 'adventure' },
    { title: 'Comedy', id: 'comedy' },
    { title: 'Drama', id: 'drama' },
    { title: 'Fantasy', id: 'fantasy' },
    { title: 'Isekai', id: 'isekai' },
    { title: 'Magic', id: 'magic' },
    { title: 'Romance', id: 'romance' },
    { title: 'School', id: 'school' },
    { title: 'Sci-Fi', id: 'sci-fi' },
    { title: 'Seinen', id: 'seinen' },
    { title: 'Shounen', id: 'shounen' },
    { title: 'Slice of Life', id: 'slice-of-life' },
    { title: 'Supernatural', id: 'supernatural' },
    { title: 'Mystery', id: 'mystery' },
    { title: 'Ecchi', id: 'ecchi' },
    { title: 'Sports', id: 'sports' },
    { title: 'Mecha', id: 'mecha' },
    { title: 'Horror', id: 'horror' },
    { title: 'Suspense', id: 'suspense' }
];

// Fetch API with automated multi-proxy fallback
async function fetchAPI(endpoint) {
    const url = `${API_BASE}${endpoint}`;
    
    const isLocalServer = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' || 
                          window.location.port !== ''; // running on a local development port

    // We try local/Vercel proxy first if on a web server, then direct, then public proxies
    const requestStrategies = [];
    
    if (window.location.protocol.startsWith('http')) {
        requestStrategies.push({
            name: 'Local/Vercel Proxy Server',
            urlFn: () => `/api${endpoint}`
        });
    }
    
    requestStrategies.push(
        {
            name: 'Direct Fetch',
            urlFn: (u) => u
        },
        {
            name: 'CORSProxy.io',
            urlFn: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
        },
        {
            name: 'AllOrigins.win',
            urlFn: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
        }
    );

    let lastError = null;
    
    for (const strategy of requestStrategies) {
        try {
            console.log(`Trying ${strategy.name} for: ${endpoint}`);
            const finalUrl = strategy.urlFn(url);
            
            // Set timeout for fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(finalUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status}`);
            }
            
            const text = await response.text();
            // Validate JSON
            const data = JSON.parse(text);
            
            // Sankavollerei API returns status: success or ok: true
            if (data && (data.status === 'success' || data.ok)) {
                return data;
            } else {
                throw new Error(data.message || 'API returned failure status');
            }
        } catch (err) {
            console.warn(`${strategy.name} failed:`, err.message);
            lastError = err;
        }
    }
    
    showToast('Koneksi API gagal. Mencoba memuat ulang...', 'error');
    throw lastError || new Error('Failed to fetch from all endpoints');
}

// Helper to extract just the episode number from an episode title
function extractEpisodeNumber(title) {
    if (!title) return '';
    
    // Pattern 1: match "Episode 123", "Ep 123", "Eps. 12.5"
    const epRegex = /(?:Episode|Ep\.?|Eps\.?)\s*(\d+(\.\d+)?)/i;
    const match = title.match(epRegex);
    if (match) {
        return match[1];
    }
    
    // Pattern 2: if not found, look for standalone numbers, starting from the end
    // (anime names might contain numbers, e.g. "Mob Psycho 100 Season 3 Episode 12" -> we want 12, not 100 or 3)
    const numbers = title.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
        return numbers[numbers.length - 1];
    }
    
    return title;
}

// UI State variables
let currentView = 'home';
let episodeSortAsc = false;
let historyItems = JSON.parse(localStorage.getItem('nekowatch_history')) || [];

// App Elements
const views = {
    home: document.getElementById('view-home'),
    catalog: document.getElementById('view-catalog'),
    detail: document.getElementById('view-detail'),
    stream: document.getElementById('view-stream'),
    results: document.getElementById('view-results')
};

// Toast notification helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ attrs: { 'data-lucide': true } });

    // Show toast with slide-in
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Hide and remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show specific view with fade animation
function switchView(viewName) {
    currentView = viewName;
    
    // Deactivate all views
    Object.keys(views).forEach(key => {
        views[key].classList.remove('active');
    });
    
    // Activate requested view
    if (views[viewName]) {
        views[viewName].classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Update active navigation links
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        const viewLink = link.getAttribute('data-view');
        if (viewLink === viewName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Close mobile modal if open
    document.getElementById('genres-modal').classList.remove('active');
}

// Render generic anime grid
function renderAnimeGrid(animeList, containerId, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = `<div class="no-data">Tidak ada anime yang ditemukan.</div>`;
        return;
    }

    const itemsToRender = limit ? animeList.slice(0, limit) : animeList;

    itemsToRender.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // Handle ID parsing
        const animeId = anime.animeId || anime.href.split('/').pop();
        
        // Check for episodes or score
        const epsBadge = anime.episodes ? `<div class="card-badge">${anime.episodes} Eps</div>` : '';
        const scoreBadge = anime.score && anime.score !== '0' && anime.score !== '0.00' ? 
            `<div class="card-score"><i data-lucide="star"></i> ${anime.score}</div>` : '';
        
        // Release day tag if available
        const releaseTag = anime.releaseDay ? `<div class="card-release-tag">${anime.releaseDay}</div>` : '';
        
        card.innerHTML = `
            <a href="#/anime/${animeId}">
                <div class="card-poster-wrapper">
                    <img class="card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">
                    ${epsBadge}
                    ${scoreBadge}
                    ${releaseTag}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${anime.title}</h3>
                    <div class="card-meta">
                        <span class="card-episodes"><i data-lucide="play"></i> Nonton</span>
                        <span>${anime.latestReleaseDate || anime.lastReleaseDate || 'Sub Indo'}</span>
                    </div>
                </div>
            </a>
        `;
        
        container.appendChild(card);
    });
    
    // Refresh icons
    lucide.createIcons({ attrs: { 'data-lucide': true } });
}

// Save to watch history
function saveToHistory(animeId, animeTitle, poster, episodeId, episodeTitle) {
    // Remove if already exists to place it on top
    historyItems = historyItems.filter(item => item.animeId !== animeId);
    
    // Add new item at index 0
    historyItems.unshift({
        animeId,
        animeTitle,
        poster,
        episodeId,
        episodeTitle,
        timestamp: Date.now()
    });
    
    // Limit to 12 items
    if (historyItems.length > 12) historyItems.pop();
    
    localStorage.setItem('nekowatch_history', JSON.stringify(historyItems));
    updateHistoryUI();
}

// Clear history
document.getElementById('clear-history-btn').addEventListener('click', () => {
    historyItems = [];
    localStorage.removeItem('nekowatch_history');
    updateHistoryUI();
    showToast('Riwayat menonton telah dihapus.');
});

// Update watch history UI
function updateHistoryUI() {
    const historySection = document.getElementById('history-section');
    const historyGrid = document.getElementById('history-grid');
    
    if (historyItems.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    
    historySection.style.display = 'block';
    historyGrid.innerHTML = '';
    
    historyItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        const epNum = extractEpisodeNumber(item.episodeTitle);
        const epText = isNaN(epNum) ? epNum : `Episode ${epNum}`;
        card.innerHTML = `
            <a href="#/episode/${item.episodeId}">
                <div class="card-poster-wrapper">
                    <img class="card-poster" src="${item.poster}" alt="${item.animeTitle}" loading="lazy">
                    <div class="card-badge bg-cyan">Lanjut</div>
                    <div class="card-release-tag">${epText}</div>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${item.animeTitle}</h3>
                    <div class="card-meta">
                        <span class="card-episodes"><i data-lucide="play" style="color:var(--cyan)"></i> Putar</span>
                        <span style="font-size:10px">${new Date(item.timestamp).toLocaleDateString('id-ID')}</span>
                    </div>
                </div>
            </a>
        `;
        historyGrid.appendChild(card);
    });
    
    lucide.createIcons({ attrs: { 'data-lucide': true } });
}

// Generate Spotlight Hero Banner
function renderHeroBanner(ongoingList) {
    const heroBanner = document.getElementById('hero-banner');
    if (!heroBanner || !ongoingList || ongoingList.length === 0) return;
    
    // Pick a random anime from ongoing list as spotlight
    const idx = Math.floor(Math.random() * Math.min(ongoingList.length, 6));
    const item = ongoingList[idx];
    const animeId = item.animeId || item.href.split('/').pop();
    
    // Fetch further details for synopsis and better metadata
    fetchAPI(`/anime/${animeId}`).then(detailRes => {
        const details = detailRes.data;
        const genresHTML = details.genreList.slice(0, 3).map(g => `<span class="hero-badge">${g.title}</span>`).join(' ');
        const synopsis = details.synopsis && details.synopsis.paragraphs.length > 0 ? 
            details.synopsis.paragraphs[0] : 'Saksikan kelanjutan kisah anime seru ini secara gratis dengan subtitle Indonesia.';
            
        heroBanner.innerHTML = `
            <div class="hero-bg" style="background-image: url('${details.poster}')"></div>
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-poster-wrapper">
                    <img class="hero-poster" src="${details.poster}" alt="${details.title}">
                </div>
                <div class="hero-info">
                    <div style="display:flex; gap: 8px;">
                        <span class="hero-badge" style="background:var(--pink)">SPOTLIGHT</span>
                        ${genresHTML}
                    </div>
                    <h1 class="hero-title">${details.title}</h1>
                    <div class="hero-meta">
                        <span class="hero-meta-item score"><i data-lucide="star"></i> ${details.score || '0.0'}</span>
                        <span class="hero-meta-item"><i data-lucide="tv"></i> ${details.type || 'TV'}</span>
                        <span class="hero-meta-item"><i data-lucide="calendar"></i> Hari Rilis: ${item.releaseDay || '-'}</span>
                    </div>
                    <p class="hero-synopsis">${synopsis}</p>
                    <div class="hero-actions">
                        <a href="#/anime/${animeId}" class="btn-hero-play">
                            <i data-lucide="play"></i> Detail & Episode
                        </a>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons({ attrs: { 'data-lucide': true } });
    }).catch(err => {
        // Fallback banner rendering if detail API fails
        heroBanner.innerHTML = `
            <div class="hero-bg" style="background-image: url('${item.poster}')"></div>
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-poster-wrapper">
                    <img class="hero-poster" src="${item.poster}" alt="${item.title}">
                </div>
                <div class="hero-info">
                    <span class="hero-badge" style="background:var(--pink)">SPOTLIGHT</span>
                    <h1 class="hero-title">${item.title}</h1>
                    <div class="hero-meta">
                        <span class="hero-meta-item"><i data-lucide="play-circle"></i> Episode ${item.episodes || '?'}</span>
                        <span class="hero-meta-item"><i data-lucide="calendar"></i> Rilis: ${item.releaseDay || '-'}</span>
                    </div>
                    <p class="hero-synopsis">Streaming nonton anime sub indo ter-update setiap hari hanya di NekoWatch.</p>
                    <div class="hero-actions">
                        <a href="#/anime/${animeId}" class="btn-hero-play">
                            <i data-lucide="play"></i> Tonton Sekarang
                        </a>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons({ attrs: { 'data-lucide': true } });
    });
}

// Router pages logic
async function loadHome() {
    switchView('home');
    updateHistoryUI();
    
    try {
        const res = await fetchAPI('/home');
        if (res.data) {
            renderHeroBanner(res.data.ongoing.animeList);
            renderAnimeGrid(res.data.ongoing.animeList, 'ongoing-grid', 18);
            renderAnimeGrid(res.data.completed.animeList, 'completed-grid', 18);
        }
    } catch (err) {
        console.error('Error loading home data:', err);
        showToast('Gagal memuat katalog anime terbaru.', 'error');
    }
}

async function loadCatalog(type, page = 1) {
    switchView('catalog');
    const grid = document.getElementById('catalog-grid');
    const title = document.getElementById('catalog-title');
    const pagination = document.getElementById('catalog-pagination');
    
    pagination.style.display = 'none';
    title.innerHTML = `<i data-lucide="loader-2" class="shimmer" style="animation: spin 1s infinite linear;"></i> Loading...`;
    grid.innerHTML = '<div class="card-skeleton shimmer"></div>'.repeat(12);
    lucide.createIcons({ attrs: { 'data-lucide': true } });

    // Use the dedicated paginated endpoints instead of /home
    const endpoint = type === 'ongoing' ? '/ongoing-anime' : '/complete-anime';
    const titleText = type === 'ongoing' ? 'Semua Anime Ongoing' : 'Semua Anime Completed';

    try {
        const res = await fetchAPI(`${endpoint}?page=${page}`);
        if (res.data && res.data.animeList) {
            title.innerText = titleText;
            renderAnimeGrid(res.data.animeList, 'catalog-grid');
            
            // Set up pagination
            if (res.data.pagination) {
                const pg = res.data.pagination;
                pagination.style.display = 'flex';
                document.getElementById('catalog-page-info').innerText = `Halaman ${pg.currentPage} dari ${pg.totalPages || '?'}`;
                
                const prevPageBtn = document.getElementById('btn-catalog-prev-page');
                const nextPageBtn = document.getElementById('btn-catalog-next-page');
                
                if (pg.hasPrevPage) {
                    prevPageBtn.onclick = () => window.location.hash = `#/${type}/${pg.prevPage}`;
                    prevPageBtn.removeAttribute('disabled');
                } else {
                    prevPageBtn.onclick = null;
                    prevPageBtn.setAttribute('disabled', 'true');
                }
                
                if (pg.hasNextPage) {
                    nextPageBtn.onclick = () => window.location.hash = `#/${type}/${pg.nextPage}`;
                    nextPageBtn.removeAttribute('disabled');
                } else {
                    nextPageBtn.onclick = null;
                    nextPageBtn.setAttribute('disabled', 'true');
                }
            }
            
            lucide.createIcons({ attrs: { 'data-lucide': true } });
        } else {
            title.innerText = titleText;
            grid.innerHTML = `<div class="no-data">Tidak ada anime yang ditemukan.</div>`;
        }
    } catch (err) {
        console.error('Error loading catalog:', err);
        title.innerText = 'Gagal Memuat';
        grid.innerHTML = `<div class="error-msg">Gagal mengambil data dari API server. Silakan coba lagi.</div>`;
    }
}

async function loadDetail(animeId) {
    switchView('detail');
    
    // Skeleton states
    document.getElementById('detail-backdrop').style.backgroundImage = 'none';
    document.getElementById('detail-poster').src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"></svg>';
    document.getElementById('detail-title').innerText = 'Loading...';
    document.getElementById('detail-japanese').innerText = '';
    document.getElementById('detail-score-val').innerText = '-';
    document.getElementById('detail-type').innerText = '-';
    document.getElementById('detail-status').innerText = '-';
    document.getElementById('detail-episodes').innerText = '- Eps';
    document.getElementById('detail-duration').innerText = '-';
    document.getElementById('detail-genres').innerHTML = '';
    document.getElementById('detail-synopsis-text').innerText = 'Loading synopsis...';
    document.getElementById('detail-studio').innerText = '-';
    document.getElementById('detail-producers').innerText = '-';
    document.getElementById('detail-aired').innerText = '-';
    document.getElementById('detail-episodes-grid').innerHTML = '<div class="card-skeleton shimmer" style="height:50px;"></div>'.repeat(6);
    document.getElementById('recommendations-section').style.display = 'none';

    try {
        const res = await fetchAPI(`/anime/${animeId}`);
        const anime = res.data;
        
        // Render detailed content
        document.getElementById('detail-backdrop').style.backgroundImage = `url('${anime.poster}')`;
        document.getElementById('detail-poster').src = anime.poster;
        document.getElementById('detail-title').innerText = anime.title;
        document.getElementById('detail-japanese').innerText = anime.japanese || '';
        document.getElementById('detail-score-val').innerText = anime.score || '-';
        document.getElementById('detail-type').innerText = anime.type || '-';
        document.getElementById('detail-status').innerText = anime.status || '-';
        document.getElementById('detail-episodes').innerText = `${anime.episodes || '?'} Eps`;
        document.getElementById('detail-duration').innerText = anime.duration || '-';
        document.getElementById('detail-studio').innerText = anime.studios || '-';
        document.getElementById('detail-producers').innerText = anime.producers || '-';
        document.getElementById('detail-aired').innerText = anime.aired || '-';

        // Genres
        const genresList = document.getElementById('detail-genres');
        genresList.innerHTML = '';
        if (anime.genreList) {
            anime.genreList.forEach(g => {
                const tag = document.createElement('a');
                tag.href = `#/genre/${g.genreId}`;
                tag.className = 'tag-genre';
                tag.innerText = g.title;
                genresList.appendChild(tag);
            });
        }

        // Synopsis
        const synopsisContainer = document.getElementById('detail-synopsis-text');
        synopsisContainer.innerHTML = '';
        if (anime.synopsis && anime.synopsis.paragraphs.length > 0) {
            anime.synopsis.paragraphs.forEach(para => {
                const p = document.createElement('p');
                p.innerText = para;
                synopsisContainer.appendChild(p);
            });
        } else {
            synopsisContainer.innerText = 'Sinopsis tidak tersedia untuk anime ini.';
        }

        // Episode renderer helper
        renderEpisodesGrid(anime.episodeList, animeId, anime.title, anime.poster);

        // Sorting toggle
        const sortBtn = document.getElementById('btn-sort-episodes');
        sortBtn.onclick = () => {
            episodeSortAsc = !episodeSortAsc;
            sortBtn.innerHTML = episodeSortAsc ? `<i data-lucide="sort-desc"></i> Terlama` : `<i data-lucide="sort-asc"></i> Terbaru`;
            lucide.createIcons({ attrs: { 'data-lucide': true } });
            
            const sortedList = [...anime.episodeList].reverse();
            renderEpisodesGrid(episodeSortAsc ? sortedList : anime.episodeList, animeId, anime.title, anime.poster);
        };

        // Recommended Anime
        const recSection = document.getElementById('recommendations-section');
        if (anime.recommendedAnimeList && anime.recommendedAnimeList.length > 0) {
            recSection.style.display = 'block';
            renderAnimeGrid(anime.recommendedAnimeList, 'detail-recommendations-grid');
        } else {
            recSection.style.display = 'none';
        }

        lucide.createIcons({ attrs: { 'data-lucide': true } });

    } catch (err) {
        console.error('Error loading details:', err);
        showToast('Gagal memuat detail anime.', 'error');
        document.getElementById('detail-title').innerText = 'Gagal Memuat';
        document.getElementById('detail-synopsis-text').innerText = 'Data anime ini tidak dapat diambil dari server.';
    }
}

// Render list of episodes inside Detail grid
function renderEpisodesGrid(episodeList, animeId, animeTitle, poster) {
    const grid = document.getElementById('detail-episodes-grid');
    grid.innerHTML = '';
    
    if (!episodeList || episodeList.length === 0) {
        grid.className = 'episodes-grid';
        grid.innerHTML = '<div class="no-data" style="grid-column:1/-1">Belum ada episode yang tersedia.</div>';
        return;
    }

    grid.className = 'episodes-grid numeric-grid';

    episodeList.forEach(ep => {
        const card = document.createElement('a');
        card.href = `#/episode/${ep.episodeId}`;
        card.className = 'episode-card numeric-card';
        
        const epNum = extractEpisodeNumber(ep.title);
        
        // Native tooltip for full info on hover
        card.title = `${ep.title} (${ep.date || 'Rilis'})`;
        
        card.innerHTML = `
            <span>${epNum}</span>
        `;
        
        // Listen to click to store history
        card.addEventListener('click', () => {
            saveToHistory(animeId, animeTitle, poster, ep.episodeId, ep.title);
        });

        grid.appendChild(card);
    });
}

// Streaming view handler
async function loadStream(episodeId) {
    switchView('stream');
    
    const player = document.getElementById('video-player');
    const title = document.getElementById('stream-title');
    const qualityBadges = document.getElementById('quality-badges');
    const serverBadges = document.getElementById('server-badges');
    const downloadContainer = document.getElementById('download-links-container');
    const sidebarEpisodes = document.getElementById('stream-sidebar-episodes');
    const sidebarAnimeInfo = document.getElementById('stream-anime-info');
    
    // Clear elements
    player.src = '';
    title.innerText = 'Loading Episode...';
    qualityBadges.innerHTML = '';
    serverBadges.innerHTML = '';
    downloadContainer.innerHTML = '';
    sidebarEpisodes.innerHTML = '';
    sidebarAnimeInfo.innerHTML = '';
    document.getElementById('stream-quality-display').innerText = '-';
    
    try {
        const res = await fetchAPI(`/episode/${episodeId}`);
        const data = res.data;
        
        title.innerText = data.title;
        document.getElementById('stream-duration').innerHTML = `<i data-lucide="clock"></i> Duration: ${data.info.duration || '-'}`;
        document.getElementById('stream-credit').innerHTML = `<i data-lucide="user"></i> Credit: ${data.info.credit || '-'}`;
        
        // Setup Prev/Next buttons
        const prevBtn = document.getElementById('btn-prev-ep');
        const nextBtn = document.getElementById('btn-next-ep');
        
        if (data.hasPrevEpisode) {
            prevBtn.href = `#/episode/${data.prevEpisode.episodeId}`;
            prevBtn.classList.remove('disabled');
        } else {
            prevBtn.removeAttribute('href');
            prevBtn.classList.add('disabled');
        }
        
        if (data.hasNextEpisode) {
            nextBtn.href = `#/episode/${data.nextEpisode.episodeId}`;
            nextBtn.classList.remove('disabled');
        } else {
            nextBtn.removeAttribute('href');
            nextBtn.classList.add('disabled');
        }

        // Render genres
        const streamGenres = document.getElementById('stream-genres');
        streamGenres.innerHTML = '';
        if (data.info.genreList) {
            data.info.genreList.forEach(g => {
                const tag = document.createElement('a');
                tag.href = `#/genre/${g.genreId}`;
                tag.className = 'tag-genre';
                tag.style.padding = '4px 10px';
                tag.style.fontSize = '11.5px';
                tag.innerText = g.title;
                streamGenres.appendChild(tag);
            });
        }

        // Initialize streaming player source
        if (data.defaultStreamingUrl) {
            player.src = data.defaultStreamingUrl;
        }

        // Quality and server selection logic
        if (data.server && data.server.qualities) {
            // Find qualities that have servers
            const activeQualities = data.server.qualities.filter(q => q.serverList && q.serverList.length > 0);
            
            if (activeQualities.length > 0) {
                // Render quality badges
                activeQualities.forEach((q, idx) => {
                    const btn = document.createElement('button');
                    btn.className = `quality-btn ${idx === 0 ? 'active' : ''}`;
                    btn.innerText = q.title;
                    
                    btn.onclick = () => {
                        document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        document.getElementById('stream-quality-display').innerText = q.title;
                        renderServersList(q.serverList, player);
                    };
                    
                    qualityBadges.appendChild(btn);
                });
                
                // Render initial servers list for first quality
                document.getElementById('stream-quality-display').innerText = activeQualities[0].title;
                renderServersList(activeQualities[0].serverList, player);
            } else {
                qualityBadges.innerHTML = '<span>Streaming server alternatif tidak tersedia.</span>';
                serverBadges.innerHTML = '<span>Memutar server default.</span>';
            }
        }

        // Render download links list
        if (data.downloadUrl && data.downloadUrl.qualities) {
            data.downloadUrl.qualities.forEach(q => {
                const row = document.createElement('div');
                row.className = 'download-row';
                
                // Render download buttons for each server/host
                const linksHTML = q.urls.map(u => 
                    `<a href="${u.url}" target="_blank" rel="noopener noreferrer" class="btn-dl">${u.title}</a>`
                ).join(' ');
                
                row.innerHTML = `
                    <div class="dl-quality">${q.title}</div>
                    <div class="dl-size">${q.size || ''}</div>
                    <div class="dl-links">${linksHTML}</div>
                `;
                downloadContainer.appendChild(row);
            });
        } else {
            downloadContainer.innerHTML = '<div class="no-data">Link unduhan tidak tersedia untuk episode ini.</div>';
        }

        // Render sidebar episodes list
        if (data.info.episodeList) {
            data.info.episodeList.forEach(ep => {
                const item = document.createElement('a');
                item.href = `#/episode/${ep.episodeId}`;
                item.className = `sidebar-ep-item ${ep.episodeId === episodeId ? 'active' : ''}`;
                
                const epNum = extractEpisodeNumber(ep.title);
                item.innerText = isNaN(epNum) ? epNum : `Episode ${epNum}`;
                
                // Tooltip for full description on hover
                item.title = ep.title;
                
                sidebarEpisodes.appendChild(item);
                
                // Store active ep scroll target
                if (ep.episodeId === episodeId) {
                    setTimeout(() => item.scrollIntoView({ block: 'nearest' }), 300);
                }
            });
        }

        // Load anime mini info to sidebar (fetch detail matching current animeId)
        if (data.animeId) {
            fetchAPI(`/anime/${data.animeId}`).then(resDetail => {
                const anime = resDetail.data;
                sidebarAnimeInfo.innerHTML = `
                    <img class="anime-mini-poster" src="${anime.poster}" alt="${anime.title}">
                    <div class="anime-mini-details">
                        <h4 class="anime-mini-title">${anime.title}</h4>
                        <div class="anime-mini-meta">
                            <div>Score: <span style="color:var(--star)">★ ${anime.score || '-'}</span></div>
                            <div>Status: ${anime.status || '-'}</div>
                        </div>
                        <a href="#/anime/${data.animeId}" class="anime-mini-btn">Detail Utama</a>
                    </div>
                `;
                
                // Add this watching item to history with full info
                saveToHistory(data.animeId, anime.title, anime.poster, episodeId, data.title);
            }).catch(e => {
                // If details fetch fails, render simplified info
                sidebarAnimeInfo.innerHTML = `
                    <div class="anime-mini-details">
                        <h4 class="anime-mini-title">${data.title.split(' Episode')[0]}</h4>
                        <a href="#/" class="anime-mini-btn">Kembali ke Home</a>
                    </div>
                `;
            });
        }

        lucide.createIcons({ attrs: { 'data-lucide': true } });

    } catch (err) {
        console.error('Error loading streaming page:', err);
        showToast('Gagal memuat server video.', 'error');
        title.innerText = 'Gagal Memuat Video';
    }
}

// Render server badges list and bind switcher click
function renderServersList(serverList, playerIframe) {
    const container = document.getElementById('server-badges');
    container.innerHTML = '';
    
    serverList.forEach((srv, idx) => {
        const btn = document.createElement('button');
        btn.className = `server-badge ${idx === 0 && !playerIframe.src ? 'active' : ''}`;
        btn.innerText = srv.title;
        
        btn.onclick = async () => {
            document.querySelectorAll('.server-badge').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show loading placeholder inside iframe (reset src to clear previous source immediately)
            playerIframe.src = 'about:blank';
            showToast(`Menghubungkan ke server ${srv.title}...`);
            
            try {
                // Retrieve player URL from API serverId
                const res = await fetchAPI(`/server/${srv.serverId}`);
                if (res.data && res.data.url) {
                    playerIframe.src = res.data.url;
                } else {
                    throw new Error('API did not return a stream URL');
                }
            } catch (err) {
                console.error('Error switching server stream:', err);
                showToast('Gagal memuat link dari server ini. Coba server lain.', 'error');
            }
        };
        
        container.appendChild(btn);
    });
}

// Load search queries
async function loadSearch(query) {
    switchView('results');
    
    const title = document.getElementById('results-title');
    const grid = document.getElementById('results-grid');
    const pagination = document.getElementById('pagination');
    
    pagination.style.display = 'none';
    title.innerHTML = `<i data-lucide="loader-2" class="shimmer" style="animation: spin 1s infinite linear;"></i> Hasil pencarian untuk: "${decodeURIComponent(query)}"`;
    grid.innerHTML = '<div class="card-skeleton shimmer"></div>'.repeat(6);
    lucide.createIcons({ attrs: { 'data-lucide': true } });

    try {
        const res = await fetchAPI(`/search/${query}`);
        title.innerText = `Hasil Pencarian untuk: "${decodeURIComponent(query)}"`;
        
        if (res.data && res.data.animeList) {
            renderAnimeGrid(res.data.animeList, 'results-grid');
        } else {
            grid.innerHTML = `<div class="no-data">Anime "${decodeURIComponent(query)}" tidak ditemukan. Coba kata kunci lain.</div>`;
        }
    } catch (err) {
        console.error('Error searching:', err);
        title.innerText = 'Pencarian Gagal';
        grid.innerHTML = `<div class="error-msg">Terjadi kesalahan saat memproses pencarian Anda.</div>`;
    }
}

// Load Genre page with pagination
async function loadGenre(genreId, page = 1) {
    switchView('results');
    
    const title = document.getElementById('results-title');
    const grid = document.getElementById('results-grid');
    const pagination = document.getElementById('pagination');
    
    pagination.style.display = 'none';
    
    // Find genre name from ID
    const genreInfo = GENRES_LIST.find(g => g.id === genreId);
    const genreName = genreInfo ? genreInfo.title : genreId;
    
    title.innerHTML = `<i data-lucide="loader-2" class="shimmer" style="animation: spin 1s infinite linear;"></i> Genre: ${genreName}`;
    grid.innerHTML = '<div class="card-skeleton shimmer"></div>'.repeat(6);
    lucide.createIcons({ attrs: { 'data-lucide': true } });

    try {
        const res = await fetchAPI(`/genre/${genreId}?page=${page}`);
        title.innerText = `Genre: ${genreName}`;
        
        if (res.data && res.data.animeList) {
            renderAnimeGrid(res.data.animeList, 'results-grid');
            
            // Set up pagination
            if (res.data.pagination) {
                const pg = res.data.pagination;
                pagination.style.display = 'flex';
                document.getElementById('page-info').innerText = `Halaman ${pg.currentPage} dari ${pg.totalPages || '?'}`;
                
                const prevPageBtn = document.getElementById('btn-prev-page');
                const nextPageBtn = document.getElementById('btn-next-page');
                
                if (pg.hasPrevPage) {
                    prevPageBtn.onclick = () => window.location.hash = `#/genre/${genreId}/${pg.prevPage}`;
                    prevPageBtn.removeAttribute('disabled');
                } else {
                    prevPageBtn.setAttribute('disabled', 'true');
                }
                
                if (pg.hasNextPage) {
                    nextPageBtn.onclick = () => window.location.hash = `#/genre/${genreId}/${pg.nextPage}`;
                    nextPageBtn.removeAttribute('disabled');
                } else {
                    nextPageBtn.setAttribute('disabled', 'true');
                }
            }
        } else {
            grid.innerHTML = `<div class="no-data">Tidak ada anime yang diklasifikasikan dengan genre ini.</div>`;
        }
    } catch (err) {
        console.error('Error loading genre:', err);
        title.innerText = 'Gagal Memuat Genre';
        grid.innerHTML = `<div class="error-msg">Gagal mengambil data dari API server.</div>`;
    }
}

// Setup search autocomplete suggestions
function setupSearchSuggestions() {
    const input = document.getElementById('search-input');
    const suggestions = document.getElementById('search-suggestions');
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        
        if (query.length < 3) {
            suggestions.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetchAPI(`/search/${encodeURIComponent(query)}`);
                if (res.data && res.data.animeList && res.data.animeList.length > 0) {
                    suggestions.innerHTML = '';
                    // Limit suggestions to 5 items
                    res.data.animeList.slice(0, 5).forEach(anime => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        
                        const animeId = anime.animeId || anime.href.split('/').pop();
                        const scoreText = anime.score && anime.score !== '0' ? `★ ${anime.score}` : 'Sub Indo';

                        item.innerHTML = `
                            <img class="suggestion-poster" src="${anime.poster}" alt="${anime.title}">
                            <div class="suggestion-info">
                                <span class="suggestion-title">${anime.title}</span>
                                <span class="suggestion-meta">${anime.status || 'Completed'} &bull; ${scoreText}</span>
                            </div>
                        `;
                        
                        item.onclick = () => {
                            suggestions.style.display = 'none';
                            input.value = '';
                            window.location.hash = `#/anime/${animeId}`;
                        };
                        
                        suggestions.appendChild(item);
                    });
                    suggestions.style.display = 'block';
                } else {
                    suggestions.style.display = 'none';
                }
            } catch (err) {
                console.warn('Autocomplete failed:', err);
            }
        }, 500);
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

// Navigation & Search handlers
document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    if (query) {
        document.getElementById('search-suggestions').style.display = 'none';
        window.location.hash = `#/search/${encodeURIComponent(query)}`;
    }
});

// Render genres in dropdown and mobile modals
function renderGenresNavigation() {
    const listContainer = document.getElementById('genres-list');
    const modalContainer = document.getElementById('genres-modal-list');
    
    listContainer.innerHTML = '';
    modalContainer.innerHTML = '';
    
    GENRES_LIST.forEach(genre => {
        // Dropdown link
        const ddLink = document.createElement('a');
        ddLink.href = `#/genre/${genre.id}`;
        ddLink.className = 'genre-item';
        ddLink.innerText = genre.title;
        listContainer.appendChild(ddLink);
        
        // Modal button
        const mButton = document.createElement('a');
        mButton.href = `#/genre/${genre.id}`;
        mButton.className = 'genre-item';
        mButton.innerText = genre.title;
        modalContainer.appendChild(mButton);
    });
}

// Setup Mobile Genres Modal
const genresModal = document.getElementById('genres-modal');
const genresModalClose = document.getElementById('genres-modal-close');
const genresTrigger = document.getElementById('mobile-genres-trigger');

genresTrigger.addEventListener('click', () => {
    genresModal.classList.add('active');
});

genresModalClose.addEventListener('click', () => {
    genresModal.classList.remove('active');
});

genresModal.addEventListener('click', (e) => {
    if (e.target === genresModal) genresModal.classList.remove('active');
});

// Router dispatcher
function handleRoute() {
    const hash = window.location.hash || '#/';
    
    // Close autocompletes
    document.getElementById('search-suggestions').style.display = 'none';
    
    // Matching logic
    if (hash === '#/' || hash === '') {
        loadHome();
    } else if (hash === '#/ongoing' || hash.startsWith('#/ongoing/')) {
        const parts = hash.split('/');
        const page = parts[2] ? parseInt(parts[2]) : 1;
        loadCatalog('ongoing', page);
    } else if (hash === '#/completed' || hash.startsWith('#/completed/')) {
        const parts = hash.split('/');
        const page = parts[2] ? parseInt(parts[2]) : 1;
        loadCatalog('completed', page);
    } else if (hash.startsWith('#/anime/')) {
        const parts = hash.split('/');
        const animeId = parts[2];
        loadDetail(animeId);
    } else if (hash.startsWith('#/episode/')) {
        const parts = hash.split('/');
        const episodeId = parts[2];
        loadStream(episodeId);
    } else if (hash.startsWith('#/search/')) {
        const parts = hash.split('/');
        const query = parts[2];
        loadSearch(query);
    } else if (hash.startsWith('#/genre/')) {
        const parts = hash.split('/');
        const genreId = parts[2];
        const page = parts[3] ? parseInt(parts[3]) : 1;
        loadGenre(genreId, page);
    } else {
        // Fallback to home
        loadHome();
    }
}

// App Initialization
window.addEventListener('load', () => {
    renderGenresNavigation();
    setupSearchSuggestions();
    handleRoute();
    lucide.createIcons({ attrs: { 'data-lucide': true } });
});

window.addEventListener('hashchange', () => {
    handleRoute();
});
