#!/usr/bin/env python3
"""
AshTube BDIX Index Engine
Developed by ASRAFUL ISLAM

Crawls the h5ai-powered BDIX servers documented in the research files (DhakaFlix cluster,
Discovery FTP) into a local SQLite + FTS5 database so every title lookup is a sub-millisecond
local query instead of a slow remote crawl.

  * DhakaFlix: one h5ai server-side search per extension dumps every video file with its size.
    If a server rejects a big dump, the crawler splits the request per sub-folder.
  * Discovery FTP: the h5ai `items` API lists title folders; files are listed lazily on demand.

The index is rebuilt in the background (stale servers first) and always stays usable while
refreshing, because each server is replaced inside one transaction.
"""

import json
import os
import re
import sqlite3
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, Iterable, List, Optional, Tuple

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("ASHTUBE_INDEX_DB", os.path.join(DIRECTORY, "index.db"))
UA = "Mozilla/5.0 (Linux; Android 14; AshTube/1.0)"
REFRESH_SECONDS = 6 * 3600

VIDEO_EXT = (".mkv", ".mp4", ".avi", ".webm", ".m4v", ".ts")
SEARCH_PATTERNS = (".mkv", ".mp4", ".avi")

# --------------------------------------------------------------------------- servers

DHAKAFLIX = [
    {"id": f"dhakaflix-{n}", "name": f"DhakaFlix {n}", "mode": "search",
     "base": f"http://172.16.50.{n}", "roots": [f"/DHAKA-FLIX-{n}/"]}
    for n in (7, 9, 10, 12, 14)
]

DISCOVERY = [
    {"id": "discovery-movies", "name": "Discovery FTP", "mode": "tree-year", "roots": [
        ("https://cdn4.discoveryftp.net", "/Movies/English/"),
        ("https://cdn1.discoveryftp.net", "/Movies/Hindi/"),
        ("https://cdn1.discoveryftp.net", "/Movies/Bangla/"),
        ("https://cdn1.discoveryftp.net", "/Movies/Tamil/"),
        ("https://cdn1.discoveryftp.net", "/Movies/Animation/"),
        ("https://cdn1.discoveryftp.net", "/Movies/Others/"),
    ]},
    {"id": "discovery-series", "name": "Discovery FTP", "mode": "tree-flat", "roots": [
        ("https://cdn5.discoveryftp.net", "/Foreign%20Tv%20Series/"),
        ("https://cdn2.discoveryftp.net", "/Dubbed%20Tv%20Series/"),
        ("https://cdn2.discoveryftp.net", "/Animation%20Tv%20Series/"),
        ("https://cdn2.discoveryftp.net", "/Bangla%20Web%20Series/"),
        ("https://cdn2.discoveryftp.net", "/Hindi%20Web%20Series/"),
        ("https://cdn2.discoveryftp.net", "/Tamil%20Web%20Series/"),
    ]},
]

# ------------------------------------------------------------------------ text parsing

_JUNK = re.compile(
    r"(?:\(|\[|\{|\s-\s|\bS\d{1,2}\s*E\d{1,3}\b|\bseason\b|\b(?:19|20)\d{2}\b|\b(?:2160p|1440p|1080p|720p|576p|480p|360p|4k|uhd)\b|"
    r"\b(?:blu-?ray|bdrip|brrip|web-?dl|webrip|hdrip|hdtv|dvdrip|hdcam|camrip|remux|x26[45]|h\.?26[45]|hevc|avc|10bit|dual|multi|esubs?|msubs?|hindi|bengali|bangla|tamil|telugu|dubbed|tv series|complete)\b)",
    re.I,
)
_QUALITY = re.compile(r"(2160p|1440p|1080p|720p|576p|480p|360p|4k|uhd)", re.I)
_YEAR = re.compile(r"(?<!\d)((?:19|20)\d{2})(?!\d)")
_SXXEXX = re.compile(r"\bS(\d{1,2})[ ._-]*E(\d{1,3})(?:[ ._-]*E?(\d{1,3}))?\b", re.I)
_NXNN = re.compile(r"\b(\d{1,2})x(\d{2,3})\b", re.I)
_EP_ONLY = re.compile(r"(?:\bE(?:p|pisode)?[ ._-]*(\d{1,3})\b|\[(\d{1,3})\])", re.I)
_DASH_EP = re.compile(r"\s-\s(\d{2,3})(?:v\d)?(?:\s|\[|\(|\.|$)")
_SEASON_DIR = re.compile(r"^(?:season|series|s)[ ._-]*0*(\d{1,2})\b", re.I)


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def title_key(text: str) -> str:
    """Normalized title with leading articles removed (so 'The Batman' == 'Batman')."""
    n = norm(text)
    return re.sub(r"^(the|a|an) ", "", n)


