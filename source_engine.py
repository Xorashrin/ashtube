#!/usr/bin/env python3
"""
AshTube Source Engine
Developed by ASRAFUL ISLAM

Real, verified media sources taken from the AshTube research documents:
  * Discovery FTP (BDIX, h5ai directory index)  -> direct MKV/MP4 files with HTTP Range
  * Stremio Cinemeta (metadata engine of Stremio / Torrentio) -> IMDb ids, years, episodes
  * Consumet (FlixHQ / DramaCool / Gogoanime) and aniwatch-api -> HLS streams.
    The public instances are offline, so they are used only when CONSUMET_URL /
    ANIWATCH_URL point at a self-hosted instance (docker run -p 3000:3000 riimuru/consumet-api).
  * Mrgify BDIX IPTV playlist -> live Bangla TV channels

Nothing here fabricates URLs: if a title is not found, the resolver says so.
"""

import difflib
import json
import os
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from typing import Any, Dict, List, Optional, Tuple

UA = "Mozilla/5.0 (Linux; Android 14; AshTube/1.0)"
CONSUMET_URL = os.environ.get("CONSUMET_URL", "").rstrip("/")
ANIWATCH_URL = os.environ.get("ANIWATCH_URL", "").rstrip("/")

QUALITY_RE = re.compile(r"(2160p|4k|1440p|1080p|720p|576p|480p|360p)", re.I)
VIDEO_EXT = (".mkv", ".mp4", ".m3u8", ".webm", ".avi")
SUB_EXT = (".srt", ".vtt")


# --------------------------------------------------------------------------- http

class TTLCache:
    def __init__(self):
        self._data: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            hit = self._data.get(key)
            if hit and hit[0] > time.time():
                return hit[1]
            return None

    def set(self, key: str, value: Any, ttl: float):
        with self._lock:
            self._data[key] = (time.time() + ttl, value)


cache = TTLCache()


def http_get(url: str, timeout: float = 15, headers: Optional[Dict[str, str]] = None) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def http_json(url: str, timeout: float = 15, headers: Optional[Dict[str, str]] = None) -> Any:
    return json.loads(http_get(url, timeout, headers))


