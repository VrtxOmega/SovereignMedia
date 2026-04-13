const fs = require('fs');
const cp = require('child_process');
const data = JSON.parse(fs.readFileSync(process.env.APPDATA + '/sovereign-media/sovereign_video_library.json'));
const files = data.videos.map(v => v.path);

let unsupported = [];

console.log("Starting audit of " + files.length + " files. This might take a minute...");

for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!fs.existsSync(f)) continue;

    try {
        const out = cp.execSync(`ffprobe -v error -show_entries stream=codec_name -select_streams a:0 -of default=noprint_wrappers=1:nokey=1 "${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const codec = out.trim();
        if (codec === 'ac3' || codec === 'eac3' || codec === 'dts') {
            unsupported.push({ file: require('path').basename(f), codec });
        }
    } catch(e) {}
}

console.log("--- RESULTS ---");
console.log(JSON.stringify(unsupported, null, 2));
