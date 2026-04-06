import os
import urllib.request
import json

torrent_dir = os.path.expanduser("~/Downloads/Sovereign_Media_Torrents")
os.makedirs(torrent_dir, exist_ok=True)

# Massive Sci-Fi / Fantasy / Military Sci-Fi collections hosted via BitTorrent on Archive.org
collections = [
    {
        "name": "Baen_CD-ROM_Collection",
        "desc": "Legendary Official Baen Free Library (Military Sci-Fi: David Weber, John Ringo)",
        "url": "https://archive.org/download/baen-cd-rom-collection/baen-cd-rom-collection_archive.torrent"
    },
    {
        "name": "SciFi_Ebook_Dump_Archive",
        "desc": "Massive compiled dump of classic & golden age Sci-Fi EPUBs",
        "url": "https://archive.org/download/SciFi_Ebook_Collection/SciFi_Ebook_Collection_archive.torrent"
    },
    {
        "name": "Pulp_Magazine_Archive_SciFi",
        "desc": "Astounding Science Fiction and Galaxy Sci-Fi complete collections",
        "url": "https://archive.org/download/pulpmagazinearchive/pulpmagazinearchive_archive.torrent"
    },
    {
        "name": "LibriVox_SciFi_Audiobooks",
        "desc": "Massive collection of Science Fiction audiobooks",
        "url": "https://archive.org/download/librivoxaudio/librivoxaudio_archive.torrent"
    }
]

print("Initializing Sovereign Acquisition Protocol...")
for item in collections:
    target_file = os.path.join(torrent_dir, f"{item['name']}.torrent")
    print(f"\nTarget: {item['desc']}")
    try:
        req = urllib.request.Request(item['url'], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp, open(target_file, 'wb') as f:
            f.write(resp.read())
        print(f" [+] Securely dumped to: {target_file}")
    except Exception as e:
        print(f" [-] Failed to acquire {item['name']}: {e}")

print(f"\n[ACTION REQUIRED] Open your qBittorrent client and load the .torrent files from:\n{torrent_dir}")
