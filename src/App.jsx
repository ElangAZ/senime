import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Home, Calendar, CheckSquare, Hash, ChevronDown, ChevronLeft, ChevronRight, Search,
  Trash2, Flame, Sparkles, ArrowRight, Tv, Info, Film, Clock, 
  SortAsc, ThumbsUp, SkipBack, SkipForward, Download, List, Star, 
  User, Video, X, Loader2, Square, AlertCircle, CheckCircle2,
  History, ArrowUpDown, PlaySquare, Heart
} from 'lucide-react';

// Error Boundary to prevent full black screen on render crash
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('React render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0a0a12', color: '#fff', fontFamily: 'Outfit, sans-serif', padding: '2rem'
        }}>
          <h2 style={{ color: '#e040fb', marginBottom: '1rem' }}>Terjadi Kesalahan</h2>
          <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Halaman gagal dimuat. Detail error di console browser.</p>
          <pre style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px', fontSize: '12px', maxWidth: '600px', overflow: 'auto', color: '#ff6b6b' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{
            marginTop: '1.5rem', padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
          }}>Muat Ulang</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

const API_BASE = 'https://www.sankavollerei.com/anime';

// Genres list from index.html
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
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(finalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      
      const text = await response.text();
      const data = JSON.parse(text);
      
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
  
  throw lastError || new Error('Failed to fetch from all endpoints');
}

// Donghua-specific raw API fetch (no standard status wrapper)
async function fetchDonghuaAPI(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const strategies = [];
  if (window.location.protocol.startsWith('http')) {
    strategies.push(`/api${endpoint}`);
  }
  strategies.push(
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  );
  for (const reqUrl of strategies) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 12000); // 12s timeout per strategy
      const resp = await fetch(reqUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!resp.ok) continue;

      // Read as text first to validate it's actually JSON (not an HTML error page)
      const text = await resp.text();
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.warn('fetchDonghuaAPI: not JSON from', reqUrl);
        continue;
      }

      const json = JSON.parse(trimmed);
      // Validate it has at least one expected field from the detail or home API
      if (json && typeof json === 'object' && !Array.isArray(json) &&
          (json.title || json.episodes_list || json.latest_release || json.status || json.data || json.creator)) {
        return json;
      }
    } catch (e) {
      console.warn('fetchDonghuaAPI failed:', reqUrl, e.message);
    }
  }
  throw new Error('Failed to fetch donghua data');
}

// Extract the series detail slug from a donghua item (handles both detail and episode hrefs)
function getSeriesSlug(item) {
  const href = item.href || '';
  let rawSlug = item.slug || '';
  
  if (!rawSlug && href) {
    const parts = href.split('/').filter(Boolean);
    rawSlug = parts[parts.length - 1] || '';
  }

  // Trim leading/trailing slashes and spaces from rawSlug and href
  const cleanHref = href.replace(/^\/+|\/+$/g, '').trim();
  let cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '').trim();

  // If href explicitly points to a detail page, extract the slug from it
  if (cleanHref.includes('donghua/detail/')) {
    const slugFromDetail = cleanHref.split('donghua/detail/').pop().split('?')[0];
    if (slugFromDetail) {
      cleanSlug = slugFromDetail.replace(/^\/+|\/+$/g, '').trim();
    }
  }

  // For episode hrefs, prefer the slug from the URL
  if (cleanHref.includes('donghua/episode/')) {
    const slugFromEpisode = cleanHref.split('donghua/episode/').pop().split('?')[0];
    if (slugFromEpisode) {
      cleanSlug = slugFromEpisode.replace(/^\/+|\/+$/g, '').trim();
    }
  }

  // ALWAYS strip episode suffix
  // Handles cases like "little-fairy-yao-episode-03-subtitle-indonesia" or "little-fairy-yao-episode-143"
  const stripped = cleanSlug
    .replace(/-episode-[a-zA-Z0-9_-]*/, '')
    .replace(/-ep-?[0-9][a-zA-Z0-9_-]*/, '')
    .replace(/-subtitle-[a-zA-Z0-9_-]*/, '');

  return (stripped || cleanSlug || rawSlug).replace(/^\/+|\/+$/g, '').trim();
}

