#!/usr/bin/env python3
"""
AshTube Metadata & Feed Engine
Developed by ASRAFUL ISLAM

Live catalogs with real posters/thumbnails and release data, all mapped to ONE item schema:
  * Cinemeta (Stremio)  -> movies & series (IMDb ids, episodes, runtime)
  * Kitsu               -> anime (titles in several languages, airing countdown, upcoming)
  * kisskh              -> Korean dramas (per-season entries, thumbnails, episode counts)
  * TVMaze              -> upcoming episodes with exact air times (countdown)
Every item gets `available` = "the BDIX index / HiAnime really hosts this exact title", so the app only
promotes content that plays. Metadata and playable files are tied by normalized title + year, never by id guesses.
"""

import json
import os
import re
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import bdix_index
import source_engine as se

CINEMETA = "https://v3-cinemeta.strem.io"
KITSU = "https://kitsu.io/api/edge"
KISSKH = "https://kisskh.do/api"
TVMAZE = "https://api.tvmaze.com"
_outer = ThreadPoolExecutor(max_workers=16, thread_name_prefix="feeds-job")   # build_feeds / search jobs
_pool = ThreadPoolExecutor(max_workers=32, thread_name_prefix="feeds-map")    # per-item work (identify, availability)
_srch = ThreadPoolExecutor(max_workers=24, thread_name_prefix="feeds-search")  # user-facing search + availability (never starved by feed builds)
_leaf = ThreadPoolExecutor(max_workers=24, thread_name_prefix="feeds-io")     # raw HTTP, never submits more work


def _first_year(text: Any) -> str:
    m = re.search(r"((?:19|20)\d{2})", str(text or ""))
    return m.group(1) if m else ""


def _json(url: str, timeout: float = 12, headers: Optional[Dict[str, str]] = None):
    return se.http_json(url, timeout, {"Accept": "application/json", **(headers or {})})


def _kjson(url: str, timeout: float = 12):
    return se.http_json(url, timeout, {"Accept": "application/vnd.api+json"})


# ------------------------------------------------------------------------------ Cinemeta

def cm_item(m: Dict[str, Any], kind: str, detailed: bool = False) -> Optional[Dict[str, Any]]:
    imdb = m.get("imdb_id") or m.get("id")
    name = m.get("name")
    if not imdb or not name or not str(imdb).startswith("tt"):
        return None
    year = _first_year(m.get("year") or m.get("releaseInfo"))
    poster = m.get("poster") or f"https://images.metahub.space/poster/medium/{imdb}/img"
    item: Dict[str, Any] = {
        "id": f"cm-{imdb}", "imdbId": imdb, "title": name, "category": "movies" if kind == "movie" else "series",
        "year": year, "rating": m.get("imdbRating") or "N/A", "quality": "HD", "duration": m.get("runtime") or "",
        "genres": " · ".join(m.get("genres") or m.get("genre") or []), "backdrop": m.get("background") or poster,
        "poster": poster, "synopsis": m.get("description") or "", "isBDIX": False, "audioTracks": [],
        "isSeries": kind == "series", "remote": True,
    }
    if detailed and kind == "series":
        seasons: Dict[int, List[Dict[str, Any]]] = {}
        next_air = None
        today = time.strftime("%Y-%m-%d")
        for v in m.get("videos") or []:
            season, num = v.get("season"), v.get("episode") or v.get("number")
            if season is None or not num or int(season) < 1:
                continue
            released = (v.get("released") or v.get("firstAired") or "")[:10]
            if released and released > today:
                if not next_air or released < next_air["date"]:
                    next_air = {"date": released, "season": int(season), "episode": int(num), "at": _iso_to_epoch(v.get("released"))}
                continue
            seasons.setdefault(int(season), []).append({
                "epNum": int(num), "title": v.get("name") or v.get("title") or f"Episode {num}",
                "runtime": item["duration"] or "", "thumb": v.get("thumbnail") or poster,
            })
        item["seasons"] = [{"seasonNumber": s, "episodes": sorted(eps, key=lambda e: e["epNum"])} for s, eps in sorted(seasons.items())]
        if next_air:
            item["airing"] = next_air
    return item


def _iso_to_epoch(text: Optional[str]) -> int:
    if not text:
        return 0
    try:
        from datetime import datetime, timezone
        return int(datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc).timestamp())
    except Exception:
        return 0


