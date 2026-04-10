document.addEventListener('DOMContentLoaded', async () => {
    // ── Window Controls ──────────────────────────────────────────────────
    document.getElementById('btn-minimize')?.addEventListener('click', () => window.omega.window.minimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => window.omega.window.maximize());
    document.getElementById('btn-close')?.addEventListener('click', () => window.omega.window.close());

    const qrOverlay = document.getElementById('qr-modal-overlay');
    const qrImg = document.getElementById('qr-code-img');
    const qrUrl = document.getElementById('qr-url-text');

    document.getElementById('btn-close-qr')?.addEventListener('click', () => {
        qrOverlay.classList.add('hidden');
    });

    document.getElementById('btn-remote-launch')?.addEventListener('click', async () => {
        if (window.omega && window.omega.remote) {
            const qrData = await window.omega.remote.getQr();
            if (qrData) {
                qrImg.src = qrData.qrDataUrl;
                qrUrl.textContent = qrData.url;
                qrOverlay.classList.remove('hidden');
            } else {
                showToast("Failed to generate Remote QR code.");
            }
        }
    });

    // ── AIO Tab Switching ────────────────────────────────────────────────
    const aioTabs = document.querySelectorAll('.aio-tab');
    const aioPanels = document.querySelectorAll('.aio-panel');
    let booksInitialized = false;
    let videoInitialized = false;

    aioTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // Update tab active states
            aioTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show/hide panels
            aioPanels.forEach(p => {
                if (p.id === `panel-${target}`) {
                    p.classList.add('active');
                    p.style.display = 'flex';
                } else {
                    p.classList.remove('active');
                    p.style.display = 'none';
                }
            });

            // Lazy init for books and video
            if (target === 'books' && !booksInitialized) {
                booksInitialized = true;
                if (window._sovereignBooksInit) window._sovereignBooksInit();
            }
            if (target === 'video' && !videoInitialized) {
                videoInitialized = true;
                if (window._sovereignVideoInit) window._sovereignVideoInit();
            }
            window._omegaActiveTab = target;
        });
    });

    window._omegaActiveTab = 'audio';

    function getActiveMedia() {
        if (window._omegaActiveTab === 'video') {
            return document.getElementById('video-element');
        }
        return document.getElementById('media-local-audio');
    }

    // Initialize panel visibility (only audio visible at start)
    aioPanels.forEach(p => {
        if (p.id === 'panel-audio') {
            p.style.display = 'flex';
        } else {
            p.style.display = 'none';
        }
    });

    // ── Elements ─────────────────────────────────────────────────────────
    const btnSrcLocal = document.getElementById('media-src-local');
    const btnSrcYt = document.getElementById('media-src-yt');
    const containerYt = document.getElementById('media-webview-container');
    const panelLocal = document.getElementById('media-local-panel');

    const btnFolder = document.getElementById('media-local-folder');
    const searchInput = document.getElementById('media-search');
    const searchCount = document.getElementById('media-search-count');
    const btnSearchClear = document.getElementById('media-search-clear');
    const searchContainer = document.getElementById('library-search-container');

    const gridContainer = document.getElementById('library-grid-container');
    const libraryGrid = document.getElementById('library-grid');
    const libraryEmpty = document.getElementById('library-empty');

    const detailContainer = document.getElementById('library-detail-container');
    const detailBackBtn = document.getElementById('detail-back-btn');
    const detailAlbumTitle = document.getElementById('detail-album-title');
    const detailAlbumArtist = document.getElementById('detail-album-artist');
    const detailAlbumMeta = document.getElementById('detail-album-meta');
    const detailPlaylist = document.getElementById('media-local-playlist');
    const detailCoverArt = document.getElementById('detail-cover-art');
    const detailHeroBg = document.getElementById('detail-hero-bg');
    const detailPlayAll = document.getElementById('detail-play-all');

    const playBtn = document.getElementById('media-play');
    const prevBtn = document.getElementById('media-prev');
    const nextBtn = document.getElementById('media-next');
    const speedBtn = document.getElementById('media-speed');
    const sleepBtn = document.getElementById('media-sleep');

    const audioEl = document.getElementById('media-local-audio');
    const seekSlider = document.getElementById('media-seek');
    const seekCur = document.getElementById('media-seek-cur');
    const seekDur = document.getElementById('media-seek-dur');

    const volSlider = document.getElementById('media-volume');
    const volVal = document.getElementById('media-vol-val');

    const trackTitle = document.getElementById('media-track-title');
    const trackArtist = document.getElementById('media-track-artist');
    const coverFallback = document.querySelector('.media-cover-fallback');
    const coverImg = document.getElementById('media-cover-img');
    const coverArtBox = document.getElementById('media-cover-art');

    const sleepDropdown = document.getElementById('sleep-dropdown');
    const sleepIndicator = document.getElementById('sleep-indicator');
    const sleepTimeRemaining = document.getElementById('sleep-time-remaining');
    const sleepOffBtn = document.getElementById('sleep-off-btn');

    const detailGhostBg = document.getElementById('detail-ghost-bg');
    const chapterBtn = document.getElementById('detail-chapter-btn');
    const miniBtn = document.getElementById('media-mini');
    const chapterDrawer = document.getElementById('chapter-drawer');
    const chapterDrawerClose = document.getElementById('chapter-drawer-close');
    const chapterDrawerList = document.getElementById('chapter-drawer-list');
    let visualizerCanvas = document.getElementById('detail-visualizer');
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconPause = playBtn.querySelector('.icon-pause');

    // ── State ────────────────────────────────────────────────────────────
    let currentSource = 'local';
    let libraryData = null;
    let currentAlbums = [];
    let currentAlbumData = null;

    let activeAlbumId = null;
    let activeTrackIndex = -1;
    let isPlaying = false;
    let playSpeed = 1.0;
    const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    let currentChapters = []; // M4B chapters from ffprobe

    // Sort & Group state
    let currentSort = 'title';
    let groupByAuthor = false;
    const sortSelect = document.getElementById('media-sort');
    const groupToggle = document.getElementById('media-group-toggle');

    // Sleep timer state
    let sleepTimerId = null;
    let sleepEndTime = null;

    // Mini Player State
    let miniMode = 'normal';
    if (miniBtn) {
        miniBtn.addEventListener('click', () => {
            if (miniMode === 'normal') {
                miniMode = 'square';
                document.body.classList.remove('mode-mini-ribbon');
                document.body.classList.add('mode-mini-square');
            } else if (miniMode === 'square') {
                miniMode = 'ribbon';
                document.body.classList.remove('mode-mini-square');
                document.body.classList.add('mode-mini-ribbon');
            } else {
                miniMode = 'normal';
                document.body.classList.remove('mode-mini-square', 'mode-mini-ribbon');
            }
            window.omega.window.setMiniMode(miniMode);
        });
    }

    // ── Web Audio API — The Pulse ────────────────────────────────────────
    let audioCtx = null;
    let analyser = null;
    let audioSource = null;
    let visualizerRafId = null;

    function initAudioContext() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        audioSource = audioCtx.createMediaElementSource(audioEl);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    function startVisualizer() {
        if (!analyser || !visualizerCanvas) return;
        const ctx = visualizerCanvas.getContext('2d');
        const W = visualizerCanvas.width;
        const H = visualizerCanvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const bufferLen = analyser.frequencyBinCount;
        const dataArr = new Uint8Array(bufferLen);
        const baseRadius = 90;

        function draw() {
            visualizerRafId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArr);

            ctx.clearRect(0, 0, W, H);

            // Average amplitude for pulse intensity
            let sum = 0;
            for (let i = 0; i < bufferLen; i++) sum += dataArr[i];
            const avg = sum / bufferLen / 255;

            // Outer glow pulse
            ctx.beginPath();
            ctx.arc(cx, cy, baseRadius + 8 + avg * 20, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.04 + avg * 0.12})`;
            ctx.lineWidth = 6;
            ctx.stroke();

            // Draw radial frequency ring
            const sliceAngle = (Math.PI * 2) / bufferLen;
            ctx.beginPath();
            for (let i = 0; i < bufferLen; i++) {
                const amplitude = dataArr[i] / 255;
                const r = baseRadius + amplitude * 45;
                const angle = i * sliceAngle - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.25 + avg * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Inner glow ring
            ctx.beginPath();
            ctx.arc(cx, cy, baseRadius - 4 + avg * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.08 + avg * 0.25})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        draw();
    }

    function stopVisualizer() {
        if (visualizerRafId) {
            cancelAnimationFrame(visualizerRafId);
            visualizerRafId = null;
        }
        if (visualizerCanvas) {
            const ctx = visualizerCanvas.getContext('2d');
            ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        }
    }
    let sleepDisplayId = null;

    // ── Helpers ──────────────────────────────────────────────────────────
    function toFileUrl(filePath) {
        if (!filePath) return null;
        if (filePath.startsWith('file://') || filePath.startsWith('data:')) return filePath;
        return 'file:///' + filePath.replace(/\\/g, '/');
    }

    function formatTime(secs) {
        if (isNaN(secs) || !secs) return '0:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ── Sort/Group Logic ─────────────────────────────────────────────────
    function sortAlbums(albums, sortKey) {
        const sorted = [...albums];
        let positions = {};
        try { positions = JSON.parse(localStorage.getItem('omega_playback_positions') || '{}'); } catch(e){}

        switch (sortKey) {
            case 'recent':
                sorted.sort((a, b) => {
                    const tA = positions[a.id]?.timestamp || 0;
                    const tB = positions[b.id]?.timestamp || 0;
                    if (tA !== tB) return tB - tA; // newest first
                    return a.name.localeCompare(b.name);
                });
                break;
            case 'title':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'author':
                sorted.sort((a, b) => {
                    const c = a.artist.localeCompare(b.artist);
                    return c !== 0 ? c : a.name.localeCompare(b.name);
                });
                break;
            case 'tracks-desc':
                sorted.sort((a, b) => b.tracks.length - a.tracks.length);
                break;
            case 'tracks-asc':
                sorted.sort((a, b) => a.tracks.length - b.tracks.length);
                break;
        }
        return sorted;
    }

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderLibrary(searchInput.value);
    });

    groupToggle.addEventListener('click', () => {
        groupByAuthor = !groupByAuthor;
        groupToggle.classList.toggle('active', groupByAuthor);
        // Force sort to 'author' when grouping, restore when ungrouping
        if (groupByAuthor) {
            sortSelect.value = 'author';
            currentSort = 'author';
        }
        renderLibrary(searchInput.value);
    });

    // ── Playback Position Persistence ────────────────────────────────────
    const POSITION_KEY = 'omega_playback_positions';
    const GLOBAL_KEY = 'omega_global_state';

    function savePosition() {
        if (!activeAlbumId || activeTrackIndex < 0) return;
        try {
            const positions = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
            positions[activeAlbumId] = {
                trackIndex: activeTrackIndex,
                currentTime: audioEl.currentTime || 0,
                timestamp: Date.now()
            };
            localStorage.setItem(POSITION_KEY, JSON.stringify(positions));

            // Also save globally active track
            localStorage.setItem(GLOBAL_KEY, JSON.stringify({
                albumId: activeAlbumId,
                trackIndex: activeTrackIndex,
                currentTime: audioEl.currentTime || 0
            }));
        } catch (e) {}
    }

    function getPosition(albumId) {
        try {
            const positions = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
            return positions[albumId] || null;
        } catch (e) { return null; }
    }

    // Auto-save every 10 seconds and on pause/beforeunload
    setInterval(savePosition, 10000);
    window.addEventListener('beforeunload', savePosition);

    // ── Tab Switching ────────────────────────────────────────────────────
    function setSource(src) {
        currentSource = src;
        btnSrcLocal.classList.toggle('active', src === 'local');
        btnSrcYt.classList.toggle('active', src === 'yt');

        if (src === 'local') {
            containerYt.classList.add('hidden');
            panelLocal.classList.remove('hidden');
            syncTrackInfo();
        } else {
            panelLocal.classList.add('hidden');
            containerYt.classList.remove('hidden');
            if (audioEl && !audioEl.paused) audioEl.pause();
            trackTitle.textContent = "YouTube Music";
            trackArtist.textContent = "Web Player";
        }
    }

    btnSrcLocal.addEventListener('click', () => setSource('local'));
    btnSrcYt.addEventListener('click', () => setSource('yt'));

    // ── Local Library Operations ─────────────────────────────────────────
    async function loadLibraryFromStorage() {
        const data = await window.omega.file.getLibrary();
        if (data && data.albums) {
            libraryData = data;
            renderLibrary();
            
            // Restore globally active track in a suspended (paused) state
            try {
                const globalState = JSON.parse(localStorage.getItem('omega_global_state'));
                if (globalState && globalState.albumId) {
                    playLocalTrack(globalState.albumId, globalState.trackIndex, globalState.currentTime, true);
                }
            } catch(e) {}
        } else {
            libraryEmpty.classList.remove('hidden');
        }
    }

    btnFolder.addEventListener('click', async () => {
        btnFolder.textContent = "⏳ Scanning library...";
        btnFolder.classList.add('scanning');
        const result = await window.omega.file.openAudioFolder();
        btnFolder.textContent = "📂 Add/Refresh Library Folder";
        btnFolder.classList.remove('scanning');

        if (result && result.albums) {
            libraryData = result;
            renderLibrary();
        }
    });

    // ── Card Builder ─────────────────────────────────────────────────────
    function buildAlbumCard(album, animIndex) {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.style.animationDelay = `${Math.min(animIndex * 25, 500)}ms`;

        if (activeAlbumId === album.id) {
            card.classList.add('now-playing');
            card.style.position = 'relative';
        }

        const coverUrl = toFileUrl(album.coverArt);
        let artHtml = '<span class="library-card-fallback">Ω</span>';
        if (coverUrl) {
            artHtml = `<img src="${coverUrl}" alt="" onerror="this.style.display='none'">`;
        }

        const trackCount = album.tracks.length;
        const savedPos = getPosition(album.id);
        let resumeHint = '';
        if (savedPos && savedPos.currentTime > 30) {
            resumeHint = `<div style="font-size:10px; color:var(--gold-dim); margin-top:2px;">⟳ ${formatTime(savedPos.currentTime)}</div>`;
        }

        card.innerHTML = `
            <div class="library-card-art">${artHtml}</div>
            <div class="library-card-info">
                <div class="library-card-title">${album.name}</div>
                <div class="library-card-artist">${album.artist}</div>
                <div class="library-card-meta">${trackCount} track${trackCount !== 1 ? 's' : ''}</div>
                ${resumeHint}
            </div>
        `;

        card.addEventListener('click', () => openAlbumDetail(album));
        return card;
    }

    // ── Grid View Rendering ─────────────────────────────────────────────
    function renderLibrary(filter = '') {
        if (!libraryData || !libraryData.albums) return;

        libraryEmpty.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        detailContainer.classList.add('hidden');
        searchContainer.classList.remove('hidden');

        libraryGrid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        // Filter
        let filtered = libraryData.albums.filter(album => {
            if (!filter) return true;
            return album.name.toLowerCase().includes(lowerFilter) ||
                   album.artist.toLowerCase().includes(lowerFilter);
        });

        // Sort
        currentAlbums = sortAlbums(filtered, currentSort);

        if (currentAlbums.length === 0) {
            libraryGrid.innerHTML = '<div class="playlist-empty" style="grid-column:1/-1;">No albums match your search.</div>';
        } else if (groupByAuthor) {
            // Group by author — render section headers
            let lastAuthor = null;
            let cardIndex = 0;
            currentAlbums.forEach(album => {
                const author = album.artist || 'Unknown Artist';
                if (author !== lastAuthor) {
                    // Count albums by this author in the filtered set
                    const authorCount = currentAlbums.filter(a => a.artist === author).length;
                    const section = document.createElement('div');
                    section.className = 'library-author-section';
                    section.innerHTML = `
                        <span class="library-author-name">${author}</span>
                        <span class="library-author-line"></span>
                        <span class="library-author-count">${authorCount} title${authorCount !== 1 ? 's' : ''}</span>
                    `;
                    libraryGrid.appendChild(section);
                    lastAuthor = author;
                }
                libraryGrid.appendChild(buildAlbumCard(album, cardIndex++));
            });
        } else {
            // Flat grid
            currentAlbums.forEach((album, i) => {
                libraryGrid.appendChild(buildAlbumCard(album, i));
            });
        }

        if (filter) {
            searchCount.textContent = `${currentAlbums.length} found`;
            btnSearchClear.classList.remove('hidden');
        } else {
            searchCount.textContent = `${libraryData.albums.length} albums`;
            btnSearchClear.classList.add('hidden');
        }
    }

    // ── Detail View ──────────────────────────────────────────────────────
    function openAlbumDetail(album) {
        currentAlbumData = album;
        gridContainer.classList.add('hidden');
        detailContainer.classList.remove('hidden');
        searchContainer.classList.add('hidden');

        detailAlbumTitle.textContent = album.name;
        detailAlbumArtist.textContent = album.artist;

        // Cover art in hero header + ghost background
        const coverUrl = toFileUrl(album.coverArt);
        if (coverUrl) {
            detailCoverArt.innerHTML = `<canvas class="detail-visualizer" id="detail-visualizer" width="300" height="300"></canvas><img src="${coverUrl}" alt="">`;
            detailHeroBg.style.backgroundImage = `url('${coverUrl}')`;
            detailGhostBg.style.backgroundImage = `url('${coverUrl}')`;
        } else {
            detailCoverArt.innerHTML = '<canvas class="detail-visualizer" id="detail-visualizer" width="300" height="300"></canvas><span class="detail-cover-fallback">Ω</span>';
            detailHeroBg.style.backgroundImage = 'none';
            detailGhostBg.style.backgroundImage = 'none';
        }
        // Re-acquire canvas reference after innerHTML replacement
        visualizerCanvas = document.getElementById('detail-visualizer');

        // Track count + total duration
        const totalSecs = album.tracks.reduce((s, t) => s + (t.duration || 0), 0);
        const countStr = `${album.tracks.length} track${album.tracks.length !== 1 ? 's' : ''}`;
        detailAlbumMeta.textContent = totalSecs > 0 ? `${countStr}  •  ${formatTime(totalSecs)} total` : countStr;

        // Update play button text based on resume
        const savedPos = getPosition(album.id);
        if (savedPos && savedPos.currentTime > 30 && activeAlbumId !== album.id) {
            detailPlayAll.textContent = `▶  Resume from ${formatTime(savedPos.currentTime)}`;
        } else if (activeAlbumId === album.id) {
            detailPlayAll.textContent = isPlaying ? '⏸  Pause' : '▶  Resume';
        } else {
            detailPlayAll.textContent = '▶  Play';
        }

        renderDetailPlaylist();
    }

    detailPlayAll.addEventListener('click', () => {
        if (!currentAlbumData) return;
        if (activeAlbumId === currentAlbumData.id) {
            togglePlayPause();
            detailPlayAll.textContent = isPlaying ? '⏸  Pause' : '▶  Resume';
        } else {
            const savedPos = getPosition(currentAlbumData.id);
            if (savedPos && savedPos.currentTime > 30) {
                playLocalTrack(currentAlbumData.id, savedPos.trackIndex, savedPos.currentTime);
            } else {
                playLocalTrack(currentAlbumData.id, 0);
            }
        }
    });

    detailBackBtn.addEventListener('click', () => {
        detailContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        searchContainer.classList.remove('hidden');
        chapterDrawer.classList.add('hidden');
        currentAlbumData = null;
        renderLibrary(searchInput.value);
    });

    // ── Chapter Drawer ──────────────────────────────────────────────────
    chapterBtn.addEventListener('click', async () => {
        chapterDrawer.classList.toggle('hidden');
        if (!chapterDrawer.classList.contains('hidden')) {
            await loadAndRenderChapters();
        }
    });
    chapterDrawerClose.addEventListener('click', () => {
        chapterDrawer.classList.add('hidden');
    });

    async function loadAndRenderChapters() {
        chapterDrawerList.innerHTML = '<div style="padding:20px;color:var(--text-tertiary);font-size:12px;">Loading chapters…</div>';
        if (!currentAlbumData) return;

        // For single-track albums (M4B audiobooks), try ffprobe chapter extraction
        if (currentAlbumData.tracks.length === 1) {
            const filePath = currentAlbumData.tracks[0].path;
            try {
                const chapters = await window.omega.file.getChapters(filePath);
                if (chapters && chapters.length > 0) {
                    currentChapters = chapters;
                    renderM4BChapters();
                    return;
                }
            } catch (e) {
                console.error('Chapter extraction failed:', e);
            }
        }

        // Fallback: render track-based chapters
        currentChapters = [];
        renderTrackChapters();
    }

    function renderM4BChapters() {
        chapterDrawerList.innerHTML = '';
        const currentTime = audioEl.currentTime || 0;

        currentChapters.forEach((ch, index) => {
            const item = document.createElement('div');
            item.className = 'chapter-drawer-item';

            // Highlight current chapter based on playback position
            if (activeAlbumId === currentAlbumData.id &&
                currentTime >= ch.start && currentTime < ch.end) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <span class="chapter-num">${index + 1}</span>
                <div class="chapter-info">
                    <span class="chapter-title">${ch.title}</span>
                    <span class="chapter-time">${formatTime(ch.start)} — ${formatTime(ch.end)}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                // Seek within the single M4B file
                if (activeAlbumId !== currentAlbumData.id) {
                    playLocalTrack(currentAlbumData.id, 0, ch.start);
                } else {
                    audioEl.currentTime = ch.start;
                    if (!isPlaying) audioEl.play().catch(console.error);
                }
                setTimeout(() => renderM4BChapters(), 300);
            });
            chapterDrawerList.appendChild(item);
        });

        const activeItem = chapterDrawerList.querySelector('.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function renderTrackChapters() {
        chapterDrawerList.innerHTML = '';
        if (!currentAlbumData) return;

        let cumulativeTime = 0;
        currentAlbumData.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'chapter-drawer-item';
            if (activeAlbumId === currentAlbumData.id && activeTrackIndex === index) {
                item.classList.add('active');
            }

            const startTime = cumulativeTime;
            cumulativeTime += track.duration || 0;

            item.innerHTML = `
                <span class="chapter-num">${index + 1}</span>
                <div class="chapter-info">
                    <span class="chapter-title">${track.title}</span>
                    <span class="chapter-time">${formatTime(startTime)} — ${formatTime(cumulativeTime)}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                playLocalTrack(currentAlbumData.id, index);
                setTimeout(() => renderTrackChapters(), 300);
            });
            chapterDrawerList.appendChild(item);
        });

        const activeItem = chapterDrawerList.querySelector('.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // ── Playback Speed with Pitch Correction ──────────────────────────
    audioEl.preservesPitch = true;          // Chromium standard
    audioEl.mozPreservesPitch = true;       // Firefox fallback
    audioEl.webkitPreservesPitch = true;    // Webkit fallback

    speedBtn.addEventListener('click', () => {
        const currentIdx = speeds.indexOf(playSpeed);
        playSpeed = speeds[(currentIdx + 1) % speeds.length];
        audioEl.playbackRate = playSpeed;
        speedBtn.textContent = playSpeed === 1.0 ? '1×' : `${playSpeed}×`;
        speedBtn.classList.toggle('active', playSpeed !== 1.0);
    });

    function renderDetailPlaylist() {
        detailPlaylist.innerHTML = '';
        if (!currentAlbumData) return;

        currentAlbumData.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'media-local-item';

            if (activeAlbumId === currentAlbumData.id && activeTrackIndex === index) {
                item.classList.add('active');
            }

            const durationStr = track.duration ? formatTime(track.duration) : '';
            const trackNum = track.trackNo || (index + 1);
            const isActive = activeAlbumId === currentAlbumData.id && activeTrackIndex === index;

            item.innerHTML = `
                <div class="media-local-item-icon">${isActive ? '▶' : trackNum}</div>
                <div class="media-local-item-info">
                    <div class="media-local-item-name">${track.title}</div>
                    <div class="media-local-item-duration">${durationStr}</div>
                </div>
            `;

            item.addEventListener('click', () => playLocalTrack(currentAlbumData.id, index));
            detailPlaylist.appendChild(item);
        });
    }

    // ── Searching ────────────────────────────────────────────────────────
    searchInput.addEventListener('input', (e) => renderLibrary(e.target.value));
    btnSearchClear.addEventListener('click', () => { searchInput.value = ''; renderLibrary(); });

    // ── Audio Core ───────────────────────────────────────────────────────
    function getGlobalAlbum(albumId) {
        if (!libraryData) return null;
        return libraryData.albums.find(a => a.id === albumId);
    }

    function playLocalTrack(albumId, trackIndex, resumeTime = 0, forcePause = false) {
        const album = getGlobalAlbum(albumId);
        if (!album || trackIndex < 0 || trackIndex >= album.tracks.length) return;

        activeAlbumId = albumId;
        activeTrackIndex = trackIndex;
        const track = album.tracks[trackIndex];

        if (currentAlbumData && currentAlbumData.id === albumId) {
            renderDetailPlaylist();
        }

        // Init Web Audio API on first user-initiated play
        if (!forcePause) initAudioContext();

        audioEl.src = `file:///${track.path.replace(/\\/g, '/')}`;
        audioEl.addEventListener('loadedmetadata', function onLoad() {
            audioEl.removeEventListener('loadedmetadata', onLoad);
            audioEl.playbackRate = playSpeed; // preserve speed across tracks
            if (resumeTime > 0) {
                audioEl.currentTime = resumeTime;
            }
            if (!forcePause) {
                audioEl.play().catch(console.error);
            } else {
                setTimeout(() => audioEl.dispatchEvent(new Event('timeupdate')), 100);
            }
        });

        syncTrackInfo();
    }

    function togglePlayPause() {
        const media = getActiveMedia();
        if (window._omegaActiveTab === 'video') {
            if (media.src) {
                if (media.paused) media.play();
                else media.pause();
            }
            return;
        }

        if (currentSource !== 'local') return;

        if (activeAlbumId === null && currentAlbumData && currentAlbumData.tracks.length > 0) {
            const savedPos = getPosition(currentAlbumData.id);
            if (savedPos && savedPos.currentTime > 30) {
                playLocalTrack(currentAlbumData.id, savedPos.trackIndex, savedPos.currentTime);
            } else {
                playLocalTrack(currentAlbumData.id, 0);
            }
            return;
        } else if (activeAlbumId === null && libraryData && libraryData.albums.length > 0) {
            playLocalTrack(libraryData.albums[0].id, 0);
            return;
        }

        if (media.paused) media.play();
        else media.pause();
    }

    // ── Transport Controls ───────────────────────────────────────────────
    playBtn.addEventListener('click', togglePlayPause);

    prevBtn.addEventListener('click', () => {
        const media = getActiveMedia();
        if (window._omegaActiveTab === 'video') {
            if (media.duration) media.currentTime = Math.max(0, media.currentTime - 15);
            return;
        }
        if (currentSource !== 'local') return;
        if (media.currentTime > 3) {
            media.currentTime = 0;
        } else if (activeAlbumId !== null && activeTrackIndex > 0) {
            playLocalTrack(activeAlbumId, activeTrackIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        const media = getActiveMedia();
        if (window._omegaActiveTab === 'video') {
            if (media.duration) media.currentTime = Math.min(media.duration, media.currentTime + 15);
            return;
        }
        if (currentSource !== 'local' || activeAlbumId === null) return;
        const album = getGlobalAlbum(activeAlbumId);
        if (album && activeTrackIndex < album.tracks.length - 1) {
            playLocalTrack(activeAlbumId, activeTrackIndex + 1);
        }
    });

    speedBtn.addEventListener('click', () => {
        let idx = speeds.indexOf(playSpeed);
        idx = (idx + 1) % speeds.length;
        playSpeed = speeds[idx];
        getActiveMedia().playbackRate = playSpeed;
        speedBtn.textContent = playSpeed + '×';
    });

    // ── Bind Events to Both Media Elements ──────────────────────────────
    const videoEl = document.getElementById('video-element');

    function bindMediaEvents(el, isVideo) {
        el.addEventListener('play', () => {
            if (isVideo && window._omegaActiveTab !== 'video') return;
            if (!isVideo && window._omegaActiveTab === 'video') return;

            isPlaying = true;
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            playBtn.classList.add('playing');
            coverArtBox.classList.add('playing');
            if (currentAlbumData && activeAlbumId === currentAlbumData.id) {
                detailPlayAll.textContent = '⏸  Pause';
            }
            if (!isVideo) startVisualizer();
            if (!isVideo && !chapterDrawer.classList.contains('hidden')) renderChapterDrawer();
        });

        el.addEventListener('pause', () => {
            if (isVideo && window._omegaActiveTab !== 'video') return;
            if (!isVideo && window._omegaActiveTab === 'video') return;

            isPlaying = false;
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            playBtn.classList.remove('playing');
            coverArtBox.classList.remove('playing');
            savePosition();
            if (currentAlbumData && activeAlbumId === currentAlbumData.id) {
                detailPlayAll.textContent = '▶  Resume';
            }
            if (!isVideo) stopVisualizer();
        });

        el.addEventListener('ended', () => {
            if (isVideo && window._omegaActiveTab !== 'video') return;
            if (!isVideo && window._omegaActiveTab === 'video') return;

            savePosition();
            if (isVideo) {
                 isPlaying = false;
                 iconPlay.classList.remove('hidden');
                 iconPause.classList.add('hidden');
                 playBtn.classList.remove('playing');
                 return;
            }
            const album = getGlobalAlbum(activeAlbumId);
            if (album && activeTrackIndex < album.tracks.length - 1) {
                playLocalTrack(activeAlbumId, activeTrackIndex + 1);
            } else {
                isPlaying = false;
                iconPlay.classList.remove('hidden');
                iconPause.classList.add('hidden');
                playBtn.classList.remove('playing');
                coverArtBox.classList.remove('playing');
                stopVisualizer();
            }
        });

        el.addEventListener('timeupdate', () => {
            if (isVideo && window._omegaActiveTab !== 'video') return;
            if (!isVideo && window._omegaActiveTab === 'video') return;

            if (!el.duration) return;
            seekCur.textContent = formatTime(el.currentTime);
            seekDur.textContent = formatTime(el.duration);
            if (!isSeeking) {
                seekSlider.value = (el.currentTime / el.duration) * 1000;
            }
        });

        el.addEventListener('loadedmetadata', () => {
            seekDur.textContent = formatTime(el.duration);
            el.playbackRate = playSpeed;
        });
    }

    bindMediaEvents(audioEl, false);
    bindMediaEvents(videoEl, true);

    let isSeeking = false;
    seekSlider.addEventListener('mousedown', () => isSeeking = true);
    seekSlider.addEventListener('input', () => {
        const media = getActiveMedia();
        if (media.duration) {
            seekCur.textContent = formatTime((seekSlider.value / 1000) * media.duration);
        }
    });
    seekSlider.addEventListener('mouseup', () => {
        isSeeking = false;
        const media = getActiveMedia();
        if (media.duration) {
            media.currentTime = (seekSlider.value / 1000) * media.duration;
            savePosition();
        }
    });

    // ── Volume ──────────────────────────────────────────────────────────
    volSlider.addEventListener('input', (e) => {
        const v = e.target.value;
        volVal.textContent = v;
        audioEl.volume = v / 100;
        videoEl.volume = v / 100;
        let icon = '🔊';
        if (v == 0) icon = '🔇';
        else if (v < 30) icon = '🔈';
        else if (v < 70) icon = '🔉';
        document.getElementById('media-vol-icon').textContent = icon;
    });
    audioEl.volume = volSlider.value / 100;
    videoEl.volume = volSlider.value / 100;

    // ── Sleep Timer ─────────────────────────────────────────────────────
    sleepBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sleepDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!sleepDropdown.contains(e.target) && e.target !== sleepBtn) {
            sleepDropdown.classList.add('hidden');
        }
    });

    document.querySelectorAll('.sleep-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const mins = parseInt(opt.dataset.mins);
            sleepDropdown.classList.add('hidden');

            if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
            if (sleepDisplayId) { clearInterval(sleepDisplayId); sleepDisplayId = null; }

            if (mins === 0) {
                sleepEndTime = null;
                sleepIndicator.classList.add('hidden');
                sleepBtn.classList.remove('active');
                sleepOffBtn.classList.add('hidden');
                return;
            }

            sleepEndTime = Date.now() + mins * 60 * 1000;
            sleepIndicator.classList.remove('hidden');
            sleepBtn.classList.add('active');
            sleepOffBtn.classList.remove('hidden');

            sleepTimerId = setTimeout(() => {
                audioEl.pause();
                sleepEndTime = null;
                sleepIndicator.classList.add('hidden');
                sleepBtn.classList.remove('active');
                sleepOffBtn.classList.add('hidden');
                if (sleepDisplayId) { clearInterval(sleepDisplayId); sleepDisplayId = null; }
                showToast('💤 Sleep timer ended');
            }, mins * 60 * 1000);

            sleepDisplayId = setInterval(() => {
                if (!sleepEndTime) return;
                const remaining = Math.max(0, sleepEndTime - Date.now());
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                sleepTimeRemaining.textContent = `${m}:${s.toString().padStart(2, '0')}`;
            }, 1000);
        });
    });

    // ── Keyboard Shortcuts ──────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Don't capture if typing in search
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const mediaLeft = getActiveMedia();
                if (mediaLeft.duration) {
                    mediaLeft.currentTime = Math.max(0, mediaLeft.currentTime - 15);
                    showToast('⏪ -15s');
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                const mediaRight = getActiveMedia();
                if (mediaRight.duration) {
                    mediaRight.currentTime = Math.min(mediaRight.duration, mediaRight.currentTime + 15);
                    showToast('⏩ +15s');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                volSlider.value = Math.min(100, parseInt(volSlider.value) + 5);
                volSlider.dispatchEvent(new Event('input'));
                break;
            case 'ArrowDown':
                e.preventDefault();
                volSlider.value = Math.max(0, parseInt(volSlider.value) - 5);
                volSlider.dispatchEvent(new Event('input'));
                break;
            case 'KeyN':
                nextBtn.click();
                break;
            case 'KeyP':
                prevBtn.click();
                break;
            case 'Escape':
                if (!chapterDrawer.classList.contains('hidden')) {
                    chapterDrawer.classList.add('hidden');
                } else if (!detailContainer.classList.contains('hidden')) {
                    detailBackBtn.click();
                }
                break;
        }
    });

    // ── Toast Notification ──────────────────────────────────────────────
    let toastEl = null;
    let toastTimeout = null;

    function showToast(msg) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'keyboard-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add('visible');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toastEl.classList.remove('visible'), 1200);
    }

    // ── UI Sync ─────────────────────────────────────────────────────────
    function syncTrackInfo() {
        if (currentSource === 'local') {
            const activeAlbum = getGlobalAlbum(activeAlbumId);
            if (activeAlbum && activeTrackIndex >= 0 && activeTrackIndex < activeAlbum.tracks.length) {
                const track = activeAlbum.tracks[activeTrackIndex];
                trackTitle.textContent = track.title;
                trackArtist.textContent = activeAlbum.name;

                const coverUrl = toFileUrl(activeAlbum.coverArt);
                if (coverUrl) {
                    coverImg.src = coverUrl;
                    coverImg.classList.remove('hidden');
                    coverFallback.classList.add('hidden');
                } else {
                    coverImg.classList.add('hidden');
                    coverFallback.classList.remove('hidden');
                }
            } else {
                trackTitle.textContent = "No track playing";
                trackArtist.textContent = "Select a file to play";
            }
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────
    loadLibraryFromStorage();

    // ── Mobile Remote Bridge ─────────────────────────────────────────────
    
    // Send state every 1 second
    setInterval(() => {
        if (!window.omega || !window.omega.remote) return;
        
        let currentState = {
            playing: !audioEl.paused,
            title: trackTitle.textContent,
            artist: trackArtist.textContent,
            duration: audioEl.duration || 0,
            currentTime: audioEl.currentTime || 0,
            volume: audioEl.volume
        };
        
        // If viewing video tab
        if (window._omegaActiveTab === 'video') {
            const videoEl = document.getElementById('video-element');
            const videoTitle = document.getElementById('media-track-title'); // or whatever the video uses
            if (videoEl) {
                currentState.playing = !videoEl.paused;
                currentState.title = videoTitle ? videoTitle.textContent : 'Video';
                currentState.artist = 'Sovereign Media Video';
                currentState.duration = videoEl.duration || 0;
                currentState.currentTime = videoEl.currentTime || 0;
                currentState.volume = videoEl.volume;
            }
        }
        
        // Handle cover image resolving (stripping file:/// if local)
        if (coverImg.src && !coverImg.classList.contains('hidden')) {
            let pathUrl = decodeURIComponent(coverImg.src.replace('file:///', ''));
            // Fix Windows path vs Unix
            if (!pathUrl.includes('//') && pathUrl.indexOf(':/') !== 1 && navigator.platform.indexOf('Win') === -1) {
                pathUrl = '/' + pathUrl; 
            }
            currentState.coverPath = pathUrl;
        } else {
            currentState.coverPath = null;
        }

        window.omega.remote.sendState(currentState);
    }, 1000);

    // Listen for incoming actions
    if (window.omega && window.omega.remote) {
        window.omega.remote.onAction((action) => {
            const activeMedia = getActiveMedia();
            if (!activeMedia) return;

            if (action.type === 'togglePlay') {
                playBtn.click(); // Standard ui trigger
            } else if (action.type === 'prev') {
                prevBtn.click();
            } else if (action.type === 'next') {
                nextBtn.click();
            } else if (action.type === 'volume') {
                activeMedia.volume = action.value;
                volSlider.value = action.value;
                volSlider.style.background = `linear-gradient(to right, var(--gold) ${action.value*100}%, rgba(255,255,255,0.1) ${action.value*100}%)`;
            } else if (action.type === 'seek') {
                activeMedia.currentTime = action.value;
            }
        });
    }
});
