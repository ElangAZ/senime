import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Home, Calendar, CheckSquare, Hash, ChevronDown, Search,
  Trash2, Flame, Sparkles, ArrowRight, Tv, Info, Film, Clock, 
  SortAsc, ThumbsUp, SkipBack, SkipForward, Download, List, Star, 
  User, Video, X, Loader2, Square, AlertCircle, CheckCircle2,
  History, ArrowUpDown, PlaySquare
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
        const res = await fetchAPI(`/search/${encodeURIComponent(searchQuery.trim())}`);
        if (res.data && res.data.animeList) {
          setSuggestions(res.data.animeList.slice(0, 5));
        } else {
          setSuggestions([]);
        }
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
    if (route === '#/' || route === '') {
      return <HomeView historyItems={historyItems} clearHistory={clearHistory} triggerToast={triggerToast} />;
    } else if (route.startsWith('#/ongoing')) {
      const parts = route.split('/');
      const page = parts[2] ? parseInt(parts[2]) : 1;
      return <CatalogView type="ongoing" page={page} />;
    } else if (route.startsWith('#/completed')) {
      const parts = route.split('/');
      const page = parts[2] ? parseInt(parts[2]) : 1;
      return <CatalogView type="completed" page={page} />;
    } else if (route.startsWith('#/anime/')) {
      const parts = route.split('/');
      const animeId = parts[2];
      return <DetailView animeId={animeId} triggerToast={triggerToast} saveToHistory={saveToHistory} />;
    } else if (route.startsWith('#/episode/')) {
      const parts = route.split('/');
      const episodeId = parts[2];
      return <StreamView episodeId={episodeId} triggerToast={triggerToast} saveToHistory={saveToHistory} />;
    } else if (route.startsWith('#/search/')) {
      const parts = route.split('/');
      const query = parts[2];
      return <ResultsView mode="search" query={query} />;
    } else if (route.startsWith('#/genre/')) {
      const parts = route.split('/');
      const genreId = parts[2];
      const page = parts[3] ? parseInt(parts[3]) : 1;
      return <ResultsView mode="genre" genreId={genreId} page={page} />;
    } else {
      return <HomeView historyItems={historyItems} clearHistory={clearHistory} triggerToast={triggerToast} />;
    }
  };

  return (
    <>
      {/* Header */}
      <header className="main-header">
        <div className="header-container">
          <a href="#/" className="logo">
            <Play className="logo-icon" fill="currentColor" />
            <span className="logo-text">Neko<span>Watch</span></span>
          </a>
          
          <nav className="desktop-nav">
            <a href="#/" className={`nav-link ${(route === '#/' || route === '') ? 'active' : ''}`}>
              <Home size={16} /> Home
            </a>
            <a href="#/ongoing" className={`nav-link ${route.startsWith('#/ongoing') ? 'active' : ''}`}>
              <Calendar size={16} /> Ongoing
            </a>
            <a href="#/completed" className={`nav-link ${route.startsWith('#/completed') ? 'active' : ''}`}>
              <CheckSquare size={16} /> Completed
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
          </nav>

          <div className="search-box">
            <form id="search-form" onSubmit={handleSearchSubmit}>
              <input 
                id="search-input"
                ref={searchInputRef}
                type="text" 
                placeholder="Cari anime kesukaanmu..." 
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
                        window.location.hash = `#/anime/${animeId}`;
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
      <nav className="mobile-nav">
        <a href="#/" className={`mobile-nav-item ${(route === '#/' || route === '') ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </a>
        <a href="#/ongoing" className={`mobile-nav-item ${route.startsWith('#/ongoing') ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>Ongoing</span>
        </a>
        <a href="#/completed" className={`mobile-nav-item ${route.startsWith('#/completed') ? 'active' : ''}`}>
          <CheckSquare size={20} />
          <span>Completed</span>
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
        <p>&copy; 2026 NekoWatch. Dibuat dengan cinta untuk para Wibu. API didukung oleh Sankavollerei.</p>
      </footer>
    </>
  );
}

// ------------------------- VIEWS & COMPONENTS -------------------------

// Anime Card Grid Component
function AnimeGrid({ list, limit }) {
  if (!list || list.length === 0) {
    return <div className="no-data">Tidak ada anime yang ditemukan.</div>;
  }
  const items = limit ? list.slice(0, limit) : list;
  return (
    <div className="anime-grid">
      {items.map(anime => {
        const animeId = anime.animeId || anime.href.split('/').pop();
        const epsBadge = anime.episodes ? <div className="card-badge">{anime.episodes} Eps</div> : null;
        const scoreBadge = anime.score && anime.score !== '0' && anime.score !== '0.00' ? (
          <div className="card-score"><Star size={10} fill="var(--star)" color="var(--star)" /> {anime.score}</div>
        ) : null;
        const releaseTag = anime.releaseDay ? <div className="card-release-tag">{anime.releaseDay}</div> : null;

        return (
          <div key={animeId} className="anime-card">
            <a href={`#/anime/${animeId}`}>
              <div className="card-poster-wrapper">
                <img className="card-poster" src={anime.poster} alt={anime.title} loading="lazy" />
                {epsBadge}
                {scoreBadge}
                {releaseTag}
              </div>
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
function HomeView({ historyItems, clearHistory, triggerToast }) {
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
        {loading ? <CatalogSkeleton /> : <AnimeGrid list={ongoing} limit={18} />}
      </div>

      {/* Completed List */}
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title"><Sparkles className="title-icon text-pink" size={20} /> Anime Lengkap (Completed)</h2>
          <a href="#/completed" className="btn-view-all">Lihat Semua <ArrowRight size={14} /></a>
        </div>
        {loading ? <CatalogSkeleton /> : <AnimeGrid list={completed} limit={18} />}
      </div>
    </section>
  );
}

// Catalog View
function CatalogView({ type, page }) {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const loadCatalog = async () => {
      const endpoint = type === 'ongoing' ? '/ongoing-anime' : '/complete-anime';
      try {
        const res = await fetchAPI(`${endpoint}?page=${page}`);
        if (res.data && active) {
          setList(res.data.animeList || []);
          setPagination(res.data.pagination || null);
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error('Catalog load error:', err);
        if (active) setLoading(false);
      }
    };
    loadCatalog();
    return () => { active = false; };
  }, [type, page]);

  return (
    <section className="app-view active">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">
            {type === 'ongoing' ? 'Semua Anime Ongoing' : 'Semua Anime Completed'}
          </h2>
        </div>
        
        {loading ? (
          <CatalogSkeleton />
        ) : (
          <>
            <AnimeGrid list={list} />
            {pagination && (
              <div className="pagination-container" style={{ display: 'flex' }}>
                <button 
                  className="btn-page" 
                  disabled={!pagination.hasPrevPage}
                  onClick={() => window.location.hash = `#/${type}/${pagination.prevPage}`}
                >
                  <SkipBack size={14} /> Sebelumnya
                </button>
                <span className="page-info">Halaman {pagination.currentPage} dari {pagination.totalPages || '?'}</span>
                <button 
                  className="btn-page" 
                  disabled={!pagination.hasNextPage}
                  onClick={() => window.location.hash = `#/${type}/${pagination.nextPage}`}
                >
                  Selanjutnya <SkipForward size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Detail View
function DetailView({ animeId, triggerToast, saveToHistory }) {
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
            <AnimeGrid list={detail.recommendedAnimeList} />
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
  const activeEpisodeRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStream(null);
    setAnimeDetails(null);
    setPlayerUrl('');
    
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

          {/* Quality switcher list */}
          {stream.server?.qualities && (
            <div className="quality-selector-section">
              <h3>Pilih Kualitas Streaming:</h3>
              <div className="quality-badges">
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

          {/* Download block links */}
          <div className="download-section">
            <h2 className="section-title"><Download size={20} className="title-icon" /> Link Download</h2>
            <div className="download-container">
              {stream.downloadUrl && stream.downloadUrl.qualities ? (
                stream.downloadUrl.qualities.map((q, idx) => (
                  <div key={idx} className="download-row">
                    <div className="dl-quality">{q.title}</div>
                    <div className="dl-size">{q.size || ''}</div>
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
                <div className="no-data">Link unduhan tidak tersedia untuk episode ini.</div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar right area */}
        <div className="stream-sidebar">
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
          
          <div className="sidebar-block episode-list-block">
            <div className="sidebar-block-header">
              <h3><List size={16} /> Semua Episode</h3>
            </div>
            <div className="sidebar-episode-list">
              {stream.info?.episodeList && stream.info.episodeList.map(ep => {
                const epNum = extractEpisodeNumber(ep.title);
                const isActive = ep.episodeId === episodeId;
                return (
                  <a 
                    key={ep.episodeId}
                    ref={isActive ? activeEpisodeRef : null}
                    href={`#/episode/${ep.episodeId}`} 
                    className={`sidebar-ep-item ${isActive ? 'active' : ''}`}
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

// Search Results / Genre View
function ResultsView({ mode, query, genreId, page = 1 }) {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // Genre specific name matching
  const genreInfo = mode === 'genre' ? GENRES_LIST.find(g => g.id === genreId) : null;
  const displayName = genreInfo ? genreInfo.title : genreId;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const loadResults = async () => {
      const endpoint = mode === 'search' 
        ? `/search/${query}` 
        : `/genre/${genreId}?page=${page}`;
      try {
        const res = await fetchAPI(endpoint);
        if (res.data && active) {
          setList(res.data.animeList || []);
          setPagination(res.data.pagination || null);
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error('Results fetch error:', err);
        if (active) setLoading(false);
      }
    };
    loadResults();
    return () => { active = false; };
  }, [mode, query, genreId, page]);

  return (
    <section className="app-view active">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">
            {loading ? (
              <Loader2 className="spinner shimmer" size={20} style={{ animation: 'spin 1s infinite linear', display: 'inline-block', marginRight: '8px' }} />
            ) : null}
            {mode === 'search' ? `Hasil Pencarian untuk: "${decodeURIComponent(query)}"` : `Genre: ${displayName}`}
          </h2>
        </div>

        {loading ? (
          <CatalogSkeleton />
        ) : (
          <>
            <AnimeGrid list={list} />
            
            {mode === 'genre' && pagination && (
              <div className="pagination-container" style={{ display: 'flex' }}>
                <button 
                  className="btn-page" 
                  disabled={!pagination.hasPrevPage}
                  onClick={() => window.location.hash = `#/genre/${genreId}/${pagination.prevPage}`}
                >
                  <SkipBack size={14} /> Sebelumnya
                </button>
                <span className="page-info">Halaman {pagination.currentPage} dari {pagination.totalPages || '?'}</span>
                <button 
                  className="btn-page" 
                  disabled={!pagination.hasNextPage}
                  onClick={() => window.location.hash = `#/genre/${genreId}/${pagination.nextPage}`}
                >
                  Selanjutnya <SkipForward size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
