const { app, BrowserWindow, ipcMain, dialog, protocol, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { setupRemote } = require('./mobile_remote.js');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

let mainWindow;
let tray = null;
let isQuitting = false;

const dataPath = path.join(app.getPath('userData'), 'omega_audio_library.json');
const coversDir = path.join(app.getPath('userData'), 'covers');
const bookDataPath = path.join(app.getPath('userData'), 'sovereign_book_library.json');
const bookCoversDir = path.join(app.getPath('userData'), 'book_covers');
const videoDataPath = path.join(app.getPath('userData'), 'sovereign_video_library.json');
const thumbsDir = path.join(app.getPath('userData'), 'thumbnails');

// Ensure data directories exist
[coversDir, bookCoversDir, thumbsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function getLibrary() {
    if (fs.existsSync(dataPath)) {
        try {
            return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        } catch(e) {}
    }
    return null;
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

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
        icon: path.join(__dirname, 'omega_audio.ico'),
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

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'omega_audio.ico');
    // If the icon doesn't exist, we fallback to a nativeImage empty one, or standard electron icon
    let trayIcon = nativeImage.createEmpty();
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    }
    
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Player', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit Sovereign Media', click: () => {
            isQuitting = true;
            app.quit();
        }}
    ]);
    tray.setToolTip('Sovereign Media');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    
    // Boot Mobile Remote Controller
    setupRemote(ipcMain, mainWindow, app);
    
    // ── Media Sync Daemon ────────────────────────────────────────
    try {
        const { spawn } = require('child_process');
        const daemonPath = path.join('C:\\Veritas_Lab\\SovereignAudio\\backend', 'media_sync_daemon.py');
        if (fs.existsSync(daemonPath)) {
            let pythonExe = 'python';
            
            const syncDaemon = spawn(pythonExe, [daemonPath], { windowsHide: true, shell: true });
            syncDaemon.stdout.on('data', d => console.log('[SYNC_DAEMON]', d.toString().trim()));
            syncDaemon.stderr.on('data', d => console.error('[SYNC_DAEMON]', d.toString().trim()));
            console.log(`[SovereignMedia] Spawning Media Sync Daemon: ${daemonPath}`);

            // Spawn Localtunnel to ensure the WebSocket is accessible anywhere via HTTPS
            const ngrokDaemon = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['localtunnel', '--port', '5002', '--subdomain', 'omega-audio-rlopez'], { windowsHide: true, shell: true });
            ngrokDaemon.stdout.on('data', d => console.log('[CLOUD_TUNNEL]', d.toString().trim()));
            ngrokDaemon.stderr.on('data', d => console.error('[CLOUD_TUNNEL]', d.toString().trim()));
            console.log(`[SovereignMedia] Spawning Cloud Tunnel for Port 5002`);
            
            app.on('before-quit', () => {
                isQuitting = true;
                try { syncDaemon.kill(); } catch (e) {}
                try { ngrokDaemon.kill(); } catch (e) {}
            });
        }
    } catch (e) {
        console.warn(`[SovereignMedia] Failed to spawn Media Sync and Cloud Tunnel: ${e.message}`);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    // Only quit if not doing tray behavior, but we are doing tray behavior
    // and isQuitting flag handles actual quitting.
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
ipcMain.on('window:close', () => mainWindow?.hide());

let preMiniBounds = null;
ipcMain.on('window:setMiniMode', (event, mode) => {
    if (!mainWindow) return;
    if (mode === 'normal') {
        mainWindow.setMinimumSize(500, 400);
        if (preMiniBounds) {
            mainWindow.setBounds(preMiniBounds);
        } else {
            mainWindow.setSize(1100, 850);
        }
        forceDragRegionRedraw();
    } else if (mode === 'square') {
        if (!preMiniBounds || mainWindow.getBounds().width > 400) preMiniBounds = mainWindow.getBounds();
        mainWindow.setMinimumSize(280, 400);
        mainWindow.setSize(280, 400);
        forceDragRegionRedraw();
    } else if (mode === 'ribbon') {
        if (!preMiniBounds || mainWindow.getBounds().width > 550) preMiniBounds = mainWindow.getBounds();
        mainWindow.setMinimumSize(600, 100);
        mainWindow.setSize(600, 100);
        forceDragRegionRedraw();
    }
});

function forceDragRegionRedraw() {
    if (!mainWindow) return;
    // Chromium bug on Windows: Frameless window dragging breaks on programmatic resize.
    // Hack: Force an infinitesimal bounds change to trigger a deep OS hit-test update.
    setTimeout(() => {
        try {
            const b = mainWindow.getBounds();
            mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height + 1 });
            mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
        } catch(e) {}
    }, 50);
}

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