def cinemeta_catalog(kind: str, pages: int = 3, genre: str = "") -> List[Dict[str, Any]]:
    def one(skip):
        extra = [f"genre={urllib.parse.quote(genre)}"] if genre else []
        if skip:
            extra.append(f"skip={skip}")
        url = f"{CINEMETA}/catalog/{kind}/top{'/' + '&'.join(extra) if extra else ''}.json"
        try:
            return _json(url, 12).get("metas", [])
        except Exception:
            return []
    out = []
    for metas in _leaf.map(one, [i * 50 for i in range(pages)]):
        out.extend(i for i in (cm_item(m, kind) for m in metas) if i)
    return out


def cinemeta_search(query: str) -> List[Dict[str, Any]]:
    key = f"cms:{query.lower()}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    q = urllib.parse.quote(query.strip())

    def one(kind):
        try:
            return [i for i in (cm_item(m, kind) for m in _json(f"{CINEMETA}/catalog/{kind}/top/search={q}.json", 8).get("metas", [])) if i]
        except Exception:
            return []
    movies, series = _leaf.map(one, ["movie", "series"])
    out = movies[:10] + series[:10]
    se.cache.set(key, out, 1800)
    return out


def cinemeta_meta(imdb: str, kind: str) -> Optional[Dict[str, Any]]:
    key = f"cmm:{kind}:{imdb}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    try:
        meta = _json(f"{CINEMETA}/meta/{kind}/{imdb}.json", 12).get("meta") or {}
    except Exception:
        return None
    item = cm_item(meta, kind, detailed=True)
    if item:
        item["runtimeMin"] = _minutes(meta.get("runtime"))
        se.cache.set(key, item, 3600)
    return item


def _minutes(text: Any) -> Optional[float]:
    m = re.search(r"(\d+)", str(text or ""))
    return float(m.group(1)) if m else None


def identify(title: str, year: Optional[int], series: Optional[bool] = None) -> Optional[Dict[str, Any]]:
    """Cinemeta item whose normalized title and year equal the given ones (used to attach posters to index titles)."""
    tk = bdix_index.title_key(title)
    best = None
    for c in cinemeta_search(title):
        if series is not None and c["isSeries"] != series:
            continue
        if bdix_index.title_key(c["title"]) != tk:
            continue
        if year and c["year"] and abs(int(c["year"]) - year) > 1:
            continue
        if best is None or (c["year"] == str(year)):
            best = c
    return best


# ------------------------------------------------------------------------------ Kitsu (anime)

_KITSU_FIELDS = ("canonicalTitle,titles,abbreviatedTitles,synopsis,averageRating,startDate,endDate,episodeCount,episodeLength,"
                 "posterImage,coverImage,status,subtype,nextRelease,ageRating")


def kitsu_item(a: Dict[str, Any]) -> Dict[str, Any]:
    at = a.get("attributes", {})
    titles = at.get("titles") or {}
    name = titles.get("en") or at.get("canonicalTitle") or titles.get("en_jp") or ""
    poster = (at.get("posterImage") or {}).get("large") or (at.get("posterImage") or {}).get("original") or ""
    cover = (at.get("coverImage") or {}).get("large") or (at.get("coverImage") or {}).get("original") or poster
    alts = [t for t in [titles.get("en"), at.get("canonicalTitle"), titles.get("en_jp"), titles.get("en_us")] + (at.get("abbreviatedTitles") or [])[:3] if t]
    rating = at.get("averageRating")
    item = {
        "id": f"kt-{a['id']}", "kitsuId": a["id"], "title": name, "altTitles": list(dict.fromkeys(alts)), "category": "anime",
        "year": _first_year(at.get("startDate")), "rating": f"{float(rating) / 10:.1f}" if rating else "N/A", "quality": "HD",
        "duration": f"{at.get('episodeLength') or 24} min", "genres": at.get("subtype", "TV").upper() if at.get("subtype") else "Anime",
        "backdrop": cover, "poster": poster, "synopsis": at.get("synopsis") or "", "isBDIX": False, "audioTracks": ["Japanese", "English Dub"],
        "isSeries": at.get("subtype") != "movie", "remote": True, "episodeCount": at.get("episodeCount"), "status": at.get("status"),
    }
    nxt = _iso_to_epoch(at.get("nextRelease"))
    if nxt and nxt > time.time():
        item["airing"] = {"at": nxt}
    if at.get("status") == "upcoming" and at.get("startDate"):
        item["releaseDate"] = at["startDate"]
    return item


