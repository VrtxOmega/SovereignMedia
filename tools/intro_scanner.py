import os
import sys
import json
import subprocess
import glob
import re

def parse_ffmpeg_output(stderr_text):
    # Extracts silence and black frame intervals
    silences = []
    blacks = []
    
    start_s = None
    for line in stderr_text.splitlines():
        if "silence_start:" in line:
            match = re.search(r"silence_start:\s*([\d\.]+)", line)
            if match: start_s = float(match.group(1))
        elif "silence_end:" in line and start_s is not None:
            match = re.search(r"silence_end:\s*([\d\.]+)", line)
            if match:
                silences.append((start_s, float(match.group(1))))
                start_s = None
                
        # [blackdetect @ 0x...] black_start:10.5 black_end:12.3 black_duration:1.8
        if "black_start:" in line and "black_end:" in line:
            try:
                start_b = float(re.search(r"black_start:([\d\.]+)", line).group(1))
                end_b = float(re.search(r"black_end:([\d\.]+)", line).group(1))
                blacks.append((start_b, end_b))
            except Exception:
                pass
            
    return silences, blacks

def merge_intervals(silences, blacks):
    # Combine and sort intervals. A marker is simply a time period of "break"
    intervals = silences + blacks
    intervals.sort(key=lambda x: x[0])
    
    # Merge overlapping or close intervals (within 1 second)
    merged = []
    if not intervals: return merged
    
    current = list(intervals[0])
    for nxt in intervals[1:]:
        if nxt[0] <= current[1] + 1.0:
            current[1] = max(current[1], nxt[1])
        else:
            merged.append(tuple(current))
            current = list(nxt)
    merged.append(tuple(current))
    return merged

def find_intro(merged_intervals):
    # Look for a gap between intervals representing the Intro.
    # An intro is assumed to be between 20 and 120 seconds long.
    if len(merged_intervals) < 2:
        return None
        
    for i in range(len(merged_intervals) - 1):
        end_of_first = merged_intervals[i][1]
        start_of_second = merged_intervals[i+1][0]
        
        duration = start_of_second - end_of_first
        # If the segment between breaks is intro-length, guess it's the intro
        if 20.0 <= duration <= 120.0:
            return { "start": round(end_of_first, 2), "end": round(start_of_second, 2) }
            
    return None

def scan_directory(target_dir):
    map_file = os.path.join(target_dir, ".metadata", "intros_map.json")
    os.makedirs(os.path.dirname(map_file), exist_ok=True)
    
    intro_map = {}
    if os.path.exists(map_file):
        try:
            with open(map_file, 'r', encoding='utf-8') as f:
                intro_map = json.load(f)
        except Exception:
            pass

    extensions = ('*.mp4', '*.mkv')
    video_files = []
    for ext in extensions:
        video_files.extend(glob.glob(os.path.join(target_dir, '**', ext), recursive=True))

    new_finds = False
    for v in video_files:
        rel_path = os.path.relpath(v, target_dir).replace('\\', '/')
        if rel_path in intro_map:
            continue
            
        print(f"Scanning {os.path.basename(v)} for intro bounds...")
        # Scan first 9 minutes (540s)
        cmd = [
            "ffmpeg", "-hide_banner", "-t", "540", "-i", v,
            "-vf", "blackdetect=d=1.5:pic_th=0.10",
            "-af", "silencedetect=noise=-35dB:d=1.5",
            "-f", "null", "-"
        ]
        
        try:
            # We don't want a single slow scan to stall forever, so impose a timeout of 120 seconds per video.
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            silences, blacks = parse_ffmpeg_output(res.stderr)
            merged = merge_intervals(silences, blacks)
            intro = find_intro(merged)
            
            if intro:
                print(f"  -> Intro found: {intro['start']}s to {intro['end']}s")
                intro_map[rel_path] = intro
                new_finds = True
            else:
                print("  -> No distinct intro boundaries detected.")
                intro_map[rel_path] = {"start": -1, "end": -1}
                new_finds = True
                
        except subprocess.TimeoutExpired:
            print(f"  -> FFmpeg timeout on {os.path.basename(v)}. Skipping.")
            intro_map[rel_path] = {"start": -1, "end": -1}
            new_finds = True
            
        if new_finds:
            with open(map_file, 'w', encoding='utf-8') as f:
                json.dump(intro_map, f, indent=2)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        scan_directory(sys.argv[1])
