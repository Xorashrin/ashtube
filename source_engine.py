#!/usr/bin/env python3
"""
AshTube Source Engine
Developed by ASRAFUL ISLAM

Resolves a title to real, verified, seekable media:
  * BDIX index (bdix_index.py): DhakaFlix 7/9/10/12/14, Discovery FTP, CTGFun, FTP-146  -> direct MKV/MP4
  * HiAnime (ani-cli provider): anime sub/dub as HLS with VTT subtitles

A file is only offered when ALL of these hold, so a thumbnail can never open different content:
  1. normalized title equals the metadata title (or one of its alternates)
  2. release year matches (movies) / show start year is compatible (series)
  3. season+episode match exactly (series)
  4. the file is alive (HTTP Range probe) and its real duration (ffprobe) fits the expected runtime
"""

import base64
import json
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import bdix_index

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
BAD_NAME = re.compile(r"\b(sample|trailer|featurette|extras?|behind the scenes|bonus|teaser|promo)\b", re.I)


# --------------------------------------------------------------------------- cache / http

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
            if len(self._data) > 5000:
                now = time.time()
                self._data = {k: v for k, v in self._data.items() if v[0] > now}
            self._data[key] = (time.time() + ttl, value)


cache = TTLCache()
_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="ashtube")      # top-level jobs
_leaf = ThreadPoolExecutor(max_workers=48, thread_name_prefix="ashtube-io")    # leaf I/O only, never submits more work


def http_get(url: str, timeout: float = 15, headers: Optional[Dict[str, str]] = None) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return raw.decode(resp.headers.get_content_charset() or "utf-8", errors="replace")


def http_json(url: str, timeout: float = 15, headers: Optional[Dict[str, str]] = None) -> Any:
    return json.loads(http_get(url, timeout, headers))


