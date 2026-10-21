#!/usr/bin/env python3
"""
AshTube coverage test: what share of the most popular titles per category can the backend really play?
Availability = the BDIX index (exact title + year) or HiAnime (anime) hosts the title.
Run:  python3 coverage_test.py
"""
import time

import meta_feeds as mf
import source_engine as se


def run(label, items):
    t = time.time()
    mf.mark_available(items)
    ok = [i for i in items if i.get("available")]
    print(f"{label:10s} {len(ok):3d}/{len(items):3d} = {100 * len(ok) / max(1, len(items)):5.1f}%   ({time.time() - t:.1f}s)")
    miss = [i["title"] for i in items if not i.get("available")][:6]
    if miss:
        print("           missing e.g.:", "; ".join(miss))
    return ok


if __name__ == "__main__":
    movies = mf.cinemeta_catalog("movie", 2)[:100]
    series = mf.cinemeta_catalog("series", 2)[:100]
    anime = (mf.kitsu_list("popular", 20, 0) + mf.kitsu_list("popular", 20, 20) + mf.kitsu_list("popular", 20, 40))[:60]
    kdrama = (mf.kisskh_list(1, 0, 1, 30) + mf.kisskh_list(1, 0, 2, 30))[:60]
    print("Coverage of the most popular titles (title+year verified, alive on a real server):")
    ok_m = run("movies", movies)
    run("series", series)
    run("anime", anime)
    run("kdrama", kdrama)
    # end-to-end proof on a random sample: full resolve incl. liveness + real-duration check
    import random
    random.seed(7)
    sample = random.sample(ok_m, min(8, len(ok_m)))
    good = 0
    for it in sample:
        t = time.time()
        r = se.resolve_media(it["id"], "movies", it["title"], it["year"], runtime_min=mf._minutes(it.get("duration")))
        good += bool(r["found"])
        print(f"  resolve {it['title'][:34]:34s} {'OK ' if r['found'] else 'FAIL'} {len(r['sources'])} src  {time.time() - t:.1f}s")
    print(f"end-to-end resolve: {good}/{len(sample)}")
