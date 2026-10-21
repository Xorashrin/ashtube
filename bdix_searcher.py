#!/usr/bin/env python3
"""
AshTube Universal BDIX Search Engine
Developed by ASRAFUL ISLAM

Searches the Discovery FTP BDIX index (h5ai directory listings) for titles and returns
only files that were verified live with an HTTP Range probe. No URLs are invented.
"""

from typing import Any, Dict, List

import source_engine


class BDIXSearcher:
    def search_bdix(self, query: str) -> List[Dict[str, Any]]:
        try:
            return source_engine.search_bdix(query)
        except Exception:
            return []


bdix_searcher_instance = BDIXSearcher()
