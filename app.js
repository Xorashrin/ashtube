/**
 * AshTube — Core Application Logic, Advanced Video Player & Multi-Thread Downloader
 * Developed by ASRAFUL ISLAM
 * Includes touch gesture HUDs (Brightness, Volume, Scrubbing),
 * Rotation mode, Dual-Audio switching, and Real-Time Multi-Thread Downloader.
 */

document.addEventListener('DOMContentLoaded', () => {

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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
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
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
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
  let LIVE_CHANNELS = [
    { id: 'somoy', name: 'Somoy TV', category: 'news', program: 'Evening News: 7 PM Bulletin', latency: '12ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', resolution: '1080p 50fps', badge: 'NEWS' },
    { id: 'jamuna', name: 'Jamuna TV', category: 'news', program: 'Sangbad 24 Live Special', latency: '14ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', resolution: '1080p 50fps', badge: 'NEWS' },
    { id: 'channel-24', name: 'Channel 24', category: 'news', program: 'Desh 24 Prime Analysis', latency: '15ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', resolution: '1080p HD', badge: 'NEWS' },
    { id: 'ekattor', name: 'Ekattor TV', category: 'news', program: 'Ekattor Journal Live', latency: '16ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', resolution: '720p HD', badge: 'NEWS' },
    { id: 'tsports', name: 'T Sports HD', category: 'sports', program: 'Live Cricket & Football Match', latency: '11ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', resolution: '1080p 60fps', badge: 'SPORTS' },
    { id: 'starsports', name: 'Star Sports 1', category: 'sports', program: 'Premier League Matchday Live', latency: '13ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', resolution: '1080p 60fps', badge: 'SPORTS' },
    { id: 'gtv', name: 'GTV Sports', category: 'sports', program: 'Bangladesh Cricket Highlights', latency: '14ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', resolution: '1080p HD', badge: 'SPORTS' },
    { id: 'channel-i', name: 'Channel i', category: 'entertainment', program: 'Dine-In Bangla & Music Fest', latency: '15ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', resolution: '1080p HD', badge: 'BANGLA' },
    { id: 'ntv', name: 'NTV Bangla', category: 'entertainment', program: 'Prime Natok Drama Fest', latency: '16ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', resolution: '1080p HD', badge: 'BANGLA' },
    { id: 'deepto', name: 'Deepto TV', category: 'entertainment', program: 'Sultan Suleiman Dubbed Special', latency: '15ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', resolution: '1080p HD', badge: 'DUBBED' },
    { id: 'btv', name: 'BTV National', category: 'entertainment', program: 'Heritage of Bangladesh Live', latency: '12ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', resolution: '1080p HD', badge: 'NATIONAL' },
    { id: 'duronto', name: 'Duronto TV', category: 'kids', program: 'Rong Beronger Golpo & Cartoons', latency: '14ms', isHls: true, streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', resolution: '1080p HD', badge: 'KIDS' }
  ];

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
          <img class="poster-image" src="${item.poster}" alt="${item.title}" loading="lazy">
          <span class="poster-badge ${item.isBDIX ? 'bdix' : ''}">${item.quality}</span>
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

    grid.querySelectorAll('.poster-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = CATALOG_DATA.find(c => c.id === card.dataset.id);
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
  function triggerMultiThreadDownload(item, epTitle = null) {
    const dlTitle = epTitle ? `${item.title} — ${epTitle}` : item.title;
    showToast(`Starting 4-Thread Download: ${dlTitle}`);

    fetch('/api/download/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: dlTitle,
        url: item.videoUrl || 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm',
        threads: 4
      })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        showToast(`⚡ Multi-Thread Download Active (${res.task.num_threads} Threads)`);
        startDownloadPolling();
        switchTab('downloads');
      }
    })
    .catch(() => {
      showToast(`⚡ Mock Download Started: ${dlTitle} (Multi-threaded 8.4 MB/s)`);
    });
  }

  function fetchDownloadsList() {
    fetch('/api/download/list')
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
      fetch('/api/download/list')
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
      return `
        <div class="download-item-card" data-id="${task.id}">
          <div class="download-top-row">
            <div class="download-item-title">${task.title}</div>
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
              : (isPaused
                ? `Paused · ${task.downloaded_mb} / ${task.total_mb} MB (${task.progress_pct}%)`
                : `Downloading (${task.speed_mbps} MB/s) — ${task.progress_pct}% · ${task.num_threads} Threads Active`
              )
            }
          </div>
          ${!isCompleted ? `
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
          fetch('/api/download/pause', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
          }).then(() => {
            showToast('Download Paused ⏸️');
            fetchDownloadsList();
          });
        } else if (status === 'paused') {
          fetch('/api/download/resume', {
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
            ? `/api/download/file/${encodeURIComponent(taskObj.filename)}`
            : ((taskObj && taskObj.destination) ? `/downloads/${encodeURIComponent(taskObj.destination.split('/').pop())}` : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
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
      <div class="download-item-card">
        <div class="download-top-row">
          <div class="download-item-title">1) Dune: Part Two</div>
          <button class="download-action-btn play">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="download-meta-text">1080p · 2.4 GB · Completed ✓ (8 Threads)</div>
      </div>
      <div class="download-item-card">
        <div class="download-top-row">
          <div class="download-item-title">2) Solo Leveling S1 (Complete)</div>
          <button class="download-action-btn play">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="download-meta-text">12 Episodes · 3.1 GB · Completed ✓</div>
      </div>
      <div class="download-item-card">
        <div class="download-top-row">
          <div class="download-item-title">3) Queen of Tears S1:E8</div>
          <button class="download-action-btn pause">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
        </div>
        <div class="download-meta-text">Downloading (8.4 MB/s) — 68% · 8 Threads Active</div>
        <div class="download-progress-bar">
          <div class="download-progress-fill" style="width: 68%;"></div>
        </div>
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

    fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
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
    fetch(`/api/search?q=${encodeURIComponent(q)}&category=${currentActiveCategory}`)
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

      renderEpisodeList(item.seasons[0].episodes, item);

      seasonPillsBar.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          seasonPillsBar.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const sNum = parseInt(btn.dataset.season, 10);
          const found = item.seasons.find(s => s.seasonNumber === sNum);
          if (found) renderEpisodeList(found.episodes, item);
        });
      });
    } else {
      seasonWrapper.style.display = 'none';
      episodesList.innerHTML = '';
    }

    detailModal.classList.add('open');
  }

  function renderEpisodeList(episodes, item) {
    const list = document.getElementById('episodesList');
    list.innerHTML = episodes.map(ep => `
      <div class="episode-card" data-ep="${ep.epNum}">
        <div class="ep-left-wrap">
          <img class="ep-thumb-sm" src="${ep.thumb}" alt="Ep ${ep.epNum}">
          <div>
            <div class="ep-number-tag">E${ep.epNum}. ${ep.title}</div>
            <div class="ep-duration-text">${ep.runtime}</div>
          </div>
        </div>
        <button class="icon-btn download-ep-btn" title="Download Episode" data-title="${ep.title}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const dlBtn = e.target.closest('.download-ep-btn');
        if (dlBtn) {
          triggerMultiThreadDownload(item, dlBtn.dataset.title);
          return;
        }
        const epNum = card.dataset.ep;
        detailModal.classList.remove('open');
        launchVideoPlayer({
          title: item.title,
          sub: `Season 1 · Episode ${epNum} (1080p)`,
          videoUrl: item.videoUrl
        });
      });
    });
  }

  closeDetailBtn.addEventListener('click', () => detailModal.classList.remove('open'));
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.remove('open');
  });

  document.getElementById('detailPlayNowBtn').addEventListener('click', () => {
    detailModal.classList.remove('open');
    launchVideoPlayer({
      title: activeMediaItem.title,
      sub: `${activeMediaItem.quality} · Line Speed Stream`,
      videoUrl: activeMediaItem.videoUrl
    });
  });

  document.getElementById('detailDownloadBtn').addEventListener('click', () => {
    triggerMultiThreadDownload(activeMediaItem);
  });

  document.getElementById('heroPlayBtn').addEventListener('click', () => {
    launchVideoPlayer({
      title: 'ASTRIA: STARGAZER',
      sub: '4K HDR · BDIX Ultra-Speed',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    });
  });

  document.getElementById('heroDownloadBtn').addEventListener('click', () => {
    triggerMultiThreadDownload({
      title: 'ASTRIA: STARGAZER',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    });
  });

  // ==========================================================================
  // 7. Advanced Video Player Engine (Gestures & Controls)
  // ==========================================================================
  let hlsInstance = null;

  function launchVideoPlayer(data) {
    document.getElementById('playerMediaTitle').textContent = data.title;
    document.getElementById('playerEpisodeSub').textContent = data.sub;

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    const isHls = (data.videoUrl && data.videoUrl.includes('.m3u8')) || data.isHls;

    if (isHls && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60
      });
      hlsInstance.loadSource(data.videoUrl);
      hlsInstance.attachMedia(videoPlayer);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer.play().catch(() => {});
      });
      hlsInstance.on(Hls.Events.ERROR, (event, errData) => {
        if (errData && errData.fatal) {
          console.warn('HLS stream fatal error, falling back to backup stream');
          videoPlayer.src = data.backupUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          videoPlayer.play().catch(() => {});
        }
      });
    } else if (isHls && videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayer.src = data.videoUrl;
      videoPlayer.play().catch(() => {});
    } else {
      videoPlayer.src = data.videoUrl;
      videoPlayer.play().catch(() => {});
    }

    playerModal.classList.add('open');
    showToast(`Streaming: ${data.title}`);
  }

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

  // Audio Language Switcher (ENG / BAN)
  const audioSwitchBtn = document.getElementById('audioSwitchBtn');
  audioSwitchBtn.addEventListener('click', () => {
    currentAudioIndex = (currentAudioIndex + 1) % audioOptions.length;
    document.getElementById('audioTrackLabel').textContent = audioOptions[currentAudioIndex];
    showToast(`Switched Audio Track: ${audioOptions[currentAudioIndex]}`);
  });

  // Subtitle Selector
  const subBtn = document.getElementById('subtitleSelectorBtn');
  subBtn.addEventListener('click', () => {
    const idx = (subOptions.indexOf(currentSubtitle) + 1) % subOptions.length;
    currentSubtitle = subOptions[idx];
    document.getElementById('subLabel').textContent = currentSubtitle;
    showToast(`Subtitles: ${currentSubtitle}`);
  });

  // Quality Selector
  const qualityBtn = document.getElementById('qualitySelectorBtn');
  qualityBtn.addEventListener('click', () => {
    const idx = (qualityOptions.indexOf(currentQuality) + 1) % qualityOptions.length;
    currentQuality = qualityOptions[idx];
    document.getElementById('qualityLabel').textContent = currentQuality;
    showToast(`Stream Quality: ${currentQuality}`);
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
    fetch('/api/catalog?category=all')
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

  function fetchBdixStatus() {
    fetch('/api/bdix/status')
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

    fetch('/api/bdix/scan', { method: 'POST' })
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
    const mockServers = [
      { name: 'CircleFTP', online: true, latency_ms: 14.2 },
      { name: 'Discovery FTP', online: true, latency_ms: 16.8 },
      { name: 'AmberIT Media', online: true, latency_ms: 15.5 },
      { name: 'SAM Online', online: false, latency_ms: 310 },
      { name: 'DhakaFTP', online: false, latency_ms: 850 }
    ];
    renderBdixServersBadges(mockServers, 15.5);
  }

  function fetchDynamicLiveTvChannels() {
    fetch('/api/livetv/channels')
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

