// ══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN MEDIA — Video Module (native HTML5 video player)
// ══════════════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────
    let videoLibrary = null;
    let currentVideoData = null;
    const VIDEO_POS_KEY = 'sovereign_video_positions';
    let ambilightRafId = null;

    // ── Elements ──────────────────────────────────────────────────────────
    const videoAddFolder = document.getElementById('video-add-folder');
    const videoSearch = document.getElementById('video-search');
    const videoSearchCount = document.getElementById('video-search-count');
    const videoGridContainer = document.getElementById('video-grid-container');
    const videoGrid = document.getElementById('video-grid');
    const videoEmpty = document.getElementById('video-empty');
    const videoLibraryEl = document.getElementById('video-library');
    const videoPlayerEl = document.getElementById('video-player');
    const videoPlayerBack = document.getElementById('video-player-back');
    const videoPlayerTitle = document.getElementById('video-player-title');
    let videoElement = document.getElementById('video-element');
    let currentSubtitleUrl = null;

    // ── NEW: Tab State ──
    let activeVideoTab = 'movie'; // 'movie' or 'tv'
    const videoTabMovies = document.getElementById('video-tab-movies');
    const videoTabTvShows = document.getElementById('video-tab-tvshows');

    if (videoTabMovies && videoTabTvShows) {
        videoTabMovies.addEventListener('click', () => setVideoTab('movie'));
        videoTabTvShows.addEventListener('click', () => setVideoTab('tv'));
    }

    function setVideoTab(type) {
        activeVideoTab = type;
        if (type === 'movie') {
            videoTabMovies.style.background = 'rgba(255,215,0,0.1)';
            videoTabMovies.style.color = 'var(--gold)';
            videoTabTvShows.style.background = 'transparent';
            videoTabTvShows.style.color = 'var(--text-tertiary)';
            videoSearch.placeholder = "Search movies...";
        } else {
            videoTabTvShows.style.background = 'rgba(255,215,0,0.1)';
            videoTabTvShows.style.color = 'var(--gold)';
            videoTabMovies.style.background = 'transparent';
            videoTabMovies.style.color = 'var(--text-tertiary)';
            videoSearch.placeholder = "Search TV shows...";
        }
        currentShowView = null;
        renderVideoGrid(videoSearch.value);
    }

    if (!videoAddFolder) return;

    // ── Position Persistence ──────────────────────────────────────────────
    function saveVideoPosition(videoId, time) {
        try {
            const positions = JSON.parse(localStorage.getItem(VIDEO_POS_KEY) || '{}');
            positions[videoId] = { currentTime: time, timestamp: Date.now() };
            localStorage.setItem(VIDEO_POS_KEY, JSON.stringify(positions));
        } catch(e) {}
    }

    function getVideoPosition(videoId) {
        try {
            const positions = JSON.parse(localStorage.getItem(VIDEO_POS_KEY) || '{}');
            return positions[videoId] || null;
        } catch(e) { return null; }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function formatTime(secs) {
        if (isNaN(secs) || !secs) return '0:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function toFileUrl(filePath) {
        if (!filePath) return null;
        if (filePath.startsWith('file://')) return filePath;
        return 'file:///' + filePath.replace(/\\/g, '/');
    }

    // ── Library Loading ───────────────────────────────────────────────────
    async function loadVideoLibrary() {
        const data = await window.omega.video.getVideoLibrary();
        if (data && data.videos) {
            videoLibrary = data;
            renderVideoGrid();
        } else {
            videoEmpty.classList.remove('hidden');
        }
    }

    videoAddFolder.addEventListener('click', async () => {
        videoAddFolder.textContent = "⏳ Scanning videos...";
        videoAddFolder.classList.add('scanning');
        const result = await window.omega.video.openVideoFolder();
        videoAddFolder.textContent = "📂 Add/Refresh Video Folder";
        videoAddFolder.classList.remove('scanning');

        if (result && result.videos) {
            videoLibrary = result;
            renderVideoGrid();
        }
    });

    // ── Video Grid Rendering ──────────────────────────────────────────────
    let currentShowView = null; // null = Main Library, otherwise Show Name

    async function renderVideoGrid(filter = '') {
        if (!videoLibrary || !videoLibrary.videos) return;

        videoEmpty.classList.add('hidden');
        videoGrid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        let renders = [];
        if (!currentShowView) {
            const showsMap = new Map();
            const standalone = [];
            for (const v of videoLibrary.videos) {
                if (activeVideoTab === 'tv') {
                    if (v.type === 'tv' && v.show) {
                        if (!showsMap.has(v.show)) showsMap.set(v.show, []);
                        showsMap.get(v.show).push(v);
                    }
                } else {
                    if (v.type !== 'tv' || !v.show) {
                        standalone.push(v);
                    }
                }
            }
            if (activeVideoTab === 'tv') {
                for (const [showName, episodes] of showsMap.entries()) {
                    if (filter && !showName.toLowerCase().includes(lowerFilter)) continue;
                    episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                    renders.push({ isShow: true, title: showName, episodes: episodes, repr: episodes[0] });
                }
            } else {
                for (const v of standalone) {
                    if (filter && !v.title.toLowerCase().includes(lowerFilter)) continue;
                    renders.push({ isShow: false, title: v.title, video: v, repr: v });
                }
            }
        } else {
            renders.push({ isBack: true });
            let episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show === currentShowView);
            episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
            for (const ep of episodes) {
                const fTitle = ep.title.replace(/Chuck(?:\s*0?\d{1,2}x\d{1,2})?\s*/i, '').trim();
                const titleStr = `S${String(ep.season).padStart(2,'0')}E${String(ep.episode).padStart(2,'0')} - ${fTitle}`;
                if (filter && !titleStr.toLowerCase().includes(lowerFilter) && !ep.title.toLowerCase().includes(lowerFilter)) continue;
                renders.push({ isShow: false, title: titleStr, video: ep, repr: ep });
            }
        }

        if (renders.length === (currentShowView ? 1 : 0)) {
            videoGrid.innerHTML = '<div class="playlist-empty" style="grid-column:1/-1;">No videos match your search.</div>';
        }

        // ── Continue Watching Carousel ──
        let recentHtml = '';
        if (!filter && !currentShowView) {
            const recentVideos = videoLibrary.videos.filter(v => {
                const matchesTab = activeVideoTab === 'tv' ? (v.type === 'tv' && v.show) : (v.type !== 'tv' || !v.show);
                if (!matchesTab) return false;
                const p = getVideoPosition(v.id);
                return p && p.currentTime > 10;
            }).sort((a,b) => {
                const pa = getVideoPosition(a.id);
                const pb = getVideoPosition(b.id);
                return pb.timestamp - pa.timestamp;
            }).slice(0, 5);

            if (recentVideos.length > 0) {
                const ds = document.createElement('div');
                ds.style.gridColumn = '1 / -1';
                ds.style.marginBottom = '20px';
                ds.innerHTML = `
                    <div style="font-family:'Courier New'; font-size:12px; color:var(--gold-dim); font-weight:bold; letter-spacing:1.5px; margin-bottom:12px;">CONTINUE WATCHING</div>
                    <div id="video-continue-scroll" style="display:flex; overflow-x:auto; gap:16px; padding-bottom:12px;"></div>
                    <div style="height:1px; background:rgba(212,175,55,0.15); margin-top:8px;"></div>
                `;
                videoGrid.appendChild(ds);
                const scrollContainer = ds.querySelector('#video-continue-scroll');
                
                for (const v of recentVideos) {
                    let thumbHtml = '<span class="library-card-fallback" style="font-size:24px;">🎬</span>';
                    if (v.poster) thumbHtml = `<img src="${encodeURI(toFileUrl(v.poster))}" onerror="this.style.display='none'">`;
                    else if (v.showPoster) thumbHtml = `<img src="${encodeURI(toFileUrl(v.showPoster))}" onerror="this.style.display='none'">`;
                    else if (v.path) {
                        try {
                            const tp = await window.omega.video.getThumbnail(v.path);
                            if (tp) thumbHtml = `<img src="${encodeURI(toFileUrl(tp))}" onerror="this.style.display='none'">`;
                        } catch(e){}
                    }
                    const pos = getVideoPosition(v.id);
                    const prog = pos && v.duration ? (pos.currentTime / v.duration) * 100 : 0;
                    const card = document.createElement('div');
                    card.className = 'library-card video-card';
                    card.style.flex = '0 0 200px';
                    card.style.marginBottom = '0';
                    card.innerHTML = `
                        <div class="library-card-art video-card-art" style="height:112px;">
                            ${thumbHtml}
                            <div style="position:absolute; bottom:0; left:0; height:3px; background:var(--gold); width:${prog}%;"></div>
                        </div>
                        <div class="library-card-info" style="padding:8px;">
                            <div class="library-card-title">${v.title}</div>
                            <div style="font-size:10px; color:var(--gold-dim); margin-top:2px;">⟳ ${formatTime(pos.currentTime)}</div>
                        </div>
                    `;
                    card.addEventListener('click', () => openVideo(v));
                    scrollContainer.appendChild(card);
                }
            }
        }

        for (const [i, item] of renders.entries()) {
            const card = document.createElement('div');
            card.className = 'library-card video-card';
            card.style.animationDelay = `${Math.min(i * 25, 500)}ms`;

            if (item.isBack) {
                card.innerHTML = `
                    <div class="library-card-art video-card-art" style="display:flex; align-items:center; justify-content:center; background:var(--background-lighter);">
                        <span style="font-size:2em; color:var(--text-dim);">←</span>
                    </div>
                    <div class="library-card-info" style="justify-content:center;">
                        <div class="library-card-title" style="color:var(--text-dim); text-align:center;">Back to Library</div>
                    </div>
                `;
                card.addEventListener('click', () => { currentShowView = null; renderVideoGrid(videoSearch.value); });
                videoGrid.appendChild(card);
                continue;
            }

            let thumbHtml = '<span class="library-card-fallback">🎬</span>';
            try {
                if (item.isShow && item.repr.showPoster) {
                     thumbHtml = `<img src="${encodeURI(toFileUrl(item.repr.showPoster))}" onerror="this.style.display='none'">`;
                } else if (item.repr.poster) {
                     thumbHtml = `<img src="${encodeURI(toFileUrl(item.repr.poster))}" onerror="this.style.display='none'">`;
                } else if (item.repr.path) {
                    const thumbPath = await window.omega.video.getThumbnail(item.repr.path);
                    if (thumbPath) thumbHtml = `<img src="${encodeURI(toFileUrl(thumbPath))}" onerror="this.style.display='none'">`;
                }
            } catch(e) {}

            if (item.isShow) {
                card.innerHTML = `
                    <div class="library-card-art video-card-art">
                        ${thumbHtml}
                        <div class="video-duration-badge" style="background:var(--gold); color:#000;">${item.episodes.length} Episodes</div>
                    </div>
                    <div class="library-card-info">
                        <div class="library-card-title">${item.title}</div>
                        <div class="library-card-meta">TV Show</div>
                    </div>
                `;
                card.addEventListener('click', () => { currentShowView = item.title; renderVideoGrid(''); });
            } else {
                const video = item.video;
                const savedPos = getVideoPosition(video.id);
                let resumeHint = '';
                if (savedPos && savedPos.currentTime > 10) {
                    resumeHint = `<div style="font-size:10px; color:var(--gold-dim); margin-top:2px;">⟳ ${formatTime(savedPos.currentTime)}</div>`;
                }
                const durStr = video.duration > 0 ? formatTime(video.duration) : '';

                card.innerHTML = `
                    <div class="library-card-art video-card-art">
                        ${thumbHtml}
                        ${durStr ? `<div class="video-duration-badge">${durStr}</div>` : ''}
                    </div>
                    <div class="library-card-info">
                        <div class="library-card-title" title="${item.title}">${item.title}</div>
                        <div class="library-card-meta">${formatSize(video.size)}</div>
                        ${resumeHint}
                    </div>
                `;
                card.addEventListener('click', () => openVideo(video));
            }
            videoGrid.appendChild(card);
        }

        videoSearchCount.textContent = currentShowView 
            ? `${renders.length - 1} episodes` 
            : `${renders.length} items`;
    }

    videoSearch.addEventListener('input', (e) => renderVideoGrid(e.target.value));

    // ── Open Video ────────────────────────────────────────────────────────
    function rebuildVideoPlayer() {
        if (!videoElement) return;
        
        // 1. Teardown existing internal decoder & free memory completely
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        
        // 2. Rebuild DOM element to prevent Chrome timing drift
        const parent = videoElement.parentNode;
        const newVideo = document.createElement('video');
        newVideo.id = 'video-element';
        newVideo.controls = true;
        newVideo.preload = 'auto';
        newVideo.style.position = 'relative';
        newVideo.style.zIndex = '2';
        newVideo.style.width = '100%';
        newVideo.style.maxHeight = '100%';
        newVideo.style.objectFit = 'contain';
        newVideo.style.boxShadow = '0 0 40px rgba(0,0,0,0.8)';
        parent.replaceChild(newVideo, videoElement);
        videoElement = newVideo;
        
        // 3. Rebind dynamic events to the fresh instance
        const ambilightCanvas = document.getElementById('video-ambilight');
        const ambilightCtx = ambilightCanvas ? ambilightCanvas.getContext('2d') : null;
        
        function renderAmbilight() {
            if (!videoElement.paused && !videoElement.ended && ambilightCtx) {
                // Downscale draw for performance (keeps massive blur entirely on GPU)
                ambilightCtx.drawImage(videoElement, 0, 0, ambilightCanvas.width, ambilightCanvas.height);
            }
            ambilightRafId = requestAnimationFrame(renderAmbilight);
        }

        videoElement.addEventListener('play', () => {
            if (ambilightRafId) cancelAnimationFrame(ambilightRafId);
            ambilightRafId = requestAnimationFrame(renderAmbilight);
            
            const overlay = document.getElementById('video-up-next-overlay');
            if (overlay) overlay.classList.add('hidden');
        });

        videoElement.addEventListener('pause', () => {
            if (currentVideoData) {
                saveVideoPosition(currentVideoData.id, videoElement.currentTime);
            }
            if (ambilightRafId) {
                cancelAnimationFrame(ambilightRafId);
                ambilightRafId = null;
            }
        });
        
        // "Up Next" binge watching logic
        videoElement.addEventListener('timeupdate', () => {
            if (!currentVideoData || currentVideoData.type !== 'tv' || !currentVideoData.show) return;
            const remaining = videoElement.duration - videoElement.currentTime;
            const overlay = document.getElementById('video-up-next-overlay');
            if (!overlay) return;

            if (remaining > 0 && remaining <= 12) {
                if (overlay.classList.contains('hidden')) {
                    const episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show === currentVideoData.show);
                    episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                    const currentIndex = episodes.findIndex(v => v.id === currentVideoData.id);
                    if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
                        const nextEpisode = episodes[currentIndex + 1];
                        const titleEl = document.getElementById('up-next-title');
                        if (titleEl) titleEl.textContent = `S${String(nextEpisode.season).padStart(2,'0')}E${String(nextEpisode.episode).padStart(2,'0')} - ${nextEpisode.title}`;
                        overlay.classList.remove('hidden');
                        
                        const skipBtn = document.getElementById('up-next-skip-btn');
                        if (skipBtn) {
                            skipBtn.onclick = () => {
                                overlay.classList.add('hidden');
                                openVideo(nextEpisode);
                            };
                        }
                    }
                }
                const circle = document.getElementById('up-next-circle');
                const secText = document.getElementById('up-next-sec');
                if (circle && secText) {
                    const progressStr = Math.max(0, (remaining / 12) * 100);
                    circle.setAttribute('stroke-dasharray', `${progressStr}, 100`);
                    secText.textContent = Math.ceil(remaining);
                }
            } else {
                overlay.classList.add('hidden');
            }
        });

        videoElement.addEventListener('ended', () => {
            if (currentVideoData && currentVideoData.type === 'tv' && currentVideoData.show) {
                const episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show === currentVideoData.show);
                episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                const currentIndex = episodes.findIndex(v => v.id === currentVideoData.id);
                if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
                    const nextEpisode = episodes[currentIndex + 1];
                    console.log("[Video] Auto-playing next episode:", nextEpisode.title);
                    openVideo(nextEpisode);
                }
            }
        });
        
        // 4. Reset subtitles state visually
        if (currentSubtitleUrl) {
            URL.revokeObjectURL(currentSubtitleUrl);
            currentSubtitleUrl = null;
        }
        const subBtn = document.getElementById('video-subtitle-btn');
        if (subBtn) {
            subBtn.textContent = "[cc] Add Subtitles";
            subBtn.style.background = 'rgba(255,215,0,0.1)';
        }
    }

    function openVideo(video) {
        currentVideoData = video;
        videoLibraryEl.classList.add('hidden');
        videoPlayerEl.classList.remove('hidden');
        videoPlayerTitle.textContent = video.title;

        rebuildVideoPlayer();
        videoElement.src = toFileUrl(video.path);

        const trackTitle = document.getElementById('media-track-title');
        const trackArtist = document.getElementById('media-track-artist');
        if (trackTitle) trackTitle.textContent = video.title;
        if (trackArtist) trackArtist.textContent = 'Sovereign Cinema';

        const coverImg = document.getElementById('media-cover-img');
        const coverFallback = document.querySelector('.media-cover-fallback');
        if (coverImg) coverImg.classList.add('hidden');
        if (coverFallback) {
            coverFallback.textContent = '🎬';
            coverFallback.classList.remove('hidden');
        }
        
        // Restore position
        const savedPos = getVideoPosition(video.id);
        videoElement.addEventListener('loadedmetadata', function onLoad() {
            videoElement.removeEventListener('loadedmetadata', onLoad);
            if (savedPos && savedPos.currentTime > 10) {
                videoElement.currentTime = savedPos.currentTime;
            }
        });

        // ── Auto-Extract & Load Internal Perfectly Synced Subs ──
        if (window.omega && window.omega.video && window.omega.video.extractInternalSubtitles) {
            window.omega.video.extractInternalSubtitles(video.path).then(res => {
                if (res && res.success && res.path) {
                    console.log("[SovereignMedia] Auto-loaded internal MKV subtitle:", res.path);
                    const trackId = 'internal-sub-track';
                    let oldTrack = document.getElementById(trackId);
                    if (oldTrack) oldTrack.remove();
                    
                    const track = document.createElement('track');
                    track.id = trackId;
                    track.src = toFileUrl(res.path);
                    track.kind = 'subtitles';
                    track.srclang = 'en';
                    track.label = 'Internal (Perfect Sync)';
                    track.default = true;
                    videoElement.appendChild(track);
                    
                    const subBtn = document.getElementById('video-subtitle-btn');
                    if (subBtn) {
                        subBtn.textContent = "[cc] Internal Synced";
                        subBtn.style.background = 'var(--gold)';
                        subBtn.style.color = '#000';
                        subBtn.style.border = '1px solid var(--gold)';
                    }
                }
            }).catch(console.error);
        }

        videoElement.play().catch(console.error);
    }

    // Auto-save position
    setInterval(() => {
        if (currentVideoData && videoElement && !videoElement.paused && videoElement.currentTime > 0) {
            saveVideoPosition(currentVideoData.id, videoElement.currentTime);
        }
    }, 5000);

    // Initial binding for first load (in case they don't open a video first)
    if (videoElement) {
        videoElement.addEventListener('pause', () => {
            if (currentVideoData) saveVideoPosition(currentVideoData.id, videoElement.currentTime);
        });
    }

    // ── Subtitles ─────────────────────────────────────────────────────────
    const subBtn = document.getElementById('video-subtitle-btn');
    const subInput = document.getElementById('video-subtitle-input');
    const autoSubBtn = document.getElementById('video-auto-subtitle-btn');

    if (autoSubBtn) {
        autoSubBtn.addEventListener('click', async () => {
            if (!currentVideoData || !currentVideoData.path) return;
            autoSubBtn.disabled = true;
            autoSubBtn.textContent = '⏱ Downloading...';
            autoSubBtn.style.opacity = '0.5';

            try {
                const res = await window.omega.video.autoDownloadSubtitles(currentVideoData.path);
                if (res && res.success) {
                    console.log("Subliminal result:", res.output);
                    if (res.output.includes("Downloaded 1 subtitle") || res.output.includes("Downloaded 2 subtitle")) {
                        autoSubBtn.textContent = '✔ Downloaded!';
                        autoSubBtn.style.opacity = '1';
                        autoSubBtn.style.background = 'var(--gold)';
                        autoSubBtn.style.color = '#000';
                        alert("Subtitle downloaded successfully!\nIt has been saved next to the video file.\nPlease use the '[cc] Add Subtitles' button to load it.");
                    } else if (res.output.includes("Downloaded 0 subtitle")) {
                        autoSubBtn.textContent = '❌ No subs found';
                        alert("Could not find any English subtitles for this video.");
                    } else {
                        autoSubBtn.textContent = '✔ Complete';
                    }
                } else {
                    console.error("Auto-fetch error:", res.error, res.stderr);
                    autoSubBtn.textContent = '❌ Error';
                    alert("Subtitle download failed: " + res.error);
                }
            } catch (e) {
                console.error(e);
                autoSubBtn.textContent = '❌ Error';
            }
            
            setTimeout(() => {
                autoSubBtn.disabled = false;
                autoSubBtn.textContent = '↓ Auto-Fetch';
                autoSubBtn.style.opacity = '0.8';
                autoSubBtn.style.background = 'transparent';
                autoSubBtn.style.color = 'var(--gold)';
                autoSubBtn.style.border = '1px solid var(--gold)';
            }, 6000);
        });
    }

    if (subBtn && subInput) {
        subBtn.addEventListener('click', () => {
            subInput.click();
        });

        subInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                let text = ev.target.result;
                // Convert SRT to VTT if needed
                if (!text.trim().startsWith('WEBVTT')) {
                    text = 'WEBVTT\n\n' + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                }

                const blob = new Blob([text], { type: 'text/vtt' });
                if (currentSubtitleUrl) URL.revokeObjectURL(currentSubtitleUrl);
                currentSubtitleUrl = URL.createObjectURL(blob);

                // Remove old tracks
                const oldTracks = videoElement.querySelectorAll('track');
                oldTracks.forEach(t => t.remove());

                // Add new track
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = file.name;
                track.srclang = 'en';
                track.src = currentSubtitleUrl;
                track.default = true;
                videoElement.appendChild(track);
                
                // Force track to show
                if (videoElement.textTracks && videoElement.textTracks.length > 0) {
                    videoElement.textTracks[0].mode = 'showing';
                }
                
                subBtn.textContent = "[cc] " + file.name;
                subBtn.style.background = 'var(--gold)';
                subBtn.style.color = '#000';
            };
            reader.readAsText(file);
        });
    }

    // Back to library
    videoPlayerBack.addEventListener('click', () => {
        videoPlayerEl.classList.add('hidden');
        videoLibraryEl.classList.remove('hidden');
        if (videoElement) {
            videoElement.pause();
            videoElement.src = '';
        }
        currentVideoData = null;
        renderVideoGrid(videoSearch.value);
    });

    // ── Subtitle Sizing Controls ──────────────────────────────────────────
    const sizeDown = document.getElementById('video-sub-size-down');
    const sizeUp = document.getElementById('video-sub-size-up');
    const playerArea = document.getElementById('video-player-area');
    
    // Default size is md. If no class, assume md.
    const sizes = ['sub-size-sm', 'sub-size-md', 'sub-size-lg'];
    let currentSizeIdx = 1;

    function applySubSize() {
        if (!playerArea) return;
        playerArea.classList.remove(...sizes);
        playerArea.classList.add(sizes[currentSizeIdx]);
    }

    if (sizeDown) {
        sizeDown.addEventListener('click', () => {
            currentSizeIdx = Math.max(0, currentSizeIdx - 1);
            applySubSize();
        });
    }

    if (sizeUp) {
        sizeUp.addEventListener('click', () => {
            currentSizeIdx = Math.min(sizes.length - 1, currentSizeIdx + 1);
            applySubSize();
        });
    }
    
    applySubSize();

    // ── Init ──────────────────────────────────────────────────────────────
    window._sovereignVideoInit = loadVideoLibrary;

})();
