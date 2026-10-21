#!/usr/bin/env python3
"""
AshTube High-Speed Multi-Threaded Downloader Engine
Developed by ASRAFUL ISLAM
Architecture modeled after aria2c and pySmartDL.
Splits files into parallel segments using HTTP Range requests,
downloads chunks concurrently across worker threads, and assembles them.
Includes robust fallback for servers that block HEAD requests.
"""

import os
import sys
import time
import math
import re
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from typing import Dict, List, Optional, Any

class DownloadTask:
    def __init__(self, task_id: str, url: str, destination_path: str, title: str, num_threads: int = 8):
        self.task_id = task_id
        self.url = url
        self.destination_path = destination_path
        self.title = title
        self.num_threads = num_threads
        
        self.total_size = 0
        self.downloaded_bytes = 0
        self.speed_bytes_sec = 0.0
        self.progress_pct = 0.0
        self.status = "pending" # pending, downloading, paused, completed, failed
        self.error_message = None
        
        self.start_time = 0.0
        self.is_paused = False
        self.is_cancelled = False
        self._lock = threading.Lock()
        self.chunk_files = []

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            speed_mb = round(self.speed_bytes_sec / (1024 * 1024), 2)
            total_mb = round(self.total_size / (1024 * 1024), 2) if self.total_size else 0
            downloaded_mb = round(self.downloaded_bytes / (1024 * 1024), 2)
            
            return {
                "id": self.task_id,
                "title": self.title,
                "url": self.url,
                "status": self.status,
                "progress_pct": round(self.progress_pct, 1),
                "downloaded_mb": downloaded_mb,
                "total_mb": total_mb,
                "speed_mbps": speed_mb,
                "num_threads": self.num_threads,
                "destination": self.destination_path,
                "filename": os.path.basename(self.destination_path) if self.destination_path else "",
                "error": self.error_message
            }

