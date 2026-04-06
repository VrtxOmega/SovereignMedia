import os
import ssl
import urllib.request
import feedparser # We'll need to install this if missing, but we can do a raw xml parse too
import xml.etree.ElementTree as ET
from pathlib import Path
import time
import concurrent.futures

# Bypass strict SSL for mass downloads
ssl._create_default_https_context = ssl._create_unverified_context

BOOKS_DIR = Path(os.path.expanduser('~/Books'))
BOOKS_DIR.mkdir(parents=True, exist_ok=True)

# Standard Ebooks OPDS feeds for high-quality, formatted public domain
FEEDS = {
    "Sci-Fi": "https://standardebooks.org/opds/subjects/science-fiction",
    "Fantasy": "https://standardebooks.org/opds/subjects/fantasy",
    "Horror/Weird": "https://standardebooks.org/opds/subjects/horror",
    "Adventure": "https://standardebooks.org/opds/subjects/adventure",
    "Mystery": "https://standardebooks.org/opds/subjects/mystery"
}

def download_book(title, authors, epub_url, category):
    try:
        # Simplify filename
        clean_title = "".join(c for c in title if c.isalnum() or c in " -_").strip()
        clean_author = "".join(c for c in authors if c.isalnum() or c in " -_").strip()
        filename = f"{clean_title} - {clean_author}.epub"
        out_path = BOOKS_DIR / filename
        
        if out_path.exists():
            return f"[SKIP] {filename} already exists."
        
        req = urllib.request.Request(epub_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response, open(out_path, 'wb') as out_file:
            out_file.write(response.read())
        return f"[OK] {category}: {filename}"
    except Exception as e:
        return f"[ERROR] {title}: {e}"

books_to_download = []

print("[SovereignMedia] Scanning Standard Ebooks OPDS for Huge High-Quality Collection...")

for category, url in FEEDS.items():
    print(f"Fetching {category} feed...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        # Atom namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('atom:entry', ns)
        for entry in entries:
            title = entry.find('atom:title', ns).text
            # Can be multiple authors
            authors = [a.find('atom:name', ns).text for a in entry.findall('atom:author', ns)]
            author_str = ", ".join(authors)
            
            # Find the epub link
            epub_url = None
            for link in entry.findall('atom:link', ns):
                if link.get('type') == 'application/epub+zip':
                    epub_url = link.get('href')
                    if epub_url.startswith('/'):
                        epub_url = "https://standardebooks.org" + epub_url
                    break
            
            if epub_url:
                books_to_download.append((title, author_str, epub_url, category))
    except Exception as e:
        print(f"Failed to fetch {category}: {e}")

print(f"\n[SovereignMedia] Discovered {len(books_to_download)} premium EPUBs. Commencing massive parallel sync...")

# Download in parallel
successes = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(download_book, *b) for b in books_to_download]
    for future in concurrent.futures.as_completed(futures):
        res = future.result()
        print(res)
        if "[OK]" in res:
            successes += 1

print(f"\n[SovereignMedia] MASS INGESTION COMPLETE. Synced {successes} new premium EPUBs to {BOOKS_DIR}")
