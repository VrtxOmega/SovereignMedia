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
    const videoRefreshFolder = document.getElementById('video-refresh-folder');
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
        videoAddFolder.textContent = "📂 Add Folder";
        videoAddFolder.classList.remove('scanning');

        if (result && result.videos) {
            videoLibrary = result;
            renderVideoGrid();
        }
    });

    videoRefreshFolder.addEventListener('click', async () => {
        videoRefreshFolder.textContent = "⏳ Refreshing...";
        videoRefreshFolder.classList.add('scanning');
        const result = await window.omega.video.refreshVideoFolder();
        videoRefreshFolder.textContent = "🔄 Refresh";
        videoRefreshFolder.classList.remove('scanning');

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
            const originalShowNames = new Map(); // Store original representation
            const standalone = [];
            for (const v of videoLibrary.videos) {
                if (activeVideoTab === 'tv') {
                    if (v.type === 'tv' && v.show) {
                        const lowerName = v.show.toLowerCase();
                        if (!showsMap.has(lowerName)) {
                            showsMap.set(lowerName, []);
                            originalShowNames.set(lowerName, v.show);
                        }
                        showsMap.get(lowerName).push(v);
                        
                        // If this episode has a poster, try to use its exact name spelling and save it as the poster origin
                        if (!showsMap.has(lowerName + "_poster") && (v.showPoster || v.poster || v.path)) {
                            showsMap.set(lowerName + "_poster", v);
                            if (v.showPoster || v.poster) {
                                originalShowNames.set(lowerName, v.show); 
                            }
                        }
                    }
                } else {
                    if (v.type !== 'tv' || !v.show) {
                        standalone.push(v);
                    }
                }
            }
            if (activeVideoTab === 'tv') {
                for (const [lowerName, episodes] of showsMap.entries()) {
                    if (lowerName.endsWith("_poster")) continue;
                    const showName = originalShowNames.get(lowerName);
                    
                    if (filter && !showName.toLowerCase().includes(lowerFilter)) continue;
                    episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                    
                    const posterRepr = showsMap.get(lowerName + "_poster") || episodes[0];
                    renders.push({ isShow: true, title: showName, episodes: episodes, repr: posterRepr });
                }
            } else {
                for (const v of standalone) {
                    if (filter && !v.title.toLowerCase().includes(lowerFilter)) continue;
                    renders.push({ isShow: false, title: v.title, video: v, repr: v });
                }
            }
        } else {
            renders.push({ isBack: true });
            let episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show && v.show.toLowerCase() === currentShowView.toLowerCase());
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
                const seasons = [...new Set(item.episodes.map(e => parseInt(e.season) || 1))].sort((a,b) => a - b);
                let seasonText = 'TV Show';
                if (seasons.length === 1) {
                    seasonText = `Season ${seasons[0]}`;
                } else if (seasons.length >= 2) {
                    seasonText = `Seasons ${seasons[0]}-${seasons[seasons.length-1]}`;
                }

                card.innerHTML = `
                    <div class="library-card-art video-card-art">
                        ${thumbHtml}
                        <div class="video-duration-badge" style="background:var(--gold); color:#000;">${item.episodes.length} Episodes</div>
                    </div>
                    <div class="library-card-info">
                        <div class="library-card-title">${item.title}</div>
                        <div class="library-card-meta">${seasonText}</div>
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
                const watchProgress = savedPos && video.duration > 0 ? Math.min(100, (savedPos.currentTime / video.duration) * 100) : 0;
                const isWatched = video.duration > 0 && savedPos && savedPos.currentTime >= video.duration - 5;

                card.innerHTML = `
                    <div class="library-card-art video-card-art">
                        ${thumbHtml}
                        ${durStr ? `<div class="video-duration-badge">${durStr}</div>` : ''}
                        ${isWatched ? `<div class="video-watched-badge" title="Watched">✓</div>` : ''}
                        ${watchProgress > 0 ? `<div class="video-progress-bar" style="width:${watchProgress}%"></div>` : ''}
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
        newVideo.setAttribute('controlslist', 'nofullscreen');
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

        videoElement.addEventListener('dblclick', () => {
            const videoArea = document.getElementById('video-player-area');
            if (videoArea) {
                if (!document.fullscreenElement) {
                    videoArea.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
                } else {
                    document.exitFullscreen().catch(err => console.error("Exit fullscreen error:", err));
                }
            }
        });

        videoElement.addEventListener('play', () => {
            if (ambilightRafId) cancelAnimationFrame(ambilightRafId);
            ambilightRafId = requestAnimationFrame(renderAmbilight);
            
            const overlay = document.getElementById('video-up-next-overlay');
            if (overlay) overlay.classList.add('hidden');
            const posterArea = document.getElementById('up-next-poster');
            if (posterArea) posterArea.dataset.loaded = '';
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

            if (remaining > 0 && remaining <= 30) {
                if (overlay.classList.contains('hidden')) {
                    const episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show === currentVideoData.show);
                    episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                    const currentIndex = episodes.findIndex(v => v.id === currentVideoData.id);
                    if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
                        const nextEpisode = episodes[currentIndex + 1];
                        const titleEl = document.getElementById('up-next-title');
                        if (titleEl) titleEl.textContent = `S${String(nextEpisode.season).padStart(2,'0')}E${String(nextEpisode.episode).padStart(2,'0')} - ${nextEpisode.title}`;
                        
                        const posterArea = document.getElementById('up-next-poster');
                        if (posterArea && posterArea.dataset.loaded !== 'true') {
                            posterArea.dataset.loaded = 'true';
                            let thumbHtml = '<span class="up-next-fallback">🎬</span>';
                            if (nextEpisode.showPoster) thumbHtml = `<img src="${encodeURI(toFileUrl(nextEpisode.showPoster))}" onerror="this.style.display='none'">`;
                            else if (nextEpisode.poster) thumbHtml = `<img src="${encodeURI(toFileUrl(nextEpisode.poster))}" onerror="this.style.display='none'">`;
                            posterArea.innerHTML = thumbHtml;
                            
                            if (nextEpisode.path && !nextEpisode.showPoster && !nextEpisode.poster) {
                                window.omega.video.getThumbnail(nextEpisode.path).then(tp => {
                                    if (tp) posterArea.innerHTML = `<img src="${encodeURI(toFileUrl(tp))}" onerror="this.style.display='none'">`;
                                }).catch(()=>{});
                            }
                        }
                        
                        overlay.classList.remove('hidden');
                        
                        const skipBtn = document.getElementById('up-next-skip-btn');
                        if (skipBtn) {
                            skipBtn.onclick = () => {
                                playNextSeamless(nextEpisode);
                            };
                        }
                    }
                }
                const circle = document.getElementById('up-next-circle');
                const secText = document.getElementById('up-next-sec');
                if (circle && secText) {
                    const progressStr = Math.max(0, (remaining / 30) * 100);
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
                    playNextSeamless(nextEpisode);
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

    async function playNextSeamless(nextEpisode) {
        const transitionOverlay = document.getElementById('video-transition-overlay');
        const upNextOverlay = document.getElementById('video-up-next-overlay');
        
        if (upNextOverlay) upNextOverlay.classList.add('hidden');
        if (transitionOverlay) {
            transitionOverlay.style.opacity = '1';
        }
        
        // Wait for fade to black
        await new Promise(r => setTimeout(r, 800));
        
        openVideo(nextEpisode, true);
        
        const canPlayHandler = () => {
            if (transitionOverlay) {
                transitionOverlay.style.opacity = '0';
            }
            videoElement.removeEventListener('canplay', canPlayHandler);
        };
        videoElement.addEventListener('canplay', canPlayHandler);
        
        // Failsafe in case canplay doesn't fire fast enough
        setTimeout(() => {
            if (transitionOverlay) transitionOverlay.style.opacity = '0';
        }, 1500);
    }

    function openVideo(video, seamless = false) {
        currentVideoData = video;
        window._omegaVideoCurrentData = video; // Expose for mobile remote sync
        videoLibraryEl.classList.add('hidden');
        videoPlayerEl.classList.remove('hidden');
        videoPlayerTitle.textContent = video.title;

        if (!seamless) {
            rebuildVideoPlayer();
        } else {
            // Clean up state manually without destroying DOM
            videoElement.pause();
            if (currentSubtitleUrl) {
                URL.revokeObjectURL(currentSubtitleUrl);
                currentSubtitleUrl = null;
            }
            const oldTracks = videoElement.querySelectorAll('track');
            oldTracks.forEach(t => t.remove());
            
            const subBtn = document.getElementById('video-subtitle-btn');
            if (subBtn) {
                subBtn.textContent = "[cc] Add Subtitles";
                subBtn.style.background = 'rgba(255,215,0,0.1)';
                subBtn.style.color = 'var(--gold)';
                subBtn.style.border = '1px solid var(--gold)';
            }
        }

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
        
        // Restore position & start playback AFTER metadata is ready
        // (prevents audio/video decoder desync from seeking during active playback)
        const savedPos = getVideoPosition(video.id);
        videoElement.addEventListener('loadedmetadata', function onLoad() {
            videoElement.removeEventListener('loadedmetadata', onLoad);
            if (savedPos && savedPos.currentTime > 10) {
                if (videoElement.duration && videoElement.duration > 0 && savedPos.currentTime >= videoElement.duration - 5) {
                    // Fully watched — clear stale position, start fresh (no redundant seek)
                    saveVideoPosition(video.id, 0);
                } else {
                    videoElement.currentTime = savedPos.currentTime;
                }
            }
            videoElement.play().catch(console.error);
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

        // play() is now called inside loadedmetadata to prevent decoder desync
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

    // ── Optimize Library Button ───────────────────────────────────────────
    const optimizeBtn = document.getElementById('video-optimize-btn');
    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', async () => {
            optimizeBtn.disabled = true;
            optimizeBtn.textContent = '⏳ Optimizing...';
            optimizeBtn.style.opacity = '0.6';

            // Listen for real-time progress
            if (window.omega.video.onOptimizeProgress) {
                window.omega.video.onOptimizeProgress((data) => {
                    optimizeBtn.textContent = `⚡ ${data.current}/${data.total}`;
                });
            }

            try {
                const result = await window.omega.video.optimizeLibrary();
                if (result && result.success) {
                    if (result.total === 0) {
                        optimizeBtn.textContent = '✔ All files optimized';
                    } else {
                        optimizeBtn.textContent = `✔ ${result.converted}/${result.total} converted`;
                        // Reload the library to pick up new MP4 paths
                        const refreshed = await window.omega.video.refreshVideoFolder();
                        if (refreshed && refreshed.videos) {
                            videoLibrary = refreshed;
                            renderVideoGrid(videoSearch.value);
                        }
                    }
                } else {
                    optimizeBtn.textContent = '❌ Error';
                }
            } catch (e) {
                console.error('[Optimizer]', e);
                optimizeBtn.textContent = '❌ Error';
            }

            setTimeout(() => {
                optimizeBtn.disabled = false;
                optimizeBtn.textContent = '⚡ Optimize';
                optimizeBtn.style.opacity = '1';
            }, 5000);
        });
    }

    // ── Keyboard Shortcuts (Couch Mode) ───────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Only handle shortcuts when in video player view
        if (!videoPlayerEl || videoPlayerEl.classList.contains('hidden')) return;
        if (!videoElement) return;

        // Don't intercept when user is typing in an input
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (videoElement.paused) videoElement.play().catch(() => {});
                else videoElement.pause();
                break;

            case 'ArrowLeft':
                e.preventDefault();
                videoElement.currentTime = Math.max(0, videoElement.currentTime - (e.shiftKey ? 30 : 10));
                break;

            case 'ArrowRight':
                e.preventDefault();
                videoElement.currentTime = Math.min(videoElement.duration || 0, videoElement.currentTime + (e.shiftKey ? 30 : 10));
                break;

            case 'ArrowUp':
                e.preventDefault();
                videoElement.volume = Math.min(1, videoElement.volume + 0.05);
                break;

            case 'ArrowDown':
                e.preventDefault();
                videoElement.volume = Math.max(0, videoElement.volume - 0.05);
                break;

            case 'f':
            case 'F': {
                const videoArea = document.getElementById('video-player-area');
                if (videoArea) {
                    if (!document.fullscreenElement) videoArea.requestFullscreen().catch(() => {});
                    else document.exitFullscreen().catch(() => {});
                }
                break;
            }

            case 's':
            case 'S':
            case 'c':
            case 'C':
                // Toggle subtitle visibility
                if (videoElement.textTracks && videoElement.textTracks.length > 0) {
                    const track = videoElement.textTracks[0];
                    track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
                }
                break;

            case 'm':
            case 'M':
                videoElement.muted = !videoElement.muted;
                break;

            case 'n':
            case 'N':
                // Skip to next episode
                if (currentVideoData && currentVideoData.type === 'tv' && currentVideoData.show && videoLibrary) {
                    const episodes = videoLibrary.videos.filter(v => v.type === 'tv' && v.show === currentVideoData.show);
                    episodes.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                    const currentIndex = episodes.findIndex(v => v.id === currentVideoData.id);
                    if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
                        playNextSeamless(episodes[currentIndex + 1]);
                    }
                }
                break;

            case 'Escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
                break;
        }
    });

    // ── Init ──────────────────────────────────────────────────────────────
    window._sovereignVideoInit = loadVideoLibrary;

})();
