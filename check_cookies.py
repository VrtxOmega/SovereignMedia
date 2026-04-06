"""
Extract Amazon cookies from Chrome's cookie database directly (no admin needed).
Copies the cookie DB to a temp location to avoid lock issues.
"""
import os
import sys
import json
import shutil
import sqlite3
import tempfile
from pathlib import Path

# Chrome stores cookies in the user's profile
CHROME_COOKIE_PATHS = [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Google" / "Chrome" / "User Data" / "Default" / "Cookies",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Google" / "Chrome" / "User Data" / "Default" / "Network" / "Cookies",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Edge" / "User Data" / "Default" / "Cookies",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Edge" / "User Data" / "Default" / "Network" / "Cookies",
]

for p in CHROME_COOKIE_PATHS:
    print(f"  Checking: {p} → {'EXISTS' if p.exists() else 'not found'}")

# Find first valid cookie DB
cookie_db = None
for p in CHROME_COOKIE_PATHS:
    if p.exists():
        cookie_db = p
        break

if not cookie_db:
    print("[SovereignMedia] No cookie database found!")
    sys.exit(1)

print(f"\n[SovereignMedia] Using: {cookie_db}")

# Copy to temp to avoid lock
tmp = Path(tempfile.mktemp(suffix=".db"))
shutil.copy2(cookie_db, tmp)
print(f"[SovereignMedia] Copied to: {tmp}")

try:
    conn = sqlite3.connect(str(tmp))
    cur = conn.cursor()
    
    # Check table structure
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print(f"[SovereignMedia] Tables: {tables}")
    
    # Get column names
    cur.execute("PRAGMA table_info(cookies)")
    cols = [(r[1], r[2]) for r in cur.fetchall()]
    print(f"[SovereignMedia] Columns: {[c[0] for c in cols]}")
    
    # Get Amazon cookies
    cur.execute("SELECT name, host_key, path, is_httponly FROM cookies WHERE host_key LIKE '%amazon%'")
    amazon_cookies = cur.fetchall()
    print(f"\n[SovereignMedia] Found {len(amazon_cookies)} Amazon cookies:")
    for name, host, path, httponly in amazon_cookies:
        ho = "🔒" if httponly else "  "
        print(f"  {ho} {name:30s} | {host:30s} | httponly={httponly}")
    
    conn.close()
except Exception as e:
    print(f"[SovereignMedia] Error: {e}")
finally:
    tmp.unlink(missing_ok=True)
