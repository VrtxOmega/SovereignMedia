const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');

let mainWindow;

const dataPath = path.join(app.getPath('userData'), 'omega_audio_library.json');
const coversDir = path.join(app.getPath('userData'), 'covers');

// Ensure covers directory exists
if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
}

async function getLibrary() {
    if (fs.existsSync(dataPath)) {
        try {
            return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        } catch(e) {}
    }
    return null;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 850,
        minWidth: 500,
        minHeight: 400,
        backgroundColor: '#0a0a0c',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#121216',
            symbolColor: '#c5a365'
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            webSecurity: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── Helper: Save cover art as a file, return file:// path ────────────────
function saveCoverArt(albumId, picData, picFormat) {
    try {
        let ext = '.jpg';
        if (picFormat && picFormat.includes('png')) ext = '.png';
        const coverPath = path.join(coversDir, `${albumId}${ext}`);
        
        // Only write if not already cached
        if (!fs.existsSync(coverPath)) {
            fs.writeFileSync(coverPath, picData);
        }
        // Return a file:// URI the renderer can load
        return coverPath.replace(/\\/g, '/');
    } catch (e) {
        console.error('Failed to save cover art:', e.message);
        return null;
    }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────
ipcMain.handle('media:getLibrary', async () => {
    return await getLibrary();
});

ipcMain.handle('media:openAudioFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Audiobook Folder'
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const startFolder = result.filePaths[0];
    const audioFiles = [];
    const exts = ['.mp3', '.m4a', '.m4b', '.wav', '.flac', '.ogg'];

    // Phase 1: Collect all audio file paths
    function scanDir(dir) {
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    scanDir(fullPath);
                } else if (item.isFile()) {
                    const ext = path.extname(item.name).toLowerCase();
                    if (exts.includes(ext)) {
                        audioFiles.push({
                            filename: item.name,
                            title: item.name.replace(ext, ''),
                            path: fullPath,
                            dir: dir,
                            duration: 0,
                            trackNo: 0,
                            folderName: path.basename(dir)
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error scanning dir:', e);
        }
    }

    scanDir(startFolder);
    
    // Phase 2: Parse ID3 metadata for every file and group by album
    const { parseFile } = await import('music-metadata');
    const grouped = {};
    
    for (let track of audioFiles) {
        let albumName = track.folderName;
        let artistName = "Unknown";
        let coverBuffer = null;
        let coverFormat = null;

        try {
            const metadata = await parseFile(track.path, { duration: true });
            
            // Track-level metadata
            if (metadata.common.title) track.title = metadata.common.title;
            if (metadata.format && metadata.format.duration) track.duration = metadata.format.duration;
            if (metadata.common.track && metadata.common.track.no) track.trackNo = metadata.common.track.no;
            
            // Album name: use ID3 album tag if present
            if (metadata.common.album) {
                albumName = metadata.common.album;
            }
            
            // Artist
            if (metadata.common.albumartist) artistName = metadata.common.albumartist;
            else if (metadata.common.artist) artistName = metadata.common.artist;
            
            // Cover art: extract raw buffer (NOT base64)
            if (metadata.common.picture && metadata.common.picture.length > 0) {
                coverBuffer = metadata.common.picture[0].data;
                coverFormat = metadata.common.picture[0].format || 'image/jpeg';
            }
        } catch (err) {
            console.error(`Metadata error: ${track.filename}`, err.message);
        }

        // Build group
        if (!grouped[albumName]) {
            const safeId = crypto.createHash('sha256').update(albumName).digest('hex').substring(0, 16);
            
            // Save cover art as a real file on disk
            let coverPath = null;
            if (coverBuffer) {
                coverPath = saveCoverArt(safeId, coverBuffer, coverFormat);
            }
            
            grouped[albumName] = {
                id: safeId,
                name: albumName,
                path: track.dir,
                coverArt: coverPath,   // file path, NOT base64
                artist: artistName,
                tracks: []
            };
        } else {
            const g = grouped[albumName];
            // Fill missing cover art from later tracks
            if (!g.coverArt && coverBuffer) {
                g.coverArt = saveCoverArt(g.id, coverBuffer, coverFormat);
            }
            if (g.artist === "Unknown" && artistName !== "Unknown") {
                g.artist = artistName;
            }
        }
        
        // Push track (stripped of heavy fields for JSON storage)
        grouped[albumName].tracks.push({
            filename: track.filename,
            title: track.title,
            path: track.path,
            duration: track.duration,
            trackNo: track.trackNo
        });
    }
    
    // Phase 3: Sort tracks within each album, then sort albums alphabetically
    const albums = Object.values(grouped);
    for (let album of albums) {
        album.tracks.sort((a, b) => {
            if (a.trackNo && b.trackNo && a.trackNo !== b.trackNo) return a.trackNo - b.trackNo;
            return a.filename.localeCompare(b.filename);
        });
    }
    albums.sort((a, b) => a.name.localeCompare(b.name));

    const libraryData = { path: startFolder, albums };
    
    // JSON is now lightweight — no base64 blobs, just file paths
    fs.writeFileSync(dataPath, JSON.stringify(libraryData), 'utf8');
    return libraryData;
});

// ── Window Controls ──────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// ── Chapter Extraction via ffprobe ───────────────────────────────────────
ipcMain.handle('media:getChapters', async (_event, filePath) => {
    return new Promise((resolve) => {
        execFile('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_chapters',
            filePath
        ], { timeout: 15000 }, (err, stdout) => {
            if (err) {
                console.error('ffprobe chapter extraction failed:', err.message);
                return resolve([]);
            }
            try {
                const data = JSON.parse(stdout);
                if (!data.chapters || data.chapters.length === 0) return resolve([]);
                const chapters = data.chapters.map((ch, i) => ({
                    index: i,
                    title: (ch.tags && ch.tags.title) || `Chapter ${i + 1}`,
                    start: parseFloat(ch.start_time) || 0,
                    end: parseFloat(ch.end_time) || 0
                }));
                resolve(chapters);
            } catch (e) {
                console.error('ffprobe JSON parse error:', e.message);
                resolve([]);
            }
        });
    });
});