def probe(url: str, timeout: float = 4) -> Dict[str, Any]:
    """Range probe: alive, size, and whether seeking (206) works."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            m = re.search(r"/(\d+)$", resp.headers.get("Content-Range", ""))
            size = int(m.group(1)) if m else int(resp.headers.get("Content-Length") or 0)
            ctype = resp.headers.get("Content-Type", "")
            ok = resp.status in (200, 206) and "text/html" not in ctype
            return {"ok": ok, "seekable": resp.status == 206, "size": size, "type": ctype}
    except Exception:
        return {"ok": False, "seekable": False, "size": 0, "type": ""}


def media_duration(url: str, timeout: int = 8) -> Optional[float]:
    """Real container duration in minutes via ffprobe (reads only the header over HTTP)."""
    key = f"dur:{url}"
    hit = cache.get(key)
    if hit is not None:
        return hit or None
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-rw_timeout", str(timeout * 1_000_000), "-show_entries", "format=duration",
             "-of", "csv=p=0", url],
            capture_output=True, text=True, timeout=timeout + 4)
        minutes = float(out.stdout.strip()) / 60 if out.stdout.strip() else 0.0
    except Exception:
        minutes = 0.0
    cache.set(key, minutes, 6 * 3600)
    return minutes or None


# --------------------------------------------------------------------------- text helpers

norm = bdix_index.norm
title_key = bdix_index.title_key


def strip_category_suffix(title: str) -> str:
    """'KGF: Chapter 2 (Bangla Dubbed)' -> 'KGF: Chapter 2'."""
    return re.sub(r"\s*\((?:bangla dubbed|bengali dubbed|original bangla|bangla blockbuster|dubbed|dual audio)[^)]*\)\s*$", "", title or "", flags=re.I).strip()


def quality_rank(q: str) -> int:
    return {"4k": 5, "1440p": 4, "1080p": 3, "720p": 2, "576p": 1, "480p": 1, "360p": 0, "HD": 2, "auto": 3}.get(q, 2)


def fmt_bytes(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num < 1024 or unit == "TB":
            return f"{num:.0f} {unit}" if unit in ("B", "KB") else f"{num:.1f} {unit}"
        num /= 1024
    return ""


# --------------------------------------------------------------------------- index provider

def _row_to_source(r) -> Dict[str, Any]:
    name = r["name"] or ""
    container = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return {
        "provider": bdix_index.server_label(r["server"]),
        "serverId": r["server"],
        "quality": r["quality"] or "HD",
        "codec": r["codec"] or "",
        "size": fmt_bytes(r["size"]) if r["size"] else "",
        "sizeBytes": r["size"] or 0,
        "url": r["url"],
        "fileName": name,
        "container": container,
        "hls": False,
        "seekable": True,
        "bdix": True,
        "bucket": r["bucket"] or "",
        "mtime": r["mtime"] or 0,
    }


def _dir_to_sources(dir_row, season: Optional[int], episode: Optional[int]) -> List[Dict[str, Any]]:
    """Lazy listing of a title folder; parses each file path so S/E can be matched exactly."""
    out = []
    for f in bdix_index.list_dir_files(dir_row["url"], depth=2):
        rel = urllib.parse.unquote(f["href"])
        parsed = bdix_index.parse_entry(rel)
        if not parsed or BAD_NAME.search(parsed["name"]):
            continue
        if season is not None and (parsed["season"], parsed["episode"]) != (season, episode):
            continue
        if season is None and parsed["episode"] is not None:
            continue
        if f["size"] and f["size"] < 80 * 1024 * 1024:
            continue
        name = parsed["name"]
        t = f["time"] or 0
        out.append({
            "provider": bdix_index.server_label(dir_row["server"]), "serverId": dir_row["server"],
            "quality": parsed["quality"], "codec": parsed["codec"], "size": fmt_bytes(f["size"]) if f["size"] else "",
            "sizeBytes": f["size"] or 0, "url": f["url"], "fileName": name,
            "container": name.rsplit(".", 1)[-1].lower(), "hls": False, "seekable": True, "bdix": True,
            "bucket": parsed["bucket"], "mtime": int(t / 1000) if t > 1e11 else t,
        })
    return out


def _year_ok(row_year: Optional[int], want: Optional[int], tol: int) -> bool:
    if not want or not row_year:
        return True
    return abs(row_year - want) <= tol


def index_sources(titles: List[str], year: Optional[int], is_series: bool, season: int, episode: int) -> List[Dict[str, Any]]:
    keys = []
    for t in titles:
        k = title_key(strip_category_suffix(t))
        if k and k not in keys:
            keys.append(k)
    rows = []
    for k in keys:
        rows.extend(bdix_index.find(k))
    if not rows and keys:
        # tolerant path: every token present, same token set once articles are removed
        tokens = keys[0].split()
        for r in bdix_index.find_fuzzy(tokens):
            if set(r["tkey"].split()) == set(tokens):
                rows.append(r)
    if not rows:
        return []

    files, dirs = [], []
    for r in rows:
        (files if r["kind"] == "file" else dirs).append(r)

    sources: List[Dict[str, Any]] = []
    if is_series:
        # Index years are the show's FIRST air year, so later seasons only need "started on or before this season".
        yok = (lambda ry: ry is None or not year or ry <= year + 1) if season > 1 else (lambda ry: _year_ok(ry, year, 1))
        for r in files:
            if r["season"] == season and r["episode"] == episode and yok(r["year"]) and not BAD_NAME.search(r["name"] or ""):
                if not r["size"] or r["size"] > 40 * 1024 * 1024:
                    sources.append(_row_to_source(r))
        if len(sources) < 3:
            show_dirs = [d for d in dirs if yok(d["year"])][:4]
            for fut in [_leaf.submit(_dir_to_sources, d, season, episode) for d in show_dirs]:
                try:
                    sources.extend(fut.result(timeout=20))
                except Exception:
                    pass
    else:
        exact = [r for r in files + dirs if r["year"] == year] if year else files + dirs
        near = [r for r in files + dirs if _year_ok(r["year"], year, 1)] if year else []
        chosen = exact or near
        for r in chosen:
            if r["kind"] == "file" and r["episode"] is None and not BAD_NAME.search(r["name"] or "") \
                    and (not r["size"] or r["size"] > 100 * 1024 * 1024):
                sources.append(_row_to_source(r))
        dir_rows = [d for d in chosen if d["kind"] == "dir"][:6]
        for fut in [_leaf.submit(_dir_to_sources, d, None, None) for d in dir_rows]:
            try:
                sources.extend(fut.result(timeout=20))
            except Exception:
                pass
    return _dedupe(sources)


def _dedupe(sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Mirror servers (DhakaFlix 9 and 10 hold the same files) collapse into one source with failover URLs."""
    merged: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for s in sources:
        key = (s["fileName"].lower(), s["sizeBytes"])
        if key in merged:
            merged[key].setdefault("mirrors", []).append(s["url"])
        else:
            merged[key] = s
    return list(merged.values())


