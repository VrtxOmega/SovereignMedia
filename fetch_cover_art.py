#!/usr/bin/env python3
"""
Sovereign Media — Auto Cover Art Fetcher
Uses TMDB API to download movie/show posters for the Sovereign Media library.
Scans the library JSON, finds entries without posters, queries TMDB, downloads.

Usage:
    python fetch_cover_art.py                  # Scan all, download missing
    python fetch_cover_art.py --force           # Re-download all
    python fetch_cover_art.py --title "Movie"   # Fetch for specific title
"""

import os
import re
import sys
import json
import time
import hashlib
import argparse
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# ── TMDB Configuration ─────────────────────────────────────────────────────
# Official API Key provided by user
TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '683250be919aa0a363afb95a149565a7')
TMDB_BASE = 'https://api.themoviedb.org/3'
TMDB_IMG_BASE = 'https://image.tmdb.org/t/p'
POSTER_SIZE = 'w780'  # Good quality for TV display

# ── Paths ───────────────────────────────────────────────────────────────────
LIBRARY_PATH = os.path.join(os.environ.get('APPDATA', ''), 'sovereign-media', 'sovereign_video_library.json')
CACHE_DIR = os.path.join(os.environ.get('APPDATA', ''), 'sovereign-media', 'poster_cache')

