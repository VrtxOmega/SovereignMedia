import urllib.request
import os

books = [
    ("https://craphound.com/littlebrother/download/cory_doctorow_-_little_brother.epub", "Cory Doctorow - Little Brother.epub"),
    ("https://craphound.com/homeland/download/Cory_Doctorow_-_Homeland.epub", "Cory Doctorow - Homeland.epub")
]

target_dir = os.path.expanduser("~/Books")
os.makedirs(target_dir, exist_ok=True)

for url, filename in books:
    target_path = os.path.join(target_dir, filename)
    print(f"Downloading {filename}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        with urllib.request.urlopen(req) as response, open(target_path, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        print(f"Successfully downloaded {filename} ({len(data)} bytes)")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")

print("Done downloading modern DRM-free EPUBs.")
