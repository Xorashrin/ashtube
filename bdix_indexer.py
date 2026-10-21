#!/usr/bin/env python3
"""
AshTube Universal BDIX FTP Server Indexer & Health Checker
Developed by ASRAFUL ISLAM
Scans and monitors major Bangladeshi BDIX media servers, checking latency,
online status, and content paths.
"""

import time
import socket
import urllib.request
import urllib.error
import json
from typing import Dict, List, Any

# Primary universal BDIX FTP servers in Bangladesh
BDIX_SERVERS: List[Dict[str, str]] = [
    {
        "name": "CircleFTP",
        "provider": "Circle Network",
        "web_url": "http://circleftp.net",
        "direct_ip": "http://15.1.1.1",
        "category": "Universal BDIX"
    },
    {
        "name": "SAM Online FTP",
        "provider": "SAM Online",
        "web_url": "https://samftp.com",
        "direct_ip": "http://172.16.50.4",
        "category": "Universal BDIX"
    },
    {
        "name": "DhakaFTP",
        "provider": "Amarnet System",
        "web_url": "http://dhakaftp.com",
        "direct_ip": "http://103.205.233.70",
        "category": "Universal BDIX"
    },
    {
        "name": "ICC Communication FTP",
        "provider": "ICC Communication",
        "web_url": "http://10.16.100.244",
        "direct_ip": "http://10.16.100.202",
        "category": "Universal BDIX"
    },
    {
        "name": "Discovery FTP",
        "provider": "Discovery Network",
        "web_url": "http://discoveryftp.net",
        "direct_ip": "http://10.100.100.100",
        "category": "Universal BDIX"
    },
    {
        "name": "MojarFTP / Mojaloss",
        "provider": "Mojaloss Net",
        "web_url": "http://mojaloss.net",
        "direct_ip": "http://172.27.27.27",
        "category": "Universal BDIX"
    },
    {
        "name": "AmberIT Media",
        "provider": "AmberIT",
        "web_url": "http://amberit.com.bd",
        "direct_ip": "http://103.230.106.12",
        "category": "Universal BDIX"
    }
]

def check_server_status(url: str, timeout_sec: float = 2.5) -> Dict[str, Any]:
    """Tests connectivity and latency to a given BDIX server URL."""
    start_time = time.time()
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AshTube-BDIX-Crawler/1.0 (Android; AshTube)"}
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "online": True,
                "status_code": response.status,
                "latency_ms": latency_ms
            }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "online": False,
            "error": str(e),
            "latency_ms": latency_ms
        }

from concurrent.futures import ThreadPoolExecutor

def scan_single_server(server: Dict[str, str], timeout_sec: float = 2.0) -> Dict[str, Any]:
    target_url = server["web_url"]
    status = check_server_status(target_url, timeout_sec=timeout_sec)
    return {
        "name": server["name"],
        "provider": server["provider"],
        "target_url": target_url,
        "direct_ip": server["direct_ip"],
        "online": status["online"],
        "latency_ms": status["latency_ms"],
        "details": status.get("error", "OK")
    }

def scan_all_bdix_servers(timeout_sec: float = 2.0) -> List[Dict[str, Any]]:
    """Concurrently scans all cataloged BDIX servers with sub-second response."""
    with ThreadPoolExecutor(max_workers=len(BDIX_SERVERS)) as executor:
        results = list(executor.map(lambda srv: scan_single_server(srv, timeout_sec), BDIX_SERVERS))
    return results

if __name__ == "__main__":
    report = scan_all_bdix_servers()
    with open("bdix_servers_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("\n[✓] BDIX scan report saved to bdix_servers_report.json")
