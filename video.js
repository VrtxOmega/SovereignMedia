// ══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN MEDIA — Video Module (native HTML5 video player)
// ══════════════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────
    let videoLibrary = null;
    let currentVideoData = null;
    const VIDEO_POS_KEY = 'sovereign_video_positions';

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
    const videoElement = document.getElementById('video-element');

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
                if (v.type === 'tv' && v.show) {
                    if (!showsMap.has(v.show)) showsMap.set(v.show, []);
                    showsMap.get(v.show).push(v);
                } else {
                    standalone.push(v);
                }
            }
            for (const [showName, episodes] of showsMap.entries()) {
                if (filter && !showName.toLowerCase().includes(lowerFilter)) continue;
                episodes.sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                renders.push({ isShow: true, title: showName, episodes: episodes, repr: episodes[0] });
            }
            for (const v of standalone) {
                if (filter && !v.title.toLowerCase().includes(lowerFilter)) continue;
                renders.push({ isShow: false, title: v.title, video: v, repr: v });
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
    function openVideo(video) {
        currentVideoData = video;
        videoLibraryEl.classList.add('hidden');
        videoPlayerEl.classList.remove('hidden');
        videoPlayerTitle.textContent = video.title;

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

        videoElement.play().catch(console.error);
    }

    // Auto-save position
    if (videoElement) {
        setInterval(() => {
            if (currentVideoData && !videoElement.paused && videoElement.currentTime > 0) {
                saveVideoPosition(currentVideoData.id, videoElement.currentTime);
            }
        }, 5000);

        videoElement.addEventListener('pause', () => {
            if (currentVideoData) {
                saveVideoPosition(currentVideoData.id, videoElement.currentTime);
            }
        });

        // Autoplay next episode
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

    // ── Init ──────────────────────────────────────────────────────────────
    window._sovereignVideoInit = loadVideoLibrary;

})();
