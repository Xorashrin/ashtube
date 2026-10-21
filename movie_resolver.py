#!/usr/bin/env python3
"""
AshTube Movie Resolver
Developed by ASRAFUL ISLAM

Global movie resolver: Discovery FTP (BDIX) direct files, Cinemeta ids, Consumet FlixHQ when CONSUMET_URL is set.
All lookups go through source_engine; nothing is fabricated. When no source hosts the
title the result has found=False and an error message.
"""

from typing import Any, Dict

import source_engine


class MovieResolver:
    category = "movies"

    def resolve_movie(self, media_id: str, title: str = "", year: str = "", season: int = 1, episode: int = 1) -> Dict[str, Any]:
        return source_engine.resolve_media(media_id, self.category, title, year, season, episode, is_series=False)


movie_resolver_instance = MovieResolver()