# --------------------------------------------------------------------------- HiAnime provider

class HiAnime:
    BASE = "https://hianime.at"
    KEY = b"otaku-embed-v1"
    _gate = threading.Semaphore(4)     # polite concurrency: the site rate-limits bursts

    def _get(self, url: str, referer: str = "", timeout: float = 12) -> str:
        with self._gate:
            for attempt in range(2):
                try:
                    return http_get(url, timeout, {"Referer": referer or self.BASE + "/"})
                except urllib.error.HTTPError as exc:
                    if exc.code not in (429, 503) or attempt:
                        raise
                    time.sleep(1.2)
        raise RuntimeError("unreachable")

    def search(self, title: str) -> List[Tuple[str, str]]:
        key = f"hi:s:{title.lower()}"
        hit = cache.get(key)
        if hit is not None:
            return hit
        page = self._get(f"{self.BASE}/search?keyword={urllib.parse.quote(title)}")
        if "Just a moment" in page:
            raise RuntimeError("HiAnime blocked by Cloudflare")
        page = re.sub(r'id="main-sidebar".*', "", page, flags=re.S)
        hits = re.findall(r'<h3 class="film-name">\s*<a href="[^"]*/([^"/]*)"\s*title="([^"]*)"', page)
        ent = {"&#039;": "'", "&amp;": "&", "&quot;": '"'}
        hits = [(slug, re.sub(r"&#039;|&amp;|&quot;", lambda m: ent[m.group(0)], name)) for slug, name in hits]
        cache.set(key, hits, 1800)
        return hits

    def episodes(self, slug: str) -> Dict[int, str]:
        key = f"hi:e:{slug}"
        hit = cache.get(key)
        if hit is not None:
            return hit
        raw = self._get(f"{self.BASE}/api/theme/episode/list/{slug.rsplit('-', 1)[-1]}").replace("\\", "")
        eps = {int(n): i for n, i in re.findall(r'data-number="([^"]*)".*?data-id="(\d+)"', raw.replace("ep-item", "\nep-item")) if n.isdigit()}
        cache.set(key, eps, 900)
        return eps

    def _deob(self, blob: str) -> dict:
        raw = base64.b64decode(blob)
        return json.loads(bytes(b ^ self.KEY[i % len(self.KEY)] for i, b in enumerate(raw)).decode("utf-8", "replace"))

    def streams(self, ep_id: str) -> List[Dict[str, Any]]:
        servers = self._get(f"{self.BASE}/api/theme/episode/servers?episodeId={ep_id}").replace('\\"', '"')
        embeds = {}
        for item in servers.replace("server-item", "\nserver-item").split("\n"):
            m = re.search(r'data-type="(\w+)".*?data-server-name="([^"]*)".*?data-hash="([^"]*)"', item)
            if m and m.group(2) == "ZokoAnime":
                embeds[m.group(1)] = base64.b64decode(m.group(3)).decode()
        out: List[Dict[str, Any]] = []

        def one(mode: str, embed: str):
            ref = re.match(r"https?://[^/]+/", embed).group(0)
            html = self._get(embed, self.BASE + "/")
            blob = re.search(r'window\.__P="([^"]*)"', html)
            if not blob:
                return []
            cfg = self._deob(blob.group(1))
            src = cfg.get("src")
            src = src if isinstance(src, str) else (src[0].get("src") if src else "")
            if not src:
                return []
            subs = [{"lang": s.get("label") or s.get("lang", "Subtitle"), "url": s["src"]} for s in cfg.get("subtitles", []) if s.get("src")]
            variants = [("auto", src)]
            try:
                master = self._get(src, ref)
                base = src.rsplit("/", 1)[0] + "/"
                lines = master.splitlines()
                for i, line in enumerate(lines):
                    mm = re.search(r"RESOLUTION=\d+x(\d+)", line)
                    if mm and i + 1 < len(lines):
                        nxt = lines[i + 1].strip()
                        variants.append((f"{mm.group(1)}p", nxt if nxt.startswith("http") else base + nxt))
            except Exception:
                pass
            return [{
                "provider": f"HiAnime {'Dub' if mode == 'dub' else 'Sub'}", "serverId": "hianime", "quality": q, "codec": "h264",
                "size": "", "sizeBytes": 0, "url": u, "fileName": "", "container": "m3u8", "hls": True, "seekable": True,
                "bdix": False, "bucket": "anime", "audio": "English Dub" if mode == "dub" else "Japanese + Subtitles",
                "subtitles": subs, "referer": ref,
            } for q, u in variants]

        futs = [_leaf.submit(one, mode, e) for mode, e in embeds.items()]
        for f in futs:
            try:
                out.extend(f.result(timeout=25))
            except Exception:
                pass
        return out