def clean_title(raw: str) -> str:
    """'Dune-Part Two (2024) 1080p [Dual Audio]' -> 'Dune Part Two'."""
    s = urllib.parse.unquote(raw)
    s = re.sub(r"\.(mkv|mp4|avi|webm|m4v|ts)$", "", s, flags=re.I)
    s = s.replace("_", " ")
    s = re.sub(r"^(?:\s*[\[(][^\])]*[\])])+\s*", "", s)  # leading [Fansub Group] / (tags)
    s = re.sub(r"(?<=[A-Za-z0-9])\.(?=[A-Za-z0-9])", " ", s)
    for m in _JUNK.finditer(s):
        if m.start() == 0:
            continue  # leading '[Group]', '(2024)' or a year-titled movie such as '1917' stays in the title
        s = s[:m.start()]
        break
    return re.sub(r"\s+", " ", s).strip(" -_.,")


def parse_quality(text: str) -> str:
    m = _QUALITY.search(text)
    if not m:
        return "HD"
    q = m.group(1).lower()
    return "4k" if q in ("2160p", "4k", "uhd") else q


def parse_codec(text: str) -> str:
    low = text.lower()
    if re.search(r"x265|hevc|h\.?265", low):
        return "hevc"
    if re.search(r"av1", low):
        return "av1"
    if re.search(r"x264|h\.?264|avc", low):
        return "h264"
    return ""


def classify(path: str, name: str, is_episode: bool) -> str:
    """Category bucket, space separated flags: movies|series|anime|kdrama|bangla|dubbed ."""
    p = urllib.parse.unquote(path).lower()
    flags = set()
    if re.search(r"anime|cartoon|animation", p):
        flags.add("anime")
    if re.search(r"korean|k-drama|kdrama|\bk-?series", p):
        flags.add("kdrama")
    if re.search(r"bangla|bengali|kolkata|dhallywood|bd movies", p):
        flags.add("bangla")
    if re.search(r"bangla[ _.-]*dub|bengali[ _.-]*dub|dubbed[ _.-]*(?:in[ _.-]*)?(?:bangla|bengali)|\bbn[ _.-]*dub", p):
        flags.add("banglaDubbed")
    if re.search(r"dubbed|dual[ _.-]*audio|hindi[ _.-]*dub", p):
        flags.add("dubbed")
    flags.add("series" if is_episode or re.search(r"tv[ _-]*(?:&|and)?[ _-]*web|tv series|web series|tv shows|series", p) else "movies")
    return " ".join(sorted(flags))


def parse_entry(rel_path: str, is_dir: bool = False) -> Optional[Dict[str, Any]]:
    """Turns a decoded relative path (…/Show (2008)/Season 1/Show S01E02 1080p.mkv) into index fields."""
    parts = [p for p in rel_path.strip("/").split("/") if p]
    if not parts:
        return None
    name = parts[-1]
    parents = parts[:-1]
    se = _SXXEXX.search(name) or _SXXEXX.search(" ".join(parents[-2:]))
    nx = _NXNN.search(name)
    season = episode = None
    if se:
        season, episode = int(se.group(1)), int(se.group(2))
    elif nx:
        season, episode = int(nx.group(1)), int(nx.group(2))
    else:
        sd = next((int(m.group(1)) for p in reversed(parents) if (m := _SEASON_DIR.match(p))), None)
        em = _EP_ONLY.search(name)
        dm = _DASH_EP.search(name)
        if sd is not None and em:
            season, episode = sd, int(em.group(1) or em.group(2))
        elif dm and not is_dir:
            season, episode = (sd or 1), int(dm.group(1))
    is_episode = episode is not None

    # Title source: for episodes the show folder (above any 'Season N' folder), else the filename/folder.
    if is_episode:
        show = None
        for p in reversed(parents):
            if _SEASON_DIR.match(p) or re.match(r"^(?:specials?|extras?|complete)\b", p, re.I):
                continue
            if re.match(r"^tv series\b|^web series\b|^tv-web", p, re.I):
                continue
            show = p
            break
        title_src = show or name
        if title_key(clean_title(title_src)) == "":
            title_src = name
    elif is_dir:
        title_src = name
    else:
        title_src = name
        # A bare 'movie.mkv' (e.g. 'Movie.mkv', 'movie.1080p.mkv') inherits the folder title.
        stem = clean_title(name)
        if len(stem) < 2 and parents:
            title_src = parents[-1]
    title = clean_title(title_src)
    tkey = title_key(title)
    if not tkey:
        return None

    year = None
    for src in (name, *reversed(parents)):
        dec = urllib.parse.unquote(src)
        paren = re.findall(r"[\(\[](?:[^\)\]]*?\b)?((?:19|20)\d{2})(?!\d)", dec)
        loose = [y for y in _YEAR.findall(dec) if y != title.replace(" ", "")]
        pick = paren[0] if paren else (loose[-1] if loose else None)
        if pick:
            year = int(pick)
            break

    folder = urllib.parse.unquote("/".join(parents[-2:]))
    text = f"{'/'.join(parents)}/{name}"
    return {
        "title": title,
        "tkey": tkey,
        "year": year,
        "season": season,
        "episode": episode,
        "quality": parse_quality(text),
        "codec": parse_codec(text),
        "bucket": classify(rel_path, name, is_episode),
        "folder": folder,
        "name": name,
    }