// Helper to extract just the episode number from an episode title
function extractEpisodeNumber(title) {
  if (!title) return '';
  const epRegex = /(?:Episode|Ep\.?|Eps\.?)\s*(\d+(\.\d+)?)/i;
  const match = title.match(epRegex);
  if (match) return match[1];
  
  const numbers = title.match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length > 0) {
    return numbers[numbers.length - 1];
  }
  return title;
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileGenresOpen, setMobileGenresOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [toast, setToast] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    return JSON.parse(localStorage.getItem('nekowatch_favorites')) || [];
  });
  
  // Ref for autocomplete suggestions close on click outside
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('nekowatch_history')) || [];
    setHistoryItems(stored);

    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
      setShowSuggestions(false);
      setSearchQuery('');
      setMobileGenresOpen(false);
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Autocomplete click outside handler
    const handleClickOutside = (e) => {
      if (
        searchInputRef.current && 
        !searchInputRef.current.contains(e.target) && 
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleFavorite = (item, isDonghua = false) => {
    const itemId = item.animeId || item.slug || item.href?.split('/').pop() || '';
    if (!itemId) return;

    setFavorites(prev => {
      const exists = prev.some(x => x.id === itemId);
      let updated;
      if (exists) {
        updated = prev.filter(x => x.id !== itemId);
        triggerToast(`Dihapus dari Favorit.`, 'success');
      } else {
        updated = [...prev, {
          id: itemId,
          title: item.title,
          poster: item.poster,
          status: item.status || 'Completed',
          type: item.type || (isDonghua ? 'Donghua' : 'TV'),
          isDonghua: isDonghua
        }];
        triggerToast(`Ditambahkan ke Favorit!`, 'success');
      }
      localStorage.setItem('nekowatch_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const isFavorite = (itemId) => {
    return favorites.some(x => x.id === itemId);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      window.location.hash = `#/search/${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  // Search Autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(searchQuery.trim());
        const [animeRes, donghuaRes] = await Promise.allSettled([
          fetchAPI(`/search/${q}`),
          fetchDonghuaAPI(`/donghua/search/${q}`)
        ]);

        let merged = [];

        if (animeRes.status === 'fulfilled' && animeRes.value?.data?.animeList) {
          merged = [...animeRes.value.data.animeList.slice(0, 4)];
        }

        if (donghuaRes.status === 'fulfilled' && donghuaRes.value) {
          const dhVal = donghuaRes.value;
          const dhList = dhVal.data || dhVal || [];
          if (Array.isArray(dhList)) {
            const normalized = dhList.slice(0, 4).map(item => ({
              ...item,
              animeId: item.slug || '',
              isDonghua: true
            }));
            merged = [...normalized, ...merged];
          }
        }

        setSuggestions(merged.slice(0, 6));
      } catch (err) {
        console.warn('Autocomplete error:', err.message);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveToHistory = (animeId, animeTitle, poster, episodeId, episodeTitle) => {
    const stored = JSON.parse(localStorage.getItem('nekowatch_history')) || [];
    const filtered = stored.filter(item => item.animeId !== animeId);
    filtered.unshift({
      animeId,
      animeTitle,
      poster,
      episodeId,
      episodeTitle,
      timestamp: Date.now()
    });
    if (filtered.length > 12) filtered.pop();
    
    localStorage.setItem('nekowatch_history', JSON.stringify(filtered));
    setHistoryItems(filtered);
  };

  const clearHistory = () => {
    localStorage.removeItem('nekowatch_history');
    setHistoryItems([]);
    triggerToast('Riwayat menonton telah dihapus.');
  };

  // Parse Routes
  const renderContent = () => {
    if (route.startsWith('#/favorites')) {
      return <FavoritesView favorites={favorites} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route === '#/' || route === '') {
      return <HomeView historyItems={historyItems} clearHistory={clearHistory} triggerToast={triggerToast} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/ongoing')) {
      const parts = route.split('/');
      const page = parts[2] ? parseInt(parts[2]) : 1;
      return <CatalogView type="ongoing" page={page} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/completed')) {
      const parts = route.split('/');
      const page = parts[2] ? parseInt(parts[2]) : 1;
      return <CatalogView type="completed" page={page} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/donghua-episode/')) {
      const parts = route.split('/');
      const episodeSlug = parts[2];
      return <DonghuaStreamView episodeSlug={episodeSlug} triggerToast={triggerToast} saveToHistory={saveToHistory} />;
    } else if (route.startsWith('#/donghua-detail/')) {
      const parts = route.split('/');
      const slug = parts[2];
      return (
        <section className="app-view active" style={{ display: 'flex', justifyContent: 'center', minHeight: '80vh', alignItems: 'center' }}>
          <DonghuaDetailModal item={{ slug: slug }} onClose={() => window.history.back()} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
        </section>
      );
    } else if (route.startsWith('#/donghua')) {
      const parts = route.split('/');
      const page = parts[2] ? parseInt(parts[2]) : 1;
      return <DonghuaView page={page} triggerToast={triggerToast} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/anime/')) {
      const parts = route.split('/');
      const animeId = parts[2];
      return <DetailView animeId={animeId} triggerToast={triggerToast} saveToHistory={saveToHistory} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/episode/')) {
      const parts = route.split('/');
      const episodeId = parts[2];
      return <StreamView episodeId={episodeId} triggerToast={triggerToast} saveToHistory={saveToHistory} />;
    } else if (route.startsWith('#/search/')) {
      const parts = route.split('/');
      const query = parts[2];
      return <ResultsView mode="search" query={query} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else if (route.startsWith('#/genre/')) {
      const parts = route.split('/');
      const genreId = parts[2];
      const page = parts[3] ? parseInt(parts[3]) : 1;
      return <ResultsView mode="genre" genreId={genreId} page={page} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    } else {
      return <HomeView historyItems={historyItems} clearHistory={clearHistory} triggerToast={triggerToast} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />;
    }
  };

  return (
    <>
      {/* Header */}
      <header className="main-header">
        <div className="header-container">
          <a href="#/" className="logo">
            <Play className="logo-icon" fill="currentColor" />
            <span className="logo-text">Se<span>nime</span></span>
          </a>
          
          <nav className="desktop-nav">
            <a href="#/" className={`nav-link ${(route === '#/' || route === '') ? 'active' : ''}`}>
              <Home size={16} /> Home
            </a>
            <a href="#/favorites" className={`nav-link ${route.startsWith('#/favorites') ? 'active' : ''}`}>
              <Heart size={16} /> Favorite
            </a>

            <div className="genre-dropdown">
              <button className="nav-link dropdown-trigger">
                <Hash size={16} /> Genre <ChevronDown size={14} className="chevron" />
              </button>
              <div className="dropdown-content" id="genres-list">
                {GENRES_LIST.map(g => (
                  <a key={g.id} href={`#/genre/${g.id}`} className="genre-item">{g.title}</a>
                ))}
              </div>
            </div>
            <a href="#/donghua" className={`nav-link ${route.startsWith('#/donghua') ? 'active' : ''}`}>
              <Film size={16} /> Donghua
            </a>
          </nav>

          <div className="search-box">
            <form id="search-form" onSubmit={handleSearchSubmit}>
              <input 
                id="search-input"
                ref={searchInputRef}
                type="text" 
                placeholder={route.startsWith('#/donghua') ? "Cari donghua..." : "Cari anime..."}
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              <button type="submit"><Search size={18} /></button>
            </form>
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="search-suggestions" ref={suggestionsRef} style={{ display: 'block' }}>
                {suggestions.map(anime => {
                  const animeId = anime.animeId || anime.href.split('/').pop();
                  return (
                    <div 
                      key={animeId} 
                      className="suggestion-item" 
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearchQuery('');
                        const isDh = anime.type === 'Donghua' || anime.isDonghua || anime.href?.includes('/donghua/');
                        window.location.hash = isDh ? `#/donghua-detail/${animeId}` : `#/anime/${animeId}`;
                      }}
                    >
                      <img className="suggestion-poster" src={anime.poster} alt={anime.title} />
                      <div className="suggestion-info">
                        <span className="suggestion-title">{anime.title}</span>
                        <span className="suggestion-meta">{anime.status || 'Completed'} &bull; ★ {anime.score && anime.score !== '0' ? anime.score : 'Sub Indo'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" style={{ justifyContent: 'space-around' }}>
        <a href="#/" className={`mobile-nav-item ${(route === '#/' || route === '') ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </a>
        <a href="#/favorites" className={`mobile-nav-item ${route.startsWith('#/favorites') ? 'active' : ''}`}>
          <Heart size={20} />
          <span>Favorite</span>
        </a>
        <a href="#/donghua" className={`mobile-nav-item ${route.startsWith('#/donghua') ? 'active' : ''}`}>
          <Film size={20} />
          <span>Donghua</span>
        </a>
        <button className="mobile-nav-item" onClick={() => setMobileGenresOpen(true)}>
          <Hash size={20} />
          <span>Genre</span>
        </button>
      </nav>

      {/* Mobile Genres Modal */}
      {mobileGenresOpen && (
        <div className="modal active" onClick={() => setMobileGenresOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Hash size={20} /> Pilih Genre</h2>
              <button className="modal-close" onClick={() => setMobileGenresOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {GENRES_LIST.map(genre => (
                <a key={genre.id} href={`#/genre/${genre.id}`} className="genre-item" onClick={() => setMobileGenresOpen(false)}>
                  {genre.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast show ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="main-footer">
        <p>&copy; 2026 NekoWatch. Dibuat oleh Senux. API didukung oleh Sankavollerei.</p>
      </footer>
    </>
  );
}

// ------------------------- VIEWS & COMPONENTS -------------------------

// Anime Card Grid Component
function AnimeGrid({ list, limit, toggleFavorite, isFavorite }) {
  if (!list || list.length === 0) {
    return <div className="no-data">Tidak ada anime yang ditemukan.</div>;
  }
  const items = limit ? list.slice(0, limit) : list;
  return (
    <div className="anime-grid">
      {items.map(anime => {
        const animeId = anime.animeId || anime.href?.split('/').pop() || '';
        const isDh = anime.type === 'Donghua' || anime.isDonghua || anime.href?.includes('/donghua/');
        const targetHref = isDh ? `#/donghua-detail/${animeId}` : `#/anime/${animeId}`;
        const epsBadge = anime.episodes ? <div className="card-badge">{anime.episodes} Eps</div> : null;
        const scoreBadge = anime.score && anime.score !== '0' && anime.score !== '0.00' ? (
          <div className="card-score"><Star size={10} fill="var(--star)" color="var(--star)" /> {anime.score}</div>
        ) : null;
        const releaseTag = anime.releaseDay ? <div className="card-release-tag">{anime.releaseDay}</div> : null;
        const favorited = isFavorite && isFavorite(animeId);

        return (
          <div key={animeId} className="anime-card">
            <div className="card-poster-wrapper">
              <a href={targetHref}>
                <img className="card-poster" src={anime.poster} alt={anime.title} loading="lazy" />
              </a>
              {epsBadge}
              {scoreBadge}
              {releaseTag}
              {toggleFavorite && isFavorite && (
                <button
                  className={`quick-favorite-btn ${favorited ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(anime, isDh);
                  }}
                  title={favorited ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                >
                  <Heart size={14} fill={favorited ? "var(--pink)" : "none"} color={favorited ? "var(--pink)" : "currentColor"} />
                </button>
              )}
            </div>
            <a href={targetHref}>
              <div className="card-body">
                <h3 className="card-title">{anime.title}</h3>
                <div className="card-meta">
                  <span className="card-episodes"><Play size={10} fill="currentColor" /> Nonton</span>
                  <span>{anime.latestReleaseDate || anime.lastReleaseDate || 'Sub Indo'}</span>
                </div>
              </div>
            </a>
          </div>
        );
      })}
    </div>
  );
}

// Reusable Pagination Component
function PaginationBar({ pagination, currentPage, buildHref }) {
  if (!pagination) return null;
  const totalPages = pagination.lastPage || pagination.totalPages || currentPage;
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <a
        href={currentPage > 1 ? buildHref(currentPage - 1) : undefined}
        className={`page-btn page-prev ${currentPage <= 1 ? 'disabled' : ''}`}
      >
        <ChevronLeft size={16} /> Sebelumnya
      </a>
      <div className="page-numbers">
        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} className="page-dots">…</span>
          ) : (
            <a
              key={p}
              href={buildHref(p)}
              className={`page-num ${p === currentPage ? 'active' : ''}`}
            >
              {p}
            </a>
          )
        )}
      </div>
      <a
        href={pagination.hasNextPage ? buildHref(currentPage + 1) : undefined}
        className={`page-btn page-next ${!pagination.hasNextPage ? 'disabled' : ''}`}
      >
        Berikutnya <ChevronRight size={16} />
      </a>
    </div>
  );
}

// Skeletons
function CatalogSkeleton() {
  return (
    <div className="anime-grid">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="card-skeleton shimmer" style={{ height: '300px' }}></div>
      ))}
    </div>
  );
}

// Home View
function HomeView({ historyItems, clearHistory, triggerToast, toggleFavorite, isFavorite }) {
  const [spotlight, setSpotlight] = useState(null);
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const res = await fetchAPI('/home');
        if (res.data && active) {
          const ongoingList = res.data.ongoing.animeList || [];
          setOngoing(ongoingList);
          setCompleted(res.data.completed.animeList || []);
          setLoading(false);

          // Get detailed spotlight synopsis
          if (ongoingList.length > 0) {
            const idx = Math.floor(Math.random() * Math.min(ongoingList.length, 6));
            const randomShow = ongoingList[idx];
            const randomId = randomShow.animeId || randomShow.href.split('/').pop();
            try {
              const detailRes = await fetchAPI(`/anime/${randomId}`);
              if (detailRes.data && active) {
                setSpotlight({
                  ...detailRes.data,
                  releaseDay: randomShow.releaseDay
                });
              }
            } catch (err) {
              if (active) setSpotlight(randomShow); // fallback
            }
          }
        }
      } catch (err) {
        console.error('Home load error:', err);
        if (active) {
          triggerToast('Gagal memuat katalog anime terbaru.', 'error');
          setLoading(false);
        }
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  return (
    <section className="app-view active">
      {/* Hero Spotlight Banner */}
      <div className="hero-container" id="hero-banner">
        {loading ? (
          <div className="hero-skeleton shimmer"></div>
        ) : spotlight ? (
          <>
            <div className="hero-bg" style={{ backgroundImage: `url('${spotlight.poster}')` }}></div>
            <div className="hero-overlay"></div>
            <div className="hero-content">
              <div className="hero-poster-wrapper">
                <img className="hero-poster" src={spotlight.poster} alt={spotlight.title} />
              </div>
              <div className="hero-info">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="hero-badge" style={{ background: 'var(--pink)' }}>SPOTLIGHT</span>
                  {spotlight.genreList && spotlight.genreList.slice(0, 3).map(g => (
                    <span key={g.genreId} className="hero-badge">{g.title}</span>
                  ))}
                </div>
                <h1 className="hero-title">{spotlight.title}</h1>
                <div className="hero-meta">
                  <span className="hero-meta-item score">
                    <Star size={12} fill="var(--star)" color="var(--star)" /> {spotlight.score || '0.0'}
                  </span>
                  <span className="hero-meta-item"><Tv size={12} /> {spotlight.type || 'TV'}</span>
                  {spotlight.releaseDay && (
                    <span className="hero-meta-item"><Calendar size={12} /> Hari Rilis: {spotlight.releaseDay}</span>
                  )}
                </div>
                <p className="hero-synopsis">
                  {spotlight.synopsis && spotlight.synopsis.paragraphs && spotlight.synopsis.paragraphs.length > 0
                    ? spotlight.synopsis.paragraphs[0]
                    : 'Streaming nonton anime sub indo ter-update setiap hari hanya di NekoWatch.'}
                </p>
                <div className="hero-actions">
                  <a href={`#/anime/${spotlight.animeId || (spotlight.href ? spotlight.href.split('/').pop() : '')}`} className="btn-hero-play">
                    <Play size={16} fill="currentColor" /> Detail &amp; Episode
                  </a>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* History watch items */}
      {historyItems.length > 0 && (
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title"><History className="title-icon" size={20} /> Lanjutkan Menonton</h2>
            <button className="btn-clear-history" onClick={clearHistory}><Trash2 size={14} /> Hapus Semua</button>
          </div>
          <div className="anime-grid">
            {historyItems.map(item => {
              const epNum = extractEpisodeNumber(item.episodeTitle);
              const epText = isNaN(epNum) ? epNum : `Episode ${epNum}`;
              return (
                <div key={item.animeId} className="anime-card">
                  <a href={`#/episode/${item.episodeId}`}>
                    <div className="card-poster-wrapper">
                       <img className="card-poster" src={item.poster} alt={item.animeTitle} />
                       <div className="card-badge bg-cyan">Lanjut</div>
                       <div className="card-release-tag">{epText}</div>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{item.animeTitle}</h3>
                      <div className="card-meta">
                        <span className="card-episodes"><Play size={10} fill="var(--cyan)" color="var(--cyan)" /> Putar</span>
                        <span style={{ fontSize: '10px' }}>{new Date(item.timestamp).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ongoing List */}
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title"><Flame className="title-icon text-accent" size={20} /> Anime Ongoing Terbaru</h2>
          <a href="#/ongoing" className="btn-view-all">Lihat Semua <ArrowRight size={14} /></a>
        </div>
        {loading ? <CatalogSkeleton /> : <AnimeGrid list={ongoing} limit={18} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />}
      </div>

      {/* Completed List */}
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title"><Sparkles className="title-icon text-pink" size={20} /> Anime Lengkap (Completed)</h2>
          <a href="#/completed" className="btn-view-all">Lihat Semua <ArrowRight size={14} /></a>
        </div>
        {loading ? <CatalogSkeleton /> : <AnimeGrid list={completed} limit={18} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />}
      </div>
    </section>
  );
}

// Catalog View with Pagination
function CatalogView({ type, page, toggleFavorite, isFavorite }) {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setList([]);
    setPagination(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const loadCatalog = async () => {
      const endpoint = type === 'ongoing' ? '/ongoing-anime' : '/complete-anime';
      try {
        const res = await fetchAPI(`${endpoint}?page=${page}`);
        if (res.data && active) {
          setList(res.data.animeList || []);
          setPagination(res.pagination || res.data.pagination || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Catalog load error:', err);
        if (active) setLoading(false);
      }
    };
    
    loadCatalog();
    return () => { active = false; };
  }, [type, page]);

  const buildHref = (p) => `#/${type}/${p}`;

  return (
    <section className="app-view active">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">
            {type === 'ongoing' ? (
              <><Flame className="title-icon text-accent" size={20} /> Semua Anime Ongoing</>
            ) : (
              <><Sparkles className="title-icon text-pink" size={20} /> Semua Anime Completed</>
            )}
          </h2>
          {pagination && (
            <span className="page-info-badge">Halaman {page}</span>
          )}
        </div>
        
        {loading ? (
          <CatalogSkeleton />
        ) : (
          <>
            <AnimeGrid list={list} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
            <PaginationBar pagination={pagination} currentPage={page} buildHref={buildHref} />
          </>
        )}
      </div>
    </section>
  );
}

// Detail View
function DetailView({ animeId, triggerToast, saveToHistory, toggleFavorite, isFavorite }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const loadDetails = async () => {
      try {
        const res = await fetchAPI(`/anime/${animeId}`);
        if (res.data && active) {
          setDetail(res.data);
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error('Detail load error:', err);
        if (active) {
          triggerToast('Gagal memuat detail anime.', 'error');
          setLoading(false);
        }
      }
    };
    loadDetails();
    return () => { active = false; };
  }, [animeId]);

  if (loading) {
    return (
      <section className="app-view active" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Loader2 className="spinner shimmer" size={40} style={{ animation: 'spin 1s infinite linear' }} />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="app-view active">
        <div className="no-data">Gagal memuat detail anime. Silakan kembali ke Home.</div>
      </section>
    );
  }

  const episodes = sortAsc ? [...(detail.episodeList || [])].reverse() : (detail.episodeList || []);

  return (
    <section className="app-view active">
      <div className="detail-backdrop" style={{ backgroundImage: `url('${detail.poster}')` }}></div>
      <div className="detail-container">
        
        {/* Detail Main Info */}
        <div className="detail-main">
          <div className="detail-poster-container">
            <img id="detail-poster" src={detail.poster} alt={detail.title} />
            <div className="detail-score">
              <Star size={12} fill="var(--star)" color="var(--star)" /> <span>{detail.score || '-'}</span>
            </div>
          </div>
          <div className="detail-info-content">
            <h1 className="detail-title">{detail.title}</h1>
            {detail.japanese && <h2 className="detail-japanese">{detail.japanese}</h2>}
            
            <div className="detail-meta-tags">
              <span className="meta-tag"><Tv size={14} /> <span>{detail.type || '-'}</span></span>
              <span className="meta-tag"><Info size={14} /> <span>{detail.status || '-'}</span></span>
              <span className="meta-tag"><Film size={14} /> <span>{detail.episodes || '?'} Eps</span></span>
              <span className="meta-tag"><Clock size={14} /> <span>{detail.duration || '-'}</span></span>
              {toggleFavorite && isFavorite && (
                <button 
                  onClick={() => toggleFavorite(detail, false)} 
                  className={`meta-tag btn-favorite-toggle ${isFavorite(animeId) ? 'active' : ''}`}
                  style={{ 
                    cursor: 'pointer', 
                    border: 'none', 
                    background: isFavorite(animeId) ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.06)',
                    color: isFavorite(animeId) ? 'var(--pink)' : 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <Heart size={14} fill={isFavorite(animeId) ? 'var(--pink)' : 'none'} color={isFavorite(animeId) ? 'var(--pink)' : 'currentColor'} /> 
                  <span>{isFavorite(animeId) ? 'Favorit Saya' : 'Tambah Favorit'}</span>
                </button>
              )}
            </div>

            <div className="detail-genres">
              {detail.genreList && detail.genreList.map(g => (
                <a key={g.genreId} href={`#/genre/${g.genreId}`} className="tag-genre">{g.title}</a>
              ))}
            </div>

            <div className="detail-synopsis">
              <h3>Sinopsis</h3>
              <div className="synopsis-text">
                {detail.synopsis && detail.synopsis.paragraphs && detail.synopsis.paragraphs.length > 0 ? (
                  detail.synopsis.paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
                ) : (
                  <p>Sinopsis tidak tersedia untuk anime ini.</p>
                )}
              </div>
            </div>

            <div className="detail-grid-info">
              <div className="info-item"><strong>Studio:</strong> <span>{detail.studios || '-'}</span></div>
              <div className="info-item"><strong>Produser:</strong> <span>{detail.producers || '-'}</span></div>
              <div className="info-item"><strong>Rilis:</strong> <span>{detail.aired || '-'}</span></div>
            </div>
          </div>
        </div>

        {/* Episode selector list */}
        <div className="detail-episodes-section">
          <div className="section-header">
            <h2 className="section-title"><PlaySquare size={20} className="title-icon" /> Daftar Episode</h2>
            <button className="btn-sort" onClick={() => setSortAsc(!sortAsc)}>
              <ArrowUpDown size={14} /> {sortAsc ? 'Terlama' : 'Terbaru'}
            </button>
          </div>
          
          {episodes.length === 0 ? (
            <div className="no-data">Belum ada episode yang tersedia.</div>
          ) : (
            <div className="episodes-grid numeric-grid">
              {episodes.map(ep => {
                const epNum = extractEpisodeNumber(ep.title);
                return (
                  <a 
                    key={ep.episodeId} 
                    href={`#/episode/${ep.episodeId}`} 
                    className="episode-card numeric-card"
                    title={`${ep.title} (${ep.date || 'Rilis'})`}
                    onClick={() => saveToHistory(animeId, detail.title, detail.poster, ep.episodeId, ep.title)}
                  >
                    <span>{epNum}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {detail.recommendedAnimeList && detail.recommendedAnimeList.length > 0 && (
          <div className="detail-recommendations-section">
            <div className="section-header">
              <h2 className="section-title"><ThumbsUp size={20} className="title-icon" /> Rekomendasi Anime</h2>
            </div>
            <AnimeGrid list={detail.recommendedAnimeList} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
          </div>
        )}
      </div>
    </section>
  );
}

// Stream View
function StreamView({ episodeId, triggerToast, saveToHistory }) {
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerUrl, setPlayerUrl] = useState('');
  const [activeQuality, setActiveQuality] = useState('');
  const [serverList, setServerList] = useState([]);
  const [activeServer, setActiveServer] = useState('');
  const [animeDetails, setAnimeDetails] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const activeEpisodeRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStream(null);
    setAnimeDetails(null);
    setPlayerUrl('');
    setDownloadOpen(false);
    
    const loadStreamData = async () => {
      try {
        const res = await fetchAPI(`/episode/${episodeId}`);
        if (!active) return;
        
        const data = res.data;
        setStream(data);
        setLoading(false);
        if (data.defaultStreamingUrl) {
          setPlayerUrl(data.defaultStreamingUrl);
        }

        // Handle quality list
        if (data.server && data.server.qualities) {
          const activeQualities = data.server.qualities.filter(q => q.serverList && q.serverList.length > 0);
          if (activeQualities.length > 0) {
            setActiveQuality(activeQualities[0].title);
            setServerList(activeQualities[0].serverList);
            if (activeQualities[0].serverList.length > 0) {
              setActiveServer(activeQualities[0].serverList[0].serverId);
            }
          }
        }

        // Fetch mini details for sidebar & watch history saving
        if (data.animeId) {
          try {
            const detailRes = await fetchAPI(`/anime/${data.animeId}`);
            if (detailRes.data && active) {
              setAnimeDetails(detailRes.data);
              saveToHistory(data.animeId, detailRes.data.title, detailRes.data.poster, episodeId, data.title);
            }
          } catch (e) {
            console.warn('Mini info fetch failed:', e.message);
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Scroll to active episode in sidebar
        setTimeout(() => {
          if (activeEpisodeRef.current) {
            activeEpisodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 500);

      } catch (err) {
        console.error('Stream load error:', err);
        if (active) {
          triggerToast('Gagal memuat link streaming.', 'error');
          setLoading(false);
        }
      }
    };
    loadStreamData();
    return () => { active = false; };
  }, [episodeId]);

  const switchQuality = (q) => {
    setActiveQuality(q.title);
    setServerList(q.serverList || []);
    if (q.serverList && q.serverList.length > 0) {
      switchServer(q.serverList[0]);
    }
  };

  const switchServer = async (server) => {
    setActiveServer(server.serverId);
    setPlayerUrl('about:blank');
    triggerToast(`Menghubungkan ke server ${server.title}...`);
    try {
      const res = await fetchAPI(`/server/${server.serverId}`);
      if (res.data && res.data.url) {
        setPlayerUrl(res.data.url);
      } else {
        throw new Error('No URL returned from server API');
      }
    } catch (e) {
      console.error('Server change error:', e);
      triggerToast('Gagal memuat stream dari server ini. Silakan coba server lain.', 'error');
    }
  };

  if (loading) {
    return (
      <section className="app-view active" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Loader2 className="spinner shimmer" size={40} style={{ animation: 'spin 1s infinite linear' }} />
      </section>
    );
  }

  if (!stream) {
    return (
      <section className="app-view active">
        <div className="no-data">Gagal memuat player video.</div>
      </section>
    );
  }

  return (
    <section className="app-view active">
      <div className="stream-container">
        
        {/* Stream main left area */}
        <div className="stream-main">
          <div className="video-section">
            <div className="video-player-wrapper">
              <iframe 
                id="video-player" 
                src={playerUrl} 
                frameBorder="0" 
                allowFullScreen
                title={stream.title}
              ></iframe>
            </div>
            
            <div className="video-controls">
              <a 
                href={stream.hasPrevEpisode ? `#/episode/${stream.prevEpisode.episodeId}` : undefined} 
                className={`btn-control ${!stream.hasPrevEpisode ? 'disabled' : ''}`}
              >
                <SkipBack size={14} /> Episode Seb
              </a>
              
              <div className="server-selector-container">
                <span>Server:</span>
                <div className="server-badges">
                  {serverList.map(srv => (
                    <button 
                      key={srv.serverId} 
                      className={`server-badge ${activeServer === srv.serverId ? 'active' : ''}`}
                      onClick={() => switchServer(srv)}
                    >
                      {srv.title}
                    </button>
                  ))}
                  {serverList.length === 0 && <span style={{ fontSize: '12px', color: '#aaa' }}>Def server</span>}
                </div>
              </div>
              
              <a 
                href={stream.hasNextEpisode ? `#/episode/${stream.nextEpisode.episodeId}` : undefined} 
                className={`btn-control ${!stream.hasNextEpisode ? 'disabled' : ''}`}
              >
                Episode Sel <SkipForward size={14} />
              </a>
            </div>
          </div>

          <div className="stream-info">
            <h1 className="stream-title">{stream.title}</h1>
            <div className="stream-meta">
              <span className="stream-meta-item"><Clock size={12} /> Duration: {stream.info?.duration || '-'}</span>
              <span className="stream-meta-item"><User size={12} /> Credit: {stream.info?.credit || '-'}</span>
              <span className="stream-meta-item"><Video size={12} /> Quality: {activeQuality || '-'}</span>
            </div>
            
            <div className="stream-genres">
              {stream.info?.genreList && stream.info.genreList.map(g => (
                <a 
                  key={g.genreId} 
                  href={`#/genre/${g.genreId}`} 
                  className="tag-genre"
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  {g.title}
                </a>
              ))}
            </div>
          </div>

          {/* Download block as collapsible dropdown */}
          <div className={`download-dropdown-section ${downloadOpen ? 'open' : ''}`}>
            <button className="download-dropdown-toggle" onClick={() => setDownloadOpen(!downloadOpen)}>
              <div className="download-toggle-left">
                <Download size={18} />
                <span>Link Download</span>
              </div>
              <ChevronDown size={18} className={`download-chevron ${downloadOpen ? 'rotated' : ''}`} />
            </button>
            {downloadOpen && (
              <div className="download-dropdown-body">
                {stream.downloadUrl && stream.downloadUrl.qualities ? (
                  stream.downloadUrl.qualities.map((q, idx) => (
                    <div key={idx} className="download-dropdown-row">
                      <div className="dl-row-header">
                        <span className="dl-quality">{q.title}</span>
                        <span className="dl-size">{q.size || ''}</span>
                      </div>
                      <div className="dl-links">
                        {q.urls.map((link, lIdx) => (
                          <a 
                            key={lIdx} 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-dl"
                          >
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data" style={{ padding: '16px' }}>Link unduhan tidak tersedia untuk episode ini.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — right column: anime info + quality + episode list */}
        <div className="stream-sidebar">
          {/* Anime mini info card */}
          {animeDetails && (
            <div className="sidebar-block anime-mini-info">
              <img className="anime-mini-poster" src={animeDetails.poster} alt={animeDetails.title} />
              <div className="anime-mini-details">
                <h4 className="anime-mini-title">{animeDetails.title}</h4>
                <div className="anime-mini-meta">
                  <div>Score: <span style={{ color: 'var(--star)' }}>★ {animeDetails.score || '-'}</span></div>
                  <div>Status: {animeDetails.status || '-'}</div>
                </div>
                <a href={`#/anime/${stream.animeId}`} className="anime-mini-btn">Detail Utama</a>
              </div>
            </div>
          )}

          {/* Quality selector in sidebar */}
          {stream.server?.qualities && (
            <div className="sidebar-block">
              <div className="sidebar-block-header">
                <h3><Video size={16} /> Kualitas</h3>
              </div>
              <div className="quality-badges" style={{ flexWrap: 'wrap' }}>
                {stream.server.qualities.filter(q => q.serverList && q.serverList.length > 0).map(q => (
                  <button
                    key={q.title}
                    className={`quality-btn ${activeQuality === q.title ? 'active' : ''}`}
                    onClick={() => switchQuality(q)}
                  >
                    {q.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Episode list in sidebar */}
          <div className="sidebar-block sidebar-episode-block">
            <div className="sidebar-block-header">
              <h3><List size={16} /> Semua Episode</h3>
            </div>
            <div className="sidebar-episode-scroll">
              {stream.info?.episodeList && stream.info.episodeList.map(ep => {
                const epNum = extractEpisodeNumber(ep.title);
                const isActive = ep.episodeId === episodeId;
                return (
                  <a
                    key={ep.episodeId}
                    ref={isActive ? activeEpisodeRef : null}
                    href={`#/episode/${ep.episodeId}`}
                    className={`stream-ep-item ${isActive ? 'active' : ''}`}
                    title={ep.title}
                  >
                    {isNaN(epNum) ? epNum : `Episode ${epNum}`}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

// Helper: normalize donghua item to common anime card format
function normalizeDonghua(item) {
  // Determine the link destination
  const slug = item.slug || '';
  const href = item.href || '';
  // href looks like "/donghua/episode/..." or "/donghua/detail/..."
  const isEpisode = href.includes('/donghua/episode/');
  const isDetail  = href.includes('/donghua/detail/');
  let linkHash = '#/donghua-episode/' + slug;
  if (isDetail) linkHash = '#/donghua-detail/' + slug;

  return {
    ...item,
    animeId: slug,
    title: item.title,
    poster: item.poster,
    latestReleaseDate: item.current_episode || item.status || '',
    _donghuaLink: linkHash,
  };
}

// Donghua Card Grid – opens a detail modal on click instead of navigating
function DonghuaGrid({ list, onCardClick, toggleFavorite, isFavorite }) {
  if (!list || list.length === 0) {
    return <div className="no-data">Tidak ada Donghua yang ditemukan.</div>;
  }
  return (
    <div className="anime-grid">
      {list.map((item, idx) => {
        const norm = normalizeDonghua(item);
        const favorited = isFavorite && isFavorite(norm.animeId);
        return (
          <div
            key={norm.animeId + idx}
            className="anime-card"
            style={{ cursor: 'pointer' }}
            onClick={() => onCardClick && onCardClick(item)}
          >
            <div>
              <div className="card-poster-wrapper">
                <img className="card-poster" src={norm.poster} alt={norm.title} loading="lazy" />
                {norm.current_episode && (
                  <div className="card-release-tag">{norm.current_episode}</div>
                )}
                {norm.status && (
                  <div className="card-badge" style={{ background: norm.status === 'Ongoing' ? 'var(--accent)' : 'var(--pink)' }}>
                    {norm.status}
                  </div>
                )}
                {toggleFavorite && isFavorite && (
                  <button
                    className={`quick-favorite-btn ${favorited ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite({ ...item, slug: norm.animeId }, true);
                    }}
                    title={favorited ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                  >
                    <Heart size={14} fill={favorited ? "var(--pink)" : "none"} color={favorited ? "var(--pink)" : "currentColor"} />
                  </button>
                )}
                <div className="dh-card-play-overlay">
                  <Play size={28} fill="white" color="white" />
                </div>
              </div>
              <div className="card-body">
                <h3 className="card-title">{norm.title}</h3>
                <div className="card-meta">
                  <span className="card-episodes"><Play size={10} fill="currentColor" /> Detail & Episode</span>
                  <span>{norm.type || 'Donghua'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Donghua View – renders the grid and manages the detail modal
function DonghuaView({ page, triggerToast, toggleFavorite, isFavorite }) {
  const [tab, setTab] = useState('latest');
  const [latestList, setLatestList] = useState([]);
  const [completedList, setCompletedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLatestList([]);
    setCompletedList([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const loadDonghua = async () => {
      const strategies = [];
      const rawUrl = `https://www.sankavollerei.com/anime/donghua/home/${page}`;

      if (window.location.protocol.startsWith('http')) {
        strategies.push(`/api/donghua/home/${page}`);
      }
      strategies.push(
        `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
      );

      let parsed = null;
      for (const url of strategies) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          const resp = await fetch(url, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!resp.ok) continue;
          const json = await resp.json();
          if (json && (json.status === 'success' || json.latest_release)) {
            parsed = json;
            break;
          }
        } catch (e) {
          console.warn('Donghua fetch strategy failed:', url, e.message);
        }
      }

      if (!active) return;

      if (parsed) {
        setLatestList(parsed.latest_release || []);
        setCompletedList(parsed.completed_donghua || []);
        setLoading(false);
      } else {
        triggerToast('Gagal memuat daftar Donghua.', 'error');
        setLoading(false);
      }
    };

    loadDonghua();
    return () => { active = false; };
  }, [page]);

  return (
    <section className="app-view active">
      {page === 1 ? (
        <>
          {/* Ongoing List */}
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                <Flame className="title-icon text-accent" size={20} /> Donghua Ongoing Terbaru
              </h2>
            </div>
            {loading ? (
              <CatalogSkeleton />
            ) : (
              <DonghuaGrid list={latestList.slice(0, 18)} onCardClick={setSelectedItem} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
            )}
          </div>

          {/* Completed List */}
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">
                <Sparkles className="title-icon text-pink" size={20} /> Donghua Lengkap (Completed)
              </h2>
            </div>
            {loading ? (
              <CatalogSkeleton />
            ) : (
              <DonghuaGrid list={completedList.slice(0, 18)} onCardClick={setSelectedItem} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
            )}
          </div>
        </>
      ) : (
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">
              <Film className="title-icon" size={20} style={{ color: 'var(--cyan)' }} /> Donghua Terbaru — Halaman {page}
            </h2>
          </div>
          {loading ? (
            <CatalogSkeleton />
          ) : (
            <DonghuaGrid list={latestList} onCardClick={setSelectedItem} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
          )}
        </div>
      )}

      {/* Pagination at the bottom */}
      {!loading && (
        <div className="section-container" style={{ marginTop: '20px' }}>
          <PaginationBar pagination={{ lastPage: 32 }} currentPage={page} buildHref={(p) => `#/donghua/${p}`} />
        </div>
      )}

      {/* Donghua Detail Modal */}
      {selectedItem && (
        <DonghuaDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
      )}
    </section>
  );
}

// ─── Donghua Detail Modal ────────────────────────────────────────────────────
function DonghuaDetailModal({ item, onClose, toggleFavorite, isFavorite }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  const seriesSlug = getSeriesSlug(item);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail(null);

    fetchDonghuaAPI(`/donghua/detail/${seriesSlug}`)
      .then(data => { if (active && data) setDetail(data); })
      .catch(e => console.error('DonghuaDetailModal error:', e))
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [seriesSlug]);

  // Escape key & body scroll lock
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const episodes = detail?.episodes_list
    ? (sortAsc ? [...detail.episodes_list].reverse() : detail.episodes_list)
    : [];

  return (
    <div className="dh-modal-overlay" onClick={onClose}>
      <div className="dh-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="dh-modal-topbar">
          <button className="dh-modal-close" onClick={onClose} aria-label="Tutup">
            <X size={22} />
          </button>
        </div>

        <div className="dh-modal-body">
          {loading ? (
            <div className="dh-modal-loading">
              <Loader2 size={44} style={{ animation: 'spin 1s linear infinite', color: 'var(--cyan)' }} />
              <p>Memuat detail Donghua...</p>
            </div>
          ) : detail ? (
            <>
              {/* Hero Banner */}
              <div className="dh-modal-hero" style={{ backgroundImage: `url('${detail.poster}')` }}>
                <div className="dh-modal-hero-overlay" />
                <div className="dh-modal-hero-content">
                  <img className="dh-modal-poster" src={detail.poster} alt={detail.title} />
                  <div className="dh-modal-info">
                    <div className="dh-modal-badges">
                      <span className="hero-badge" style={{ background: 'var(--cyan)' }}>{detail.type || 'Donghua'}</span>
                      <span className="hero-badge" style={{ background: detail.status === 'Completed' ? 'var(--pink)' : 'var(--accent)' }}>
                        {detail.status}
                      </span>
                      {detail.season && <span className="hero-badge">{detail.season}</span>}
                      {detail.country && <span className="hero-badge">{detail.country}</span>}
                      
                      {toggleFavorite && isFavorite && (
                        <button 
                          onClick={() => toggleFavorite({ ...detail, slug: seriesSlug }, true)}
                          className="hero-badge"
                          style={{
                            cursor: 'pointer',
                            border: 'none',
                            background: isFavorite(seriesSlug) ? 'var(--pink)' : 'rgba(255,255,255,0.12)',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: '600'
                          }}
                        >
                          <Heart size={11} fill={isFavorite(seriesSlug) ? '#fff' : 'none'} color="#fff" />
                          <span>{isFavorite(seriesSlug) ? 'Favorit Saya' : 'Tambah Favorit'}</span>
                        </button>
                      )}
                    </div>
                    <h2 className="dh-modal-title">{detail.title}</h2>
                    {detail.alter_title && <p className="dh-modal-alter">{detail.alter_title}</p>}
                    <div className="dh-modal-meta-row">
                      {detail.studio && <span><strong>Studio:</strong> {detail.studio}</span>}
                      {detail.network && <span><strong>Network:</strong> {detail.network}</span>}
                      {detail.episodes_count && (
                        <span><Film size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{detail.episodes_count} Eps</span>
                      )}
                      {detail.duration && (
                        <span><Clock size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{detail.duration}</span>
                      )}
                      {detail.released_on && (
                        <span><Calendar size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{detail.released_on}</span>
                      )}
                    </div>
                    {detail.genres && detail.genres.length > 0 && (
                      <div className="dh-modal-genres">
                        {detail.genres.map(g => (
                          <span key={g.slug} className="tag-genre">{g.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              {detail.synopsis && (
                <div className="dh-modal-synopsis">
                  <h3><Info size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Sinopsis</h3>
                  <p>{detail.synopsis}</p>
                </div>
              )}

              {/* Episode List */}
              <div className="dh-modal-episodes">
                <div className="section-header" style={{ marginBottom: '14px' }}>
                  <h3 className="section-title" style={{ fontSize: '17px' }}>
                    <PlaySquare size={18} className="title-icon" /> Daftar Episode
                    <span className="page-info-badge" style={{ marginLeft: '8px', fontSize: '12px' }}>{episodes.length} Eps</span>
                  </h3>
                  <button className="btn-sort" onClick={() => setSortAsc(!sortAsc)}>
                    <ArrowUpDown size={14} /> {sortAsc ? 'Terlama' : 'Terbaru'}
                  </button>
                </div>
                {episodes.length === 0 ? (
                  <div className="no-data">Episode belum tersedia.</div>
                ) : (
                  <div className="episodes-grid numeric-grid">
                    {episodes.map((ep, idx) => {
                      const epNum = extractEpisodeNumber(ep.episode);
                      const epSlug = ep.slug || ep.href?.split('/').pop() || '';
                      return (
                        <a
                          key={ep.slug || idx}
                          href={`#/donghua-episode/${epSlug}`}
                          className="episode-card numeric-card"
                          title={ep.episode}
                        >
                          <span>{epNum || String(idx + 1)}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="dh-modal-loading">
              <AlertCircle size={44} style={{ color: 'var(--pink)' }} />
              <p>Gagal memuat detail Donghua.</p>
              <button className="btn-hero-play" onClick={onClose} style={{ marginTop: '16px' }}>Tutup</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Donghua Stream View ──────────────────────────────────────────────────────
function DonghuaStreamView({ episodeSlug, triggerToast, saveToHistory }) {
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerUrl, setPlayerUrl] = useState('');
  const [serverList, setServerList] = useState([]);
  const [activeServer, setActiveServer] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const activeEpisodeRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStream(null);
    setPlayerUrl('');
    setDownloadOpen(false);

    const loadStream = async () => {
      try {
        let data = null;
        try {
          const res = await fetchAPI(`/donghua/episode/${episodeSlug}`);
          data = res.data || res;
        } catch (e) {
          const raw = await fetchDonghuaAPI(`/donghua/episode/${episodeSlug}`);
          data = raw.data || raw;
        }
        if (!active) return;

        setStream(data);
        setLoading(false);

        if (data.streaming?.main_url?.url) {
          setPlayerUrl(data.streaming.main_url.url);
        } else if (data.streaming?.servers?.length > 0) {
          setPlayerUrl(data.streaming.servers[0].url);
        }

        if (data.streaming?.servers) {
          setServerList(data.streaming.servers);
          if (data.streaming.servers.length > 0) {
            setActiveServer(data.streaming.servers[0].name);
          }
        }

        if (data.donghua_details?.slug) {
          saveToHistory(
            data.donghua_details.slug,
            data.donghua_details.title || data.episode,
            data.donghua_details.poster || '',
            episodeSlug,
            data.episode
          );
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          if (activeEpisodeRef.current) {
            activeEpisodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 500);
      } catch (err) {
        console.error('DonghuaStream error:', err);
        if (active) {
          triggerToast('Gagal memuat streaming Donghua.', 'error');
          setLoading(false);
        }
      }
    };

    loadStream();
    return () => { active = false; };
  }, [episodeSlug]);

  const switchServer = (server) => {
    setActiveServer(server.name);
    setPlayerUrl(server.url);
    triggerToast(`Menghubungkan ke server ${server.name}...`);
  };

  if (loading) {
    return (
      <section className="app-view active" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Loader2 className="spinner shimmer" size={40} style={{ animation: 'spin 1s infinite linear' }} />
      </section>
    );
  }

  if (!stream) {
    return (
      <section className="app-view active">
        <div className="no-data">Gagal memuat player Donghua.</div>
      </section>
    );
  }

  const downloadQualities = stream.download_url ? Object.keys(stream.download_url).map(key => {
    const title = key.replace('download_url_', '');
    const urlsObj = stream.download_url[key];
    const urls = Object.keys(urlsObj).map(provider => ({
      title: provider,
      url: urlsObj[provider]
    }));
    return { title, urls };
  }) : [];

  return (
    <section className="app-view active">
      <div className="stream-container">
        <div className="stream-main">
          <div className="video-section">
            <div className="video-player-wrapper">
              <iframe
                id="donghua-video-player"
                src={playerUrl}
                frameBorder="0"
                allowFullScreen
                title={stream.episode}
              ></iframe>
            </div>

            <div className="video-controls">
              <a
                href={stream.navigation?.previous_episode ? `#/donghua-episode/${stream.navigation.previous_episode.slug}` : undefined}
                className={`btn-control ${!stream.navigation?.previous_episode ? 'disabled' : ''}`}
              >
                <SkipBack size={14} /> Episode Seb
              </a>

              <div className="server-selector-container">
                <span>Server:</span>
                <div className="server-badges">
                  {serverList.map(srv => (
                    <button
                      key={srv.name}
                      className={`server-badge ${activeServer === srv.name ? 'active' : ''}`}
                      onClick={() => switchServer(srv)}
                    >
                      {srv.name}
                    </button>
                  ))}
                  {serverList.length === 0 && <span style={{ fontSize: '12px', color: '#aaa' }}>Def server</span>}
                </div>
              </div>

              <a
                href={stream.navigation?.next_episode ? `#/donghua-episode/${stream.navigation.next_episode.slug}` : undefined}
                className={`btn-control ${!stream.navigation?.next_episode ? 'disabled' : ''}`}
              >
                Episode Sel <SkipForward size={14} />
              </a>
            </div>
          </div>

          <div className="stream-info">
            <h1 className="stream-title">{stream.episode}</h1>
            <div className="stream-meta">
              <span className="stream-meta-item"><Clock size={12} /> {stream.donghua_details?.released || '-'}</span>
              <span className="stream-meta-item"><Film size={12} /> Donghua</span>
            </div>
          </div>

          <div className={`download-dropdown-section ${downloadOpen ? 'open' : ''}`}>
            <button className="download-dropdown-toggle" onClick={() => setDownloadOpen(!downloadOpen)}>
              <div className="download-toggle-left">
                <Download size={18} />
                <span>Link Download</span>
              </div>
              <ChevronDown size={18} className={`download-chevron ${downloadOpen ? 'rotated' : ''}`} />
            </button>
            {downloadOpen && (
              <div className="download-dropdown-body">
                {downloadQualities.length > 0 ? (
                  downloadQualities.map((q, idx) => (
                    <div key={idx} className="download-dropdown-row">
                      <div className="dl-row-header">
                        <span className="dl-quality">{q.title}</span>
                      </div>
                      <div className="dl-links">
                        {q.urls.map((link, lIdx) => (
                          <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer" className="btn-dl">
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data" style={{ padding: '16px' }}>Link unduhan tidak tersedia.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — right column: poster info + server selection + episode list */}
        <div className="stream-sidebar">
          {stream.donghua_details && (
            <div className="sidebar-block anime-mini-info">
              {stream.donghua_details.poster && (
                <img className="anime-mini-poster" src={stream.donghua_details.poster} alt={stream.donghua_details.title} />
              )}
              <div className="anime-mini-details">
                <h4 className="anime-mini-title">{stream.donghua_details.title}</h4>
                <div className="anime-mini-meta">
                  <div>Type: <span style={{ color: 'var(--cyan)' }}>Donghua</span></div>
                  <div>Rilis: <span>{stream.donghua_details.released || '-'}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Server list in sidebar */}
          {serverList.length > 0 && (
            <div className="sidebar-block">
              <div className="sidebar-block-header">
                <h3><Video size={16} /> Pilihan Server</h3>
              </div>
              <div className="quality-badges" style={{ flexWrap: 'wrap' }}>
                {serverList.map(srv => (
                  <button
                    key={srv.name}
                    className={`quality-btn ${activeServer === srv.name ? 'active' : ''}`}
                    onClick={() => switchServer(srv)}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Episode list in sidebar */}
          <div className="sidebar-block sidebar-episode-block">
            <div className="sidebar-block-header">
              <h3><List size={16} /> Semua Episode</h3>
            </div>
            <div className="sidebar-episode-scroll">
              {stream.episodes_list?.map(ep => {
                const epNum = extractEpisodeNumber(ep.episode);
                const epSlug = ep.slug || ep.href?.split('/').pop() || '';
                const isActive = epSlug === episodeSlug;
                return (
                  <a
                    key={epSlug || ep.episode}
                    ref={isActive ? activeEpisodeRef : null}
                    href={`#/donghua-episode/${epSlug}`}
                    className={`stream-ep-item ${isActive ? 'active' : ''}`}
                    title={ep.episode}
                  >
                    {isNaN(Number(epNum)) ? epNum : `Ep ${epNum}`}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Search Results / Genre View with Pagination
function ResultsView({ mode, query, genreId, page = 1, toggleFavorite, isFavorite }) {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // Genre specific name matching
  const genreInfo = mode === 'genre' ? GENRES_LIST.find(g => g.id === genreId) : null;
  const displayName = genreInfo ? genreInfo.title : genreId;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setList([]);
    setPagination(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const loadResults = async () => {
      if (mode === 'search') {
        try {
          const [animeRes, donghuaRes] = await Promise.allSettled([
            fetchAPI(`/search/${query}`),
            fetchDonghuaAPI(`/donghua/search/${query}`)
          ]);

          let mergedList = [];

          if (animeRes.status === 'fulfilled' && animeRes.value?.data?.animeList) {
            mergedList = [...animeRes.value.data.animeList];
          }

          if (donghuaRes.status === 'fulfilled' && donghuaRes.value) {
            const dhVal = donghuaRes.value;
            const dhList = dhVal.data || dhVal || [];
            if (Array.isArray(dhList)) {
              const normalizedDh = dhList.map(item => ({
                ...item,
                animeId: item.slug || '',
                isDonghua: true
              }));
              mergedList = [...normalizedDh, ...mergedList];
            }
          }

          if (active) {
            setList(mergedList);
            setLoading(false);
          }
        } catch (err) {
          console.error('Search results fetch error:', err);
          if (active) setLoading(false);
        }
      } else {
        const endpoint = `/genre/${genreId}?page=${page}`;
        try {
          const res = await fetchAPI(endpoint);
          if (res.data && active) {
            setList(res.data.animeList || []);
            setPagination(res.pagination || res.data.pagination || null);
            setLoading(false);
          }
        } catch (err) {
          console.error('Results fetch error:', err);
          if (active) setLoading(false);
        }
      }
    };

    loadResults();
    return () => { active = false; };
  }, [mode, query, genreId, page]);

  const buildHref = (p) => `#/genre/${genreId}/${p}`;

  return (
    <section className="app-view active">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title results-title">
            {loading ? (
              <Loader2 className="spinner shimmer" size={20} style={{ animation: 'spin 1s infinite linear', display: 'inline-block', marginRight: '8px', flexShrink: 0 }} />
            ) : null}
            <span className="results-title-text">
              {mode === 'search' ? `Hasil Pencarian: "${decodeURIComponent(query)}"` : `Genre: ${displayName}`}
            </span>
          </h2>
          {mode === 'genre' && pagination && (
            <span className="page-info-badge">Halaman {page}</span>
          )}
        </div>

        {loading ? (
          <CatalogSkeleton />
        ) : (
          <>
            <AnimeGrid list={list} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
            {mode === 'genre' && (
              <PaginationBar pagination={pagination} currentPage={page} buildHref={buildHref} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Favorites View ──────────────────────────────────────────────────────────
function FavoritesView({ favorites, toggleFavorite, isFavorite }) {
  const animeFavorites = favorites.filter(x => !x.isDonghua);
  const donghuaFavorites = favorites.filter(x => x.isDonghua);

  // Normalize favorites to match grid items
  const normAnimeList = animeFavorites.map(x => ({
    animeId: x.id,
    title: x.title,
    poster: x.poster,
    status: x.status,
    type: x.type
  }));

  const normDonghuaList = donghuaFavorites.map(x => ({
    slug: x.id,
    title: x.title,
    poster: x.poster,
    status: x.status,
    type: x.type
  }));

  const [selectedDonghua, setSelectedDonghua] = useState(null);

  return (
    <section className="app-view active">
      <div className="section-container">
        <div className="section-header" style={{ marginBottom: '20px' }}>
          <h2 className="section-title">
            <Heart className="title-icon text-pink" size={20} fill="var(--pink)" /> Favorit Saya
          </h2>
        </div>

        {/* Anime Favorites Section */}
        <div className="section-container" style={{ marginBottom: '40px' }}>
          <div className="section-header">
            <h3 className="section-title" style={{ fontSize: '18px' }}>
              <PlaySquare className="title-icon" size={18} /> Anime Favorit
              <span className="page-info-badge" style={{ marginLeft: '8px', fontSize: '12px' }}>{animeFavorites.length}</span>
            </h3>
          </div>
          {animeFavorites.length === 0 ? (
            <div className="no-data" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              Belum ada anime yang ditambahkan ke favorit.
            </div>
          ) : (
            <AnimeGrid list={normAnimeList} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
          )}
        </div>

        {/* Donghua Favorites Section */}
        <div className="section-container">
          <div className="section-header">
            <h3 className="section-title" style={{ fontSize: '18px' }}>
              <Film className="title-icon text-cyan" size={18} /> Donghua Favorit
              <span className="page-info-badge" style={{ marginLeft: '8px', fontSize: '12px' }}>{donghuaFavorites.length}</span>
            </h3>
          </div>
          {donghuaFavorites.length === 0 ? (
            <div className="no-data" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              Belum ada donghua yang ditambahkan ke favorit.
            </div>
          ) : (
            <DonghuaGrid list={normDonghuaList} onCardClick={setSelectedDonghua} toggleFavorite={toggleFavorite} isFavorite={isFavorite} />
          )}
        </div>
      </div>

      {/* Donghua Detail Modal */}
      {selectedDonghua && (
        <DonghuaDetailModal
          item={selectedDonghua}
          onClose={() => setSelectedDonghua(null)}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
      )}
    </section>
  );
}