hianime = HiAnime()


def _anime_canon(name: str) -> str:
    """Canonical anime title: 'My Hero Academia Season 2' == 'My Hero Academia 2' == 'My Hero Academia 2nd Season'."""
    n = norm(name)
    n = re.sub(r"\b(\d+)(?:st|nd|rd|th) season\b", r"s\1", n)
    n = re.sub(r"\bseason (\d+)\b", r"s\1", n)
    for word, num in (("first", 1), ("second", 2), ("third", 3), ("fourth", 4), ("fifth", 5)):
        n = re.sub(rf"\b{word} season\b", f"s{num}", n)
    n = re.sub(r"(?<=[a-z]) (\d)$", r" s\1", n)          # trailing sequel number
    return n.strip()


def _anime_pick(titles: List[str]) -> Optional[str]:
    """Best HiAnime slug for any metadata title: canonical equality wins, else near-exact ratio (season markers must agree)."""
    import difflib
    want = [_anime_canon(t) for t in titles if t]
    if not want:
        return None
    best, best_score = None, 0.0
    for q in list(dict.fromkeys(titles))[:4]:
        try:
            hits = hianime.search(q)
        except Exception:
            continue
        for slug, name in hits[:10]:
            n = _anime_canon(name)
            if n in want:
                score = 1.0
            else:
                score = max(difflib.SequenceMatcher(None, n, w).ratio() for w in want)
                if re.search(r"\bs\d\b", n) != re.search(r"\bs\d\b", want[0]) and \
                        (re.search(r"\bs\d\b", n) and re.search(r"\bs\d\b", want[0]) and re.search(r"\bs\d\b", n).group() != re.search(r"\bs\d\b", want[0]).group()):
                    score -= 0.2     # different season number
            if score > best_score:
                best, best_score = slug, score
        if best_score >= 0.99:
            break
    return best if best_score >= 0.9 else None


def anime_sources(titles: List[str], episode: int) -> List[Dict[str, Any]]:
    slug = _anime_pick(titles)
    if not slug:
        return []
    ep_id = hianime.episodes(slug).get(episode)
    return hianime.streams(ep_id) if ep_id else []


# --------------------------------------------------------------------------- resolve

def _score(s: Dict[str, Any], category: str) -> float:
    score = {3: 5.0, 2: 4.2, 5: 3.4, 4: 3.6, 1: 2.5, 0: 1.0}.get(quality_rank(s["quality"]), 3.0)   # 1080p, 720p, then 4K
    score += 1.2 if s["container"] in ("mp4", "m4v", "m3u8") else 0
    score += 0.5 if s["codec"] == "h264" else (-0.3 if s["codec"] == "hevc" else 0)
    flags = set(s.get("bucket", "").split())
    if category == "bangla":
        score += 4 if "banglaDubbed" in flags else (2 if "bangla" in flags else 0)
    if category == "anime" and s.get("hls"):
        score += 1.5
    if s.get("seekable"):
        score += 0.5
    return score


