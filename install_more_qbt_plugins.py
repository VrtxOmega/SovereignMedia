import os
import urllib.request

engines_dir = os.path.expanduser(r"~\AppData\Local\qBittorrent\nova3\engines")

plugins = [
    ("solidtorrents.py", "https://raw.githubusercontent.com/BurningMop/qBittorrent-Search-Plugins/master/solidtorrents.py"),
    ("therarbg.py", "https://raw.githubusercontent.com/BurningMop/qBittorrent-Search-Plugins/master/therarbg.py"),
    ("rutracker.py", "https://raw.githubusercontent.com/imDMG/qBt_SE/master/rutracker.py"),
    ("thepiratebay.py", "https://raw.githubusercontent.com/LightDestory/qBittorrent-Search-Plugins/master/src/engines/thepiratebay.py"),
    ("glotorrents.py", "https://raw.githubusercontent.com/LightDestory/qBittorrent-Search-Plugins/master/src/engines/glotorrents.py"),
    ("kickasstorrent.py", "https://raw.githubusercontent.com/LightDestory/qBittorrent-Search-Plugins/master/src/engines/kickasstorrents.py"),
    ("snowfl.py", "https://raw.githubusercontent.com/LightDestory/qBittorrent-Search-Plugins/master/src/engines/snowfl.py"),
    ("nyaasi.py", "https://raw.githubusercontent.com/MadeOfMagicAndWires/qBit-plugins/master/engines/nyaasi.py")
]

print("Injecting expanded search plugins into qBittorrent...")
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