// ══════════════════════════════════════════════════════════════════════════
// ── BOOK IPC Handlers ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

async function getBookLibrary() {
    if (fs.existsSync(bookDataPath)) {
        try { return JSON.parse(fs.readFileSync(bookDataPath, 'utf8')); }
        catch(e) {}
    }
    return null;
}

ipcMain.handle('books:getLibrary', async () => {
    return await getBookLibrary();
});

ipcMain.handle('books:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select eBook Folder'
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const startFolder = result.filePaths[0];
    const books = [];
    const AdmZip = require('adm-zip');
    
    // Load Delta Cache
    const existingCache = await getBookLibrary() || [];
    const cacheMap = new Map();
    existingCache.forEach(b => cacheMap.set(b.id, b));

    async function scanDir(dir) {
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            let processCount = 0;
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await scanDir(fullPath);
                } else if (item.isFile()) {
                    const ext = path.extname(item.name).toLowerCase();
                    if (ext === '.epub') {
                        const stat = fs.statSync(fullPath);
                        const id = crypto.createHash('sha256').update(fullPath).digest('hex').substring(0, 16);
                        
                        const cached = cacheMap.get(id);
                        if (cached && cached.modified === stat.mtimeMs && cached.size === stat.size) {
                            books.push(cached);
                            continue; // Delta Cache HIT: Bypass AdmZip extraction entirely!
                        }
                        
                        let fallbackTitle = item.name.replace(ext, '').replace(/_/g, ' ');
                        let extractedTitle = fallbackTitle;
                        let extractedAuthor = "Unknown Author";
                        let extractedCoverPath = null;

                        try {
                            const zip = new AdmZip(fullPath);
                            let opfPath = 'content.opf';
                            const containerEntry = zip.getEntry('META-INF/container.xml');
                            if (containerEntry) {
                                const containerData = containerEntry.getData().toString('utf8');
                                const match = containerData.match(/full-path=["']([^"']+\.opf)["']/i);
                                if (match) opfPath = match[1];
                            }
                            const opfEntry = zip.getEntry(opfPath);
                            if (opfEntry) {
                                const opfData = opfEntry.getData().toString('utf8');
                                const titleMatch = opfData.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
                                const creatorMatch = opfData.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
                                if (titleMatch) extractedTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                                if (creatorMatch) extractedAuthor = creatorMatch[1].replace(/<[^>]+>/g, '').trim();
                                
                                // Cover Extraction
                                let coverId = null;
                                const coverMetaMatch = opfData.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i);
                                if (coverMetaMatch) coverId = coverMetaMatch[1];
                                
                                let coverHref = null;
                                if (coverId) {
                                    const itemMatch = opfData.match(new RegExp(`<item[^>]*id=["']${coverId}["'][^>]*href=["']([^"']+)["']`, 'i'));
                                    if (itemMatch) coverHref = itemMatch[1];
                                }
                                if (!coverHref) {
                                    const propMatch = opfData.match(/<item[^>]*properties=["']cover-image["'][^>]*href=["']([^"']+)["']/i);
                                    if (propMatch) coverHref = propMatch[1];
                                }
                                // Fallback 1: Any item with id="cover" or id="cover-image"
                                if (!coverHref) {
                                    const idMatch = opfData.match(/<item[^>]*id=["'](?:cover|cover-image)["'][^>]*href=["']([^"']+)["']/i);
                                    if (idMatch) coverHref = idMatch[1];
                                }
                                // Fallback 2: Any image item with "cover" or "front" in the filename
                                if (!coverHref) {
                                    const nameMatch = opfData.match(/<item[^>]*href=["']([^"']*(?:cover|front)[^"']*\.(?:jpg|jpeg|png))["'][^>]*media-type=["']image\/[^"']+["']/i);
                                    if (nameMatch) coverHref = nameMatch[1];
                                }
                                
                                if (coverHref) {
                                    let opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));
                                    let absCoverPath = opfDir ? `${opfDir}/${coverHref}` : coverHref;
                                    const coverEntry = zip.getEntry(absCoverPath);
                                    if (coverEntry) {
                                        const picData = coverEntry.getData();
                                        const fileExt = coverHref.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                                        extractedCoverPath = saveCoverArt("book_" + id, picData, fileExt);
                                    }
                                }
                            }
                        } catch (err) {}

                        let pushData = {
                            id,
                            title: extractedTitle,
                            author: extractedAuthor,
                            filename: item.name,
                            path: fullPath,
                            size: stat.size,
                            modified: stat.mtimeMs
                        };
                        if (extractedCoverPath) {
                            pushData.coverArt = 'file:///' + extractedCoverPath;
                        }
                        books.push(pushData);
                        
                        processCount++;
                        // Yield event loop every 50 books to prevent frozen UI on giant library
                        if (processCount % 50 === 0) {
                            await new Promise(r => setImmediate(r));
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Book scan error:', e);
        }
    }

    await scanDir(startFolder);
    books.sort((a, b) => a.title.localeCompare(b.title));

    const libraryData = { path: startFolder, books };
    fs.writeFileSync(bookDataPath, JSON.stringify(libraryData), 'utf8');
    return libraryData;
});

ipcMain.handle('books:getFile', async (_event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        // Return as ArrayBuffer-compatible for epub.js
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } catch (e) {
        console.error('Failed to read book file:', e.message);
        return null;
    }
});

// ══════════════════════════════════════════════════════════════════════════
// ── VIDEO IPC Handlers ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

async function getVideoLibrary() {
    if (fs.existsSync(videoDataPath)) {
        try { return JSON.parse(fs.readFileSync(videoDataPath, 'utf8')); }
        catch(e) {}
    }
    return null;
}

ipcMain.handle('video:getLibrary', async () => {
    return await getVideoLibrary();
});

ipcMain.handle('video:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Video Folder'
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    return await scanVideoLibrary(result.filePaths[0]);
});

ipcMain.handle('video:refreshFolder', async () => {
    if (!fs.existsSync(videoDataPath)) return null;
    try {
        const libraryData = JSON.parse(fs.readFileSync(videoDataPath, 'utf8'));
        if (libraryData && libraryData.path) {
            return await scanVideoLibrary(libraryData.path);
        }
    } catch (e) {
        console.error('Failed to parse existing video library JSON', e);
    }
    return null;
});

async function scanVideoLibrary(startFolder) {
    const videos = [];
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.wmv'];

    function scanDir(dir) {
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    scanDir(fullPath);
                } else if (item.isFile()) {
                    const ext = path.extname(item.name).toLowerCase();
                    if (videoExts.includes(ext)) {
                        const stat = fs.statSync(fullPath);
                        const id = crypto.createHash('sha256').update(fullPath).digest('hex').substring(0, 16);
                        
                        let vidType = "movie";
                        let showName = null;
                        let seasonNum = null;
                        let episodeNum = null;

                        let baseName = item.name.replace(ext, '');
                        // tv match on the original name
                        const tvMatch = baseName.match(/(?:\b|_)S(\d{1,2})E(\d{1,2})(?:\b|_)/i) || baseName.match(/(?:\b|_)0?(\d{1,2})x(\d{1,2})(?:\b|_)/i) || baseName.match(/S(\d{1,2})E(\d{1,2})/i);
                        
                        let title = baseName.replace(/_/g, ' ');

                        if (tvMatch) {
                            vidType = "tv";
                            seasonNum = parseInt(tvMatch[1], 10);
                            episodeNum = parseInt(tvMatch[2], 10);
                            
                            showName = title.substring(0, tvMatch.index).trim();
                            if (showName.endsWith('-')) showName = showName.slice(0, -1).trim();
                            
                            if (!showName || showName.length < 2) {
                                showName = path.basename(dir);
                                if (showName.toLowerCase().includes('season')) {
                                    showName = path.basename(path.dirname(dir));
                                }
                            }
                        } else {
                            title = title.replace(/\.(19|20)\d{2}\..*/, '');
                            title = title.replace(/\./g, ' ').trim();
                        }

                        if (vidType === "tv" && (!showName || showName.length < 2)) showName = "Unknown Show";

                        let posterPath = null;
                        const posterCandidates = [`${baseName}.jpg`, `${baseName}.png`, `${baseName}-thumb.jpg`, 'poster.jpg', 'cover.jpg', 'folder.jpg'];
                        for (const cand of posterCandidates) {
                            const cp = path.join(dir, cand);
                            if (fs.existsSync(cp)) {
                                posterPath = cp.replace(/\\/g, '/');
                                break;
                            }
                        }

                        const vidObj = {
                            id,
                            title,
                            type: vidType,
                            filename: item.name,
                            path: fullPath,
                            poster: posterPath,
                            size: stat.size,
                            modified: stat.mtimeMs,
                            duration: 0
                        };

                        if (vidType === 'tv') {
                            vidObj.show = showName;
                            vidObj.season = seasonNum;
                            vidObj.episode = episodeNum;
                            
                            // Find the overarching show poster from parent directories
                            let sPoster = null;
                            const pCands = ['poster.jpg', 'cover.jpg', 'folder.jpg', 'fanart.jpg', 'banner.jpg'];
                            for (const cDir of [dir, path.dirname(dir), path.dirname(path.dirname(dir))]) {
                                for (const pCand of pCands) {
                                    const pp = path.join(cDir, pCand);
                                    if (fs.existsSync(pp)) {
                                        sPoster = pp.replace(/\\/g, '/');
                                        break;
                                    }
                                }
                                if (sPoster) break;
                            }
                            vidObj.showPoster = sPoster;
                        }

                        videos.push(vidObj);
                    }
                }
            }
        } catch (e) {
            console.error('Video scan error:', e);
        }
    }

    scanDir(startFolder);

    // Try to extract duration with ffprobe for each video
    for (const video of videos) {
        try {
            const dur = await new Promise((resolve) => {
                execFile('ffprobe', [
                    '-v', 'quiet', '-print_format', 'json',
                    '-show_format', video.path
                ], { timeout: 5000 }, (err, stdout) => {
                    if (err) return resolve(0);
                    try {
                        const data = JSON.parse(stdout);
                        resolve(parseFloat(data.format?.duration) || 0);
                    } catch(e) { resolve(0); }
                });
            });
            video.duration = dur;
        } catch(e) { /* skip */ }
    }

    videos.sort((a, b) => a.title.localeCompare(b.title));

    const libraryData = { path: startFolder, videos };
    fs.writeFileSync(videoDataPath, JSON.stringify(libraryData), 'utf8');
    return libraryData;
}

