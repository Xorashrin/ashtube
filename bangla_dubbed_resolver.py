#!/usr/bin/env python3
"""
AshTube Bangla Dubbed Resolver
Developed by ASRAFUL ISLAM

Bangla dubbed and South Indian cinema resolver over Discovery FTP Bangla/Tamil/Hindi/Others folders and dubbed series.
All lookups go through source_engine; nothing is fabricated. When no source hosts the
title the result has found=False and an error message.
"""

from typing import Any, Dict

import source_engine


class BanglaDubbedResolver:
    category = "bangla"

    def resolve_bangla(self, media_id: str, title: str = "", year: str = "", season: int = 1, episode: int = 1) -> Dict[str, Any]:
        return source_engine.resolve_media(media_id, self.category, title, year, season, episode, is_series=False)


bangla_resolver_instance = BanglaDubbedResolver()
