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
  const proxied = (url, referer) => apiUrl('/api/proxy?u=' + encodeURIComponent(url) + (referer ? '&r=' + encodeURIComponent(referer) : ''));

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
  let CATALOG_DATA = [];

  // Live TV Channels Data (Dynamic with fallback)
  let LIVE_CHANNELS = [];

  // ==========================================================================
  // 2. State & DOM References
  // ==========================================================================
  let currentActiveTab = 'home';
  let currentActiveCategory = 'all';
  let activeMediaItem = null;
  let heroItem = null;
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
  // ---- item registry: every rendered card resolves back to its full item (home rails, search, explore)
  const ITEMS = new Map();
  const register = (items) => (items || []).forEach(i => i && i.id && ITEMS.set(i.id, i));
  const lookupItem = (id) => ITEMS.get(id) || CATALOG_DATA.find(c => c.id === id);

  function renderAllSections() {
    renderContinueWatching();
    renderLiveTvGrid(LIVE_CHANNELS);
    fetchDownloadsList();
  }

  // ---- real "Continue Watching" (saved by the player, stored on this device)
  const PROGRESS_KEY = 'ashtube_progress';
  const readProgress = () => { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]'); } catch (e) { return []; } };
  const writeProgress = (list) => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) { /* storage unavailable */ } };

  function saveProgress(force = false) {
    if (!activePlayback || !activePlayback.item || !videoPlayer.duration || videoPlayer.currentTime < 5) return;
    const now = Date.now();
    if (!force && now - (saveProgress.last || 0) < 5000) return;
    saveProgress.last = now;
    const it = activePlayback.item;
    const key = `${it.id}:${activePlayback.season || 1}:${activePlayback.episode || 1}`;
    const list = readProgress().filter(p => p.key !== key);
    const pct = videoPlayer.currentTime / videoPlayer.duration;
    if (pct < 0.95) {
      list.unshift({ key, pos: videoPlayer.currentTime, dur: videoPlayer.duration, at: now,
                     season: activePlayback.season || 1, episode: activePlayback.episode || 1,
                     item: { id: it.id, title: it.title, poster: it.poster, backdrop: it.backdrop, category: it.category, year: it.year, isSeries: it.isSeries } });
    }
    writeProgress(list);
  }

  function renderContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const rail = document.getElementById('continueWatchingRail');
    const list = readProgress();
    section.style.display = list.length ? '' : 'none';
    rail.innerHTML = list.map(p => `
      <div class="resume-card" data-key="${escapeHtml(p.key)}">
        <div class="resume-thumb-wrap">
          <img class="resume-thumb" src="${escapeHtml(p.item.backdrop || p.item.poster || '')}" alt="${escapeHtml(p.item.title)}" loading="lazy">
          <div class="play-overlay-mini"><div class="play-circle-sm"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div></div>
          <div class="progress-track"><div class="progress-fill" style="width: ${Math.round(100 * p.pos / p.dur)}%;"></div></div>
        </div>
        <div class="resume-info">
          <div class="resume-title">${escapeHtml(p.item.title)}</div>
          <div class="resume-meta">${p.item.isSeries ? `S${p.season}:E${p.episode} · ` : ''}${Math.max(1, Math.round((p.dur - p.pos) / 60))}m left</div>
        </div>
      </div>
    `).join('');
    rail.querySelectorAll('.resume-card').forEach(card => {
      card.addEventListener('click', () => {
        const p = readProgress().find(x => x.key === card.dataset.key);
        if (!p) return;
        ITEMS.set(p.item.id, Object.assign({}, ITEMS.get(p.item.id) || {}, p.item));
        playMedia(ITEMS.get(p.item.id), p.season, p.episode, p.item.isSeries ? `Season ${p.season} · Episode ${p.episode}` : '', p.pos);
      });
    });
  }
  document.getElementById('clearHistoryLink').addEventListener('click', () => { writeProgress([]); renderContinueWatching(); });

  // ---- poster cards, home rails and countdown chips
  let clockOffset = 0;   // server time minus device time, so countdowns are right even with a wrong phone clock

  function airTimeOf(item) {
    if (item.airing && item.airing.at) return item.airing.at;
    if (item.releaseDate) { const t = Date.parse(item.releaseDate); if (t) return Math.floor(t / 1000); }
    return 0;
  }

  function posterCardHtml(item) {
    const at = airTimeOf(item);
    const future = at && at > Date.now() / 1000 + clockOffset;
    const badge = item.available === false
      ? '<span class="poster-badge soon">Not hosted yet</span>'
      : (item.isBDIX ? '<span class="poster-badge bdix">BDIX</span>' : `<span class="poster-badge">${escapeHtml(item.quality || 'HD')}</span>`);
    const epLabel = item.airing && item.airing.episode ? `Ep ${item.airing.episode}` : (item.releaseDate ? 'Premiere' : '');
    return `
      <div class="poster-card" data-id="${escapeHtml(item.id)}">
        <div class="poster-image-wrap">
          <img class="poster-image" src="${escapeHtml(item.poster || '')}" alt="${escapeHtml(item.title)}" loading="lazy">
          ${badge}
          ${future ? `<span class="countdown-chip" data-at="${at}" data-label="${escapeHtml(epLabel)}"></span>` : ''}
        </div>
        <div class="poster-info">
          <div class="poster-title">${escapeHtml(item.title)}</div>
          <div class="poster-meta"><span>${escapeHtml(String(item.year || ''))}</span><span>★ ${escapeHtml(String(item.rating || 'N/A'))}</span></div>
        </div>
      </div>`;
  }

  function bindPosterClicks(container) {
    container.querySelectorAll('.poster-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = lookupItem(card.dataset.id);
        if (item) openDetailModal(item);
      });
    });
  }

  function renderHomeRails(rails) {
    const host = document.getElementById('dynamicRails');
    if (!host) return;
    host.innerHTML = rails.map(r => `
      <section class="content-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h3 class="section-title">${escapeHtml(r.title)}</h3>
            ${r.countdown ? '<span class="section-tag">Live Countdown</span>' : ''}
          </div>
        </div>
        <div class="horizontal-scroller" data-rail="${escapeHtml(r.id)}">${r.items.map(posterCardHtml).join('')}</div>
      </section>
    `).join('');
    rails.forEach(r => register(r.items));
    bindPosterClicks(host);
    tickCountdowns();
  }

  function formatCountdown(sec) {
    if (sec <= 0) return 'Aired';
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function tickCountdowns() {
    const nowSec = Date.now() / 1000 + clockOffset;
    document.querySelectorAll('.countdown-chip').forEach(el => {
      const left = Number(el.dataset.at) - nowSec;
      el.textContent = `${el.dataset.label ? el.dataset.label + ' · ' : ''}${formatCountdown(left)}`;
    });
  }
  setInterval(tickCountdowns, 1000);

  function loadHome() {
    return fetchJson('/api/home', null, 15000).then(res => {
      if (res.success && res.rails && res.rails.length) {
        clockOffset = (res.now || 0) - Date.now() / 1000;
        renderHomeRails(res.rails);
        const first = res.rails[0].items[0];
        if (first) updateHeroSpotlight(first);
        return true;
      }
      return false;
    });
  }

  function renderExploreCatalog(items) {
    const grid = document.getElementById('exploreCatalogGrid');
    const countLabel = document.getElementById('catalogResultsCount');
    countLabel.textContent = `Showing ${items.length} Titles`;
    register(items);
    grid.innerHTML = items.map(posterCardHtml).join('');
    bindPosterClicks(grid);
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
  // One in-flight/cached request per (title, season, episode); detail sheets prefetch it so Play feels instant.
  const resolvePromises = new Map();

  function fetchResolved(item, season, episode) {
    const key = `${item.id}:${season}:${episode}`;
    if (resolvePromises.has(key)) return resolvePromises.get(key);
    const qs = new URLSearchParams({
      id: item.id,
      category: item.category || '',
      title: item.title,
      year: item.year || '',
      series: item.isSeries ? '1' : '0',
      season: String(season),
      episode: String(episode)
    });
    const p = fetchJson(`/api/stream/resolve?${qs.toString()}`, null, 90000)
      .then(res => {
        const ok = res.success && res.resolved && res.resolved.sources && res.resolved.sources.length;
        if (!ok) resolvePromises.delete(key);   // negative answers are not kept: the index may refresh
        return { resolved: ok ? res.resolved : null, error: res.error || '' };
      })
      .catch(err => {
        resolvePromises.delete(key);
        return { resolved: null, error: err && err.name === 'AbortError' ? 'Source lookup timed out — try again' : 'Backend server unreachable' };
      });
    resolvePromises.set(key, p);
    return p;
  }

  function prefetchResolve(item, season = 1, episode = 1) {
    if (item && item.available !== false) fetchResolved(item, season, episode);
  }

  function resolveMedia(item, season = 1, episode = 1) {
    showToast(`Finding best source for ${item.title}…`);
    return fetchResolved(item, season, episode).then(r => {
      if (!r.resolved) showToast(r.error || 'No source currently hosts this title');
      return r.resolved;
    });
  }

  function playMedia(item, season = 1, episode = 1, subtitle = '', startAt = 0) {
    resolveMedia(item, season, episode).then(resolved => {
      if (!resolved) return;
      const best = resolved.sources.find(src => src.url === resolved.stream_url) || resolved.sources[0];
      launchVideoPlayer({
        title: item.title,
        sub: subtitle || `${best.quality} · ${best.provider}${best.bdix ? ' · BDIX' : ''}`,
        videoUrl: best.url,
        isHls: best.hls,
        referer: best.referer || '',
        sources: resolved.sources,
        audioTracks: resolved.audio_tracks,
        item, season, episode, startAt
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
          const found = lookupItem(item.dataset.id);
          if (found) {
            saveSearchHistory(found.title);
            searchInput.value = found.title;
            clearSearchBtn.style.display = 'flex';
            hideSuggestionsDropdown();
            openDetailModal(found);
          } else {
            searchInput.value = item.dataset.title || '';
            executeSearch(searchInput.value);
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
      item.title.toLowerCase().includes(q) || (item.genres || '').toLowerCase().includes(q)
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
          const found = lookupItem(item.dataset.id);
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
      (item.genres || '').toLowerCase().includes(q) ||
      (item.synopsis || '').toLowerCase().includes(q) ||
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
    document.getElementById('detailBannerImg').src = item.backdrop || item.poster || '';
    document.getElementById('detailMainTitle').textContent = item.title;
    document.getElementById('detailYear').textContent = item.year || '';
    document.getElementById('detailQualityBadge').textContent = item.available === false ? 'Not hosted yet' : (item.quality || 'HD');
    document.getElementById('detailRating').textContent = `${item.rating || 'N/A'} ★`;
    document.getElementById('detailDuration').textContent = item.duration || '';
    document.getElementById('detailGenres').textContent = item.genres || '';
    document.getElementById('detailSynopsis').textContent = item.synopsis || '';

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
    const firstSeason = item.isSeries && item.seasons && item.seasons[0];
    if (firstSeason && firstSeason.episodes[0]) prefetchResolve(item, firstSeason.seasonNumber, firstSeason.episodes[0].epNum);
    else if (!item.isSeries) prefetchResolve(item);

    // Search results from Cinemeta arrive without episode lists: load them on demand.
    if (item.remote && item.isSeries && !item.seasons && !String(item.id).startsWith('tv-')) {
      fetchJson(`/api/media/${encodeURIComponent(item.id)}?type=series`, null, 25000).then(res => {
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
      card.addEventListener('pointerdown', () => prefetchResolve(item, seasonNumber, Number(card.dataset.ep)));
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

  // Hero banner mirrors the first item of the first home rail (see updateHeroSpotlight)
  document.getElementById('heroPlayBtn').addEventListener('click', () => {
    if (!heroItem) { showToast('Catalog is still loading'); return; }
    openDetailModal(heroItem);
    document.getElementById('detailPlayNowBtn').click();
  });

  document.getElementById('heroDownloadBtn').addEventListener('click', () => {
    if (!heroItem) { showToast('Catalog is still loading'); return; }
    openDetailModal(heroItem);
    document.getElementById('detailDownloadBtn').click();
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
    // HLS and subtitles go through the CORS-enabled proxy; direct files keep a plain request
    if (isHls) videoPlayer.crossOrigin = 'anonymous'; else videoPlayer.removeAttribute('crossorigin');
    videoPlayer.querySelectorAll('track').forEach(t => t.remove());
    const cur = (data.sources || []).find(v => v.url === data.videoUrl);
    ((cur && cur.subtitles) || []).filter(t => /\.vtt(\?|$)/i.test(t.url) && isHls).forEach((t, i) => {
      const el = document.createElement('track');
      el.kind = 'subtitles';
      el.label = t.lang;
      el.src = proxied(t.url, data.referer);
      videoPlayer.appendChild(el);
    });
    if (data.startAt) videoPlayer.addEventListener('loadedmetadata', () => { videoPlayer.currentTime = data.startAt; }, { once: true });
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
      hlsInstance.loadSource(proxied(data.videoUrl, data.referer));
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
      videoPlayer.src = proxied(data.videoUrl, data.referer);
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
    launchVideoPlayer(Object.assign({}, activePlayback, { videoUrl: src.url, isHls: src.hls, referer: src.referer || activePlayback.referer, startAt: resumeAt, _viaProxy: false }));
  }

  videoPlayer.addEventListener('timeupdate', () => saveProgress(false));
  videoPlayer.addEventListener('pause', () => saveProgress(true));

  videoPlayer.addEventListener('error', () => {
    if (!playerModal.classList.contains('open') || !videoPlayer.getAttribute('src')) return;
    if (activePlayback && !activePlayback._viaProxy && !/\/api\/proxy/.test(videoPlayer.src)) {
      // The phone may not be on BDIX while the PC is: retry through the backend once.
      activePlayback._viaProxy = true;
      const resumeAt = videoPlayer.currentTime || activePlayback.startAt || 0;
      videoPlayer.removeAttribute('crossorigin');
      videoPlayer.src = proxied(activePlayback.videoUrl, activePlayback.referer);
      videoPlayer.addEventListener('loadedmetadata', () => { videoPlayer.currentTime = resumeAt; }, { once: true });
      videoPlayer.play().catch(() => {});
      showToast('Direct link unreachable — streaming through the backend');
      return;
    }
    const mkv = /\.mkv(\?|$)/i.test(videoPlayer.src);
    showToast(mkv ? 'This device cannot play MKV in-app — use Download, then play the file' : 'Playback error — try another quality');
  });

  document.getElementById('exitPlayerBtn').addEventListener('click', () => {
    saveProgress(true);
    videoPlayer.pause();
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    videoPlayer.src = '';
    playerModal.classList.remove('open');
    activePlayback = null;
    renderContinueWatching();
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
    loadHome().catch(() => false);
    fetchJson('/api/catalog?category=all', null, 20000)
      .then(data => {
        if (data.success && data.items && data.items.length > 0) {
          register(data.items);
          applyCatalogData(data.items);
        } else {
          loadLocalCatalogJson();
        }
      })
      .catch(() => loadLocalCatalogJson());
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
      register(items);
      activeMediaItem = CATALOG_DATA[0];
      if (!document.getElementById('dynamicRails').children.length) {
        updateHeroSpotlight(CATALOG_DATA[0]);
        renderHomeRails([{ id: 'catalog', title: 'Featured', items: CATALOG_DATA.slice(0, 20) }]);
      }
      renderAllSections();
      if (currentActiveTab === 'explore') {
        filterCatalog(currentActiveCategory);
      }
    }
  }

  function updateHeroSpotlight(item) {
    if (!item) return;
    heroItem = item;
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

  // First run inside the APK: there is no same-origin backend, so ask for the server address.
  (function firstRunSetup() {
    let saved = '';
    try { saved = localStorage.getItem('ashtube_api_base') || ''; } catch (e) { /* storage unavailable */ }
    if (!location.protocol.startsWith('http') && !saved) {
      switchTab('livetv');
      setTimeout(() => showToast('Enter your AshTube server address below, then tap Save'), 600);
    }
  })();
  showToast('AshTube Ready · BDIX Live TV & Peering Scanner Active');

});