ipcMain.handle('video:getThumbnail', async (_event, filePath) => {
    const id = crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
    const thumbPath = path.join(thumbsDir, `${id}.jpg`);
    if (fs.existsSync(thumbPath)) {
        return thumbPath.replace(/\\/g, '/');
    }
    // Generate thumbnail with ffmpeg
    return new Promise((resolve) => {
        execFile('ffmpeg', [
            '-i', filePath, '-ss', '00:00:05',
            '-vframes', '1', '-q:v', '4',
            '-vf', 'scale=320:-1',
            thumbPath
        ], { timeout: 10000 }, (err) => {
            if (err) {
                console.error('Thumbnail generation failed:', err.message);
                return resolve(null);
            }
            resolve(thumbPath.replace(/\\/g, '/'));
        });
    });
});

ipcMain.handle('video:autoDownloadSubtitles', async (_event, filePath) => {
    return new Promise((resolve) => {
        // Spawn subliminal python script to fetch English subtitles.
        execFile('python', ['-m', 'subliminal', 'download', '-l', 'en', filePath], { timeout: 45000 }, (err, stdout, stderr) => {
            if (err) {
                 resolve({ success: false, error: err.message, stderr });
            } else {
                 resolve({ success: true, output: stdout });
            }
        });
    });
});

ipcMain.handle('video:extractInternalSubtitles', async (_event, filePath) => {
    return new Promise((resolve) => {
        const outPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.internal.vtt';
        if (fs.existsSync(outPath)) {
            return resolve({ success: true, path: outPath.replace(/\\/g, '/') });
        }
        
        execFile('ffmpeg', [
            '-y', '-i', filePath, 
            '-map', '0:s:0', 
            '-f', 'webvtt', 
            outPath
        ], { timeout: 15000 }, (err, stdout, stderr) => {
            if (err) {
                console.error("No internal sub found or extraction failed:", err.message);
                resolve({ success: false });
            } else {
                resolve({ success: true, path: outPath.replace(/\\/g, '/') });
            }
        });
    });
});
