# Anime Data Sources, Backend Architecture, and Technical Research Report

This document compiles all data, repositories, API endpoints, technical considerations, and legal/architectural analyses retrieved and discussed during the research session for building an anime streaming and downloading Android application.

---

## 1. Top 5 Open-Source Anime Sources & Downloader Tools (GitHub)

The following repositories represent the most reliable, active, and comprehensive open-source tools with large content catalogs and full download capabilities.

| Project | Type / Platform | Content Providers | Download Capabilities | Repository Link |
| :--- | :--- | :--- | :--- | :--- |
| **ani-cli** | Shell Script CLI<br>(Linux, macOS, Windows, Android/Termux) | Aggregators (HiAnime / Zoro mirrors) | Uses `yt-dlp` or `ffmpeg`. Supports episode range selection (`-e`), custom resolutions (360p–1080p), zero bloat. | [ani-cli](https://github.com/pystardust/ani-cli) |
| **animdl** | Python CLI & Downloader<br>(Windows, macOS, Linux) | Multi-provider (AllAnime, AnimePahe, Gogoanime, Kaido, Zoro) | Batch downloading via `aria2c` and IDM (`--idm`), subtitle extraction, auto-organization into season/episode directories. | [animdl](https://github.com/justfoolingaround/animdl) |
| **Aniyomi** | Android Native App (Kotlin)<br>(Android, Emulators) | 100+ community extensions (HiAnime, Gogoanime, AnimePahe, Nyaa) | Built-in background download manager with queueing, offline viewing with embedded `mpv`, tracking sync (AniList, MAL, Kitsu). | [aniyomi](https://github.com/aniyomiorg/aniyomi) |
| **Miru** | Desktop & Mobile App (Flutter)<br>(Windows, macOS, Linux, Android, Web) | HTTP scrapers + BitTorrent indexers (Nyaa, TokyoTosho) | Direct torrent caching and streaming, raw Blu-ray remuxes, uncensored releases, multi-audio tracks, 1080p/4K. | [miru-app](https://github.com/miru-project/miru-app) |
| **Cloudstream** | Android & Android TV App (Kotlin)<br>(Android, FireStick, Android TV) | Modular plugin repositories (Megarepo, Hexated, English Providers) | Multi-threaded background downloader, resume support, multiple server mirrors, ad-free. | [cloudstream](https://github.com/recloudstream/cloudstream) |

---

## 2. Dedicated Open-Source Backend APIs for Android

For a custom Android application that requires a centralized REST API delivering structured JSON (metadata, episode lists, stream links, and download links), the two best production-ready options are:

### A. aniwatch-api ([ghoshRitesh12/aniwatch-api](https://github.com/ghoshRitesh12/aniwatch-api))
* **Primary Target:** Scrapes HiAnime (formerly Zoro / AniWatch).
* **Key Advantages:**
  * Returns ready-to-stream multi-quality HLS (`.m3u8`) playlists.
  * Provides WebVTT (`.vtt`) subtitle tracks for multi-language captioning.
  * Generates direct episode download pages and links.
  * Pre-built home page aggregations (Spotlight, Trending, Latest Episodes, Top Upcoming).
* **Quickstart / Deployment:**
  ```bash
  git clone https://github.com/ghoshRitesh12/aniwatch-api.git
  cd aniwatch-api
  npm install
  npm start
  ```

### B. consumet.ts ([consumet/api.consumet.org](https://github.com/consumet/api.consumet.org))
* **Primary Target:** Multi-provider aggregator (Gogoanime, AnimePahe, Zoro, Bilibili).
* **Key Advantages:**
  * Provider redundancy: If one streaming host goes down or changes its markup, the app can fail over to another provider seamlessly.
  * Direct MP4 download links extracted from GogoCDN, StreamSB, and Kwik.
  * Docker container available for one-line deployment:
    ```bash
    docker pull riimuru/consumet-api
    docker run -d -p 3000:3000 riimuru/consumet-api
    ```

---

## 3. Standard Android REST Endpoints & Data Contracts

### Core API Routes (Based on `aniwatch-api` & `consumet`)

| Purpose | Route | Description |
| :--- | :--- | :--- |
| **Home Screen Feed** | `GET /api/v2/hianime/home` | Spotlight banner, trending anime, latest completed, and new episodes. |
| **Search Catalog** | `GET /api/v2/hianime/search?keyword={query}&page=1` | Search queries with pagination. |
| **Anime Detail View** | `GET /api/v2/hianime/anime/{anime-id}` | Synopsis, genres, ratings, status, studio, and franchise relations. |
| **Episode Listing** | `GET /api/v2/hianime/episodes/{anime-id}` | Array of all episode numbers, IDs, and titles. |
| **Server Switcher** | `GET /api/v2/hianime/servers?id={episode-id}` | Lists available CDNs (HD-1, HD-2, StreamSB) and categories (Sub / Dub). |
| **Stream & Download** | `GET /api/v2/hianime/episode-sources?id={episode-id}&server=hd-1&category=sub` | Returns stream `.m3u8` URLs, download URLs, headers, and subtitles. |

### Sample JSON Response (Stream & Download Sources)

```json
{
  "success": true,
  "data": {
    "headers": {
      "Referer": "https://megacloud.tv/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
    },
    "sources": [
      {
        "url": "https://.../master.m3u8",
        "isM3U8": true,
        "quality": "auto"
      }
    ],
    "download": "https://.../download-page-or-direct.mp4",
    "subtitles": [
      {
        "lang": "English",
        "url": "https://.../subtitles/eng-1.vtt"
      }
    ]
  }
}
```

---

## 4. Technical Requirements for Android Development

### 1. HTTP Headers & Anti-Hotlinking Protection
* **Problem:** Streaming servers (MegaCloud, GogoCDN, Kwik) validate incoming requests. Without legitimate headers, video streams will fail with `HTTP 403 Forbidden`.
* **Solution:** Pass the `Referer` and `User-Agent` received from the backend into Android's `DefaultHttpDataSource.Factory` in **ExoPlayer / Media3**:
  ```kotlin
  val httpDataSourceFactory = DefaultHttpDataSource.Factory()
      .setUserAgent(backendUserAgent)
      .setDefaultRequestProperties(mapOf("Referer" to backendReferer))
  ```

### 2. Streaming vs. Downloading Architecture
* **Streaming (`.m3u8` HLS):** ExoPlayer handles multi-bitrate HLS natively.
* **Direct MP4 Downloads:** Can be delegated to Android's native `DownloadManager` or `WorkManager` with `OkHttp`.
* **HLS (`.m3u8`) Segmented Downloads:** For sources that only supply `.m3u8` streams:
  * **Option A:** Use **ExoPlayer / Media3 `DownloadService`** to cache encrypted/segmented HLS playlists locally for offline playback.
  * **Option B:** Integrate **`ffmpeg-kit-android`** to download segments and remux them into a single local `.mp4` file.

### 3. Metadata Quality & Taxonomy
* Scraper sites frequently treat each anime season (e.g., *Jujutsu Kaisen Season 1* vs. *Season 2*) as independent entries.
* **Recommended Hybrid Model:**
  * Use the free **[AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs)** or **Jikan (MyAnimeList API)** for official catalog metadata, search suggestions, season grouping, banners, and character details.
  * Use the scraper backend purely as a resolver for stream and download links.

---

## 5. Content Freshness, Episode Coverage & Updates

1. **Upload Cadence:**
   * Automated scrapers monitor Japanese television simulcasts and licensed providers (Crunchyroll, Netflix, HIDIVE).
   * New episodes are typically available on scraper CDNs within **30 to 60 minutes** of broadcasting.
2. **Library Depth:**
   * Catalogs include both ongoing series and long-running legacy franchises (e.g., *One Piece* 1000+ episodes, *Dragon Ball*, *Naruto*).
   * Both Subbed and Dubbed audio options are provided via server endpoints.

---

## 6. Legal, Play Store Policies & Risk Mitigation

| Domain | Risk / Condition | Recommended Mitigation |
| :--- | :--- | :--- |
| **Google Play Store Policy** | Apps providing access to copyrighted third-party media violate Play Store policies and will be banned. | Distribute the app as an APK via **GitHub Releases**, **F-Droid**, or an independent website (the approach used by Aniyomi, Cloudstream, Dantotsu). |
| **Backend IP Bans & Rate Limiting** | Forwarding all Android client requests from a single server IP causes target streaming sites to blacklist the backend. | 1. Implement **Redis caching** for metadata and episode lists (12–24h TTL).<br>2. Employ rotating proxy services for outbound scraper requests. |
| **Cloudflare Protection** | Target hosts periodically update Cloudflare Turnstile or DDoS verification. | Keep scraper libraries updated; both `consumet` and `aniwatch-api` actively maintain scraper decryption keys. |
| **Domain Shifts** | Scraped websites frequently rotate domains (e.g., `.to` &rarr; `.tv`). | Store provider base URLs in server environment variables or remote config flags so domain changes do not require app updates. |
| **Server Architecture** | Centralized proxying of video streams incurs high bandwidth costs and legal liability. | **Lightweight Scraper Architecture:** The backend only decrypts and returns video links; client devices stream directly from the CDN. Alternatively, adopt a **Client-Side Extension Engine** (like Aniyomi/Cloudstream) where scraping runs directly on the device with zero server hosting costs. |