class MultiThreadDownloader:
    """High-speed segmented multi-threaded download manager."""

    def __init__(self, download_dir: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads"), default_threads: int = 8):
        self.download_dir = download_dir
        self.default_threads = default_threads
        os.makedirs(self.download_dir, exist_ok=True)
        self.tasks: Dict[str, DownloadTask] = {}
        self._executor = ThreadPoolExecutor(max_workers=16)

    def start_download(self, url: str, title: str, filename: Optional[str] = None, num_threads: Optional[int] = None) -> DownloadTask:
        threads = num_threads or self.default_threads
        if not filename:
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
            ext = ext if ext in (".mkv", ".mp4", ".webm", ".avi", ".ts") else ".mp4"
            stem = re.sub(r"[^\w()\-]+", "_", title, flags=re.UNICODE).strip("_.") or "video"
            filename = f"{stem[:120]}{ext}"
        safe_name = os.path.basename(filename)
        dest_path = os.path.join(self.download_dir, safe_name)
        task_id = f"dl_{int(time.time() * 1000)}"

        task = DownloadTask(task_id, url, dest_path, title, threads)
        self.tasks[task_id] = task
        self._executor.submit(self._run_task, task)
        return task

    def pause_download(self, task_id: str) -> bool:
        if task_id in self.tasks:
            task = self.tasks[task_id]
            task.is_paused = True
            task.status = "paused"
            task.speed_bytes_sec = 0.0
            return True
        return False

    def resume_download(self, task_id: str) -> bool:
        if task_id in self.tasks:
            task = self.tasks[task_id]
            if task.status == "paused":
                task.is_paused = False
                task.status = "downloading"
                self._executor.submit(self._run_task, task)
                return True
        return False

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        task = self.tasks.get(task_id)
        return task.to_dict() if task else None

    def list_all_tasks(self) -> List[Dict[str, Any]]:
        return [t.to_dict() for t in self.tasks.values()]

    def _run_task(self, task: DownloadTask):
        task.status = "downloading"
        task.start_time = time.time()
        
        try:
            # 1. Inspect headers via HEAD, fallback to GET Range 0-0 if HEAD is blocked
            task.total_size = self._probe_file_size(task.url)

            # 2. Check if server supports Range requests
            if task.total_size > 0:
                self._multi_thread_download(task)
            else:
                self._single_thread_download(task)

            if not task.is_paused and not task.is_cancelled:
                task.status = "completed"
                task.progress_pct = 100.0
                task.speed_bytes_sec = 0.0

        except Exception as e:
            if not task.is_paused:
                task.status = "failed"
                task.error_message = str(e)
                print(f"[Downloader Error] Task {task.task_id} failed: {e}")

    def _probe_file_size(self, url: str) -> int:
        """Returns the total size only when the server honours Range (206), else 0 (single stream)."""
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) AshTube/1.0", "Range": "bytes=0-0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                crange = resp.headers.get("Content-Range", "")
                if resp.status == 206 and "/" in crange:
                    total_part = crange.split("/")[-1].strip()
                    if total_part.isdigit():
                        return int(total_part)
        except Exception:
            pass
        return 0

    def _multi_thread_download(self, task: DownloadTask):
        chunk_size = math.ceil(task.total_size / task.num_threads)
        ranges = []
        task.chunk_files = []

        for i in range(task.num_threads):
            start = i * chunk_size
            end = min(task.total_size - 1, (i + 1) * chunk_size - 1)
            chunk_file = f"{task.destination_path}.part{i}"
            ranges.append((i, start, end, chunk_file))
            task.chunk_files.append(chunk_file)

        last_time = time.time()
        last_bytes = 0

        # Concurrent Chunk Workers (ThreadPool)
        with ThreadPoolExecutor(max_workers=task.num_threads) as pool:
            futures = [pool.submit(self._download_chunk, task, r[0], r[1], r[2], r[3]) for r in ranges]
            
            # Progress Monitoring Loop
            while any(not f.done() for f in futures):
                if task.is_paused or task.is_cancelled:
                    break

                time.sleep(0.3)
                now = time.time()
                elapsed = now - last_time
                if elapsed >= 0.4:
                    current_bytes = self._calculate_downloaded(task)
                    speed = (current_bytes - last_bytes) / elapsed
                    with task._lock:
                        task.downloaded_bytes = current_bytes
                        task.speed_bytes_sec = max(0.0, speed)
                        task.progress_pct = (current_bytes / task.total_size) * 100 if task.total_size else 0
                    last_bytes = current_bytes
                    last_time = now

            chunk_errors = []
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as ce:
                    chunk_errors.append(str(ce))
                    print(f"[Chunk Error] {ce}")

        # 3. Assemble chunks into the final media file (only when every byte arrived)
        if not task.is_paused and not task.is_cancelled:
            if self._calculate_downloaded(task) != task.total_size:
                raise RuntimeError(f"Incomplete download ({'; '.join(chunk_errors) or 'connection dropped'}). Resume to retry.")
            self._assemble_chunks(task)

    def _download_chunk(self, task: DownloadTask, index: int, start: int, end: int, chunk_path: str):
        existing_size = 0
        if os.path.exists(chunk_path):
            existing_size = os.path.getsize(chunk_path)

        resume_start = start + existing_size
        if resume_start > end:
            return # Chunk already complete

        req = urllib.request.Request(
            task.url,
            headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 14) AshTube/1.0",
                "Range": f"bytes={resume_start}-{end}"
            }
        )

        with urllib.request.urlopen(req, timeout=12) as resp:
            mode = "ab" if existing_size > 0 else "wb"
            with open(chunk_path, mode) as f:
                while not task.is_paused and not task.is_cancelled:
                    buffer = resp.read(64 * 1024) # 64 KB buffer
                    if not buffer:
                        break
                    f.write(buffer)

    def _calculate_downloaded(self, task: DownloadTask) -> int:
        total = 0
        for cf in task.chunk_files:
            if os.path.exists(cf):
                total += os.path.getsize(cf)
        return total

    def _assemble_chunks(self, task: DownloadTask):
        with open(task.destination_path, "wb") as outfile:
            for cf in task.chunk_files:
                if os.path.exists(cf):
                    with open(cf, "rb") as infile:
                        while True:
                            buf = infile.read(512 * 1024) # 512 KB
                            if not buf:
                                break
                            outfile.write(buf)
                    try:
                        os.remove(cf)
                    except OSError:
                        pass
        task.progress_pct = 100.0
        task.downloaded_bytes = task.total_size

    def _single_thread_download(self, task: DownloadTask):
        req = urllib.request.Request(task.url, headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) AshTube/1.0"})
        with urllib.request.urlopen(req, timeout=12) as resp, open(task.destination_path, "wb") as f:
            downloaded = 0
            last_time = time.time()
            last_bytes = 0
            while not task.is_paused and not task.is_cancelled:
                buf = resp.read(64 * 1024)
                if not buf:
                    break
                f.write(buf)
                downloaded += len(buf)
                now = time.time()
                if now - last_time >= 0.4:
                    speed = (downloaded - last_bytes) / (now - last_time)
                    with task._lock:
                        task.downloaded_bytes = downloaded
                        task.speed_bytes_sec = speed
                        task.progress_pct = (downloaded / task.total_size) * 100 if task.total_size else 0
                    last_bytes = downloaded
                    last_time = now

# Singleton instance
downloader_instance = MultiThreadDownloader()

if __name__ == "__main__":
    print("[AshTube Downloader Engine] Testing multi-threaded segmented download (Developed by ASRAFUL ISLAM)...")
    # Test on Wikimedia Commons high-speed open video (accepts Range, 96MB)
    test_url = "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm"
    task = downloader_instance.start_download(test_url, title="Big Buck Bunny 480p", num_threads=8)
    
    # Monitor for 6 seconds to verify live speed and thread throughput
    for _ in range(12):
        time.sleep(0.5)
        d = task.to_dict()
        print(f" -> Progress: {d['progress_pct']}% | Speed: {d['speed_mbps']} MB/s | Downloaded: {d['downloaded_mb']}/{d['total_mb']} MB (8 Threads Active)")
        if task.status == "completed":
            break
    
    print(f"\n[✓] Downloader status: {task.status}")