def probe(url: str, timeout: float = 8, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Range probe: tells whether a URL really serves bytes, its size, and if seeking works."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-0", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            cr = resp.headers.get("Content-Range", "")
            m = re.search(r"/(\d+)$", cr)
            size = int(m.group(1)) if m else int(resp.headers.get("Content-Length") or 0)
            return {"ok": resp.status in (200, 206), "seekable": resp.status == 206, "size": size,
                    "type": resp.headers.get("Content-Type", "")}
    except Exception:
        return {"ok": False, "seekable": False, "size": 0, "type": ""}


# ----------------------------------------------------------------------- helpers

def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    text = re.sub(r"\(.*?\)|\[.*?\]", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"^(the|a|an) ", "", text.strip())
    return re.sub(r"\s+", " ", text).strip()


def match_score(query: str, candidate: str) -> float:
    q, c = norm(query), norm(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 1.0
    qc, cc = q.replace(" ", ""), c.replace(" ", "")
    if qc == cc:
        return 0.98
    ratio = difflib.SequenceMatcher(None, qc, cc).ratio()
    if cc.startswith(qc) and len(qc) >= 6:
        ratio = max(ratio, 0.86)
    return ratio


def strip_category_suffix(title: str) -> str:
    """'KGF: Chapter 2 (Bangla Dubbed)' -> 'KGF: Chapter 2'."""
    return re.sub(r"\s*\((?:bangla dubbed|original bangla|bangla blockbuster|dubbed)[^)]*\)\s*$", "", title or "", flags=re.I).strip()


def quality_of(name: str) -> str:
    m = QUALITY_RE.search(name)
    if not m:
        return "HD"
    q = m.group(1).lower()
    return "4k" if q in ("2160p", "4k") else q


def quality_rank(q: str) -> int:
    order = {"4k": 5, "1440p": 4, "1080p": 3, "720p": 2, "576p": 1, "480p": 1, "360p": 0, "HD": 2}
    return order.get(q, 2)


def fmt_bytes(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num < 1024 or unit == "TB":
            return f"{num:.0f} {unit}" if unit in ("B", "KB") else f"{num:.1f} {unit}"
        num /= 1024
    return ""


# ----------------------------------------------------------------------- cinemeta

class Cinemeta:
    """Stremio Cinemeta: the metadata engine behind Stremio/Torrentio (docs: MOVIE research)."""
    BASE = "https://v3-cinemeta.strem.io"

    def search(self, query: str) -> List[Dict[str, Any]]:
        key = f"cm:s:{query.lower()}"
        hit = cache.get(key)
        if hit is not None:
            return hit
        q = urllib.parse.quote(query.strip())
        out: List[Dict[str, Any]] = []
        for kind in ("movie", "series"):
            try:
                data = http_json(f"{self.BASE}/catalog/{kind}/top/search={q}.json", timeout=10)
                out.extend(self._to_item(m, kind) for m in data.get("metas", []))
            except Exception:
                continue
        out = [o for o in out if o]
        cache.set(key, out, 1800)
        return out

    def meta(self, imdb_id: str, kind: str) -> Optional[Dict[str, Any]]:
        key = f"cm:m:{kind}:{imdb_id}"
        hit = cache.get(key)
        if hit is not None:
            return hit
        try:
            data = http_json(f"{self.BASE}/meta/{kind}/{imdb_id}.json", timeout=12)
        except Exception:
            return None
        item = self._to_item(data.get("meta") or {}, kind, with_episodes=True)
        if item:
            cache.set(key, item, 3600)
        return item

    def _to_item(self, m: Dict[str, Any], kind: str, with_episodes: bool = False) -> Optional[Dict[str, Any]]:
        imdb = m.get("imdb_id") or m.get("id")
        name = m.get("name")
        if not imdb or not name or not re.match(r"^tt\d+$", imdb):
            return None
        year_match = re.search(r"(\d{4})", str(m.get("year") or m.get("releaseInfo") or ""))
        year = year_match.group(1) if year_match else ""
        poster = m.get("poster") or f"https://images.metahub.space/poster/medium/{imdb}/img"
        item: Dict[str, Any] = {
            "id": f"cm-{imdb}",
            "imdbId": imdb,
            "title": name,
            "category": "movies" if kind == "movie" else "series",
            "year": year,
            "rating": m.get("imdbRating") or "N/A",
            "quality": "HD",
            "duration": m.get("runtime") or "",
            "genres": " · ".join(m.get("genres") or m.get("genre") or []),
            "backdrop": m.get("background") or poster,
            "poster": poster,
            "synopsis": m.get("description") or "",
            "isBDIX": False,
            "audioTracks": [],
            "isSeries": kind == "series",
            "remote": True,
        }
        if with_episodes and kind == "series":
            seasons: Dict[int, List[Dict[str, Any]]] = {}
            for v in m.get("videos") or []:
                season, num = v.get("season"), v.get("episode") or v.get("number")
                if season is None or not num or season < 1:
                    continue
                aired = v.get("released") or v.get("firstAired")
                if aired and aired[:10] > time.strftime("%Y-%m-%d"):
                    continue
                seasons.setdefault(int(season), []).append({
                    "epNum": int(num),
                    "title": v.get("name") or v.get("title") or f"Episode {num}",
                    "runtime": item["duration"] or "",
                    "thumb": v.get("thumbnail") or poster,
                })
            item["seasons"] = [
                {"seasonNumber": s, "episodes": sorted(eps, key=lambda e: e["epNum"])}
                for s, eps in sorted(seasons.items())
            ]
        return item

    def identify(self, title: str, year: str = "", series: Optional[bool] = None) -> Optional[Dict[str, Any]]:
        """Best Cinemeta match for a title (+year), used to get the IMDb id."""
        best, best_score = None, 0.0
        for cand in self.search(strip_category_suffix(title)):
            if series is not None and cand["isSeries"] != series:
                continue
            score = match_score(title, cand["title"])
            if year and cand["year"] and cand["year"] == str(year):
                score += 0.05
            if score > best_score:
                best, best_score = cand, score
        return best if best_score >= 0.8 else None


cinemeta = Cinemeta()


# ------------------------------------------------------------------- discovery ftp

class DiscoveryFTP:
    """Discovery FTP (BDIX): h5ai directory index with direct files. Verified: HTTP 206 Range support."""
    NAME = "Discovery FTP"
    MOVIE_ROOTS = {
        "english": "https://cdn4.discoveryftp.net/Movies/English/",
        "hindi": "https://cdn1.discoveryftp.net/Movies/Hindi/",
        "bangla": "https://cdn1.discoveryftp.net/Movies/Bangla/",
        "tamil": "https://cdn1.discoveryftp.net/Movies/Tamil/",
        "animation": "https://cdn1.discoveryftp.net/Movies/Animation/",
        "others": "https://cdn1.discoveryftp.net/Movies/Others/",
    }
    SERIES_ROOTS = {
        "foreign": "https://cdn5.discoveryftp.net/Foreign%20Tv%20Series/",
        "dubbed": "https://cdn2.discoveryftp.net/Dubbed%20Tv%20Series/",
        "animation": "https://cdn2.discoveryftp.net/Animation%20Tv%20Series/",
        "bangla": "https://cdn2.discoveryftp.net/Bangla%20Web%20Series/",
        "hindi": "https://cdn2.discoveryftp.net/Hindi%20Web%20Series/",
        "tamil": "https://cdn2.discoveryftp.net/Tamil%20Web%20Series/",
    }
    # Which roots to search for each AshTube category (first = most likely)
    CATEGORY_MOVIE_ROOTS = {
        "movies": ["english", "animation", "others"],
        "bangla": ["bangla", "tamil", "others", "hindi", "english"],
        "anime": ["animation", "others"],
        "kdrama": ["others"],
        "series": [],
    }
    CATEGORY_SERIES_ROOTS = {
        "series": ["foreign", "dubbed", "animation"],
        "anime": ["animation", "foreign", "dubbed"],
        "kdrama": ["foreign", "dubbed"],
        "bangla": ["bangla", "dubbed", "tamil", "hindi"],
        "movies": [],
    }

    def list_dir(self, url: str, ttl: float = 3600) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
        """Returns (dirs, files) as lists of (name, absolute_url)."""
        key = f"dftp:{url}"
        hit = cache.get(key)
        if hit is not None:
            return hit
        html = http_get(url, timeout=25)
        parsed = urllib.parse.urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        dirs: List[Tuple[str, str]] = []
        files: List[Tuple[str, str]] = []
        seen = set()
        for href in re.findall(r'<a href="([^"]+)"', html):
            href = unescape(href)
            if href in ("..", "#") or href.startswith(("http", "?", "#", "javascript")) or "_h5ai" in href:
                continue
            absolute = urllib.parse.urljoin(base, href)
            if not absolute.startswith(url) or absolute == url or absolute in seen:
                continue
            seen.add(absolute)
            name = urllib.parse.unquote(absolute[len(url):].strip("/"))
            if "/" in name:
                continue
            (dirs if absolute.endswith("/") else files).append((name, absolute))
        result = (dirs, files)
        cache.set(key, result, ttl)
        return result

    def _best_dir(self, dirs: List[Tuple[str, str]], title: str, minimum: float = 0.86) -> Optional[Tuple[str, str]]:
        best, best_score = None, 0.0
        for name, url in dirs:
            score = match_score(title, name)
            if score > best_score:
                best, best_score = (name, url), score
        return best if best_score >= minimum else None

    def _files_in(self, url: str, sub_depth: int = 1) -> List[Tuple[str, str]]:
        dirs, files = self.list_dir(url, ttl=900)
        found = [f for f in files if f[0].lower().endswith(VIDEO_EXT + SUB_EXT)]
        if not found and sub_depth > 0:
            for _, d in dirs[:6]:
                found.extend(self._files_in(d, sub_depth - 1))
        return found

    # ---- movies
    def find_movie(self, title: str, year: str, roots: List[str]) -> List[Tuple[str, str]]:
        title = strip_category_suffix(title)
        years = [str(year)] if year else []
        if year and str(year).isdigit():
            years += [str(int(year) + 1), str(int(year) - 1)]
        for root_key in roots:
            root = self.MOVIE_ROOTS[root_key]
            for y in years:
                try:
                    dirs, files = self.list_dir(f"{root}{y}/")
                except Exception:
                    continue
                cand = self._best_dir(dirs, title)
                if cand:
                    found = self._files_in(cand[1])
                    if found:
                        return found
                # Some folders hold the files directly in the year directory
                direct = [f for f in files if f[0].lower().endswith(VIDEO_EXT) and match_score(title, re.split(r"\.(19|20)\d\d\.", f[0])[0].replace(".", " ")) >= 0.9]
                if direct:
                    return direct
        return []

    # ---- series
    def find_series_dir(self, title: str, roots: List[str]) -> Optional[Tuple[str, str]]:
        title = strip_category_suffix(title)
        best, best_score = None, 0.0
        for root_key in roots:
            try:
                dirs, _ = self.list_dir(self.SERIES_ROOTS[root_key], ttl=21600)
            except Exception:
                continue
            for name, url in dirs:
                score = match_score(title, name)
                if score > best_score:
                    best, best_score = (name, url), score
            if best_score >= 0.95:
                break
        return best if best_score >= 0.86 else None

    def find_episode(self, show_url: str, season: int, episode: int) -> List[Tuple[str, str]]:
        pat = re.compile(rf"S0*{season}[ ._-]*E0*{episode}(?!\d)", re.I)
        alt = re.compile(rf"(?:^|[^a-z0-9])E(?:p|pisode)?[ ._-]*0*{episode}(?!\d)", re.I)
        dirs, files = self.list_dir(show_url, ttl=900)
        season_dirs = [d for d in dirs if re.search(rf"(?:season|series|s)[ ._-]*0*{season}(?!\d)", d[0], re.I)]
        scan: List[Tuple[str, str]] = []
        for _, d in season_dirs or [(None, show_url)]:
            _, fs = self.list_dir(d, ttl=900)
            scan.extend(fs)
        scan.extend(files)
        hits = [f for f in scan if f[0].lower().endswith(VIDEO_EXT) and pat.search(f[0])]
        if not hits and season_dirs:
            hits = [f for f in scan if f[0].lower().endswith(VIDEO_EXT) and alt.search(f[0])]
        return hits

    def episode_count(self, show_url: str) -> Dict[int, int]:
        dirs, files = self.list_dir(show_url, ttl=900)
        counts: Dict[int, int] = {}
        for name, url in dirs:
            m = re.search(r"(\d+)", name)
            if m and re.search(r"season|series|^s\d", name, re.I):
                _, fs = self.list_dir(url, ttl=900)
                counts[int(m.group(1))] = len([f for f in fs if f[0].lower().endswith(VIDEO_EXT)])
        return counts

    # ---- shared
    def to_sources(self, files: List[Tuple[str, str]], kind_label: str = "") -> List[Dict[str, Any]]:
        videos = [f for f in files if f[0].lower().endswith(VIDEO_EXT)]
        subs = [f for f in files if f[0].lower().endswith(SUB_EXT)]
        sources = []
        with ThreadPoolExecutor(max_workers=6) as pool:
            probes = list(pool.map(lambda f: probe(f[1]), videos[:8]))
        for (name, url), pr in zip(videos[:8], probes):
            if not pr["ok"]:
                continue
            sources.append({
                "provider": self.NAME,
                "quality": quality_of(name),
                "size": fmt_bytes(pr["size"]),
                "sizeBytes": pr["size"],
                "url": url,
                "fileName": name,
                "container": name.rsplit(".", 1)[-1].lower(),
                "hls": name.lower().endswith(".m3u8"),
                "seekable": pr["seekable"],
                "bdix": True,
                "subtitles": [{"lang": _sub_lang(s[0]), "url": s[1]} for s in subs],
            })
        return sources


def _sub_lang(name: str) -> str:
    low = name.lower()
    for key, label in (("bangla", "Bengali"), ("bengali", "Bengali"), ("ben", "Bengali"), ("english", "English"), ("eng", "English")):
        if key in low:
            return label
    return "Subtitle"


discovery = DiscoveryFTP()


# ----------------------------------------------------------------- consumet / aniwatch

class Consumet:
    """Consumet REST routes (FlixHQ, DramaCool, Gogoanime) - needs a self-hosted CONSUMET_URL."""

    def available(self) -> bool:
        if not CONSUMET_URL:
            return False
        cached = cache.get("consumet:alive")
        if cached is not None:
            return cached
        try:
            http_get(f"{CONSUMET_URL}/", timeout=5)
            alive = True
        except urllib.error.HTTPError:
            alive = True
        except Exception:
            alive = False
        cache.set("consumet:alive", alive, 120)
        return alive

    def _provider(self, category: str) -> Tuple[str, str]:
        if category == "anime":
            return "anime", "gogoanime"
        if category == "kdrama":
            return "movies", "dramacool"
        return "movies", "flixhq"

    def resolve(self, category: str, title: str, season: int, episode: int, year: str = "") -> List[Dict[str, Any]]:
        if not self.available():
            return []
        group, name = self._provider(category)
        q = urllib.parse.quote(strip_category_suffix(title))
        results = http_json(f"{CONSUMET_URL}/{group}/{name}/{q}", timeout=15).get("results", [])
        pick = max(results, key=lambda r: match_score(title, r.get("title", "")), default=None)
        if not pick or match_score(title, pick.get("title", "")) < 0.8:
            return []
        info_url = f"{CONSUMET_URL}/{group}/{name}/info?id={urllib.parse.quote(pick['id'])}"
        info = http_json(info_url, timeout=20)
        episodes = info.get("episodes") or []
        ep = None
        if episodes:
            ep = next((e for e in episodes if int(e.get("season", 1) or 1) == season and int(e.get("number", 0) or 0) == episode), None)
            ep = ep or (episodes[episode - 1] if 0 < episode <= len(episodes) else None)
        if group == "anime":
            watch = f"{CONSUMET_URL}/anime/{name}/watch/{urllib.parse.quote(ep['id'])}" if ep else None
        else:
            if not ep and info.get("episodes") is not None and info.get("type", "").lower().startswith("movie") and episodes:
                ep = episodes[0]
            watch = f"{CONSUMET_URL}/movies/{name}/watch?episodeId={urllib.parse.quote(ep['id'])}&mediaId={urllib.parse.quote(info.get('id', pick['id']))}" if ep else None
        if not watch:
            return []
        data = http_json(watch, timeout=25)
        headers = data.get("headers") or {}
        subs = [{"lang": s.get("lang", "Subtitle"), "url": s.get("url")} for s in data.get("subtitles", []) if s.get("url")]
        out = []
        for s in data.get("sources", []):
            url = s.get("url")
            if not url:
                continue
            out.append({
                "provider": f"Consumet {name}",
                "quality": str(s.get("quality", "auto")).lower() if s.get("quality") else "auto",
                "size": "",
                "sizeBytes": 0,
                "url": url,
                "hls": bool(s.get("isM3U8")) or ".m3u8" in url,
                "seekable": True,
                "headers": headers,
                "bdix": False,
                "subtitles": subs,
            })
        return out


class Aniwatch:
    """aniwatch-api (HiAnime) v2 routes - needs a self-hosted ANIWATCH_URL."""

    def available(self) -> bool:
        if not ANIWATCH_URL:
            return False
        cached = cache.get("aniwatch:alive")
        if cached is not None:
            return cached
        try:
            http_get(f"{ANIWATCH_URL}/api/v2/hianime/home", timeout=6)
            alive = True
        except Exception:
            alive = False
        cache.set("aniwatch:alive", alive, 120)
        return alive

    def resolve(self, title: str, episode: int) -> List[Dict[str, Any]]:
        if not self.available():
            return []
        base = f"{ANIWATCH_URL}/api/v2/hianime"
        q = urllib.parse.quote(strip_category_suffix(title))
        animes = http_json(f"{base}/search?q={q}&page=1", timeout=15).get("data", {}).get("animes", [])
        pick = max(animes, key=lambda a: match_score(title, a.get("name", "")), default=None)
        if not pick or match_score(title, pick.get("name", "")) < 0.75:
            return []
        eps = http_json(f"{base}/anime/{pick['id']}/episodes", timeout=15).get("data", {}).get("episodes", [])
        ep = next((e for e in eps if e.get("number") == episode), None)
        if not ep:
            return []
        eid = urllib.parse.quote(ep["episodeId"], safe="")
        out = []
        for category in ("sub", "dub"):
            try:
                data = http_json(f"{base}/episode/sources?animeEpisodeId={eid}&server=hd-1&category={category}", timeout=25).get("data", {})
            except Exception:
                continue
            subs = [{"lang": t.get("lang", "Subtitle"), "url": t.get("url")} for t in data.get("tracks", []) if t.get("url") and t.get("kind") != "thumbnails"]
            for s in data.get("sources", []):
                if s.get("url"):
                    out.append({
                        "provider": f"aniwatch {category}",
                        "quality": "auto",
                        "size": "",
                        "sizeBytes": 0,
                        "url": s["url"],
                        "hls": bool(s.get("isM3U8")) or ".m3u8" in s["url"],
                        "seekable": True,
                        "headers": data.get("headers") or {},
                        "bdix": False,
                        "audio": "Dubbed" if category == "dub" else "Original + Subtitles",
                        "subtitles": subs,
                    })
        return out


consumet = Consumet()
aniwatch = Aniwatch()


# --------------------------------------------------------------------- resolver

def pick_default(sources: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Best default: prefer browser-playable containers, then up to 1080p, then biggest."""
    def key(s):
        playable = 2 if (s.get("hls") or s.get("container") in ("mp4", "webm")) else 1
        q = quality_rank(s["quality"])
        capped = q if q <= 3 else 3 - (q - 3) * 0.1
        return (playable, capped, 1 if s.get("bdix") else 0)
    return max(sources, key=key, default=None)


def _lookup_all(category: str, title: str, year: str, season: int, episode: int, is_series: bool, imdb_id: str) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    status: Dict[str, str] = {}
    sources: List[Dict[str, Any]] = []
    tasks = {}

    def ftp_series():
        show = discovery.find_series_dir(title, discovery.CATEGORY_SERIES_ROOTS.get(category, ["foreign", "dubbed"]))
        if not show:
            return []
        return discovery.to_sources(discovery.find_episode(show[1], season, episode))

    def ftp_movie():
        roots = discovery.CATEGORY_MOVIE_ROOTS.get(category) or ["english"]
        return discovery.to_sources(discovery.find_movie(title, year, roots))

    with ThreadPoolExecutor(max_workers=4) as pool:
        if is_series:
            tasks[pool.submit(ftp_series)] = "Discovery FTP"
        else:
            tasks[pool.submit(ftp_movie)] = "Discovery FTP"
        if category == "anime" and aniwatch.available():
            tasks[pool.submit(aniwatch.resolve, title, episode)] = "aniwatch-api"
        if consumet.available():
            tasks[pool.submit(consumet.resolve, category, title, season, episode, year)] = "Consumet"
        for fut in as_completed(tasks, timeout=60):
            name = tasks[fut]
            try:
                found = fut.result()
                sources.extend(found)
                status[name] = f"{len(found)} source(s)" if found else "not found"
            except Exception as exc:
                status[name] = f"error: {exc}"
    if CONSUMET_URL == "" and "Consumet" not in status:
        status["Consumet"] = "not configured (set CONSUMET_URL to a self-hosted instance)"
    if category == "anime" and not ANIWATCH_URL:
        status["aniwatch-api"] = "not configured (set ANIWATCH_URL to a self-hosted instance)"
    return sources, status


def resolve_media(media_id: str, category: str, title: str, year: str = "", season: int = 1, episode: int = 1,
                  is_series: Optional[bool] = None) -> Dict[str, Any]:
    category = (category or "").lower() or (media_id.split("-")[0] if "-" in media_id else "movies")
    category = {"movie": "movies"}.get(category, category)
    imdb_id = ""
    if media_id.startswith("cm-"):
        imdb_id = media_id[3:]
    if is_series is None:
        is_series = category in ("series", "anime", "kdrama")
    # Names like "Hawa (Original Bangla)" are always movies in the catalog; honour explicit flag when given.
    if not title and imdb_id:
        meta = cinemeta.meta(imdb_id, "series" if is_series else "movie")
        if meta:
            title, year = meta["title"], meta["year"]

    cache_key = f"resolve:{category}:{title}:{year}:{season}:{episode}:{bool(is_series)}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    sources, status = _lookup_all(category, title, str(year or ""), int(season), int(episode), bool(is_series), imdb_id)
    sources.sort(key=lambda s: (-quality_rank(s["quality"]), s["provider"]))
    default = pick_default(sources)
    qualities: Dict[str, str] = {}
    for s in sources:
        qualities.setdefault(s["quality"], s["url"])

    result = {
        "found": bool(sources),
        "title": title,
        "category": category,
        "season": season if is_series else None,
        "episode": episode if is_series else None,
        "stream_url": default["url"] if default else "",
        "download_url": max(sources, key=lambda s: (s.get("seekable"), s.get("sizeBytes", 0)), default={}).get("url", "") if sources else "",
        "headers": default.get("headers", {}) if default else {},
        "subtitles": default.get("subtitles", []) if default else [],
        "audio_tracks": sorted({s["audio"] for s in sources if s.get("audio")}),
        "qualities": qualities,
        "sources": sources,
        "providers": status,
    }
    if not sources:
        result["error"] = "No source currently hosts this title"
    cache.set(cache_key, result, 600 if sources else 120)
    return result


def search_bdix(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Searches Discovery FTP for titles matching the query (via Cinemeta for year/type)."""
    query = (query or "").strip()
    if len(query) < 3:
        return []
    key = f"bdixsearch:{query.lower()}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    cands = cinemeta.search(query)[:4]
    results: List[Dict[str, Any]] = []

    def one(c):
        if c["isSeries"]:
            show = discovery.find_series_dir(c["title"], ["foreign", "dubbed", "animation", "bangla", "hindi", "tamil"])
            if show:
                return {"server": DiscoveryFTP.NAME, "title": c["title"], "year": c["year"], "type": "series", "path": show[1], "online": True}
        else:
            files = discovery.find_movie(c["title"], c["year"], ["english", "animation", "bangla", "hindi", "tamil", "others"])
            vids = [f for f in files if f[0].lower().endswith(VIDEO_EXT)]
            if vids:
                best = max(vids, key=lambda f: quality_rank(quality_of(f[0])))
                return {"server": DiscoveryFTP.NAME, "title": c["title"], "year": c["year"], "type": "movie",
                        "file_path": best[0], "direct_url": best[1], "quality": quality_of(best[0]), "online": True}
        return None

    with ThreadPoolExecutor(max_workers=4) as pool:
        for r in pool.map(one, cands):
            if r:
                results.append(r)
    cache.set(key, results[:limit], 900)
    return results[:limit]


# -------------------------------------------------------------------------- live tv

MRGIFY_URL = "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/Channels_data.json"

_CATEGORY_RULES = [
    ("sports", re.compile(r"sport|cricket|football|ten\b|\bt ?sports|gazi|ptv sports|star sports", re.I)),
    ("news", re.compile(r"news|somoy|jamuna|ekattor|dbc|independent|channel ?24|atn news|ekushey|news24|nagorik|bangla ?vision", re.I)),
    ("kids", re.compile(r"kid|cartoon|duronto|nick|pogo|disney|toon|chhota|doraemon|motu|patlu|gopal|bheem|peppa", re.I)),
]


def _classify(name: str) -> Tuple[str, str]:
    for cat, rx in _CATEGORY_RULES:
        if rx.search(name):
            return cat, cat.upper()
    return "entertainment", "BANGLA"


def _probe_stream(url: str, timeout: float = 6) -> Tuple[bool, float]:
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            head = resp.read(2048).decode("utf-8", errors="ignore")
            ok = resp.status == 200 and ("#EXTM3U" in head or "#EXT" in head)
            return ok, (time.time() - start) * 1000
    except Exception:
        return False, 0.0


def fetch_live_channels(force: bool = False) -> List[Dict[str, Any]]:
    """Live Bangla TV from the Mrgify BDIX IPTV playlist; dead streams are filtered out."""
    if not force:
        hit = cache.get("livetv")
        if hit is not None:
            return hit
    data = http_json(MRGIFY_URL, timeout=15)
    raw = [c for c in data.get("channels", []) if c.get("name") and str(c.get("url", "")).startswith("http")]
    # Same channel can appear with several URLs: keep the first as primary, the rest as backups.
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for c in raw:
        grouped.setdefault(norm(re.sub(r"\(\d+p\)", "", c["name"])), []).append(c)

    def check(group: List[Dict[str, Any]]):
        alive = []
        for c in group:
            ok, ms = _probe_stream(c["url"])
            if ok:
                alive.append((c, ms))
        return group[0]["name"], alive

    channels: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        for name, alive in pool.map(check, grouped.values()):
            if not alive:
                continue
            primary, ms = alive[0]
            clean = re.sub(r"\s*\((\d+p)\)", "", primary["name"]).strip()
            res = re.search(r"\((\d+p)\)", primary["name"])
            category, badge = _classify(clean)
            channels.append({
                "id": re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-"),
                "name": clean,
                "category": category,
                "program": "Live",
                "latency": f"{int(ms)}ms",
                "isHls": ".m3u8" in primary["url"],
                "streamUrl": primary["url"],
                "backupUrl": alive[1][0]["url"] if len(alive) > 1 else "",
                "badge": badge,
                "resolution": res.group(1) if res else "Live",
            })
    channels.sort(key=lambda c: (c["category"] != "news", c["name"].lower()))
    if channels:
        cache.set("livetv", channels, 600)
    return channels


# ----------------------------------------------------------------------- ping/status

def provider_status() -> Dict[str, Any]:
    out = {}
    for name, url in (("Discovery FTP", "https://cdn4.discoveryftp.net/Movies/English/"), ("Cinemeta", "https://v3-cinemeta.strem.io/manifest.json")):
        start = time.time()
        try:
            http_get(url, timeout=8)
            out[name] = {"online": True, "latency_ms": round((time.time() - start) * 1000)}
        except Exception as exc:
            out[name] = {"online": False, "error": str(exc)}
    out["Consumet"] = {"online": consumet.available(), "configured": bool(CONSUMET_URL)}
    out["aniwatch-api"] = {"online": aniwatch.available(), "configured": bool(ANIWATCH_URL)}
    return out


if __name__ == "__main__":
    import sys
    r = resolve_media("movie-dune-2", "movies", "Dune: Part Two", "2024")
    print(json.dumps({k: r[k] for k in ("found", "stream_url", "qualities", "providers")}, indent=1))
    sys.exit(0 if r["found"] else 1)
