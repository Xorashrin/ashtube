# AshTube — High-Speed Streaming & Multi-Thread Downloader

<p align="center">
  <img src="assets/ashtube_logo.png" alt="AshTube Logo" width="130" style="border-radius: 28px;" />
</p>

<p align="center">
  <b>Developed by ASRAFUL ISLAM</b><br>
  <i>Lead Architect &amp; Full-Stack Mobile Engineer</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-ff3366?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/APK%20Size-5--8%20MB-00f2fe?style=for-the-badge" alt="APK Size" />
  <img src="https://img.shields.io/badge/BDIX-100%20Mbps%20Direct-00c853?style=for-the-badge" alt="BDIX" />
  <img src="https://img.shields.io/badge/Downloader-Multi--Threaded-ff9100?style=for-the-badge" alt="Downloader" />
</p>

---

## ⚡ Overview

**AshTube** is a next-generation, ultra-fast streaming and downloading media platform designed for Android and modern web browsers. Featuring direct 100 Mbps BDIX FTP peering, native mobile gesture controls, an aria2c-style multi-threaded segmented downloader, and live Bangla TV streaming.

### 🌟 Key Features

1. **Ultra-Lightweight & Super Fast (5–8 MB):**
   - Built with native Android hardware acceleration (`android:hardwareAccelerated="true"`).
   - Instant 0-second launch with local bundled assets.
   - Proguard/R8 optimization to keep the APK footprint under 8 MB.

2. **Developer Welcome Screen:**
   - Prominently showcases **Developed by ASRAFUL ISLAM** upon opening the app.

3. **Advanced Mobile Gesture Video Player:**
   - **Left Swipe:** Smooth vertical brightness adjustment with HUD indicator.
   - **Right Swipe:** Smooth vertical volume control.
   - **Double-Tap Seek:** 10s forward / 10s backward seek animations.
   - **Dual-Audio Switcher:** Instant toggle between English and Bangla dubbed tracks.
   - **Landscape Rotation Lock:** Seamless cinematic full-screen view.

4. **Multi-Thread Segmented Downloader:**
   - Splits video streams into 4–8 concurrent chunks using HTTP Range requests.
   - Assembles directly on disk with live MB/s progress tracking and pause/resume support.
   - In-app offline video playback.

5. **Universal BDIX Latency Diagnostics & Live TV:**
   - Real-time parallel latency scanner across CircleFTP, Discovery Network, AmberIT, SAM Online, and DhakaFTP.
   - 12+ live Bangla, Sports, Entertainment, and Kids TV channels with HLS `.m3u8` failover.

---

## 🚀 Automated Android APK Build (GitHub Actions)

This repository includes a GitHub Actions workflow that automatically compiles and packages the Android APK upon every push.

1. Navigate to the **[Actions Tab](../../actions)** in this repository.
2. Select the latest run of **Build AshTube Android APK**.
3. Download the **`AshTube-v1.0.0-APK`** artifact, or grab the pre-compiled APK directly from the **[Releases](../../releases)** tab.

---

## 🛠️ Local Development & Web Server

To run the web version and Python API microservices locally:

```bash
# Clone the repository
git clone https://github.com/Xorashrin/ashtube.git
cd ashtube

# Start the AshTube backend server
python3 server.py
```

Open your browser and navigate to `http://localhost:8000`.

### Media sources (`source_engine.py`)

| Source | Used for | Status |
| :--- | :--- | :--- |
| Discovery FTP (BDIX, h5ai index) | Movies, series, anime, K-drama, Bangla/South Indian files (direct MKV/MP4, HTTP Range) | Live |
| Stremio Cinemeta | Search beyond the built-in catalog, IMDb ids, real episode lists | Live |
| Mrgify BDIX IPTV playlist | Live Bangla TV (dead streams filtered out) | Live |
| Consumet (FlixHQ / DramaCool / Gogoanime) | HLS streams | Needs `CONSUMET_URL` (public instance is offline) |
| aniwatch-api (HiAnime) | Anime HLS, sub and dub | Needs `ANIWATCH_URL` |

```bash
# optional: self-host the HLS providers, then start AshTube with their addresses
docker run -d -p 3000:3000 riimuru/consumet-api
CONSUMET_URL=http://localhost:3000 python3 server.py
```

If no source hosts a title, the app says so instead of playing a placeholder. In the APK, enter the
server address (for example `http://192.168.0.10:8000`) in the box under the BDIX card on the Live TV tab.

---

## 📄 License & Credits

Created and maintained with ❤️ by **ASRAFUL ISLAM**.
All rights reserved.
