#!/usr/bin/env python3
"""
AshTube Anime Resolver
Developed by ASRAFUL ISLAM

Anime resolver: aniwatch-api (ANIWATCH_URL), Consumet Gogoanime (CONSUMET_URL) and Discovery FTP animation folders.
All lookups go through source_engine; nothing is fabricated. When no source hosts the
title the result has found=False and an error message.
"""

from typing import Any, Dict

import source_engine


class AnimeResolver:
    category = "anime"

    def resolve_anime(self, media_id: str, title: str = "", year: str = "", season: int = 1, episode: int = 1) -> Dict[str, Any]:
        return source_engine.resolve_media(media_id, self.category, title, year, season, episode, is_series=True)


anime_resolver_instance = AnimeResolver()
