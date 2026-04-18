import json
import os
import subprocess
import tempfile

audit_path = "audit.json"
library_path = os.path.expandvars(r"%APPDATA%\sovereign-media\sovereign_video_library.json")

def load_audit():
    with open(audit_path, "r", encoding="utf-16") as f:
        # Strip the "Starting audit..." line and "--- RESULTS ---" line
        lines = f.readlines()
        json_lines = []
        capture = False
        for line in lines:
            if line.strip() == "[":
                capture = True
            if capture:
                json_lines.append(line)
        return json.loads("".join(json_lines))

def load_library():
    with open(library_path, "r", encoding="utf-8") as f:
        return json.load(f)

def run():
    audit_data = load_audit()
    lib_data = load_library()
    
    # Map filenames to their full paths from the library
    name_to_path = {os.path.basename(v["path"]): v["path"] for v in lib_data["videos"]}
    
    files_to_process = []
    # Skip the ones we already started processing manually
    skip_prefix = "The Mandalorian S01"
    
    for item in audit_data:
        filename = item["file"]
        if filename.startswith(skip_prefix):
            continue
            
        full_path = name_to_path.get(filename)
        if full_path and os.path.exists(full_path):
            files_to_process.append(full_path)
            
    print(f"Found {len(files_to_process)} files to optimize.")
    
    for fpath in files_to_process:
        print(f"\n======================================")
        print(f"Processing: {os.path.basename(fpath)}")
        dirname = os.path.dirname(fpath)
        ext = os.path.splitext(fpath)[1]
        out_name = os.path.splitext(fpath)[0] + "_aac" + ext
        
        # -map 0:s? makes sure that if there are NO subtitles, the command doesn't fail.
        # -c:s copy strictly copies the subtitles without touching them. Same for video.
        cmd = [
            "ffmpeg", "-y", "-i", fpath,
            "-map", "0:v", "-map", "0:a", "-map", "0:s?",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k",
            "-c:s", "copy",
            out_name
        ]
        
        print(f"Command: {' '.join(cmd)}")
        result = subprocess.run(cmd)
        
        if result.returncode == 0:
            print("Success! Replacing original.")
            os.remove(fpath)
            os.rename(out_name, fpath)
        else:
            print(f"Error processing {fpath}.")
            if os.path.exists(out_name):
                os.remove(out_name)

if __name__ == "__main__":
    run()