def kitsu_list(kind: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    q = {
        "trending": f"{KITSU}/trending/anime?limit={limit}",
        "airing": f"{KITSU}/anime?filter[status]=current&sort=-userCount&page[limit]={limit}&page[offset]={offset}&fields[anime]={_KITSU_FIELDS}",
        "popular": f"{KITSU}/anime?sort=-userCount&page[limit]={limit}&page[offset]={offset}&fields[anime]={_KITSU_FIELDS}",
        "upcoming": f"{KITSU}/anime?filter[status]=upcoming&sort=-userCount&page[limit]={limit}&page[offset]={offset}&fields[anime]={_KITSU_FIELDS}",
    }[kind]
    try:
        return [kitsu_item(a) for a in _kjson(q, 15).get("data", [])]
    except Exception:
        return []


def kitsu_search(query: str) -> List[Dict[str, Any]]:
    key = f"kts:{query.lower()}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    try:
        data = _kjson(f"{KITSU}/anime?filter[text]={urllib.parse.quote(query)}&page[limit]=10&fields[anime]={_KITSU_FIELDS}", 10).get("data", [])
        out = [kitsu_item(a) for a in data]
    except Exception:
        out = []
    se.cache.set(key, out, 1800)
    return out


def kitsu_detail(kitsu_id: str) -> Optional[Dict[str, Any]]:
    key = f"ktd:{kitsu_id}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    try:
        item = kitsu_item(_kjson(f"{KITSU}/anime/{kitsu_id}?fields[anime]={_KITSU_FIELDS}", 12)["data"])
        meta = _kjson(f"{KITSU}/anime/{kitsu_id}/episodes?page[limit]=20&fields[episodes]=canonicalTitle,number,thumbnail,length,airdate", 12)
    except Exception:
        return None
    total = (meta.get("meta") or {}).get("count") or item.get("episodeCount") or 0
    eps = {}
    for e in meta.get("data", []):
        at = e["attributes"]
        if at.get("number"):
            eps[at["number"]] = {"epNum": at["number"], "title": at.get("canonicalTitle") or f"Episode {at['number']}",
                                 "runtime": f"{at.get('length') or item['duration'].split()[0]} min",
                                 "thumb": ((at.get("thumbnail") or {}).get("original")) or item["backdrop"]}
    for n in range(1, min(int(total or 0), 500) + 1):
        eps.setdefault(n, {"epNum": n, "title": f"Episode {n}", "runtime": item["duration"], "thumb": item["backdrop"]})
    item["seasons"] = [{"seasonNumber": 1, "episodes": [eps[n] for n in sorted(eps)]}] if item["isSeries"] and eps else []
    item["runtimeMin"] = _minutes(item["duration"])
    se.cache.set(key, item, 3600)
    return item


# ------------------------------------------------------------------------------ kisskh (K-Drama)

_SEASON_SUFFIX = re.compile(r"\s*(?:season|s)\s*(\d+)\s*$", re.I)


def kk_item(d: Dict[str, Any]) -> Dict[str, Any]:
    raw = d.get("title", "")
    m = _SEASON_SUFFIX.search(raw)
    base = _SEASON_SUFFIX.sub("", raw).strip() if m else raw
    thumb = d.get("thumbnail") or ""
    return {
        "id": f"kk-{d['id']}", "kisskhId": d["id"], "title": raw, "baseTitle": base, "season": int(m.group(1)) if m else 1,
        "category": "kdrama", "year": _first_year(d.get("releaseDate")), "rating": "N/A", "quality": "HD",
        "duration": "", "genres": "K-Drama", "backdrop": thumb, "poster": thumb, "synopsis": d.get("description") or "",
        "isBDIX": False, "audioTracks": ["Korean"], "isSeries": True, "remote": True, "episodeCount": d.get("episodesCount"),
    }


def kisskh_list(order: int = 1, status: int = 0, page: int = 1, size: int = 30) -> List[Dict[str, Any]]:
    try:
        data = _json(f"{KISSKH}/DramaList/List?page={page}&type=0&sub=0&country=2&status={status}&order={order}&pageSize={size}", 12)
        return [kk_item(d) for d in data.get("data", [])]
    except Exception:
        return []


def kisskh_search(query: str) -> List[Dict[str, Any]]:
    key = f"kks:{query.lower()}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    try:
        out = [kk_item(d) for d in _json(f"{KISSKH}/DramaList/Search?q={urllib.parse.quote(query)}&type=0", 10)[:12]]
    except Exception:
        out = []
    se.cache.set(key, out, 1800)
    return out


def kisskh_detail(drama_id: str) -> Optional[Dict[str, Any]]:
    key = f"kkd:{drama_id}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _json(f"{KISSKH}/DramaList/Drama/{drama_id}?isq=false", 12)
    except Exception:
        return None
    item = kk_item(d)
    eps = sorted({int(e["number"]) for e in d.get("episodes", []) if e.get("number")})
    item["seasons"] = [{"seasonNumber": item["season"], "episodes": [
        {"epNum": n, "title": f"Episode {n}", "runtime": "", "thumb": item["backdrop"]} for n in eps]}] if eps else []
    item["status"] = d.get("status")
    se.cache.set(key, item, 3600)
    return item


# ------------------------------------------------------------------------------ TVMaze (countdown)

def tvmaze_upcoming(days: int = 7, limit: int = 40) -> List[Dict[str, Any]]:
    """Next aired episode per popular scripted/animated show over the next `days` -> exact countdown."""
    now = time.time()
    dates = [time.strftime("%Y-%m-%d", time.gmtime(now + 86400 * i)) for i in range(days)]
    urls = [(f"{TVMAZE}/schedule/web?date={{d}}"), (f"{TVMAZE}/schedule?country=US&date={{d}}"),
            (f"{TVMAZE}/schedule?country=KR&date={{d}}"), (f"{TVMAZE}/schedule?country=JP&date={{d}}")]
    jobs = [u.format(d=d) for d in dates for u in urls]

    def fetch(url):
        try:
            return _json(url, 12)
        except Exception:
            return []

    shows: Dict[int, Dict[str, Any]] = {}
    for eps in _leaf.map(fetch, jobs):
        for e in eps:
            show = e.get("show") or (e.get("_embedded") or {}).get("show") or {}
            at = _iso_to_epoch(e.get("airstamp"))
            if not show.get("id") or at < now or not (show.get("image") or {}).get("original") or e.get("number") is None:
                continue
            if show.get("type") not in ("Scripted", "Animation") or show.get("language") not in ("English", "Korean", "Japanese"):
                continue
            if (show.get("weight") or 0) < 70:      # TVMaze popularity: drops obscure/regional filler
                continue
            prev = shows.get(show["id"])
            if prev and prev["airing"]["at"] <= at:
                continue
            country = ((show.get("network") or show.get("webChannel") or {}).get("country") or {}).get("code")
            category = "kdrama" if (country == "KR" or show.get("language") == "Korean") else \
                       "anime" if (show.get("type") == "Animation" and show.get("language") == "Japanese") else "series"
            img = show["image"]["original"]
            imdb = (show.get("externals") or {}).get("imdb")
            shows[show["id"]] = {
                "id": f"cm-{imdb}" if imdb and category == "series" else f"tv-{show['id']}", "imdbId": imdb, "title": show.get("name", ""),
                "category": category, "year": _first_year(show.get("premiered")),
                "rating": str((show.get("rating") or {}).get("average") or "N/A"), "quality": "HD", "duration": "",
                "genres": " · ".join(show.get("genres") or []), "backdrop": img, "poster": img,
                "synopsis": re.sub(r"<[^>]+>", "", show.get("summary") or ""), "isBDIX": False, "audioTracks": [], "isSeries": True,
                "remote": True, "airing": {"at": at, "season": e.get("season"), "episode": e.get("number")},
            }
    return sorted(shows.values(), key=lambda s: s["airing"]["at"])[:limit]


# ------------------------------------------------------------------------------ availability + feeds

def anime_available(item: Dict[str, Any]) -> bool:
    titles = item.get("altTitles") or [item["title"]]
    year = int(item["year"]) if str(item.get("year", "")).isdigit() else None
    if se.has_source(titles, year, True):
        return True
    key = f"hi:avail:{item['id']}"
    hit = se.cache.get(key)
    if hit is None:
        try:
            hit = bool(se._anime_pick(titles))
        except Exception:
            return False          # transient failure: do not cache, retry next time
        se.cache.set(key, hit, 6 * 3600)
    return hit


def mark_available(items: List[Dict[str, Any]], budget: Optional[float] = None, pool=None) -> List[Dict[str, Any]]:
    """Flags each item with `available` (True/False). With a time `budget`, slow checks (HiAnime lookups)
    that miss the deadline stay `None` (unknown) instead of delaying the response."""
    from concurrent.futures import wait

    def one(it):
        year = int(it["year"]) if str(it.get("year", "")).isdigit() else None
        if it["category"] == "anime":
            it["available"] = anime_available(it)
        elif it["category"] == "kdrama":
            it["available"] = se.has_source([it.get("baseTitle", it["title"])], year, True)
        else:
            it["available"] = se.has_source([it["title"]], year, bool(it["isSeries"]))
        it["isBDIX"] = bool(it["available"])
        return it

    futs = [(pool or _pool).submit(one, it) for it in items]
    if budget is not None:
        wait(futs, timeout=budget)
        for it, f in zip(items, futs):
            if not f.done():
                it["available"], it["isBDIX"] = None, False
    else:
        wait(futs)
    return items


def _unique(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen, out = set(), []
    for it in items:
        if it["id"] not in seen and it.get("title"):
            seen.add(it["id"])
            out.append(it)
    return out


def recent_titles(bucket: str, limit: int = 24) -> List[Dict[str, Any]]:
    """Newest files on the BDIX servers, matched to metadata so every card has a true poster."""
    rows = bdix_index.recent(400, bucket=bucket)
    seen, cands = set(), []
    for r in rows:
        k = (r["tkey"], r["year"])
        if k in seen:
            continue
        seen.add(k)
        cands.append(r)
    out = []

    def one(r):
        series = r["episode"] is not None or "series" in (r["bucket"] or "")
        it = identify(r["title"], r["year"], series)
        if it:
            it = dict(it)
            it["addedAt"] = r["mtime"]
            it["available"], it["isBDIX"] = True, True
            return it
        return None
    for it in _pool.map(one, cands[:limit * 3]):
        if it:
            out.append(it)
        if len(out) >= limit:
            break
    return _unique(out)


SNAPSHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feeds_cache.json")
_feed_lock = threading.Lock()
_feeds: Dict[str, Any] = {"at": 0, "rails": [], "catalog": {}}
SEED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feeds_seed.json")
for _path in (SNAPSHOT, SEED):          # live snapshot first, shipped seed on a fresh install
    try:
        with open(_path, "r", encoding="utf-8") as _f:
            _feeds.update(json.load(_f))
        break
    except Exception:
        continue


def build_feeds() -> Dict[str, Any]:
    jobs = {
        "movies": _outer.submit(cinemeta_catalog, "movie", 4),
        "series": _outer.submit(cinemeta_catalog, "series", 4),
        "k_airing": _outer.submit(lambda: kitsu_list("airing", 20, 0) + kitsu_list("airing", 20, 20) + kitsu_list("airing", 20, 40)),
        "k_trend": _outer.submit(kitsu_list, "trending", 20),
        "k_pop": _outer.submit(kitsu_list, "popular", 20),
        "k_up": _outer.submit(kitsu_list, "upcoming", 20),
        "kd_pop": _outer.submit(kisskh_list, 1, 0, 1, 30),
        "kd_new": _outer.submit(kisskh_list, 2, 0, 1, 30),
        "kd_on": _outer.submit(kisskh_list, 1, 1, 1, 20),
        "tv_up": _outer.submit(tvmaze_upcoming, 7, 40),
        "new_movies": _outer.submit(recent_titles, "movies", 20),
        "new_series": _outer.submit(recent_titles, "series", 20),
        "bangla": _outer.submit(recent_titles, "bangla", 24),
        "bn_dub": _outer.submit(recent_titles, "banglaDubbed", 24),
    }
    res = {k: f.result() for k, f in jobs.items()}
    movies = mark_available(_unique(res["movies"]))
    series = mark_available(_unique(res["series"]))
    anime = mark_available(_unique(res["k_airing"] + res["k_trend"] + res["k_pop"]))
    kdrama = mark_available(_unique(res["kd_on"] + res["kd_pop"] + res["kd_new"]))
    upcoming_tv = mark_available(res["tv_up"])
    for t in upcoming_tv:     # an upcoming episode is only "available" later; the show itself must be on the servers
        t["comingSoon"] = True
    upcoming_anime = [a for a in res["k_up"] if a.get("releaseDate")]
    bangla = _unique(res["bn_dub"] + res["bangla"])

    def playable(items):
        return [i for i in items if i.get("available")]

    airing_anime = [a for a in anime if a.get("airing")] + [t for t in upcoming_tv if t["category"] == "anime" and t.get("available")]
    airing_anime.sort(key=lambda a: a["airing"]["at"])
    rails = [
        {"id": "trending-movies", "title": "Trending Movies", "items": playable(movies)[:20]},
        {"id": "new-movies", "title": "New on BDIX · Movies", "items": res["new_movies"]},
        {"id": "trending-series", "title": "Popular Series", "items": playable(series)[:20]},
        {"id": "new-series", "title": "New on BDIX · Series", "items": res["new_series"]},
        {"id": "airing-anime", "title": "Airing Anime · Next Episode", "items": airing_anime[:15], "countdown": True},
        {"id": "trending-anime", "title": "Trending Anime", "items": playable(anime)[:20]},
        {"id": "kdrama", "title": "K-Drama", "items": playable(kdrama)[:20]},
        {"id": "upcoming", "title": "Coming Soon · Countdown", "countdown": True,
         "items": sorted(upcoming_tv[:12] + upcoming_anime[:8], key=lambda i: (i.get("airing") or {}).get("at") or _iso_to_epoch(i.get("releaseDate")) or 9e12)},
        {"id": "bangla-dubbed", "title": "Bangla & Dubbed", "items": bangla[:20]},
    ]
    rails = [r for r in rails if r["items"]]
    catalog = {
        "movies": playable(movies), "series": playable(series), "anime": playable(anime), "kdrama": playable(kdrama),
        "bangla": bangla, "upcoming": upcoming_tv + upcoming_anime,
    }
    snapshot = {"at": int(time.time()), "rails": rails, "catalog": catalog}
    with _feed_lock:
        _feeds.update(snapshot)
    try:
        with open(SNAPSHOT + ".tmp", "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False)
        os.replace(SNAPSHOT + ".tmp", SNAPSHOT)
    except OSError:
        pass
    return snapshot


def get_feeds() -> Dict[str, Any]:
    with _feed_lock:
        return dict(_feeds)


_refresher_started = False


def start_background_refresh(interval: int = 1200):
    global _refresher_started
    if _refresher_started:
        return
    _refresher_started = True

    def loop():
        while True:
            wait = interval - (time.time() - _feeds.get("at", 0))
            if wait > 0:          # a fresh on-disk snapshot is already being served
                time.sleep(wait)
            try:
                build_feeds()
            except Exception as exc:
                print(f"[feeds] refresh failed: {exc}")
            time.sleep(interval)
    threading.Thread(target=loop, daemon=True, name="feeds-refresh").start()


# ------------------------------------------------------------------------------ search + detail

def search(query: str, category: str = "all") -> List[Dict[str, Any]]:
    """Parallel metadata search; every hit gets its availability so the UI can badge it."""
    q = query.strip()
    if len(q) < 2:
        return []
    key = f"srch:{q.lower()}:{category}"
    hit = se.cache.get(key)
    if hit is not None:
        return hit
    jobs = []
    if category in ("all", "movies", "series", "bangla"):
        jobs.append(_srch.submit(cinemeta_search, q))
    if category in ("all", "anime"):
        jobs.append(_srch.submit(kitsu_search, q))
    if category == "kdrama":   # kisskh also lists non-Korean shows, so it only answers explicit K-Drama searches
        jobs.append(_srch.submit(kisskh_search, q))
    items = []
    for j in jobs:
        try:
            items.extend(j.result(timeout=3.5))
        except Exception:
            pass
    items = mark_available(_unique(items), budget=2.5, pool=_srch)
    if category in ("movies", "series"):
        items = [i for i in items if i["category"] == category]
    qn = bdix_index.norm(q)
    items.sort(key=lambda i: (-(bdix_index.norm(i["title"]) == qn), i.get("available") is False, -bool(i.get("available")), -(bdix_index.norm(i["title"]).startswith(qn))))
    se.cache.set(key, items, 900)
    return items


def detail(media_id: str) -> Optional[Dict[str, Any]]:
    if media_id.startswith("cm-"):
        imdb = media_id[3:]
        item = cinemeta_meta(imdb, "movie")
        series_item = None
        if not item or not item.get("synopsis"):
            series_item = cinemeta_meta(imdb, "series")
        item = series_item if series_item and (series_item.get("seasons") or not item) else item
    elif media_id.startswith("kt-"):
        item = kitsu_detail(media_id[3:])
    elif media_id.startswith("kk-"):
        item = kisskh_detail(media_id[3:])
    else:
        return None
    if item:
        mark_available([item], budget=3, pool=_srch)
    return item


if __name__ == "__main__":
    t = time.time()
    f = build_feeds()
    print(f"feeds built in {time.time() - t:.1f}s")
    for r in f["rails"]:
        print(f"  {r['id']:18s} {len(r['items']):3d}", [i["title"] for i in r["items"][:3]])
