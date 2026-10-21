#!/usr/bin/env python3
"""
AshTube K-Drama Resolver
Developed by ASRAFUL ISLAM

K-Drama resolver: Consumet DramaCool (CONSUMET_URL) and Discovery FTP foreign/dubbed series folders.
All lookups go through source_engine; nothing is fabricated. When no source hosts the
title the result has found=False and an error message.
"""

from typing import Any, Dict

import source_engine


class KDramaResolver:
    category = "kdrama"

    def resolve_kdrama(self, media_id: str, title: str = "", year: str = "", season: int = 1, episode: int = 1) -> Dict[str, Any]:
        return source_engine.resolve_media(media_id, self.category, title, year, season, episode, is_series=True)


kdrama_resolver_instance = KDramaResolver()