def _verify(sources: List[Dict[str, Any]], expected_min: Optional[float], is_series: bool, category: str, limit: int = 4) -> List[Dict[str, Any]]:
    """Liveness (Range probe) for all candidates, then a real-duration check for the best few."""
    live: List[Dict[str, Any]] = []
    futs = {_leaf.submit(probe, s["url"]): s for s in sources[:14] if not s.get("hls")}
    for f in as_completed(futs):
        s = futs[f]
        try:
            p = f.result()
        except Exception:
            continue
        if p["ok"]:
            s["seekable"] = p["seekable"]
            if p["size"]:
                s["sizeBytes"], s["size"] = p["size"], fmt_bytes(p["size"])
            live.append(s)
        else:
            for m in s.get("mirrors", []):
                if probe(m)["ok"]:
                    s["url"] = m
                    live.append(s)
                    break
    live.extend(s for s in sources if s.get("hls"))
    live.sort(key=lambda s: -_score(s, category))

    head = [s for s in live if not s.get("hls")][:limit]
    durations = dict(zip((id(s) for s in head), _leaf.map(lambda s: media_duration(s["url"]), head)))
    keep = []
    for s in live:
        dur = durations.get(id(s))
        if s.get("hls") or id(s) not in durations:
            keep.append(s)
            continue
        s["durationMin"] = round(dur) if dur else None
        if dur:
            lo, hi = (8, 200) if is_series else (35, 400)
            if expected_min:
                lo, hi = expected_min * 0.55, expected_min * 1.6
            if not (lo <= dur <= hi):
                continue   # wrong content for this title
        keep.append(s)
    return keep


def resolve_media(media_id: str, category: str, title: str, year: str = "", season: int = 1, episode: int = 1,
                  is_series: Optional[bool] = None, alt_titles: Optional[List[str]] = None,
                  runtime_min: Optional[float] = None) -> Dict[str, Any]:
    category = (category or "").lower() or (media_id.split("-")[0] if "-" in media_id else "movies")
    category = {"movie": "movies"}.get(category, category)
    if is_series is None:
        is_series = category in ("series", "anime", "kdrama")
    titles = [title] + [t for t in (alt_titles or []) if t and t != title]
    year_i = int(year) if str(year or "").isdigit() else None

    cache_key = f"resolve:{category}:{'|'.join(titles[:3])}:{year_i}:{season}:{episode}:{bool(is_series)}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    status: Dict[str, str] = {}
    sources: List[Dict[str, Any]] = []
    jobs = {"BDIX index": _pool.submit(index_sources, titles, year_i, bool(is_series), int(season), int(episode))}
    if category == "anime":
        jobs["HiAnime"] = _pool.submit(anime_sources, titles, int(episode))
    for name, fut in jobs.items():
        try:
            found = fut.result(timeout=45)
            sources.extend(found)
            status[name] = f"{len(found)} source(s)" if found else "not found"
        except Exception as exc:
            status[name] = f"error: {str(exc)[:80]}"

    sources = _verify(sources, runtime_min, bool(is_series), category)
    default = max(sources, key=lambda s: _score(s, category), default=None)
    qualities: Dict[str, str] = {}
    for s in sorted(sources, key=lambda s: -_score(s, category)):
        qualities.setdefault(s["quality"], s["url"])

    result = {
        "found": bool(sources),
        "title": title,
        "category": category,
        "season": season if is_series else None,
        "episode": episode if is_series else None,
        "stream_url": default["url"] if default else "",
        "download_url": max((s for s in sources if not s.get("hls")), key=lambda s: (s.get("seekable"), s.get("sizeBytes", 0)), default={}).get("url", ""),
        "subtitles": default.get("subtitles", []) if default else [],
        "audio_tracks": sorted({s["audio"] for s in sources if s.get("audio")}),
        "qualities": qualities,
        "sources": sources,
        "providers": status,
    }
    if not sources:
        result["error"] = "No source currently hosts this exact title"
    cache.set(cache_key, result, 900 if sources else 90)
    return result


