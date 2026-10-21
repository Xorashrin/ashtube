# Bangladesh Media Sources, BDIX Ecosystem & Backend Integration Analysis

This document provides a technical evaluation of **10 Bangladesh-specific open-source media sources, scrapers, and indexers on GitHub**, followed by an analysis of backend feasibility, download reliability, player controls (seek, pause, play), language switching, and metadata accuracy for your **MythFlix** app.

---

## 1. Top 10 Bangladesh-Specific Media Sources & Repositories

| # | Project / Repository | Category | Core Purpose | Content Coverage |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **[redowan99/Redowan-CloudStream](https://github.com/redowan99/Redowan-CloudStream)** | CloudStream Extension | Aggregates Bangladeshi BDIX media servers, Bangla dubbed movies, and OTT series. | Bengali web series, Natok, foreign dubbed films, BDIX FTP servers. |
| **2** | **[Niloy-Sarker/niloy-cloudstream](https://github.com/Niloy-Sarker/niloy-cloudstream)** | CloudStream Plugin | Scrapes DhakaFlix and local BDIX movie portals paired with TMDB identifiers. | Local ISP FTP media, Bangla cinema, Hollywood with Bangla subtitles. |
| **3** | **[abusaeeidx/Toffee-playlist](https://github.com/abusaeeidx/Toffee-playlist)** | Live TV & VOD Scraper | Auto-scrapes live streams and VOD content from the Banglalink Toffee platform. | Bangladeshi live sports, news, entertainment, and drama series. |
| **4** | **[viewlift-ripper/hoichoi-api](https://github.com/viewlift-ripper/hoichoi-api)** | OTT API Wrapper | Reverse-engineers ViewLift endpoints for Hoichoi to extract media manifests. | Bengali original web series, Kolkata & Bangladeshi movies. |
| **5** | **[abusaeeidx/Mrgify-BDIX-IPTV](https://github.com/abusaeeidx/Mrgify-BDIX-IPTV)** | IPTV Playlist System | Automatically generates and tests working BDIX live TV playlists (`.m3u8`). | 100+ Bangladeshi and Indian satellite channels on BDIX peering. |
| **6** | **[Shadmanislam/bdiptv](https://github.com/Shadmanislam/bdiptv)** | BDIX Live TV Hub | Open list of 500+ live television channels with BDIX routing. | National Bangladeshi channels (BTV, Channel i, Somoy, Jamuna) and sports. |
| **7** | **[Sourav9063/ftp_searcher](https://github.com/Sourav9063/ftp_searcher)** | BDIX FTP Search Engine | Indexes and searches files across major Bangladeshi ISP FTP servers. | High-speed direct downloads of movies, TV series, software, and games. |
| **8** | **[FakeErrorX/BDIX-FTP-TESTER](https://github.com/FakeErrorX/BDIX-FTP-TESTER)** | BDIX Checker / Indexer | Multi-platform tool that crawls, verifies status, and extracts direct links from BDIX servers. | Discovers active BDIX endpoints (CircleFTP, SamOnline, ICC, RoarFTP). |
| **9** | **[jahidhimon/bioscope](https://github.com/jahidhimon/bioscope)** | OTT Integration | API and scraping framework for Grameenphone's Bioscope platform. | Bangladeshi telefilms, Eid drama specials, and classic Bangla cinema. |
| **10** | **[imShakil/tvlink](https://github.com/imShakil/tvlink)** | Media Link Aggregator | Curated, updated repository of streaming endpoints for Bangladeshi media. | Mixed VOD and live TV streams across regional platforms. |

---

## 2. Can These Sources Be Integrated Into Your App Backend?

### A. The BDIX Peering Barrier (Crucial Architectural Reality)
* **What is BDIX?** The Bangladesh Internet Exchange (BDIX) connects local ISPs at ultra-high speed (up to 100 Mbps).
* **The Problem:** BDIX FTP servers (like CircleFTP, SamOnline, DhakaFTP) **only work if the user is connected to a participating Bangladeshi ISP**.
  * If a user tries to access a BDIX link from **Mobile Data (Grameenphone, Banglalink, Robi)** or an ISP that does not peer with that specific server, the link will **time out / fail**.
  * If your backend server is hosted on AWS, DigitalOcean, or Hetzner in Germany or Singapore, **your backend cannot access private BDIX servers** unless it routes through a local Bangladeshi BDIX proxy server.
* **Backend Recommendation:** For BDIX sources, use a **Client-Side Resolver** (like Cloudstream's model) where the Android app tests and connects to BDIX servers directly from the user's home Wi-Fi network.

### B. OTT Platforms & Widevine DRM (Hoichoi, Chorki, Toffee Premium)
* **Free Content & Live TV:** Non-DRM streams (like Toffee Live TV or free Natoks on Bioscope) return standard `.m3u8` playlists and can easily be proxied through your backend.
* **Premium Subscription Content:** Commercial platforms (Chorki, Hoichoi Premium) protect their original web series with **Google Widevine Modular DRM**.
  * Raw video chunks are encrypted (`.enc` / cenc).
  * Without legitimate Widevine license server tokens and CDM keys, the extracted stream will output a black screen with no audio.
  * Any third-party scraper claiming to download premium Chorki/Hoichoi content breaks frequently whenever the platform rotates its decryption tokens.

---

## 3. Can Content Be Downloaded, Streamed, and Controlled?

| Feature | BDIX FTP Sources | Live TV (Toffee, BD IPTV) | Free OTT VOD (Bioscope, Toffee) | Premium OTT (Chorki, Hoichoi) |
| :--- | :---: | :---: | :---: | :---: |
| **Direct Download** | **Yes** (Extreme speed via `DownloadManager`) | **No** (Live broadcast; only recordable) | **Yes** (Via `Media3 DownloadService`) | **No** (Blocked by Widevine DRM) |
| **Smooth Streaming** | **Yes** (On BDIX Wi-Fi) | **Yes** (Low latency HLS) | **Yes** (Adaptive HLS) | **Requires DRM License** |
| **Play / Pause** | **Yes** | **Yes** | **Yes** | **Yes** |
| **Seek (Rewind/Fast-Forward)** | **Yes** (Instant) | **No** (Unless Catch-up TV is supported) | **Yes** (Full timeline seek) | **Yes** |
| **Search Capabilities** | **Yes** (File query via `ftp_searcher`) | **Yes** (Channel name query) | **Yes** (Catalog API) | **Yes** (Catalog API) |

---

## 4. Language & Audio Switching (Multi-Audio Support)

* **Bangladeshi Native Content (Natok, Bangla Films, Web Series):**
  * Almost all Bangladeshi content is recorded with a **single native Bengali audio track**.
  * There are **no alternative language audio tracks** (no English or Hindi dubbed versions exist for native Bangladeshi dramas).
  * **Subtitles:** Some shows include embedded English subtitles (`.vtt` / `.srt`), which can be parsed and selected via ExoPlayer's `TrackSelectionParameters`.
* **Foreign Movies Dubbed in Bengali:**
  * BDIX FTP servers frequently host Hollywood, South Indian, and Bollywood movies with dual-audio tracks (e.g., *Track 1: English, Track 2: Bengali Dubbed*).
  * In Android, **ExoPlayer automatically parses all audio tracks**. You can provide an in-app "Audio Language" toggle that switches tracks instantly without rebuffering.

---

## 5. Metadata Fidelity: Will Thumbnails and Titles Match Content?

### Scenario 1: Official Scrapers (Toffee, Bioscope, Hoichoi APIs)
* **Content Match:** **100% Accurate.**
* The poster thumbnail, synopsis, episode number, and video stream originate from the platform's official database. There is zero risk of fake titles or mismatched videos.

### Scenario 2: Community BDIX FTP Servers (CircleFTP, SamOnline, etc.)
* **Content Match:** **Inconsistent (Requires Backend Sanitization).**
* BDIX servers are managed by local ISP network administrators who upload raw torrents and rename folders manually.
* **Common Issues:**
  * An entry labeled `Avatar_2_1080p_Dual_Audio.mp4` might actually be a low-quality CAM rip with muffled sound.
  * Filenames often contain scene junk: `Movie.Name.2024.1080p.HEVC.x265-BDTech.mkv`.
* **How MythFlix Should Solve This:**
  1. Do not display raw filenames from BDIX FTPs directly to users.
  2. Run a backend filename sanitizer regex:
     ```python
     clean_title = re.sub(r'(\d{4}|1080p|720p|WEB-DL|BluRay|x264|x265|HEVC).*', '', raw_filename)
     ```
  3. Query the **TMDB API** with `clean_title` to fetch the verified official poster, cast, and overview.
  4. Only display the item in the UI if it passes verification.

---

## 6. Recommended Architecture for MythFlix Bangladesh

To offer a high-performance experience without broken links or ISP timeouts:

```
                                  ┌───────────────────────────────────┐
                                  │      MythFlix Android App         │
                                  └───────────────┬───────────────────┘
                                                  │
                                  ┌───────────────┴───────────────────┐
                                  ▼                                   ▼
                   ┌───────────────────────────────┐   ┌───────────────────────────────┐
                   │  If User is on BDIX Wi-Fi     │   │ If User is on Mobile / Non-BD │
                   └──────────────┬────────────────┘   └──────────────┬────────────────┘
                                  │                                   │
                                  ▼                                   ▼
                   ┌───────────────────────────────┐   ┌───────────────────────────────┐
                   │ Query Local BDIX FTP Links    │   │ Query Global CDN Resolvers    │
                   │ (Niloy / Redowan Cloudstream) │   │ (TMDB-Embed, Consumet FlixHQ) │
                   │  - Download Speed: ~100 Mbps  │   │  - Works on Any ISP / 4G      │
                   └───────────────────────────────┘   └───────────────────────────────┘
```

1. **For Live TV:** Use **[abusaeeidx/Toffee-playlist](https://github.com/abusaeeidx/Toffee-playlist)** and **[Mrgify-BDIX-IPTV](https://github.com/abusaeeidx/Mrgify-BDIX-IPTV)**. They deliver buffer-free national channels with proper stream headers.
2. **For High-Speed Downloads:** Enable BDIX FTP detection in your Android app so users on home broadband can download movies at 50–100 Mbps using Android's native `DownloadManager`.
3. **For Global Availability:** Always keep **TMDB-Embed** or **Consumet** active as the primary fallback so mobile data users (Grameenphone/Robi 4G) never experience connection timeouts.
