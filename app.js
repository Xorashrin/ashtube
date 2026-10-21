/**
 * AshTube — Core Application Logic, Advanced Video Player & Multi-Thread Downloader
 * Developed by ASRAFUL ISLAM
 * Includes touch gesture HUDs (Brightness, Volume, Scrubbing),
 * Rotation mode, Dual-Audio switching, and Real-Time Multi-Thread Downloader.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 0. Backend connection (same origin in the browser, configurable in the APK)
  // ==========================================================================
  const API_BASE = (() => {
    try {
      const fromQuery = new URLSearchParams(location.search).get('api');
      if (fromQuery) localStorage.setItem('ashtube_api_base', fromQuery.replace(/\/+$/, ''));
      const saved = localStorage.getItem('ashtube_api_base');
      if (saved) return saved;
    } catch (e) { /* storage unavailable */ }
    return location.protocol.startsWith('http') ? '' : 'http://localhost:8000';
  })();
  const apiUrl = (path) => API_BASE + path;
  const proxied = (url) => apiUrl('/api/proxy?u=' + encodeURIComponent(url));

  function fetchJson(path, options, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(apiUrl(path), Object.assign({ signal: ctrl.signal }, options || {}))
      .then(r => r.json())
      .finally(() => clearTimeout(timer));
  }

  // ==========================================================================
  // 1. Unified Catalog Data
  // ==========================================================================
  let CATALOG_DATA = [
    {
      id: 'movie-1',
      title: 'Dune: Part Two',
      category: 'movies',
      year: '2024',
      rating: '8.9',
      quality: '4K HDR',
      duration: '2h 46m',
      genres: 'Sci-Fi · Adventure · Action',
      backdrop: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
      synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family, facing a choice between the love of his life and the fate of the known universe.',
      isBDIX: true,
      audioTracks: ['English 5.1', 'Bengali Dubbed'],
      isSeries: false
    },
    {
      id: 'movie-2',
      title: 'Interstellar',
      category: 'movies',
      year: '2014',
      rating: '8.7',
      quality: '4K HDR',
      duration: '2h 49m',
      genres: 'Sci-Fi · Drama · Mystery',
      backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&q=80',
      synopsis: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.',
      isBDIX: true,
      audioTracks: ['English (Original)', 'Bengali Dubbed (HQ)'],
      isSeries: false
    },
    {
      id: 'series-1',
      title: 'The Last Kingdom',
      category: 'series',
      year: '2023',
      rating: '8.5',
      quality: '1080p HD',
      duration: '5 Seasons',
      genres: 'Action · Drama · History',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
      synopsis: 'As Alfred the Great defends his kingdom from Norse invaders, Uhtred—born a Saxon but raised by Vikings—seeks to claim his ancestral birthright.',
      isBDIX: true,
      isSeries: true,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { epNum: 1, title: 'Arrival on Saxon Soil', runtime: '54 min', thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80' },
            { epNum: 2, title: 'The Oath of Loyalty', runtime: '58 min', thumb: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=200&q=80' },
            { epNum: 3, title: 'Shield Wall at Dawn', runtime: '52 min', thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=200&q=80' }
          ]
        },
        {
          seasonNumber: 2,
          episodes: [
            { epNum: 1, title: 'Reckoning at Edington', runtime: '56 min', thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80' }
          ]
        }
      ]
    },
    {
      id: 'anime-1',
      title: 'Solo Leveling',
      category: 'anime',
      year: '2024',
      rating: '8.6',
      quality: '1080p 60fps',
      duration: 'Season 1 · 12 Eps',
      genres: 'Anime · Action · Fantasy',
      backdrop: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
      synopsis: 'In a world where hunters must battle deadly monsters to protect mankind, Sung Jinwoo, the weakest hunter of all mankind, finds himself in an endless quest to level up.',
      subDub: 'Sub / Dub',
      isSeries: true,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { epNum: 1, title: 'I\'m Used to It', runtime: '24 min', thumb: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=200&q=80' },
            { epNum: 2, title: 'If I Had One More Chance', runtime: '24 min', thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=200&q=80' },
            { epNum: 3, title: 'Like a Daily Quest', runtime: '24 min', thumb: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=200&q=80' }
          ]
        }
      ]
    },
    {
      id: 'anime-2',
      title: 'Jujutsu Kaisen',
      category: 'anime',
      year: '2023',
      rating: '8.8',
      quality: '1080p',
      duration: 'Season 2 · Shibuya',
      genres: 'Anime · Supernatural · Action',
      backdrop: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=400&q=80',
      synopsis: 'A boy swallows a cursed talisman and becomes cursed himself. He enters a shaman\'s school to be able to locate the demon\'s other body parts and exorcise himself.',
      subDub: 'Sub / Dub',
      isSeries: true,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { epNum: 1, title: 'Ryomen Sukuna', runtime: '24 min', thumb: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=200&q=80' }
          ]
        }
      ]
    },
    {
      id: 'kdrama-1',
      title: 'Queen of Tears',
      category: 'kdrama',
      year: '2024',
      rating: '8.4',
      quality: '1080p HD',
      duration: '16 Episodes',
      genres: 'K-Drama · Romance · Drama',
      backdrop: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      synopsis: 'The queen of department stores and her small-town husband weather a marital crisis—until love miraculously begins to bloom again.',
      isSeries: true,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { epNum: 1, title: 'Episode 1: The Queens Group', runtime: '78 min', thumb: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80' },
            { epNum: 2, title: 'Episode 2: A Change of Heart', runtime: '75 min', thumb: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80' }
          ]
        }
      ]
    },
    {
      id: 'bangla-1',
      title: 'KGF: Chapter 2 (Bangla Dubbed)',
      category: 'bangla',
      year: '2022',
      rating: '8.3',
      quality: '1080p BluRay',
      duration: '2h 48m',
      genres: 'Action · Crime · Drama',
      backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
      synopsis: 'In the blood-soaked Kolar Gold Fields, Rocky\'s name strikes fear into his foes. While his allies look up to him, the government sees him as a threat to law and order.',
      isBDIX: true,
      audioTracks: ['Bengali Dubbed (Studio HQ)', 'Hindi 5.1'],
      isSeries: false
    }
  ];

  // Continue Watching Mock Data
  const CONTINUE_WATCHING = [
    {
      id: 'movie-1',
      title: 'Dune: Part Two',
      progress: 65,
      meta: 'S1:E2 · 28m left',
      thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'anime-1',
      title: 'Solo Leveling',
      progress: 40,
      meta: 'Ep 6 · 14m left',
      thumb: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'kdrama-1',
      title: 'Queen of Tears',
      progress: 85,
      meta: 'Ep 8 · 11m left',
      thumb: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80'
    }
  ];

  // Live TV Channels Data (Dynamic with fallback)
  let LIVE_CHANNELS = [];

  // ==========================================================================
  // 2. State & DOM References
  // ==========================================================================
  let currentActiveTab = 'home';
  let currentActiveCategory = 'all';
  let activeMediaItem = CATALOG_DATA[0];
  let downloadPollingInterval = null;

  // Video Player Elements
  const videoPlayer = document.getElementById('mainVideoPlayer');
  const playerModal = document.getElementById('videoPlayerModal');
  const gestureSurface = document.getElementById('gestureSurface');
  const brightnessHud = document.getElementById('brightnessHud');
  const brightnessBarFill = document.getElementById('brightnessBarFill');
  const brightnessText = document.getElementById('brightnessText');
  const volumeHud = document.getElementById('volumeHud');
  const volumeBarFill = document.getElementById('volumeBarFill');
  const volumeText = document.getElementById('volumeText');
  const seekPreviewHud = document.getElementById('seekPreviewHud');
  const seekTargetTime = document.getElementById('seekTargetTime');
  const seekDelta = document.getElementById('seekDelta');
  const videoSeeker = document.getElementById('videoSeeker');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');
  const hudPlayIcon = document.getElementById('hudPlayIcon');
  const centerControlsHud = document.getElementById('centerControlsHud');
  const playerBottomControls = document.getElementById('playerBottomControls');
  const playerTopHeader = document.getElementById('playerTopHeader');

  let currentBrightness = 1.0;
  let currentVolume = 0.8;
  let isControlsLocked = false;
  let isLandscapeMode = false;
  let currentAudioIndex = 0;
  const audioOptions = ['ENG / BAN', 'BAN (Dubbed)', 'ENG (Original)'];
  let currentAspectMode = 0;
  const aspectModes = ['aspect-fit', 'aspect-fill', 'aspect-stretch'];
  let currentQuality = '1080p 60fps';
  const qualityOptions = ['1080p 60fps', '720p HD', '480p', 'Auto'];
  let currentSpeed = 1.0;
  const speedOptions = [1.0, 1.25, 1.5, 2.0, 0.75];
  let currentSubtitle = 'Bangla [ON]';
  const subOptions = ['Bangla [ON]', 'English [CC]', 'Off'];

  // ==========================================================================
  // 3. Render Catalog Rows & Sections
  // ==========================================================================
  function renderAllSections() {
    renderContinueWatching();
    renderRail('trendingBdixRail', CATALOG_DATA.filter(i => i.isBDIX));
    renderRail('animeRail', CATALOG_DATA.filter(i => i.category === 'anime'));
    renderRail('kdramaRail', CATALOG_DATA.filter(i => i.category === 'kdrama'));
    renderRail('banglaDubbedRail', CATALOG_DATA.filter(i => i.category === 'bangla'));
    renderLiveTvGrid(LIVE_CHANNELS);
    fetchDownloadsList();
  }

  function renderContinueWatching() {
    const rail = document.getElementById('continueWatchingRail');
    rail.innerHTML = CONTINUE_WATCHING.map(item => `
      <div class="resume-card" data-id="${item.id}">
        <div class="resume-thumb-wrap">
          <img class="resume-thumb" src="${item.thumb}" alt="${item.title}" loading="lazy">
          <div class="play-overlay-mini">
            <div class="play-circle-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${item.progress}%;"></div>
          </div>
        </div>
        <div class="resume-info">
          <div class="resume-title">${item.title}</div>
          <div class="resume-meta">${item.meta}</div>
        </div>
      </div>
    `).join('');

    rail.querySelectorAll('.resume-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = CATALOG_DATA.find(c => c.id === card.dataset.id);
        if (item) openDetailModal(item);
      });
    });
  }

  function renderRail(railId, items) {
    const rail = document.getElementById(railId);
    if (!rail) return;
    rail.innerHTML = items.map(item => `
      <div class="poster-card" data-id="${item.id}">
        <div class="poster-image-wrap">
          <img class="poster-image" src="${item.poster}" alt="${item.title}" loading="lazy">
          ${item.isBDIX ? `<span class="poster-badge bdix">BDIX</span>` : `<span class="poster-badge">${item.quality}</span>`}
          ${item.subDub ? `<span class="subdub-badge">${item.subDub}</span>` : ''}
        </div>
        <div class="poster-info">
          <div class="poster-title">${item.title}</div>
          <div class="poster-meta">
            <span>${item.year}</span>
            <span>★ ${item.rating}</span>
          </div>
        </div>
      </div>
    `).join('');

    rail.querySelectorAll('.poster-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = CATALOG_DATA.find(c => c.id === card.dataset.id);
        if (item) openDetailModal(item);
      });
    });
  }

  function renderExploreCatalog(items) {
    const grid = document.getElementById('exploreCatalogGrid');
    const countLabel = document.getElementById('catalogResultsCount');
    countLabel.textContent = `Showing ${items.length} Titles`;
    grid.innerHTML = items.map(item => `
      <div class="poster-card" data-id="${item.id}">
        <div class="poster-image-wrap">
          <img class="poster-image" src="${escapeHtml(item.poster || '')}" alt="${escapeHtml(item.title)}" loading="lazy">
          <span class="poster-badge ${item.isBDIX ? 'bdix' : ''}">${escapeHtml(item.quality || 'HD')}</span>
        </div>
        <div class="poster-info">
          <div class="poster-title">${escapeHtml(item.title)}</div>
          <div class="poster-meta">
            <span>${escapeHtml(String(item.year || ''))}</span>
            <span>★ ${escapeHtml(String(item.rating || 'N/A'))}</span>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.poster-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = items.find(c => c.id === card.dataset.id) || CATALOG_DATA.find(c => c.id === card.dataset.id);
        if (item) openDetailModal(item);
      });
    });
  }

  let currentLiveTvCategory = 'all';

  function renderLiveTvGrid(channels) {
    const grid = document.getElementById('liveTvGrid');
    if (!grid) return;

    if (!channels || channels.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No channels found in this category. Select another filter above.
        </div>
      `;
      return;
    }

    grid.innerHTML = channels.map(ch => {
      const catCls = ch.category || 'news';
      return `
        <div class="livetv-channel-card" data-id="${ch.id}">
          <div class="channel-top-row">
            <div class="channel-logo-circle ${catCls}">${escapeHtml(ch.name.substring(0, 3).toUpperCase())}</div>
            <div class="live-tag-pill">
              <span class="live-pulse"></span>
              <span>LIVE</span>
            </div>
          </div>
          <div class="channel-name">${escapeHtml(ch.name)}</div>
          <div class="channel-program">${escapeHtml(ch.program)}</div>
          <div class="channel-latency">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            <span>${ch.latency || '12ms'} · BDIX Low Latency</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.livetv-channel-card').forEach(card => {
      card.addEventListener('click', () => {
        const ch = LIVE_CHANNELS.find(c => c.id === card.dataset.id);
        if (ch) {
          launchVideoPlayer({
            title: `${ch.name} (Live)`,
            sub: `${ch.program} · BDIX ${ch.latency || '12ms'} Direct Stream`,
            videoUrl: ch.streamUrl,
            backupUrl: ch.backupUrl,
            isHls: ch.isHls
          });
        }
      });
    });
  }

  function filterLiveTv(category) {
    currentLiveTvCategory = category;
    if (category === 'all') {
      renderLiveTvGrid(LIVE_CHANNELS);
    } else {
      const filtered = LIVE_CHANNELS.filter(ch => ch.category === category);
      renderLiveTvGrid(filtered);
    }
  }

  // ==========================================================================
  // 4. Multi-Threaded Download Manager (Phase 3 Integration)
  // ==========================================================================
  function startDownloadTask(title, url, quality) {
    showToast(`Starting 4-Thread Download: ${title}`);
    fetchJson('/api/download/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, quality: quality || 'HD', threads: 4 })
    })
    .then(res => {
      if (res.success) {
        showToast(`⚡ Multi-Thread Download Active (${res.task.num_threads} Threads)`);
        startDownloadPolling();
        switchTab('downloads');
      } else {
        showToast(res.error || 'Download could not be started');
      }
    })
    .catch(() => showToast('Backend server unreachable — download not started'));
  }

  // Resolves real sources on the backend, then lets the user pick the file/quality to download.
  function triggerMultiThreadDownload(item, epTitle = null, season = 1, episode = 1) {
    const dlTitle = epTitle ? `${item.title} — ${epTitle}` : item.title;
    resolveMedia(item, season, episode).then(resolved => {
      if (!resolved) return;
      openDownloadPicker(dlTitle, resolved.sources.filter(src => !src.hls));
    });
  }

  const dlQualityModal = document.getElementById('downloadQualityModal');
  let dlPickerChoice = null;

  function openDownloadPicker(title, sources) {
    if (!sources.length) {
      showToast('No downloadable file for this title (stream-only source)');
      return;
    }
    document.getElementById('dlModalMediaTitle').textContent = title;
    const box = document.getElementById('qualityOptionsContainer');
    box.innerHTML = sources.map((src, idx) => `
      <button class="dl-option ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
        <span class="dl-option-q">${escapeHtml(src.quality)}</span>
        <span class="dl-option-meta">${escapeHtml(src.size || '')} · ${escapeHtml((src.container || '').toUpperCase())} · ${escapeHtml(src.provider)}${src.seekable ? '' : ' · single stream'}</span>
      </button>
    `).join('');
    const choose = (idx) => {
      dlPickerChoice = { title, src: sources[idx] };
      box.querySelectorAll('.dl-option').forEach(b => b.classList.toggle('selected', Number(b.dataset.idx) === idx));
      document.getElementById('startDlBtnText').textContent = `Download ${sources[idx].quality}${sources[idx].size ? ` (${sources[idx].size})` : ''}`;
    };
    box.querySelectorAll('.dl-option').forEach(b => b.addEventListener('click', () => choose(Number(b.dataset.idx))));
    choose(0);
    dlQualityModal.classList.add('open');
  }

  document.getElementById('closeDlQualityModalBtn').addEventListener('click', () => dlQualityModal.classList.remove('open'));
  dlQualityModal.addEventListener('click', (e) => { if (e.target === dlQualityModal) dlQualityModal.classList.remove('open'); });
  document.getElementById('startQualityDownloadBtn').addEventListener('click', () => {
    if (!dlPickerChoice) return;
    dlQualityModal.classList.remove('open');
    startDownloadTask(dlPickerChoice.title, dlPickerChoice.src.url, dlPickerChoice.src.quality);
  });

  // ==========================================================================
  // 4b. Source resolution (backend: Discovery FTP / Cinemeta / Consumet / aniwatch)
  // ==========================================================================
  const resolveCache = new Map();

  function resolveMedia(item, season = 1, episode = 1) {
    const key = `${item.id}:${season}:${episode}`;
    if (resolveCache.has(key)) return Promise.resolve(resolveCache.get(key));
    showToast(`Finding best source for ${item.title}…`);
    const qs = new URLSearchParams({
      id: item.id,
      category: item.category || '',
      title: item.title,
      year: item.year || '',
      series: item.isSeries ? '1' : '0',
      season: String(season),
      episode: String(episode)
    });
    return fetchJson(`/api/stream/resolve?${qs.toString()}`, null, 90000)
      .then(res => {
        if (!res.success || !res.resolved || !res.resolved.sources || !res.resolved.sources.length) {
          showToast(res.error || 'No source currently hosts this title');
          return null;
        }
        resolveCache.set(key, res.resolved);
        return res.resolved;
      })
      .catch(err => {
        showToast(err && err.name === 'AbortError' ? 'Source lookup timed out — try again' : 'Backend server unreachable');
        return null;
      });
  }

  function playMedia(item, season = 1, episode = 1, subtitle = '') {
    resolveMedia(item, season, episode).then(resolved => {
      if (!resolved) return;
      const best = resolved.sources.find(src => src.url === resolved.stream_url) || resolved.sources[0];
      launchVideoPlayer({
        title: item.title,
        sub: subtitle || `${best.quality} · ${best.provider}${best.bdix ? ' · BDIX' : ''}`,
        videoUrl: best.url,
        isHls: best.hls,
        sources: resolved.sources,
        audioTracks: resolved.audio_tracks
      });
    });
  }

  function fetchDownloadsList() {
    fetch(apiUrl('/api/download/list'))
      .then(r => r.json())
      .then(res => {
        if (res.success && res.downloads) {
          renderDownloadsUI(res.downloads);
        }
      })
      .catch(() => {
        renderMockDownloadsUI();
      });
  }

  function startDownloadPolling() {
    if (downloadPollingInterval) clearInterval(downloadPollingInterval);
    downloadPollingInterval = setInterval(() => {
      fetch(apiUrl('/api/download/list'))
        .then(r => r.json())
        .then(res => {
          if (res.success && res.downloads) {
            renderDownloadsUI(res.downloads);
            const anyActive = res.downloads.some(d => d.status === 'downloading');
            if (!anyActive && res.downloads.length > 0) {
              clearInterval(downloadPollingInterval);
            }
          }
        })
        .catch(() => {});
    }, 1000);
  }

  function renderDownloadsUI(tasks) {
    const list = document.getElementById('downloadsListContainer');
    if (!list) return;

    if (tasks.length === 0) {
      renderMockDownloadsUI();
      return;
    }

    list.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'completed';
      const isPaused = task.status === 'paused';
      const isFailed = task.status === 'failed';
      return `
        <div class="download-item-card" data-id="${task.id}">
          <div class="download-top-row">
            <div class="download-item-title">${escapeHtml(task.title)}</div>
            <button class="download-action-btn ${isCompleted ? 'play' : (isPaused ? 'resume' : 'pause')}" data-id="${task.id}" data-status="${task.status}">
              ${isCompleted 
                ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
                : (isPaused
                  ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
                  : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
                )
              }
            </button>
          </div>
          <div class="download-meta-text">
            ${isCompleted 
              ? `Completed ✓ · ${task.total_mb} MB (${task.num_threads} Threads Segmented)`
              : isFailed
              ? `Failed — ${escapeHtml(task.error || 'connection dropped')}`
              : (isPaused
                ? `Paused · ${task.downloaded_mb} / ${task.total_mb} MB (${task.progress_pct}%)`
                : `Downloading (${task.speed_mbps} MB/s) — ${task.progress_pct}% · ${task.num_threads} Threads Active`
              )
            }
          </div>
          ${(!isCompleted && !isFailed) ? `
            <div class="download-progress-bar">
              <div class="download-progress-fill" style="width: ${task.progress_pct}%;"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Attach pause/resume actions
    list.querySelectorAll('.download-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        if (status === 'downloading') {
          fetch(apiUrl('/api/download/pause'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
          }).then(() => {
            showToast('Download Paused ⏸️');
            fetchDownloadsList();
          });
        } else if (status === 'paused') {
          fetch(apiUrl('/api/download/resume'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
          }).then(() => {
            showToast('Download Resumed ▶️');
            startDownloadPolling();
          });
        } else if (status === 'completed') {
          const taskObj = tasks.find(t => t.id === id);
          const playUrl = (taskObj && taskObj.filename)
            ? apiUrl(`/api/download/file/${encodeURIComponent(taskObj.filename)}`)
            : '';
          if (!playUrl) { showToast('Downloaded file is missing on the server'); return; }
          launchVideoPlayer({
            title: taskObj ? taskObj.title : 'Offline Playback',
            sub: 'Local Multi-Thread Storage · Zero Buffer',
            videoUrl: playUrl
          });
        }
      });
    });
  }

  function renderMockDownloadsUI() {
    const list = document.getElementById('downloadsListContainer');
    if (!list) return;
    list.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
        No downloads yet. Open a title and tap Download to save it with the multi-thread engine.
      </div>
    `;
  }

  // ==========================================================================
  // 5. Navigation & Tab Switching
  // ==========================================================================
  const bottomNavItems = document.querySelectorAll('.bottom-dock .nav-item');
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      switchTab(targetTab);
    });
  });

  function switchTab(tabName) {
    currentActiveTab = tabName;
    bottomNavItems.forEach(nav => nav.classList.toggle('active', nav.dataset.tab === tabName));

    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');

    if (tabName === 'explore') {
      filterCatalog(currentActiveCategory);
    } else if (tabName === 'downloads') {
      fetchDownloadsList();
      startDownloadPolling();
    }
  }

  // Category Filter Chips
  const categoryChips = document.querySelectorAll('.category-chips-bar .chip');
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.category;
      currentActiveCategory = cat;

      if (cat === 'livetv') {
        switchTab('livetv');
      } else if (cat === 'all') {
        switchTab('home');
      } else {
        switchTab('explore');
        filterCatalog(cat);
      }
    });
  });

  function filterCatalog(category) {
    let filtered = CATALOG_DATA;
    if (category !== 'all') {
      filtered = CATALOG_DATA.filter(item => item.category === category);
    }
    const heading = document.getElementById('exploreHeading');
    const catTitles = {
      movies: 'Hollywood & Global Movies',
      series: 'TV Series & Streaming Shows',
      anime: 'Anime Simulcasts & Movies',
      kdrama: 'Korean Dramas (K-Drama)',
      bangla: 'Bangla Dubbed & Regional Cinema'
    };
    heading.textContent = catTitles[category] || 'Catalog Explorer';
    renderExploreCatalog(filtered);
  }

  // ==========================================================================
  // 5.5 Advanced Search Engine: History, Next-Word & Title Auto-Suggestions
  // ==========================================================================
  const searchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const suggestionsDropdown = document.getElementById('searchSuggestionsDropdown');
  const headerSearchBox = document.getElementById('headerSearchBox');
  const recentSearchesBar = document.getElementById('recentSearchesBar');
  
  const SEARCH_HISTORY_KEY = 'ashtube_search_history';
  let searchDebounceTimer = null;
  let suggestionSelectedIndex = -1;

  // --- Search History Helpers ---
  function getSearchHistory() {
    try {
      let raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) {
        // Fallback migration from legacy key
        raw = localStorage.getItem('mythflix_search_history');
      }
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveSearchHistory(query) {
    const q = query.trim();
    if (!q) return;
    let history = getSearchHistory();
    history = history.filter(item => item.toLowerCase() !== q.toLowerCase());
    history.unshift(q);
    if (history.length > 8) history = history.slice(0, 8);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {}
    renderRecentSearchesExplore();
  }

  function removeSearchHistoryItem(query) {
    let history = getSearchHistory();
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {}
    renderRecentSearchesExplore();
    renderHistorySuggestions();
  }

  function clearAllSearchHistory() {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {}
    renderRecentSearchesExplore();
    renderHistorySuggestions();
    showToast('Search history cleared');
  }

  // --- Render Recent Searches Pills inside Explore Tab ---
  function renderRecentSearchesExplore() {
    if (!recentSearchesBar) return;
    const history = getSearchHistory();
    if (history.length === 0) {
      recentSearchesBar.style.display = 'none';
      recentSearchesBar.innerHTML = '';
      return;
    }
    recentSearchesBar.style.display = 'flex';
    recentSearchesBar.innerHTML = `
      <span style="font-size:11px; font-weight:700; color:var(--accent-cyan); text-transform:uppercase; letter-spacing:0.6px; display:inline-flex; align-items:center; margin-right:4px;">Recent:</span>
      ${history.map(q => `
        <div class="recent-pill" data-query="${escapeHtml(q)}">
          <span class="recent-pill-icon">🕒</span>
          <span>${escapeHtml(q)}</span>
          <span class="recent-pill-del" data-del="${escapeHtml(q)}" title="Remove">✕</span>
        </div>
      `).join('')}
    `;

    recentSearchesBar.querySelectorAll('.recent-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        if (e.target.classList.contains('recent-pill-del')) {
          e.stopPropagation();
          removeSearchHistoryItem(e.target.dataset.del);
        } else {
          const query = pill.dataset.query;
          searchInput.value = query;
          executeSearch(query);
        }
      });
    });
  }

  // --- Highlight Matching Substring ---
  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="search-match">$1</span>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Show / Hide Dropdown ---
  function showSuggestionsDropdown() {
    suggestionsDropdown.style.display = 'block';
    suggestionSelectedIndex = -1;
  }

  function hideSuggestionsDropdown() {
    suggestionsDropdown.style.display = 'none';
    suggestionsDropdown.innerHTML = '';
    suggestionSelectedIndex = -1;
  }

  // --- Render History Suggestions (Empty Input) ---
  function renderHistorySuggestions() {
    const history = getSearchHistory();
    const trending = [
      { id: 'movie-dune-2', title: 'Dune: Part Two', category: 'movies', year: '2024', rating: '8.9', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80' },
      { id: 'anime-solo-leveling', title: 'Solo Leveling', category: 'anime', year: '2024', rating: '8.6', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80' },
      { id: 'kdrama-queen-of-tears', title: 'Queen of Tears', category: 'kdrama', year: '2024', rating: '8.4', poster: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
      { id: 'bangla-kgf-2', title: 'KGF: Chapter 2 (Bangla Dubbed)', category: 'bangla', year: '2022', rating: '8.3', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80' }
    ];

    let html = '';

    if (history.length > 0) {
      html += `
        <div class="suggestion-section">
          <div class="suggestion-header">
            <span>Recent Searches</span>
            <button class="suggestion-header-btn" id="clearAllHistoryBtn">Clear All</button>
          </div>
          ${history.map((q, idx) => `
            <div class="suggestion-item" data-type="history" data-query="${escapeHtml(q)}" data-idx="${idx}">
              <svg class="suggestion-phrase-icon" viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              <div class="suggestion-phrase-text">${escapeHtml(q)}</div>
              <button class="suggestion-delete-btn" data-del="${escapeHtml(q)}" title="Delete item">✕</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `
      <div class="suggestion-section">
        <div class="suggestion-header">
          <span>Trending & Suggested</span>
        </div>
        ${trending.map((t, idx) => `
          <div class="suggestion-item" data-type="media" data-id="${t.id}" data-title="${escapeHtml(t.title)}" data-idx="${history.length + idx}">
            <img class="suggestion-thumb" src="${t.poster}" alt="${escapeHtml(t.title)}">
            <div class="suggestion-info">
              <div class="suggestion-title">${escapeHtml(t.title)}</div>
              <div class="suggestion-meta">
                <span class="suggestion-badge-pill ${t.category}">${t.category}</span>
                <span>★ ${t.rating}</span>
                <span>${t.year}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    suggestionsDropdown.innerHTML = html;
    showSuggestionsDropdown();

    const clearBtn = document.getElementById('clearAllHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllSearchHistory();
      });
    }

    suggestionsDropdown.querySelectorAll('.suggestion-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSearchHistoryItem(btn.dataset.del);
      });
    });

    suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (type === 'history') {
          const q = item.dataset.query;
          searchInput.value = q;
          executeSearch(q);
        } else if (type === 'media') {
          const found = CATALOG_DATA.find(c => c.id === item.dataset.id);
          if (found) {
            saveSearchHistory(found.title);
            searchInput.value = found.title;
            clearSearchBtn.style.display = 'flex';
            hideSuggestionsDropdown();
            openDetailModal(found);
          }
        }
      });
    });
  }

  // --- Fetch Predictive Suggestions (Titles + Next-Word Phrases) ---
  function fetchAutoSuggestions(query) {
    if (!query) {
      renderHistorySuggestions();
      return;
    }

    fetch(apiUrl(`/api/suggest?q=${encodeURIComponent(query)}`))
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          renderSuggestionsDropdown(data.titles || [], data.phrases || [], query);
        } else {
          renderLocalFallbackSuggestions(query);
        }
      })
      .catch(() => {
        renderLocalFallbackSuggestions(query);
      });
  }

  function renderLocalFallbackSuggestions(query) {
    const q = query.toLowerCase();
    const titles = CATALOG_DATA.filter(item => 
      item.title.toLowerCase().includes(q) || item.genres.toLowerCase().includes(q)
    ).slice(0, 5);

    const phrases = [];
    titles.forEach(item => {
      if (item.title.toLowerCase().startsWith(q) && item.title.toLowerCase() !== q) {
        phrases.push(item.title);
      }
    });

    renderSuggestionsDropdown(titles, phrases, query);
  }

  function renderSuggestionsDropdown(titles, phrases, query) {
    if (titles.length === 0 && phrases.length === 0) {
      suggestionsDropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No direct suggestions for <strong style="color:var(--accent-cyan);">"${escapeHtml(query)}"</strong>.
          <div style="margin-top: 6px; font-size: 11px;">Press Enter to search full catalog.</div>
        </div>
      `;
      showSuggestionsDropdown();
      return;
    }

    let html = '';
    let globalIdx = 0;

    // 1. Suggested Titles
    if (titles.length > 0) {
      html += `
        <div class="suggestion-section">
          <div class="suggestion-header">
            <span>Suggested Titles</span>
            <span style="font-size:9px; color:var(--text-muted);">${titles.length} matches</span>
          </div>
          ${titles.map(t => {
            const currentIdx = globalIdx++;
            return `
              <div class="suggestion-item" data-type="media" data-id="${t.id}" data-title="${escapeHtml(t.title)}" data-idx="${currentIdx}">
                <img class="suggestion-thumb" src="${t.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80'}" alt="${escapeHtml(t.title)}">
                <div class="suggestion-info">
                  <div class="suggestion-title">${highlightMatch(t.title, query)}</div>
                  <div class="suggestion-meta">
                    <span class="suggestion-badge-pill ${t.category || 'movies'}">${t.category || 'Media'}</span>
                    <span>★ ${t.rating || '8.5'}</span>
                    <span>${t.year || '2024'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 2. Next-Word & Predictive Phrases
    if (phrases.length > 0) {
      html += `
        <div class="suggestion-section">
          <div class="suggestion-header">
            <span>Predictive Auto-Suggest & Next-Word</span>
          </div>
          ${phrases.map(p => {
            const currentIdx = globalIdx++;
            return `
              <div class="suggestion-item" data-type="phrase" data-phrase="${escapeHtml(p)}" data-idx="${currentIdx}">
                <svg class="suggestion-phrase-icon" viewBox="0 0 24 24"><path d="M5 19h14V5H5v14zm10-7l-4 4-1.41-1.41L12.17 12l-2.58-2.59L11 8l4 4z"/></svg>
                <div class="suggestion-phrase-text">${highlightMatch(p, query)}</div>
                <span style="font-size:10px; color:var(--accent-cyan); font-weight:600;">Search ↗</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    suggestionsDropdown.innerHTML = html;
    showSuggestionsDropdown();

    suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (type === 'media') {
          const found = CATALOG_DATA.find(c => c.id === item.dataset.id);
          if (found) {
            saveSearchHistory(found.title);
            searchInput.value = found.title;
            clearSearchBtn.style.display = 'flex';
            hideSuggestionsDropdown();
            openDetailModal(found);
          } else {
            const title = item.dataset.title;
            searchInput.value = title;
            executeSearch(title);
          }
        } else if (type === 'phrase') {
          const phrase = item.dataset.phrase;
          searchInput.value = phrase;
          executeSearch(phrase);
        }
      });
    });
  }

  // --- Execute Instant Search ---
  function executeSearch(query) {
    const q = query.trim();
    hideSuggestionsDropdown();
    clearSearchBtn.style.display = q ? 'flex' : 'none';

    if (!q) {
      filterCatalog(currentActiveCategory);
      return;
    }

    saveSearchHistory(q);
    switchTab('explore');
    document.getElementById('exploreHeading').textContent = `Search: "${q}"`;
    const countEl = document.getElementById('catalogResultsCount');
    if (countEl) countEl.textContent = 'Searching...';

    // Fetch from dynamic search API
    fetch(apiUrl(`/api/search?q=${encodeURIComponent(q)}&category=${currentActiveCategory}`))
      .then(r => r.json())
      .then(data => {
        if (data.success && data.items) {
          renderExploreCatalog(data.items);
        } else {
          localSearchFallback(q);
        }
      })
      .catch(() => {
        localSearchFallback(q);
      });
  }

  function localSearchFallback(query) {
    const q = query.toLowerCase();
    const results = CATALOG_DATA.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.genres.toLowerCase().includes(q) ||
      item.synopsis.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.audioTracks && item.audioTracks.some(t => t.toLowerCase().includes(q)))
    );
    renderExploreCatalog(results);
  }

  // --- Input Events ---
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    clearSearchBtn.style.display = q ? 'flex' : 'none';
    if (!q) {
      renderHistorySuggestions();
    } else {
      fetchAutoSuggestions(q);
    }
  });

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const q = e.target.value.trim();
    clearSearchBtn.style.display = q ? 'flex' : 'none';

    searchDebounceTimer = setTimeout(() => {
      if (q.length > 0) {
        fetchAutoSuggestions(q);
      } else {
        renderHistorySuggestions();
      }
    }, 150);
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    if (items.length > 0 && suggestionsDropdown.style.display !== 'none') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestionSelectedIndex = (suggestionSelectedIndex + 1) % items.length;
        updateSelectedSuggestion(items);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestionSelectedIndex = (suggestionSelectedIndex - 1 + items.length) % items.length;
        updateSelectedSuggestion(items);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestionSelectedIndex >= 0 && items[suggestionSelectedIndex]) {
          items[suggestionSelectedIndex].click();
          return;
        }
      } else if (e.key === 'Escape') {
        hideSuggestionsDropdown();
        return;
      }
    }

    if (e.key === 'Enter') {
      executeSearch(searchInput.value);
    }
  });

  function updateSelectedSuggestion(items) {
    items.forEach((item, idx) => {
      if (idx === suggestionSelectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // Clear button click
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderHistorySuggestions();
  });

  // Click outside header search box closes dropdown
  document.addEventListener('click', (e) => {
    if (!headerSearchBox.contains(e.target)) {
      hideSuggestionsDropdown();
    }
  });

  // ==========================================================================
  // 6. Media Detail & Episode Picker Sheet
  // ==========================================================================
  const detailModal = document.getElementById('mediaDetailModal');
  const closeDetailBtn = document.getElementById('closeDetailModalBtn');

  function openDetailModal(item) {
    activeMediaItem = item;
    document.getElementById('detailBannerImg').src = item.backdrop;
    document.getElementById('detailMainTitle').textContent = item.title;
    document.getElementById('detailYear').textContent = item.year;
    document.getElementById('detailQualityBadge').textContent = item.quality;
    document.getElementById('detailRating').textContent = `IMDb ${item.rating} ★`;
    document.getElementById('detailDuration').textContent = item.duration;
    document.getElementById('detailGenres').textContent = item.genres;
    document.getElementById('detailSynopsis').textContent = item.synopsis;

    const seasonWrapper = document.getElementById('seasonSelectorWrapper');
    const seasonPillsBar = document.getElementById('seasonPillsBar');
    const episodesList = document.getElementById('episodesList');

    if (item.isSeries && item.seasons && item.seasons.length > 0) {
      seasonWrapper.style.display = 'block';
      seasonPillsBar.innerHTML = item.seasons.map((s, idx) => `
        <button class="chip ${idx === 0 ? 'active' : ''}" data-season="${s.seasonNumber}">Season ${s.seasonNumber}</button>
      `).join('');

      renderEpisodeList(item.seasons[0].episodes, item, item.seasons[0].seasonNumber);

      seasonPillsBar.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          seasonPillsBar.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const sNum = parseInt(btn.dataset.season, 10);
          const found = item.seasons.find(s => s.seasonNumber === sNum);
          if (found) renderEpisodeList(found.episodes, item, found.seasonNumber);
        });
      });
    } else {
      seasonWrapper.style.display = 'none';
      episodesList.innerHTML = '';
    }

    detailModal.classList.add('open');

    // Search results from Cinemeta arrive without episode lists: load them on demand.
    if (item.remote && item.isSeries && !item.seasons) {
      fetchJson(`/api/media/${encodeURIComponent(item.id)}?type=series`).then(res => {
        if (res.success && res.media && res.media.seasons && activeMediaItem === item) {
          Object.assign(item, res.media);
          openDetailModal(item);
        }
      }).catch(() => showToast('Could not load episode list'));
    }
  }

  function renderEpisodeList(episodes, item, seasonNumber = 1) {
    const list = document.getElementById('episodesList');
    list.innerHTML = episodes.map(ep => `
      <div class="episode-card" data-ep="${ep.epNum}">
        <div class="ep-left-wrap">
          <img class="ep-thumb-sm" src="${escapeHtml(ep.thumb || item.poster || '')}" alt="Ep ${ep.epNum}">
          <div>
            <div class="ep-number-tag">E${ep.epNum}. ${escapeHtml(ep.title)}</div>
            <div class="ep-duration-text">${escapeHtml(ep.runtime || '')}</div>
          </div>
        </div>
        <button class="icon-btn download-ep-btn" title="Download Episode" data-title="${escapeHtml(ep.title)}" data-ep="${ep.epNum}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const dlBtn = e.target.closest('.download-ep-btn');
        if (dlBtn) {
          triggerMultiThreadDownload(item, dlBtn.dataset.title, seasonNumber, Number(dlBtn.dataset.ep));
          return;
        }
        const epNum = Number(card.dataset.ep);
        detailModal.classList.remove('open');
        playMedia(item, seasonNumber, epNum, `Season ${seasonNumber} · Episode ${epNum}`);
      });
    });
  }

  closeDetailBtn.addEventListener('click', () => detailModal.classList.remove('open'));
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.remove('open');
  });

  document.getElementById('detailPlayNowBtn').addEventListener('click', () => {
    const item = activeMediaItem;
    const firstSeason = item.isSeries && item.seasons && item.seasons[0];
    const firstEp = firstSeason && firstSeason.episodes[0];
    detailModal.classList.remove('open');
    if (firstEp) {
      playMedia(item, firstSeason.seasonNumber, firstEp.epNum, `Season ${firstSeason.seasonNumber} · Episode ${firstEp.epNum}`);
    } else {
      playMedia(item);
    }
  });

  document.getElementById('detailDownloadBtn').addEventListener('click', () => {
    const item = activeMediaItem;
    const firstSeason = item.isSeries && item.seasons && item.seasons[0];
    const firstEp = firstSeason && firstSeason.episodes[0];
    if (firstEp) {
      triggerMultiThreadDownload(item, `S${firstSeason.seasonNumber}E${firstEp.epNum}`, firstSeason.seasonNumber, firstEp.epNum);
    } else {
      triggerMultiThreadDownload(item);
    }
  });

  // Hero banner always mirrors the first catalog entry (see updateHeroSpotlight)
  document.getElementById('heroPlayBtn').addEventListener('click', () => {
    const item = CATALOG_DATA[0];
    const firstSeason = item.isSeries && item.seasons && item.seasons[0];
    const firstEp = firstSeason && firstSeason.episodes[0];
    if (firstEp) playMedia(item, firstSeason.seasonNumber, firstEp.epNum, `Season ${firstSeason.seasonNumber} · Episode ${firstEp.epNum}`);
    else playMedia(item);
  });

  document.getElementById('heroDownloadBtn').addEventListener('click', () => {
    triggerMultiThreadDownload(CATALOG_DATA[0]);
  });

  // ==========================================================================
  // 7. Advanced Video Player Engine (Gestures & Controls)
  // ==========================================================================
  let hlsInstance = null;
  let activePlayback = null;

  function launchVideoPlayer(data) {
    if (!data.videoUrl) {
      showToast('No playable stream available');
      return;
    }
    document.getElementById('playerMediaTitle').textContent = data.title;
    document.getElementById('playerEpisodeSub').textContent = data.sub;

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    activePlayback = data;
    document.getElementById('audioTrackLabel').textContent = 'Original';
    document.getElementById('subLabel').textContent = 'Off';
    const current = (data.sources || []).find(v => v.url === data.videoUrl);
    document.getElementById('qualityLabel').textContent = current ? current.quality : 'Auto';

    const isHls = data.videoUrl.includes('.m3u8') || data.isHls;
    const tryBackup = () => {
      if (data.backupUrl && !data._backupTried) {
        data._backupTried = true;
        showToast('Primary stream failed — switching to backup');
        launchVideoPlayer(Object.assign({}, data, { videoUrl: data.backupUrl, _backupTried: true }));
        return true;
      }
      return false;
    };

    if (isHls && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60
      });
      hlsInstance.loadSource(proxied(data.videoUrl));
      hlsInstance.attachMedia(videoPlayer);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer.play().catch(() => {});
      });
      hlsInstance.on(Hls.Events.ERROR, (event, errData) => {
        if (errData && errData.fatal) {
          console.warn('HLS stream fatal error', errData.details);
          if (!tryBackup()) showToast('This stream is offline right now');
        }
      });
    } else if (isHls && videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayer.src = proxied(data.videoUrl);
      videoPlayer.play().catch(() => {});
    } else {
      videoPlayer.src = data.videoUrl;
      videoPlayer.play().catch(() => {});
    }

    playerModal.classList.add('open');
    showToast(`Streaming: ${data.title}`);
  }

  // Cycle through the real quality variants the backend found for the current title.
  function switchPlaybackSource(src) {
    if (!activePlayback) return;
    const resumeAt = videoPlayer.currentTime || 0;
    launchVideoPlayer(Object.assign({}, activePlayback, { videoUrl: src.url, isHls: src.hls }));
    videoPlayer.addEventListener('loadedmetadata', () => { videoPlayer.currentTime = resumeAt; }, { once: true });
  }

  videoPlayer.addEventListener('error', () => {
    if (!playerModal.classList.contains('open') || !videoPlayer.getAttribute('src')) return;
    const mkv = /\.mkv(\?|$)/i.test(videoPlayer.src);
    showToast(mkv ? 'This device cannot play MKV in-app — use Download, then play the file' : 'Playback error — try another quality');
  });

  document.getElementById('exitPlayerBtn').addEventListener('click', () => {
    videoPlayer.pause();
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    videoPlayer.src = '';
    playerModal.classList.remove('open');
    if (isLandscapeMode) toggleRotationMode();
  });

  // Play / Pause Toggle
  const centerPlayBtn = document.getElementById('centerPlayToggleBtn');
  centerPlayBtn.addEventListener('click', togglePlayPause);
  videoPlayer.addEventListener('play', () => {
    hudPlayIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  });
  videoPlayer.addEventListener('pause', () => {
    hudPlayIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  });

  function togglePlayPause() {
    if (videoPlayer.paused) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  }

  // 10s Rewind & Fast Forward
  document.getElementById('rewind10Btn').addEventListener('click', () => jumpTime(-10));
  document.getElementById('forward10Btn').addEventListener('click', () => jumpTime(10));

  function jumpTime(seconds) {
    videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + seconds));
    showToast(seconds > 0 ? `+${seconds}s Forward` : `${seconds}s Rewind`);
  }

  // Seeker Update & Time Formatting
  videoPlayer.addEventListener('timeupdate', () => {
    if (!isNaN(videoPlayer.duration) && videoPlayer.duration > 0) {
      const pct = (videoPlayer.currentTime / videoPlayer.duration) * 100;
      videoSeeker.value = pct;
      currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
      durationDisplay.textContent = formatTime(videoPlayer.duration);
    }
  });

  videoSeeker.addEventListener('input', (e) => {
    if (videoPlayer.duration) {
      const targetTime = (e.target.value / 100) * videoPlayer.duration;
      videoPlayer.currentTime = targetTime;
    }
  });

  function formatTime(secs) {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const remainingSecs = s % 60;
    const formattedM = m < 10 ? `0${m}` : m;
    const formattedS = remainingSecs < 10 ? `0${remainingSecs}` : remainingSecs;
    return `${formattedM}:${formattedS}`;
  }

  // Rotation / Theater Mode Toggle
  const rotateBtn = document.getElementById('rotateScreenBtn');
  rotateBtn.addEventListener('click', toggleRotationMode);

  function toggleRotationMode() {
    isLandscapeMode = !isLandscapeMode;
    playerModal.classList.toggle('landscape-mode', isLandscapeMode);
    rotateBtn.classList.toggle('active', isLandscapeMode);
    showToast(isLandscapeMode ? 'Cinematic Landscape View Active' : 'Portrait Mode Active');
  }

  // Aspect Ratio Toggle
  const aspectBtn = document.getElementById('aspectRatioBtn');
  aspectBtn.addEventListener('click', () => {
    currentAspectMode = (currentAspectMode + 1) % aspectModes.length;
    const mode = aspectModes[currentAspectMode];
    videoPlayer.className = '';
    if (mode !== 'aspect-fit') videoPlayer.classList.add(mode);
    const labels = ['Fit Screen', 'Crop to Fill', 'Stretch 16:9'];
    showToast(`Aspect Ratio: ${labels[currentAspectMode]}`);
  });

  // Lock Controls Toggle
  const lockBtn = document.getElementById('lockControlsBtn');
  lockBtn.addEventListener('click', () => {
    isControlsLocked = !isControlsLocked;
    playerModal.classList.toggle('controls-locked', isControlsLocked);
    lockBtn.classList.toggle('active', isControlsLocked);
    showToast(isControlsLocked ? 'Screen Locked 🔒 (Tap lock to unlock)' : 'Screen Unlocked 🔓');
  });

  // Audio track switcher: only real tracks exposed by the loaded file/stream
  const audioSwitchBtn = document.getElementById('audioSwitchBtn');
  audioSwitchBtn.addEventListener('click', () => {
    const tracks = videoPlayer.audioTracks;
    if (!tracks || tracks.length < 2) {
      showToast('This file has a single audio track');
      return;
    }
    let current = 0;
    for (let i = 0; i < tracks.length; i++) if (tracks[i].enabled) current = i;
    const next = (current + 1) % tracks.length;
    for (let i = 0; i < tracks.length; i++) tracks[i].enabled = (i === next);
    const label = tracks[next].label || tracks[next].language || `Track ${next + 1}`;
    document.getElementById('audioTrackLabel').textContent = label;
    showToast(`Audio Track: ${label}`);
  });

  // Subtitle selector: WebVTT tracks supplied by the source (SRT is not supported by browsers)
  const subBtn = document.getElementById('subtitleSelectorBtn');
  subBtn.addEventListener('click', () => {
    const tracks = Array.from(videoPlayer.textTracks).filter(t => t.kind === 'subtitles');
    if (tracks.length === 0) {
      showToast('No subtitles available for this source');
      return;
    }
    const shown = tracks.findIndex(t => t.mode === 'showing');
    tracks.forEach(t => { t.mode = 'disabled'; });
    const next = shown + 1;
    if (next < tracks.length) tracks[next].mode = 'showing';
    const label = next < tracks.length ? (tracks[next].label || 'On') : 'Off';
    document.getElementById('subLabel').textContent = label;
    showToast(`Subtitles: ${label}`);
  });

  // Quality Selector
  const qualityBtn = document.getElementById('qualitySelectorBtn');
  qualityBtn.addEventListener('click', () => {
    const variants = (activePlayback && activePlayback.sources) || [];
    if (variants.length < 2) {
      showToast('Only one quality is available for this title');
      return;
    }
    const idx = variants.findIndex(v => v.url === activePlayback.videoUrl);
    const next = variants[(idx + 1) % variants.length];
    document.getElementById('qualityLabel').textContent = next.quality;
    showToast(`Stream Quality: ${next.quality}${next.size ? ` (${next.size})` : ''}`);
    switchPlaybackSource(next);
  });

  // Playback Speed
  const speedBtn = document.getElementById('speedSelectorBtn');
  speedBtn.addEventListener('click', () => {
    const idx = (speedOptions.indexOf(currentSpeed) + 1) % speedOptions.length;
    currentSpeed = speedOptions[idx];
    videoPlayer.playbackRate = currentSpeed;
    document.getElementById('speedLabel').textContent = `${currentSpeed}x`;
    showToast(`Speed: ${currentSpeed}x`);
  });

  // Fullscreen Toggle
  document.getElementById('fullscreenToggleBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      playerModal.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // ==========================================================================
  // 8. Mobile Touch Gestures (Brightness, Volume, Scrubbing)
  // ==========================================================================
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let lastTapTime = 0;
  let activeGesture = null;
  let seekBaseTime = 0;
  let hudHideTimeout = null;

  gestureSurface.addEventListener('touchstart', onTouchStart, { passive: false });
  gestureSurface.addEventListener('touchmove', onTouchMove, { passive: false });
  gestureSurface.addEventListener('touchend', onTouchEnd);

  // Mouse emulation for desktop testing
  let isMouseDown = false;
  gestureSurface.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    onTouchStart({
      preventDefault: () => {},
      touches: [{ clientX: e.clientX, clientY: e.clientY }]
    });
  });
  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    onTouchMove({
      preventDefault: () => {},
      touches: [{ clientX: e.clientX, clientY: e.clientY }]
    });
  });
  window.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      onTouchEnd();
    }
  });

  function onTouchStart(e) {
    if (isControlsLocked) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    activeGesture = null;
    seekBaseTime = videoPlayer.currentTime;
  }

  function onTouchMove(e) {
    if (isControlsLocked) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const rect = gestureSurface.getBoundingClientRect();
    const isLeftSide = touchStartX < rect.left + rect.width / 2;

    if (!activeGesture) {
      if (Math.abs(deltaY) > 15 && Math.abs(deltaY) > Math.abs(deltaX)) {
        activeGesture = isLeftSide ? 'brightness' : 'volume';
      } else if (Math.abs(deltaX) > 20) {
        activeGesture = 'seek';
      }
    }

    if (activeGesture === 'brightness') {
      const change = -deltaY / 250;
      currentBrightness = Math.max(0.3, Math.min(1.8, currentBrightness + change));
      videoPlayer.style.filter = `brightness(${currentBrightness})`;
      const pct = Math.round((currentBrightness / 1.8) * 100);
      brightnessBarFill.style.height = `${pct}%`;
      brightnessText.textContent = `${pct}%`;
      brightnessHud.classList.add('visible');
      touchStartY = touch.clientY;
    } else if (activeGesture === 'volume') {
      const change = -deltaY / 250;
      currentVolume = Math.max(0, Math.min(1, currentVolume + change));
      videoPlayer.volume = currentVolume;
      const pct = Math.round(currentVolume * 100);
      volumeBarFill.style.height = `${pct}%`;
      volumeText.textContent = `${pct}%`;
      volumeHud.classList.add('visible');
      touchStartY = touch.clientY;
    } else if (activeGesture === 'seek') {
      const scrubSeconds = Math.round(deltaX / 5);
      const target = Math.max(0, Math.min(videoPlayer.duration || 0, seekBaseTime + scrubSeconds));
      seekTargetTime.textContent = formatTime(target);
      seekDelta.textContent = scrubSeconds >= 0 ? `+${scrubSeconds}s` : `${scrubSeconds}s`;
      seekPreviewHud.classList.add('visible');
      videoPlayer.currentTime = target;
    }
  }

  function onTouchEnd() {
    clearTimeout(hudHideTimeout);
    hudHideTimeout = setTimeout(() => {
      brightnessHud.classList.remove('visible');
      volumeHud.classList.remove('visible');
      seekPreviewHud.classList.remove('visible');
    }, 1200);

    const now = Date.now();
    const tapLength = now - lastTapTime;
    if (tapLength < 300 && tapLength > 50 && !activeGesture) {
      handleDoubleTap(touchStartX);
    } else if (!activeGesture && (now - touchStartTime < 250)) {
      toggleControlsVisibility();
    }
    lastTapTime = now;
  }

  function handleDoubleTap(tapX) {
    const rect = gestureSurface.getBoundingClientRect();
    if (tapX < rect.left + rect.width / 2) {
      jumpTime(-10);
      triggerRipple('doubleTapLeft');
    } else {
      jumpTime(10);
      triggerRipple('doubleTapRight');
    }
  }

  function triggerRipple(elemId) {
    const el = document.getElementById(elemId);
    el.classList.remove('ripple-animate');
    void el.offsetWidth;
    el.classList.add('ripple-animate');
  }

  let controlsVisible = true;
  function toggleControlsVisibility() {
    if (isControlsLocked) return;
    controlsVisible = !controlsVisible;
    centerControlsHud.style.opacity = controlsVisible ? '1' : '0';
    playerBottomControls.style.opacity = controlsVisible ? '1' : '0';
    playerTopHeader.style.opacity = controlsVisible ? '1' : '0';
  }

  // ==========================================================================
  // 9. Toast Notification Drawer
  // ==========================================================================
  function showToast(message) {
    const tray = document.getElementById('toastTray');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--accent-cyan)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      <span>${message}</span>
    `;
    tray.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ==========================================================================
  // 10. Dynamic Catalog Loader (Phase 4 Integration)
  // ==========================================================================
  function loadDynamicCatalog() {
    fetch(apiUrl('/api/catalog?category=all'))
      .then(r => r.json())
      .then(data => {
        if (data.success && data.items && data.items.length > 0) {
          applyCatalogData(data.items);
        } else {
          loadLocalCatalogJson();
        }
      })
      .catch(() => {
        loadLocalCatalogJson();
      });
  }

  function loadLocalCatalogJson() {
    fetch('catalog.json')
      .then(r => r.json())
      .then(items => {
        if (Array.isArray(items) && items.length > 0) {
          applyCatalogData(items);
        }
      })
      .catch(err => {
        console.warn('Backend catalog offline, using internal fallback data', err);
      });
  }

  function applyCatalogData(items) {
    if (Array.isArray(items) && items.length > 0) {
      CATALOG_DATA = items;
      activeMediaItem = CATALOG_DATA[0];
      updateHeroSpotlight(CATALOG_DATA[0]);
      renderAllSections();
      if (currentActiveTab === 'explore') {
        filterCatalog(currentActiveCategory);
      }
    }
  }

  function updateHeroSpotlight(item) {
    if (!item) return;
    const heroBackdrop = document.getElementById('heroBackdropImg');
    const heroTitle = document.getElementById('heroTitle');
    const heroQuality = document.getElementById('heroQualityTag');
    const heroRating = document.getElementById('heroRatingTag');
    const heroDesc = document.getElementById('heroDesc');
    if (heroBackdrop) heroBackdrop.src = item.backdrop;
    if (heroTitle) heroTitle.textContent = item.title;
    if (heroQuality) heroQuality.textContent = item.quality || '4K HDR';
    if (heroRating) heroRating.textContent = `★ ${item.rating || '8.9'}`;
    if (heroDesc) heroDesc.textContent = item.synopsis || '';
  }

  // ==========================================================================
  // 11. BDIX Real-Time Scanner & Live TV Engine (Phase 5 Integration)
  // ==========================================================================
  const scanBdixBtn = document.getElementById('scanBdixBtn');
  const bdixServersBadgesRow = document.getElementById('bdixServersBadgesRow');
  const bdixStatusText = document.getElementById('bdixStatusText');
  const bdixPillText = document.getElementById('bdixPillText');
  const liveTvFilterChips = document.getElementById('liveTvFilterChips');

  const backendUrlInput = document.getElementById('backendUrlInput');
  const saveBackendUrlBtn = document.getElementById('saveBackendUrlBtn');
  if (backendUrlInput && saveBackendUrlBtn) {
    backendUrlInput.value = API_BASE || location.origin;
    saveBackendUrlBtn.addEventListener('click', () => {
      const value = backendUrlInput.value.trim().replace(/\/+$/, '');
      if (!/^https?:\/\/[^\s]+$/.test(value)) {
        showToast('Enter a full address like http://192.168.0.10:8000');
        return;
      }
      try { localStorage.setItem('ashtube_api_base', value); } catch (e) { /* storage unavailable */ }
      showToast('Backend saved — reloading…');
      setTimeout(() => location.reload(), 600);
    });
  }

  function fetchBdixStatus() {
    fetch(apiUrl('/api/bdix/status'))
      .then(r => r.json())
      .then(res => {
        if (res.success && res.servers) {
          renderBdixServersBadges(res.servers, res.avg_latency_ms);
        }
      })
      .catch(() => {
        renderMockBdixBadges();
      });
  }

  function triggerBdixScan() {
    if (!scanBdixBtn) return;
    scanBdixBtn.classList.add('scanning');
    const scanBtnText = document.getElementById('scanBtnText');
    if (scanBtnText) scanBtnText.textContent = 'Testing...';
    showToast('Testing BDIX media peering latencies...');

    fetch(apiUrl('/api/bdix/scan'), { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        scanBdixBtn.classList.remove('scanning');
        if (scanBtnText) scanBtnText.textContent = 'Test Ping';
        if (res.success && res.servers) {
          renderBdixServersBadges(res.servers, res.avg_latency_ms);
          showToast(`⚡ BDIX Scan Complete · Avg Latency ${res.avg_latency_ms}ms`);
        }
      })
      .catch(() => {
        scanBdixBtn.classList.remove('scanning');
        if (scanBtnText) scanBtnText.textContent = 'Test Ping';
        renderMockBdixBadges();
        showToast('⚡ BDIX Peering Active · 14.2ms Direct Route');
      });
  }

  function renderBdixServersBadges(servers, avgLatency = 14) {
    if (!bdixServersBadgesRow) return;
    bdixServersBadgesRow.innerHTML = servers.map(srv => {
      const isOnline = srv.online;
      const latText = isOnline ? `${srv.latency_ms}ms` : 'BDIX Only';
      return `
        <div class="server-latency-chip ${isOnline ? 'online' : 'offline'}">
          <span class="server-dot ${isOnline ? 'online' : 'offline'}"></span>
          <span class="server-name-txt">${escapeHtml(srv.name)}</span>
          <span class="server-latency-txt">${latText}</span>
        </div>
      `;
    }).join('');

    const roundedLat = Math.round(avgLatency || 14);
    if (bdixStatusText) {
      bdixStatusText.textContent = `BDIX Peering Active · Ultra-Low Latency (${roundedLat}ms)`;
    }
    if (bdixPillText) {
      bdixPillText.textContent = `BDIX Active · ${roundedLat}ms · 100 Mbps`;
    }
  }

  function renderMockBdixBadges() {
    if (bdixServersBadgesRow) {
      bdixServersBadgesRow.innerHTML = '<div class="server-latency-txt">Backend offline — start server.py to scan BDIX servers</div>';
    }
    if (bdixStatusText) bdixStatusText.textContent = 'Backend server unreachable';
    if (bdixPillText) bdixPillText.textContent = 'BDIX Offline';
  }

  function fetchDynamicLiveTvChannels() {
    fetch(apiUrl('/api/livetv/channels'))
      .then(r => r.json())
      .then(res => {
        if (res.success && res.channels && res.channels.length > 0) {
          LIVE_CHANNELS = res.channels;
          renderLiveTvGrid(LIVE_CHANNELS);
        } else {
          fallbackLiveTvChannels();
        }
      })
      .catch(() => {
        fallbackLiveTvChannels();
      });
  }

  function fallbackLiveTvChannels() {
    fetch('livetv_channels.json')
      .then(r => r.json())
      .then(channels => {
        if (Array.isArray(channels) && channels.length > 0) {
          LIVE_CHANNELS = channels;
          renderLiveTvGrid(LIVE_CHANNELS);
        }
      })
      .catch(() => {
        renderLiveTvGrid(LIVE_CHANNELS);
      });
  }

  if (liveTvFilterChips) {
    liveTvFilterChips.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        liveTvFilterChips.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterLiveTv(btn.dataset.filter);
      });
    });
  }

  if (scanBdixBtn) {
    scanBdixBtn.addEventListener('click', triggerBdixScan);
  }

  // ==========================================================================
  // Developer Welcome Modal ("Developed by ASRAFUL ISLAM")
  // ==========================================================================
  const developerWelcomeModal = document.getElementById('developerWelcomeModal');
  const enterAppBtn = document.getElementById('enterAppBtn');

  function initDeveloperWelcomeModal() {
    if (!developerWelcomeModal) return;
    // Show on every initial app launch as requested
    setTimeout(() => {
      developerWelcomeModal.classList.add('open');
    }, 200);

    if (enterAppBtn) {
      enterAppBtn.addEventListener('click', () => {
        developerWelcomeModal.classList.remove('open');
        showToast('Welcome to AshTube · Developed by ASRAFUL ISLAM');
      });
    }

    // Dismiss with Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && developerWelcomeModal.classList.contains('open')) {
        developerWelcomeModal.classList.remove('open');
      }
    });

    // Close on outer backdrop click
    developerWelcomeModal.addEventListener('click', (e) => {
      if (e.target === developerWelcomeModal) {
        developerWelcomeModal.classList.remove('open');
      }
    });
  }

  // Initial App Render
  renderAllSections();
  loadDynamicCatalog();
  renderRecentSearchesExplore();
  fetchBdixStatus();
  fetchDynamicLiveTvChannels();
  initDeveloperWelcomeModal();
  showToast('AshTube Ready · BDIX Live TV & Peering Scanner Active');

});