def clean_title(raw_title):
    """Extract the clean movie/show name from a torrent-style filename."""
    title = raw_title
    # Remove common torrent tags
    title = re.sub(r'\s*\(?\d{4}\)?\s*$', '', title)  # trailing year
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    title = re.sub(r'\b(1080p|720p|480p|2160p|4K|HDRip|WEBRip|BluRay|BRRip|DVDRip|HDTV|WEB-DL|WEB)\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\b(x264|x265|h264|h265|HEVC|AAC|AC3|DTS|5\.1|7\.1|AMZN|NF|HMAX|DSNP)\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\b(YIFY|YTS|RARBG|EZTV|FGT|SPARKS|FLUX|ETHEL)\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'S\d{1,2}E\d{1,2}.*', '', title, flags=re.IGNORECASE)  # strip episode info
    title = re.sub(r'\.\s*$', '', title)
    title = title.replace('.', ' ').replace('_', ' ')
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def extract_year(raw_title):
    """Try to extract a 4-digit year from the title."""
    match = re.search(r'\b(19|20)\d{2}\b', raw_title)
    return int(match.group()) if match else None

def tmdb_search(title, media_type='movie', year=None):
    """Search TMDB for a movie or TV show using the official API."""
    if not TMDB_API_KEY:
        print("  ⚠ No TMDB_API_KEY set — skipping API search")
        return None

    # Clean up obvious subtitle cruft that breaks API search
    title = re.sub(r'(?i)the bone temple.*', '', title).strip()
    title = re.sub(r'(?i)migration.*', 'Migration', title).strip()
    title = re.sub(r'(?i)\b\d\b.*migration', 'Migration', title).strip()
    title = title.replace(' - ', ' ')
    
    endpoint = f'{TMDB_BASE}/search/{media_type}'
    params = {
        'api_key': TMDB_API_KEY,
        'query': title,
        'include_adult': 'false'
    }
    if year:
        params['year' if media_type == 'movie' else 'first_air_date_year'] = str(year)
    
    url = f'{endpoint}?{urllib.parse.urlencode(params)}'
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SovereignMedia/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('results', [])
            if results:
                return results[0]
            
            # If nothing was found, try a chunked search (first 3 words)
            words = title.split()
            if len(words) > 3:
                chunk = " ".join(words[:3])
                params['query'] = chunk
                if 'year' in params: del params['year'] # relax year constraint on fallback
                url2 = f'{endpoint}?{urllib.parse.urlencode(params)}'
                req2 = urllib.request.Request(url2, headers={'User-Agent': 'SovereignMedia/1.0'})
                with urllib.request.urlopen(req2, timeout=10) as resp2:
                    data2 = json.loads(resp2.read().decode('utf-8'))
                    if data2.get('results'):
                        return data2.get('results')[0]

    except Exception as e:
        print(f"  X TMDB API error: {e}")
    return None

def download_poster(poster_path, save_to):
    """Download a poster image from TMDB CDN."""
    url = f'{TMDB_IMG_BASE}/{POSTER_SIZE}{poster_path}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SovereignMedia/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            img_data = resp.read()
            os.makedirs(os.path.dirname(save_to), exist_ok=True)
            with open(save_to, 'wb') as f:
                f.write(img_data)
            print(f"  OK Downloaded poster -> {save_to} ({len(img_data)//1024} KB)")
            return True
    except Exception as e:
        print(f"  X Download failed: {e}")
        return False

def process_video(video, force=False):
    """Process a single video entry — find and download its poster."""
    video_dir = os.path.dirname(video['path'])
    poster_dest = os.path.join(video_dir, 'poster.jpg')
    
    # Check if poster already exists AND is actually a valid file (>0 bytes)
    if not force and os.path.exists(poster_dest) and os.path.getsize(poster_dest) > 0:
        print(f"  -> Poster already exists: {poster_dest}")
        return poster_dest
    
    # Also check the basename-matching pattern
    base = os.path.splitext(video['filename'])[0]
    for ext in ['.jpg', '.png']:
        candidate = os.path.join(video_dir, base + ext)
        if not force and os.path.exists(candidate) and os.path.getsize(candidate) > 0:
            print(f"  -> Poster already exists: {candidate}")
            return candidate
    
    # Clean the title for search
    raw_title = video.get('show') or video.get('title', '')
    clean = clean_title(raw_title)
    year = extract_year(video.get('title', '') + ' ' + os.path.basename(video_dir))
    media_type = 'tv' if video.get('type') == 'tv' else 'movie'
    
    print(f"  * Searching TMDB: \"{clean}\" ({media_type}, year={year})")
    
    result = tmdb_search(clean, media_type, year)
    
    # Fallback: try without year
    if not result and year:
        result = tmdb_search(clean, media_type)
    
    # Fallback: try the other media type
    if not result:
        alt_type = 'tv' if media_type == 'movie' else 'movie'
        result = tmdb_search(clean, alt_type, year)
    
    if not result:
        print(f"  X No TMDB results for \"{clean}\"")
        return None
    
    # Prefer beautiful 16:9 backdrops (Netflix-style) for our widescreen video UI grid, fallback to vertical poster
    poster_path = result.get('backdrop_path')
    if not poster_path:
        poster_path = result.get('poster_path')
        
    if not poster_path:
        print(f"  X TMDB result has no backdrop or poster")
        return None
    
    tmdb_title = result.get('title') or result.get('name', '?')
    print(f"  * Matched: \"{tmdb_title}\" (TMDB ID: {result.get('id')})")
    
    if download_poster(poster_path, poster_dest):
        return poster_dest
    
    return None

def update_library(library_data, updates):
    """Write updated poster paths back to the library JSON."""
    for video_id, poster_path in updates.items():
        for v in library_data['videos']:
            if v['id'] == video_id:
                v['poster'] = poster_path.replace('\\', '/')
                # If it's a TV show, also set showPoster
                if v.get('type') == 'tv':
                    v['showPoster'] = poster_path.replace('\\', '/')
    
    with open(LIBRARY_PATH, 'w', encoding='utf-8') as f:
        json.dump(library_data, f)
    print(f"\nOK Library JSON updated with {len(updates)} new poster(s)")

def main():
    parser = argparse.ArgumentParser(description='Sovereign Media — Auto Cover Art Fetcher')
    parser.add_argument('--force', action='store_true', help='Re-download all posters')
    parser.add_argument('--title', type=str, help='Fetch for specific title only')
    parser.add_argument('--dry-run', action='store_true', help='Search only, don\'t download')
    args = parser.parse_args()
    
    if not os.path.exists(LIBRARY_PATH):
        print(f"X Library not found at: {LIBRARY_PATH}")
        sys.exit(1)
    
    with open(LIBRARY_PATH, 'r', encoding='utf-8') as f:
        library = json.load(f)
    
    videos = library.get('videos', [])
    print(f"\n{'=' * 60}")
    print(f"  SOVEREIGN MEDIA -- Cover Art Fetcher")
    print(f"  Library: {len(videos)} items")
    print(f"{'=' * 60}\n")
    
    # Deduplicate TV shows — only fetch once per show
    processed_shows = set()
    updates = {}
    stats = {'found': 0, 'skipped': 0, 'failed': 0, 'existing': 0}
    
    for v in videos:
        title = v.get('show') or v.get('title', '')
        
        # Filter by --title if specified
        if args.title and args.title.lower() not in title.lower():
            continue
        
        # Skip TV episodes we've already processed the show for
        if v.get('type') == 'tv' and v.get('show'):
            show_key = v['show'].lower()
            if show_key in processed_shows:
                continue
            processed_shows.add(show_key)
        
        # Skip if already has a valid poster (> 0 bytes)
        has_valid_poster = False
        if v.get('poster') and os.path.exists(v['poster']) and os.path.getsize(v['poster']) > 0:
            has_valid_poster = True
            
        if not args.force and has_valid_poster:
            stats['existing'] += 1
            continue
        
        print(f"> {title}")
        
        if args.dry_run:
            clean = clean_title(title)
            year = extract_year(v.get('title', '') + ' ' + os.path.dirname(v['path']))
            media_type = 'tv' if v.get('type') == 'tv' else 'movie'
            result = tmdb_search(clean, media_type, year)
            if result:
                print(f"  OK Would match: {result.get('title') or result.get('name')}")
                stats['found'] += 1
            else:
                print(f"  X No match found")
                stats['failed'] += 1
            time.sleep(0.3)  # Rate limit
            continue
        
        poster = process_video(v, force=args.force)
        if poster:
            updates[v['id']] = poster
            # For TV shows, update all episodes of that show
            if v.get('type') == 'tv' and v.get('show'):
                for ep in videos:
                    if ep.get('show') and ep['show'].lower() == v['show'].lower():
                        updates[ep['id']] = poster
            stats['found'] += 1
        else:
            stats['failed'] += 1
        
        time.sleep(0.3)  # TMDB rate limit: ~40 req/10s
    
    # Write updates to library
    if updates and not args.dry_run:
        update_library(library, updates)
    
    print(f"\n{'-' * 60}")
    print(f"  Results: {stats['found']} downloaded, {stats['existing']} existing, {stats['failed']} failed, {stats['skipped']} skipped")
    print(f"{'-' * 60}\n")

if __name__ == '__main__':
    main()
