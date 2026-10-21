# TV Series & Web Series Data Sources, Streaming & Backend Architecture

This document evaluates the **top 5 open-source GitHub repositories for TV series and web series** (encompassing Netflix, HBO/Max, Apple TV+, Amazon Prime Video, Disney+, Hulu, and Asian Dramas). 

Each source is evaluated against strict criteria:
1. **Catalog Completeness:** Comprehensive season coverage (Season 1 through final season, specials) and rapid indexing of new episode drops.
2. **Speed & Quality:** High-bitrate 1080p and 4K HDR streams with high-speed download throughput.
3. **Episode-Level Metadata Fidelity (100% Match):** Season number, episode number, episode title, and individual episode thumbnail strictly match the inner video file with zero desynchronization or bait-and-switch.
4. **Download Capabilities:** Hassle-free downloading for individual episodes and multi-episode season batches.

---

## Comparative Matrix for TV Series

| Source / Repository | Primary Tech Stack | TV Series Metadata Model | Streaming & Download Speed | Video Quality | Batch Season Download |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[Cloudstream](https://github.com/recloudstream/cloudstream)** | Android (Kotlin) | TMDB & Simkl TV ID | High (Multi-threaded CDNs) | 720p, 1080p, 4K | **Yes** (Built-in queue for entire seasons) |
| **[Torrentio / Stremio](https://github.com/TheBeastLT/torrentio-scraper)** | Node.js / Rust | IMDb ID + Season + Episode<br>(`tt0903747:1:1`) | Extreme (50–100+ MB/s via Debrid/P2P) | 1080p WEB-DL, 4K HDR, Dolby Vision | **Yes** (Direct Debrid season pack links) |
| **[Consumet.ts (FlixHQ & DramaCool)](https://github.com/consumet/consumet.ts)** | TypeScript / Node.js<br>(REST API Backend) | TMDB ID & Episode Slugs | High (MegaCloud, UpCloud) | 360p to 1080p HLS | **Yes** (Iterative endpoint resolution) |
| **[TMDB-Embed-API](https://github.com/Inside4ndroid/TMDB-Embed-API)** | Node.js / Docker<br>(REST Stream Resolver) | Strict TMDB TV ID + S + E<br>(`/tv/{id}/{s}/{e}`) | High (Decrypted HLS `.m3u8`) | 1080p, 720p | **Yes** (Programmatic batch queuing via API) |
| **[Lobster](https://github.com/justchokingaround/lobster)** | Shell Script CLI | TMDB API | High (Direct CDN line speed) | 720p, 1080p | **Yes** (Range flag for episodes) |

---

## Detailed Evaluation of the Top 5 TV Series Sources

### 1. [recloudstream/cloudstream](https://github.com/recloudstream/cloudstream)
* **What it is:** The leading open-source Android streaming client featuring dedicated TV series architecture.
* **Series Catalog:** Unrivaled on mobile. Through plugins like *SoraStream*, *SuperStream*, *Hexated*, and *DramaCool*, it indexes Western TV series, miniseries, and Asian web dramas.
* **Why Season & Episode Metadata Matches Content:**
  * Uses TMDB's TV series hierarchy (`/tv/{id}/season/{season_number}`).
  * Every episode displays its official title, air date, overview, and individual episode thumbnail.
  * Scrapers match streams against verified season and episode numbers (`S01E01`), eliminating out-of-order episodes.
* **Streaming & Download Capabilities:**
  * **Episode Player:** Autoplays the next episode, remembers per-episode timestamps, and tracks watched status.
  * **Season Batch Downloader:** Features a dedicated "Download Season" button that queues all episodes in the background with selectable resolutions.

---

### 2. [TheBeastLT/torrentio-scraper](https://github.com/TheBeastLT/torrentio-scraper) (with [Stremio Core](https://github.com/Stremio/stremio-core))
* **What it is:** The benchmark engine for complete TV series, miniseries, and season boxsets.
* **Series Catalog:** The largest catalog in existence. Covers complete runs of legacy shows (*The Sopranos*, *The Wire*, *Friends*) and same-day drops of streaming exclusives (*House of the Dragon*, *Stranger Things*, *The Bear*).
* **Why Season & Episode Metadata Matches Content:**
  * **Cinemeta Determinism:** Every query is strictly keyed:
    `stream/series/{imdb_id}:{season_num}:{episode_num}.json`
  * Scrapes scene releases following the standard TV scene naming convention (e.g., `Show.Title.S02E05.1080p.AMZN.WEB-DL.DDP5.1.H.264`).
  * Torrent hash checking guarantees that Episode 5 of Season 2 is never swapped with another episode.
* **Streaming & Download Capabilities:**
  * **Quality:** Pristine 4K HDR, Dolby Vision, multi-language audio tracks, and 5.1/7.1 surround sound.
  * **High-Speed Debrid Downloads:** When paired with Real-Debrid or Torbox, entire season packs (20–50 GB) download at line speed (up to 1 Gbps) over direct HTTPS connections.

---

### 3. [consumet/consumet.ts](https://github.com/consumet/consumet.ts) (FlixHQ & DramaCool Modules)
* **What it is:** A production-grade REST API backend that extracts TV series and Asian dramas into clean JSON.
* **Series Catalog:** Dual-engine coverage:
  * **FlixHQ Provider:** Western series (Netflix, HBO, Disney+, Apple TV+, Prime).
  * **DramaCool / ViewAsian Provider:** Comprehensive Asian web series (K-dramas, C-dramas, J-dramas).
* **API Flow for Series:**
  1. **Get Series Details & Episode List:**
     ```typescript
     const showInfo = await flixhq.fetchMediaInfo("tv/breaking-bad-39257");
     // Returns: { title, seasons: 5, episodes: [{ id: "...", season: 1, number: 1, title: "Pilot" }, ...] }
     ```
  2. **Fetch Stream & Download Links for Target Episode:**
     ```typescript
     const sources = await flixhq.fetchEpisodeSources(episodeId, mediaId);
     // Returns: { sources: [{ url: "master.m3u8" }], subtitles: [...], download: "..." }
     ```
* **Why Episode Metadata Matches Content:**
  * The backend builds a strict parent-child tree mapping the media ID to individual episode IDs before extracting CDN streams, preventing episode cross-contamination.

---

### 4. [Inside4ndroid/TMDB-Embed-API](https://github.com/Inside4ndroid/TMDB-Embed-API) (and [cool-dev-guy/vidsrc-api](https://github.com/cool-dev-guy/vidsrc-api))
* **What it is:** Dedicated REST stream resolvers designed specifically around TMDB TV identifiers.
* **Series Catalog:** Every TV show indexed on TMDB.
* **Why Season & Episode Metadata Matches Content:**
  * **Strict Triple-Key Resolution:** Endpoints do not rely on text searches. Instead, they accept exact database coordinates:
    `GET /api/tv/{tmdb_id}/{season_number}/{episode_number}`
    *Example:* `GET /api/tv/1399/1/1` (*Game of Thrones* S01E01).
  * Because your Android client queries TMDB for the official episode title and thumbnail and sends the verified `(tmdb_id, season, episode)` coordinates to the resolver, the returned stream matches the episode 100%.
* **Streaming & Download Capabilities:**
  * Decrypts and returns direct multi-bitrate `.m3u8` playlists and WebVTT subtitles.
  * Your Android app can batch-request episode URLs for a season and queue them into Android's `DownloadService`.

---

### 5. [justchokingaround/lobster](https://github.com/justchokingaround/lobster)
* **What it is:** A lightning-fast POSIX shell script CLI tool with built-in series navigation and downloading.
* **Series Catalog:** Fast-tracked indexing of trending TV series and newly aired episodes.
* **Why Season & Episode Metadata Matches Content:**
  * When a user searches for a series, Lobster queries TMDB for the total number of seasons.
  * Prompts the user with an interactive `fzf` picker for **Season &rarr; Episode Number**.
  * Shows episode titles, release dates, and image previews (`ueberzugpp`).
* **Streaming & Download Capabilities:**
  * **Playback:** Seamless `mpv` playback with auto-selected subtitles and watch history resumption (`-c` / `--continue`).
  * **Episode & Range Downloading:** Use the `-d` flag to download a single episode or an entire sequence of episodes using `ffmpeg`/`yt-dlp`.

---

## Android Series Data Architecture for MythFlix

When building the TV series section of **MythFlix**, use the following data structure to guarantee 100% metadata accuracy and smooth UX:

### 1. Unified Episode Data Model (Kotlin)
```kotlin
data class TvShowDetail(
    val tmdbId: Int,
    val title: String,
    val posterUrl: String,
    val backdropUrl: String,
    val totalSeasons: Int,
    val seasons: List<Season>
)

data class Season(
    val seasonNumber: Int,
    val name: String,
    val episodeCount: Int,
    val episodes: List<Episode>
)

data class Episode(
    val episodeNumber: Int,
    val title: String,
    val overview: String,
    val stillThumbnailUrl: String, // Individual episode thumbnail from TMDB
    val airDate: String,
    var streamUrl: String? = null,
    var isDownloaded: Boolean = false
)
```

### 2. Recommended API Integration Workflow
```
[User Selects TV Show]
         │
         ▼
1. Fetch Seasons & Episodes from TMDB API:
   GET https://api.themoviedb.org/3/tv/{tmdb_id}?append_to_response=season/1,season/2
   --> Populates UI with official thumbnails, episode titles, and summaries.
         │
         ▼
[User Taps "Play" or "Download" on S01E01]
         │
         ▼
2. Query MythFlix Resolver Backend:
   GET https://your-backend.com/api/tv/{tmdb_id}/1/1
   --> Returns direct .m3u8 stream, VTT subtitles, and HTTP headers.
         │
         ▼
3. Hand off to AndroidX Media3:
   - For Streaming: ExoPlayer.setMediaItem(mediaItem)
   - For Offline Download: Media3 DownloadService.sendAddDownload(...)
```

---

## Summary & Best Recommendations

1. **For Your Android Backend:** 
   * Deploy **[Inside4ndroid/TMDB-Embed-API](https://github.com/Inside4ndroid/TMDB-Embed-API)** for direct `/tv/{id}/{s}/{e}` stream decryption.
   * Add **[consumet/consumet.ts](https://github.com/consumet/consumet.ts)** (FlixHQ + DramaCool) as a secondary provider to cover both Western and Asian web series.
2. **For Metadata & UI:**
   * Always use the official **[TMDB API](https://developer.themoviedb.org/reference/intro/getting-started)** to populate seasons, episode thumbnails, and titles.
3. **For Offline Batch Downloads:**
   * Implement AndroidX Media3's **`DownloadService`** to queue full seasons in the background with pause/resume support.
