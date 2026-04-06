"""
Extract Amazon cookies from Chrome by copying the locked DB using msvcrt file sharing.
"""
import os, sys, sqlite3, json, tempfile, base64
from pathlib import Path

COOKIE_DB = Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data" / "Default" / "Network" / "Cookies"
LOCAL_STATE = Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data" / "Local State"
TMP_DB = Path(tempfile.gettempdir()) / "amz_cookies.db"

print(f"[SovereignMedia] Source: {COOKIE_DB}")

# Use Volume Shadow Copy to read the locked file
import subprocess
result = subprocess.run(
    ["powershell", "-NoProfile", "-Command",
     f"[System.IO.File]::ReadAllBytes('{COOKIE_DB}') | Set-Content -Path '{TMP_DB}' -Encoding Byte"],
    capture_output=True, text=True, timeout=10
)
if result.returncode != 0:
    # Fallback: try esentutl
    print("[SovereignMedia] PowerShell copy failed, trying esentutl...")
    result = subprocess.run(
        ["esentutl", "/y", str(COOKIE_DB), "/d", str(TMP_DB), "/o"],
        capture_output=True, text=True, timeout=10
    )
    if result.returncode != 0:
        print(f"[SovereignMedia] esentutl failed: {result.stderr}")
        sys.exit(1)

print(f"[SovereignMedia] Copied to {TMP_DB} ({TMP_DB.stat().st_size} bytes)")

# Read Amazon cookies
conn = sqlite3.connect(str(TMP_DB))
cur = conn.cursor()
cur.execute("""
    SELECT name, host_key, encrypted_value, is_httponly 
    FROM cookies WHERE host_key LIKE '%amazon.com%'
""")
rows = cur.fetchall()
conn.close()
print(f"[SovereignMedia] Found {len(rows)} Amazon cookies")

# Get Chrome's AES key
with open(LOCAL_STATE, "r") as f:
    key_b64 = json.load(f)["os_crypt"]["encrypted_key"]
encrypted_key = base64.b64decode(key_b64)[5:]  # Strip "DPAPI" prefix

# DPAPI decrypt the key
import ctypes, ctypes.wintypes

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD),
                ("pbData", ctypes.POINTER(ctypes.c_char))]

blob_in = DATA_BLOB(len(encrypted_key), ctypes.create_string_buffer(encrypted_key, len(encrypted_key)))
blob_out = DATA_BLOB()
ok = ctypes.windll.crypt32.CryptUnprotectData(
    ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
)
if not ok:
    print("[SovereignMedia] DPAPI key decryption failed")
    sys.exit(1)

aes_key = ctypes.string_at(blob_out.pbData, blob_out.cbData)
ctypes.windll.kernel32.LocalFree(blob_out.pbData)
print(f"[SovereignMedia] AES key: {len(aes_key)} bytes")

# Decrypt cookies using AES-GCM
try:
    from Cryptodome.Cipher import AES
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "pycryptodome", "--quiet"], check=True)
    from Cryptodome.Cipher import AES

conn = sqlite3.connect(str(TMP_DB))
cur = conn.cursor()
cur.execute("SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%amazon.com%'")

cookie_parts = []
for name, enc_val in cur.fetchall():
    try:
        if enc_val[:3] in (b'v10', b'v20'):
            nonce = enc_val[3:15]
            ct_tag = enc_val[15:]
            ct = ct_tag[:-16]
            tag = ct_tag[-16:]
            cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            val = cipher.decrypt_and_verify(ct, tag).decode('utf-8', errors='replace')
        else:
            # Legacy DPAPI
            blob_in2 = DATA_BLOB(len(enc_val), ctypes.create_string_buffer(enc_val, len(enc_val)))
            blob_out2 = DATA_BLOB()
            ctypes.windll.crypt32.CryptUnprotectData(
                ctypes.byref(blob_in2), None, None, None, None, 0, ctypes.byref(blob_out2)
            )
            val = ctypes.string_at(blob_out2.pbData, blob_out2.cbData).decode('utf-8', errors='replace')
            ctypes.windll.kernel32.LocalFree(blob_out2.pbData)
        cookie_parts.append(f"{name}={val}")
    except Exception as e:
        print(f"  [SKIP] {name}: {e}")

conn.close()

cookie_str = "; ".join(cookie_parts)
print(f"\n[SovereignMedia] Decrypted {len(cookie_parts)} cookies")

# Check critical cookies
names = [p.split("=", 1)[0] for p in cookie_parts]
for req in ["session-id", "session-token", "ubid-main", "x-main"]:
    print(f"  {'✅' if req in names else '❌'} {req}")

with open("amazon_cookie.txt", "w") as f:
    f.write(cookie_str)
print(f"\n[SovereignMedia] ✅ Full cookie string saved to amazon_cookie.txt ({len(cookie_str)} chars)")

TMP_DB.unlink(missing_ok=True)
