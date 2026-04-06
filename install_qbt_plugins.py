import os
import urllib.request

engines_dir = os.path.expanduser(r"~\AppData\Local\qBittorrent\nova3\engines")
os.makedirs(engines_dir, exist_ok=True)

plugins = [
    ("audiobookbay.py", "https://raw.githubusercontent.com/nklido/qBittorrent_search_engines/master/audiobookbay.py"),
    ("torrentgalaxy.py", "https://raw.githubusercontent.com/nindogo/qbtSearchScripts/master/torrentgalaxy.py"),
    ("magnetdl.py", "https://raw.githubusercontent.com/nindogo/qbtSearchScripts/master/magnetdl.py"),
    ("btdig.py", "https://raw.githubusercontent.com/galaris/BTDigg-qBittorrent-plugin/master/btdig.py"),
    ("anidex.py", "https://raw.githubusercontent.com/nindogo/qbtSearchScripts/master/anidex.py")
]

print("Injecting unofficial search plugins into qBittorrent...")
for filename, url in plugins:
    path = os.path.join(engines_dir, filename)
    print(f"Downloading {filename}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
            out_file.write(response.read())
        print(f" ✔ successfully installed {filename}")
    except Exception as e:
        print(f" ✘ Failed to download {filename}: {e}")

print("\nPlugin injection complete. Open qBittorrent and click View -> Search Engine to start scraping massive collections.")