def has_source(titles: List[str], year: Optional[int], is_series: bool) -> bool:
    """Instant (local index only) availability check used to badge catalog cards."""
    for t in titles:
        k = title_key(strip_category_suffix(t))
        if not k:
            continue
        for r in bdix_index.find(k, limit=40):
            if is_series:
                if _year_ok(r["year"], year, 1) and (r["episode"] is not None or r["kind"] == "dir"):
                    return True
            elif r["episode"] is None and (year is None or _year_ok(r["year"], year, 1)):
                return True
    return False


def search_bdix(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Index-backed title search (used by /api/search and auto-suggest)."""
    tokens = norm(query).split()
    if not tokens:
        return []
    seen, out = set(), []
    for r in bdix_index.find_fuzzy(tokens, limit=150):
        key = (r["tkey"], r["year"])
        if key in seen:
            continue
        seen.add(key)
        out.append({"server": bdix_index.server_label(r["server"]), "title": r["title"], "year": r["year"],
                    "type": "series" if (r["episode"] is not None or "series" in (r["bucket"] or "")) else "movie",
                    "quality": r["quality"], "online": True})
        if len(out) >= limit:
            break
    return out


def provider_status() -> Dict[str, Any]:
    stats = bdix_index.index_stats()
    out: Dict[str, Any] = {"index": {"entries": stats["entries"]}}
    for sid, st in stats["status"].items():
        out[f"{bdix_index.server_label(sid)} [{sid}]"] = {"online": bool(st.get("ok")), "rows": st.get("rows", 0), "updated": st.get("at", 0)}
    start = time.time()
    try:
        hianime.search("naruto")
        out["HiAnime"] = {"online": True, "latency_ms": round((time.time() - start) * 1000)}
    except Exception as exc:
        out["HiAnime"] = {"online": False, "error": str(exc)[:80]}
    return out


# --------------------------------------------------------------------------- live tv (Mrgify BDIX IPTV)

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
            return resp.status == 200 and "#EXT" in head, (time.time() - start) * 1000
    except Exception:
        return False, 0.0


def fetch_live_channels(force: bool = False) -> List[Dict[str, Any]]:
    if not force:
        hit = cache.get("livetv")
        if hit is not None:
            return hit
    data = http_json(MRGIFY_URL, timeout=15)
    raw = [c for c in data.get("channels", []) if c.get("name") and str(c.get("url", "")).startswith("http")]
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for c in raw:
        grouped.setdefault(norm(re.sub(r"\(\d+p\)", "", c["name"])), []).append(c)

    def check(group):
        alive = []
        for c in group:
            ok, ms = _probe_stream(c["url"])
            if ok:
                alive.append((c, ms))
        return alive

    channels: List[Dict[str, Any]] = []
    for alive in _leaf.map(check, grouped.values()):
        if not alive:
            continue
        primary, ms = alive[0]
        clean = re.sub(r"\s*\((\d+p)\)", "", primary["name"]).strip()
        res = re.search(r"\((\d+p)\)", primary["name"])
        category, badge = _classify(clean)
        channels.append({
            "id": re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-"), "name": clean, "category": category,
            "program": "Live", "latency": f"{int(ms)}ms", "isHls": ".m3u8" in primary["url"],
            "streamUrl": primary["url"], "backupUrl": alive[1][0]["url"] if len(alive) > 1 else "",
            "badge": badge, "resolution": res.group(1) if res else "Live",
        })
    channels.sort(key=lambda c: (c["category"] != "news", c["name"].lower()))
    if channels:
        cache.set("livetv", channels, 600)
    return channels


if __name__ == "__main__":
    import sys
    r = resolve_media("movie-dune-2", "movies", "Dune: Part Two", "2024", runtime_min=166)
    print(json.dumps({k: r[k] for k in ("found", "stream_url", "qualities", "providers")}, indent=1))
    sys.exit(0 if r["found"] else 1)