# --------------------------------------------------------------------------- http

def _request(url: str, payload: Optional[dict] = None, timeout: float = 30) -> Any:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"User-Agent": UA}
    if data:
        headers["Content-Type"] = "application/json;charset=UTF-8"
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def h5ai_items(base: str, href: str, timeout: float = 20) -> List[Dict[str, Any]]:
    """Direct children of a directory via the h5ai JSON API."""
    d = _request(base + href, {"action": "get", "items": {"href": href, "what": 1}}, timeout)
    out = []
    prefix = urllib.parse.unquote(href)
    for it in d.get("items", []):
        h = it.get("href", "")
        dec = urllib.parse.unquote(h)
        if dec == prefix or not dec.startswith(prefix):
            continue
        rest = dec[len(prefix):].strip("/")
        if rest and "/" not in rest:
            out.append(it)
    return out


def h5ai_search(base: str, root: str, pattern: str, timeout: float = 120) -> List[Dict[str, Any]]:
    d = _request(base + root, {"action": "get", "search": {"href": root, "pattern": pattern, "ignorecase": True}}, timeout)
    return d.get("search") or []


# ------------------------------------------------------------------------- database

_local = threading.local()
_db_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS entries(
  id INTEGER PRIMARY KEY,
  server TEXT NOT NULL, kind TEXT NOT NULL,        -- 'file' | 'dir'
  url TEXT NOT NULL, name TEXT, folder TEXT,
  size INTEGER, mtime INTEGER,
  title TEXT, tkey TEXT, year INTEGER,
  season INTEGER, episode INTEGER,
  quality TEXT, codec TEXT, bucket TEXT
);
CREATE INDEX IF NOT EXISTS ix_tkey ON entries(tkey);
CREATE INDEX IF NOT EXISTS ix_server ON entries(server);
CREATE INDEX IF NOT EXISTS ix_mtime ON entries(mtime DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(tkey, content='', contentless_delete=1, tokenize='unicode61');
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
"""


def db() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=60, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.row_factory = sqlite3.Row
        conn.executescript(SCHEMA)
        _local.conn = conn
    return conn


def set_meta(key: str, value: Any):
    with _db_lock:
        db().execute("INSERT OR REPLACE INTO meta VALUES(?,?)", (key, json.dumps(value)))
        db().commit()


def get_meta(key: str, default=None):
    row = db().execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def _store(server_id: str, rows: List[Tuple]):
    """Atomically replaces every row of one server."""
    with _db_lock:
        conn = db()
        conn.execute("BEGIN")
        try:
            old = [(r["id"],) for r in conn.execute("SELECT id FROM entries WHERE server=?", (server_id,))]
            if old:
                conn.executemany("DELETE FROM fts WHERE rowid=?", old)
                conn.execute("DELETE FROM entries WHERE server=?", (server_id,))
            conn.executemany(
                "INSERT INTO entries(server,kind,url,name,folder,size,mtime,title,tkey,year,season,episode,quality,codec,bucket) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
            conn.execute("INSERT INTO fts(rowid, tkey) SELECT id, tkey FROM entries WHERE server=?", (server_id,))
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise


def _row(server_id: str, kind: str, base: str, href: str, size: Optional[int], mtime: Optional[int], is_dir: bool, rel_root: str) -> Optional[Tuple]:
    dec = urllib.parse.unquote(href)
    rel = dec[len(urllib.parse.unquote(rel_root)):] if dec.startswith(urllib.parse.unquote(rel_root)) else dec
    full_rel = dec
    parsed = parse_entry(full_rel, is_dir=is_dir)
    if not parsed:
        return None
    url = base + (href if href.startswith("/") else "/" + href)
    return (server_id, kind, url, parsed["name"], parsed["folder"], int(size) if size else 0,
            int(mtime / 1000) if mtime and mtime > 1e11 else int(mtime or 0),
            parsed["title"], parsed["tkey"], parsed["year"], parsed["season"], parsed["episode"],
            parsed["quality"], parsed["codec"], parsed["bucket"])


# -------------------------------------------------------------------------- crawlers

def crawl_search_server(srv: Dict[str, Any]) -> List[Tuple]:
    """DhakaFlix style: h5ai search dumps (split per folder when a dump is too large for the server)."""
    base = srv["base"]
    rows: List[Tuple] = []
    seen = set()

    def dump(root: str, depth: int):
        for pat in SEARCH_PATTERNS:
            try:
                items = h5ai_search(base, root, pat, timeout=150)
            except Exception:
                if depth >= 4:
                    continue
                try:
                    kids = [k for k in h5ai_items(base, root) if k["href"].endswith("/")]
                except Exception:
                    continue
                with ThreadPoolExecutor(max_workers=6) as pool:
                    futs = [pool.submit(dump_one, k["href"], pat, depth + 1) for k in kids]
                    for f in as_completed(futs):
                        for it in f.result():
                            add(it)
                continue
            for it in items:
                add(it)

    def dump_one(root: str, pat: str, depth: int):
        try:
            return h5ai_search(base, root, pat, timeout=150)
        except Exception:
            if depth >= 5:
                return []
            try:
                kids = [k for k in h5ai_items(base, root) if k["href"].endswith("/")]
            except Exception:
                return []
            out = []
            for k in kids:
                out.extend(dump_one(k["href"], pat, depth + 1))
            return out

    def add(it):
        href = it.get("href", "")
        if href.endswith("/") or not href.lower().endswith(VIDEO_EXT) or href in seen:
            return
        seen.add(href)
        row = _row(srv["id"], "file", base, href, it.get("size"), it.get("time"), False, srv["roots"][0])
        if row:
            rows.append(row)

    for root in srv["roots"]:
        dump(root, 0)
    return rows


def crawl_tree_server(srv: Dict[str, Any]) -> List[Tuple]:
    """Discovery style: list title folders (movies per year folder, series per show folder)."""
    rows: List[Tuple] = []
    year_mode = srv["mode"] == "tree-year"

    def one_root(base: str, root: str):
        out = []
        try:
            level1 = h5ai_items(base, root)
        except Exception:
            return out
        if year_mode:
            year_dirs = [k for k in level1 if k["href"].endswith("/")]
            with ThreadPoolExecutor(max_workers=8) as pool:
                futs = {pool.submit(h5ai_items, base, k["href"]): k for k in year_dirs}
                for f in as_completed(futs):
                    try:
                        children = f.result()
                    except Exception:
                        continue
                    for c in children:
                        if c["href"].endswith("/"):
                            r = _row(srv["id"], "dir", base, c["href"], 0, c.get("time"), True, root)
                        elif c["href"].lower().endswith(VIDEO_EXT):
                            r = _row(srv["id"], "file", base, c["href"], c.get("size"), c.get("time"), False, root)
                        else:
                            continue
                        if r:
                            out.append(r)
        else:
            for c in level1:
                if c["href"].endswith("/"):
                    r = _row(srv["id"], "dir", base, c["href"], 0, c.get("time"), True, root)
                elif c["href"].lower().endswith(VIDEO_EXT):
                    r = _row(srv["id"], "file", base, c["href"], c.get("size"), c.get("time"), False, root)
                else:
                    continue
                if r:
                    out.append(r)
        return out

    with ThreadPoolExecutor(max_workers=4) as pool:
        for part in pool.map(lambda br: one_root(*br), srv["roots"]):
            rows.extend(part)
    return rows


def build_server(srv: Dict[str, Any]) -> int:
    started = time.time()
    rows = crawl_search_server(srv) if srv["mode"] == "search" else crawl_tree_server(srv)
    if not rows:
        # Never wipe a working index because a server was unreachable during this run.
        set_meta(f"status:{srv['id']}", {"ok": False, "at": int(time.time()), "rows": 0})
        return 0
    _store(srv["id"], rows)
    try:
        db().execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except sqlite3.Error:
        pass
    set_meta(f"status:{srv['id']}", {"ok": True, "at": int(time.time()), "rows": len(rows), "seconds": round(time.time() - started, 1)})
    return len(rows)


def all_servers() -> List[Dict[str, Any]]:
    return DHAKAFLIX + DISCOVERY


def build_all(only: Optional[Iterable[str]] = None) -> Dict[str, int]:
    result = {}
    for srv in all_servers():
        if only and srv["id"] not in only:
            continue
        try:
            result[srv["id"]] = build_server(srv)
        except Exception as exc:
            result[srv["id"]] = -1
            set_meta(f"status:{srv['id']}", {"ok": False, "at": int(time.time()), "error": str(exc)[:200]})
    return result


_refresher_started = False


def start_background_refresh():
    """Builds missing/stale servers first, then refreshes every REFRESH_SECONDS."""
    global _refresher_started
    if _refresher_started:
        return
    _refresher_started = True

    def loop():
        while True:
            stale = []
            for srv in all_servers():
                st = get_meta(f"status:{srv['id']}", {})
                age = time.time() - st.get("at", 0) if st.get("ok") else 1e12
                if age > REFRESH_SECONDS:
                    stale.append(srv["id"])
            if stale:
                build_all(stale)
            time.sleep(300)

    threading.Thread(target=loop, daemon=True, name="bdix-index-refresh").start()


def index_stats() -> Dict[str, Any]:
    conn = db()
    total = conn.execute("SELECT COUNT(*) c FROM entries").fetchone()["c"]
    per = {r["server"]: r["c"] for r in conn.execute("SELECT server, COUNT(*) c FROM entries GROUP BY server")}
    status = {s["id"]: get_meta(f"status:{s['id']}", {}) for s in all_servers()}
    return {"entries": total, "perServer": per, "status": status}


# ---------------------------------------------------------------------------- query

def _server_name(server_id: str) -> str:
    for s in all_servers():
        if s["id"] == server_id:
            return s["name"]
    return server_id


def find(tkey: str, categories: Optional[Iterable[str]] = None, limit: int = 400) -> List[sqlite3.Row]:
    """Exact normalized-title matches (fast path)."""
    rows = db().execute("SELECT * FROM entries WHERE tkey=? LIMIT ?", (tkey, limit)).fetchall()
    return rows


def find_fuzzy(tokens: List[str], limit: int = 300) -> List[sqlite3.Row]:
    """All entries whose title contains every token (prefix match on the last token)."""
    if not tokens:
        return []
    q = " ".join(f'"{t}"' for t in tokens[:-1]) + (" " if len(tokens) > 1 else "") + f'"{tokens[-1]}"*'
    try:
        return db().execute(
            "SELECT e.* FROM fts JOIN entries e ON e.id = fts.rowid WHERE fts MATCH ? LIMIT ?", (q, limit)).fetchall()
    except sqlite3.OperationalError:
        return []


def recent(limit: int = 40, bucket: Optional[str] = None) -> List[sqlite3.Row]:
    sql = "SELECT * FROM entries WHERE kind='file' AND mtime>0"
    args: List[Any] = []
    if bucket:
        sql += " AND (' '||bucket||' ') LIKE ?"
        args.append(f"% {bucket} %")
    sql += " ORDER BY mtime DESC LIMIT ?"
    args.append(limit)
    return db().execute(sql, args).fetchall()


_dir_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


def list_dir_files(dir_url: str, depth: int = 2) -> List[Dict[str, Any]]:
    """Lazy listing for 'dir' entries: returns video files (recursing into season folders)."""
    hit = _dir_cache.get(dir_url)
    if hit and hit[0] > time.time():
        return hit[1]
    parsed = urllib.parse.urlparse(dir_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    files: List[Dict[str, Any]] = []

    def walk(href: str, d: int):
        try:
            kids = h5ai_items(base, href)
        except Exception:
            return
        subdirs = []
        for k in kids:
            if k["href"].endswith("/"):
                subdirs.append(k["href"])
            elif k["href"].lower().endswith(VIDEO_EXT):
                files.append({"href": k["href"], "size": k.get("size") or 0, "time": k.get("time") or 0, "url": base + k["href"]})
        if d > 0 and subdirs:
            with ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda s: walk(s, d - 1), subdirs[:40]))

    walk(parsed.path, depth)
    _dir_cache[dir_url] = (time.time() + 900, files)
    return files


def server_label(server_id: str) -> str:
    return _server_name(server_id)


if __name__ == "__main__":
    import sys
    only = sys.argv[1:] or None
    t = time.time()
    print(build_all(only))
    print(json.dumps(index_stats(), indent=1)[:1500], f"\n{time.time() - t:.1f}s")
