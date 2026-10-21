# MythFlix — Development Plan & Live Progress Tracker

> **Notice for Future Agents & Context Resumption:**  
> This file tracks the exact state, architecture, completed phases, and pending tasks of the **MythFlix** streaming application. Read this file first to understand the current progress without analyzing the entire codebase.

---

## 1. Project Overview & Architectural Vision
* **Application Name:** MythFlix
* **Platform:** Mobile-First Android Web / PWA Streaming & Downloading Application.
* **Core Stack:** HTML5 semantic structure, Vanilla CSS (Glassmorphism & Obsidian Dark Theme), Vanilla JavaScript (ES6+), Python 3.13 Backend REST Microservices.
* **Key Features:**
  1. Multi-source streaming (Hollywood, TV Shows, Anime, K-Dramas, Bangla Dubbed).
  2. Ad-free stream resolution (direct HLS `.m3u8` and MP4 extraction).
  3. Advanced Video Player with mobile swipe gestures (Brightness, Volume, Seek, Dual-Audio, Rotation).
  4. High-speed multi-threaded segmented downloader engine (`aria2c` / `pySmartDL` architecture).
  5. Universal BDIX FTP indexer and live low-latency TV streaming.

---

## 2. Phased Development Roadmap

| Phase | Milestone Description | Status | Approval State |
| :---: | :--- | :---: | :---: |
| **Phase 1** | **Research, Architecture & UI Design System**<br>• Evaluated GitHub sources for Anime, Movies, Series, BD, K-Drama.<br>• Designed 5 clean, uncluttered Android UI screens.<br>• Established Obsidian design tokens and typography. | **Completed** | ✅ Approved by User |
| **Phase 2** | **Advanced Video Player Engine (Mobile Gestures & Rotation)**<br>• Refined player overlay with straight & rotated landscape view.<br>• Left-side swipe for Brightness control (HUD indicator).<br>• Right-side swipe for Volume control (HUD indicator).<br>• Dual-Audio toggle (`ENG / BAN`), subtitles, speed, and quality controls.<br>• Double-tap seek (10s back / 10s forward) and lock controls. | **Completed** | ✅ Approved by User |
| **Phase 3** | **High-Speed Multi-Thread Downloader Engine**<br>• Segmented HTTP Range multi-threaded downloader (`downloader_engine.py`).<br>• Parallel chunk workers (4–8 threads) with Range probing fallback.<br>• Chunk reassembly into single `.mp4` container.<br>• REST API routes (`/api/download/start`, `/api/download/status`, `/api/download/pause`, `/api/download/resume`, `/api/download/list`, `/api/download/file/<filename>`).<br>• Real-time speed meter (MB/s), live progress polling, and direct offline video playback. | **Completed** | ✅ Approved by User |
| **Phase 4** | **Unified Media Catalog & Dynamic API Layer (Search History & Auto-Suggest)**<br>• Enriched `catalog.json` with 23+ verified media items across Movies, Series, Anime, K-Drama, and Bangla Dubbed.<br>• Dynamic REST API routes: `/api/catalog`, `/api/search` (multi-field & category filters), and `/api/suggest`.<br>• Persistent Search History in `localStorage` (`mythflix_search_history`) with quick pills in Explore and history management.<br>• Predictive Auto-Suggest Dropdown: Next-word completion and full movie/series title suggestions with match highlighting, arrow-key navigation, and clear button. | **Completed** | ✅ Approved by User |
| **Phase 5** | **BDIX Real-Time Scanner & Live TV Engine**<br>• Concurrent parallel BDIX server ping tester in `bdix_indexer.py` (`/api/bdix/scan` & `/api/bdix/status`).<br>• Real-time BDIX health diagnostics card with live server latency badges (CircleFTP, Discovery, AmberIT, SAM Online, etc.).<br>• Low-latency Bangla live TV engine with 12+ channels (Somoy, Jamuna, Channel 24, T Sports, GTV, Star Sports, Duronto).<br>• Native and `hls.js` `.m3u8` streaming integration in Advanced Gesture Video Player with failover fallback.<br>• Live TV category filtering (All Channels, Bangla News, Live Sports, Entertainment, Kids & Learning). | **Completed** | ✅ Approved by User |
| **Phase 6** | **AshTube Rebranding, Developer Screen & GitHub Actions APK Build**<br>• Rebranded entire platform to **AshTube** with custom generated logos and icons (`assets/ashtube_logo.png`, `icon-192.png`, `icon-512.png`).<br>• Added prominent startup Developer Welcome Popup: **`Developed by ASRAFUL ISLAM`** with glassmorphism and enter transition.<br>• Created new public GitHub repository: [Xorashrin/ashtube](https://github.com/Xorashrin/ashtube).<br>• Automated cloud APK compilation on GitHub Actions (Release: **3.93 MB**, Debug: **7.37 MB** — both meeting the 5–8 MB target).<br>• Published GitHub Release v1.0.0 with direct APK download assets. | **Completed** | ✅ Verified in Cloud |

---

## 3. Detailed Component & File Registry

| File Path | Purpose | Status |
| :--- | :--- | :---: |
| [index.html](file:///home/ASHRIN/Desktop/MythFlix/index.html) | Semantic markup for all 5 screens, BDIX diagnostics card, live TV filters, player, and Hls.js script. | Active |
| [style.css](file:///home/ASHRIN/Desktop/MythFlix/style.css) | Obsidian dark theme, BDIX health scanner card, server latency chips, and live channel cards. | Active |
| [app.js](file:///home/ASHRIN/Desktop/MythFlix/app.js) | BDIX ping scanner controller, Hls.js video player engine, live TV filtering, search auto-suggest. | Active |
| [downloader_engine.py](file:///home/ASHRIN/Desktop/MythFlix/downloader_engine.py) | High-speed multi-threaded segmented chunk downloader engine. | Verified |
| [server.py](file:///home/ASHRIN/Desktop/MythFlix/server.py) | Python REST API dispatcher: `/api/catalog`, `/api/search`, `/api/suggest`, `/api/bdix/*`, `/api/livetv/*`. | Active (Port 8000) |
| [catalog.json](file:///home/ASHRIN/Desktop/MythFlix/catalog.json) | Unified multi-category catalog containing 23+ items with resolutions, audio tracks, and seasons. | Active |
| [livetv_channels.json](file:///home/ASHRIN/Desktop/MythFlix/livetv_channels.json) | Curated catalog of 12+ live Bangla, Sports, Entertainment, and Kids TV channels with BDIX streams. | Active |
| [PROGRESS_WORK.md](file:///home/ASHRIN/Desktop/MythFlix/PROGRESS_WORK.md) | Single source of truth for project milestones and current status. | Active |
| [bdix_indexer.py](file:///home/ASHRIN/Desktop/MythFlix/bdix_indexer.py) | Universal BDIX FTP health checker and sub-second parallel latency scanner. | Verified |
| [bdix_servers_report.json](file:///home/ASHRIN/Desktop/MythFlix/bdix_servers_report.json) | Real-time connectivity and latency test reports for major Bangladesh BDIX media servers. | Active |
| [kdrama_resolver.py](file:///home/ASHRIN/Desktop/MythFlix/kdrama_resolver.py) | Korean drama metadata and stream resolver. | Verified |
| [movie_resolver.py](file:///home/ASHRIN/Desktop/MythFlix/movie_resolver.py) | Global Hollywood & International movie stream resolver. | Verified |
| [anime_resolver.py](file:///home/ASHRIN/Desktop/MythFlix/anime_resolver.py) | Anime episode and HLS stream resolver (Zoro / HiAnime / Gogoanime). | Verified |
| [bangla_dubbed_resolver.py](file:///home/ASHRIN/Desktop/MythFlix/bangla_dubbed_resolver.py) | Bangla dubbed & South Indian cinema dual-audio stream resolver. | Verified |
| [bdix_searcher.py](file:///home/ASHRIN/Desktop/MythFlix/bdix_searcher.py) | Universal BDIX FTP multi-server direct file indexer & search engine. | Verified |
| [downloads/](file:///home/ASHRIN/Desktop/MythFlix/downloads) | Local directory for completed multi-threaded offline video downloads. | Verified |

---

## 4. Work Log (Phase 5 Completed)
* **Parallel BDIX Health Scanner Engine**:
  - Refactored `bdix_indexer.py` to use `ThreadPoolExecutor` for concurrent scanning across all 7 major Bangladeshi BDIX media servers in under 2 seconds.
  - Implemented `/api/bdix/status` and `/api/bdix/scan` in `server.py` to record and deliver real-time server latencies and calculate average peering speed.
* **BDIX Health & Latency Diagnostics UI**:
  - Built `#bdixScannerCard` in `index.html` and styled with obsidian emerald glass accents in `style.css`.
  - Added live latency badges with real-time indicators (CircleFTP, Discovery Network, AmberIT Media, SAM Online, DhakaFTP, etc.).
  - Added interactive "Test Ping" button (`#scanBdixBtn`) with rotating spin animation and toast notification.
* **Low-Latency Bangla Live TV Engine**:
  - Created `livetv_channels.json` with 12 channels covering Bangla News (*Somoy TV, Jamuna TV, Channel 24, Ekattor TV*), Sports (*T Sports HD, Star Sports 1, GTV Sports*), Entertainment (*Channel i, NTV, Deepto TV, BTV National*), and Kids (*Duronto TV*).
  - Built dynamic channel loader `GET /api/livetv/channels` in `server.py`.
  - Added channel category filtering (`All Channels`, `Bangla News`, `Live Sports`, `Entertainment`, `Kids & Learning`) in `app.js`.
* **Hls.js Low-Latency Video Player Integration**:
  - Integrated `hls.js` CDN library in `index.html` head for `.m3u8` live stream playback on all modern mobile and desktop browsers.
  - Enhanced `launchVideoPlayer` in `app.js` with automatic HLS detection, low-latency mode configuration, fatal error fallback, and instance teardown on exit.
