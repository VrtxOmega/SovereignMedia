#!/usr/bin/env python3
"""
SOVEREIGN MEDIA — Kindle Book Download Helper
Uses Kindle_download_helper to download all Kindle books as EPUB.
Organizes into ~/Books/ for ingestion by the Sovereign Media desktop app.

Requires: pip install kindle_download
Usage: python kindle_downloader.py --cookie <cookie> <csrf_token>
"""

import os
import sys
import shutil
import hashlib
import json
import subprocess
from pathlib import Path
from datetime import datetime


# ── Configuration ─────────────────────────────────────────────────────────
BOOKS_DIR = Path.home() / "Books"
DOWNLOADS_DIR = BOOKS_DIR / "DOWNLOADS"
DEDRM_DIR = BOOKS_DIR / "DEDRMS"
MANIFEST_FILE = BOOKS_DIR / "manifest.json"

# Kindle_download_helper repo (will be cloned if not present)
HELPER_DIR = Path(__file__).parent / "Kindle_download_helper"
KINDLE_SCRIPT = HELPER_DIR / "kindle.py"


def ensure_dirs():
    """Ensure all required directories exist."""
    BOOKS_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    DEDRM_DIR.mkdir(parents=True, exist_ok=True)


def clone_helper():
    """Clone Kindle_download_helper if not present."""
    if not HELPER_DIR.exists():
        print("[SovereignMedia] Cloning Kindle_download_helper...")
        subprocess.run([
            "git", "clone",
            "https://github.com/yihong0618/Kindle_download_helper.git",
            str(HELPER_DIR)
        ], check=True)
        # Install requirements
        req_file = HELPER_DIR / "requirements.txt"
        if req_file.exists():
            subprocess.run([
                sys.executable, "-m", "pip", "install",
                "-r", str(req_file), "--quiet"
            ], check=True)
    print(f"[SovereignMedia] Helper ready at: {HELPER_DIR}")


def download_books(csrf_token=None, cookie=None, cookie_file=None, dedrm=True):
    """Download all Kindle books using kindle.py."""
    cmd = [sys.executable, str(KINDLE_SCRIPT)]

    if csrf_token:
        cmd.append(csrf_token)
    if cookie:
        cmd.extend(["--cookie", cookie])
    elif cookie_file:
        cmd.extend(["--cookie-file", cookie_file])

    cmd.extend(["-o", str(DOWNLOADS_DIR)])

    if dedrm:
        cmd.extend(["--dedrm", "-od", str(DEDRM_DIR)])

    # US Amazon by default (no --cn flag)
    cmd.append("--resolve_duplicate_names")

    print(f"[SovereignMedia] Running: {' '.join(cmd[:3])}...")
    result = subprocess.run(cmd, cwd=str(HELPER_DIR), capture_output=False)

    if result.returncode != 0:
        print(f"[SovereignMedia] Download exited with code {result.returncode}")
    else:
        print("[SovereignMedia] Download complete!")

    return result.returncode


def organize_books():
    """
    Scan DOWNLOADS and DEDRMS directories and build a manifest.
    Prefer DEDRM'd EPUB files over raw downloads.
    """
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "source": "Kindle_download_helper",
        "books": []
    }

    # Scan DEDRMS first (these are DRM-free)
    seen_titles = set()
    for root, dirs, files in os.walk(DEDRM_DIR):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ('.epub', '.mobi', '.azw', '.azw3'):
                full_path = os.path.join(root, f)
                title = os.path.splitext(f)[0].replace('_', ' ')
                file_hash = hashlib.sha256(full_path.encode()).hexdigest()[:16]

                manifest["books"].append({
                    "id": file_hash,
                    "title": title,
                    "filename": f,
                    "path": full_path,
                    "format": ext[1:],
                    "drm_free": True,
                    "size": os.path.getsize(full_path)
                })
                seen_titles.add(title.lower())

    # Then scan DOWNLOADS for anything not already captured
    for root, dirs, files in os.walk(DOWNLOADS_DIR):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ('.epub', '.mobi', '.azw', '.azw3'):
                title = os.path.splitext(f)[0].replace('_', ' ')
                if title.lower() not in seen_titles:
                    full_path = os.path.join(root, f)
                    file_hash = hashlib.sha256(full_path.encode()).hexdigest()[:16]

                    manifest["books"].append({
                        "id": file_hash,
                        "title": title,
                        "filename": f,
                        "path": full_path,
                        "format": ext[1:],
                        "drm_free": False,
                        "size": os.path.getsize(full_path)
                    })

    # Write manifest
    with open(MANIFEST_FILE, 'w', encoding='utf-8') as mf:
        json.dump(manifest, mf, indent=2)

    print(f"[SovereignMedia] Organized {len(manifest['books'])} books → {MANIFEST_FILE}")
    return manifest


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sovereign Media — Kindle Book Downloader")
    parser.add_argument("csrf_token", nargs="?", help="Amazon CSRF token")
    parser.add_argument("--cookie", help="Amazon cookie string")
    parser.add_argument("--cookie-file", help="Path to cookie file")
    parser.add_argument("--no-dedrm", action="store_true", help="Skip DRM removal")
    parser.add_argument("--organize-only", action="store_true",
                        help="Skip download, just organize existing files")
    args = parser.parse_args()

    ensure_dirs()

    if not args.organize_only:
        clone_helper()
        rc = download_books(
            csrf_token=args.csrf_token,
            cookie=args.cookie,
            cookie_file=args.cookie_file,
            dedrm=not args.no_dedrm
        )
        if rc != 0 and not args.organize_only:
            print("[SovereignMedia] Download had errors. Running organizer on partial results...")

    manifest = organize_books()
    print(f"\n[SovereignMedia] Pipeline complete. {len(manifest['books'])} books ready.")
    print(f"  📂 Books directory: {BOOKS_DIR}")
    print(f"  📋 Manifest: {MANIFEST_FILE}")


if __name__ == "__main__":
    main()
