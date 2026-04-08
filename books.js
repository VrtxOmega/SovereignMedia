// ══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN MEDIA — Books Module (epub.js native reader)
// ══════════════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    // Wait for epub.js to be available via CDN
    const ePub = window.ePub;

    // ── State ─────────────────────────────────────────────────────────────
    let bookLibrary = null;
    let currentBook = null;        // epub.js Book instance
    let currentRendition = null;   // epub.js Rendition
    let currentBookData = null;    // library entry
    let fontSize = 100;            // percentage
    let darkTheme = true;

    const BOOK_POS_KEY = 'sovereign_book_positions';

    // ── Elements ──────────────────────────────────────────────────────────
    const bookAddFolder = document.getElementById('book-add-folder');
    const bookSearch = document.getElementById('book-search');
    const bookSearchCount = document.getElementById('book-search-count');
    const bookGridContainer = document.getElementById('book-grid-container');
    const bookGrid = document.getElementById('book-grid');
    const bookEmpty = document.getElementById('book-empty');
    const bookLibraryEl = document.getElementById('book-library');
    const bookReaderEl = document.getElementById('book-reader');
    const bookReaderBack = document.getElementById('book-reader-back');
    const bookReaderTitle = document.getElementById('book-reader-title');
    const bookReaderArea = document.getElementById('book-reader-area');
    const bookPrevPage = document.getElementById('book-prev-page');
    const bookNextPage = document.getElementById('book-next-page');
    const bookProgress = document.getElementById('book-progress');
    const bookFontDown = document.getElementById('book-font-down');
    const bookFontUp = document.getElementById('book-font-up');
    const bookThemeToggle = document.getElementById('book-theme-toggle');
    const bookTocToggle = document.getElementById('book-toc-toggle');
    const bookTocDrawer = document.getElementById('book-toc-drawer');
    const bookTocClose = document.getElementById('book-toc-close');
    const bookTocList = document.getElementById('book-toc-list');

    if (!bookAddFolder) return; // Safety: only run if books panel exists

    // ── Position Persistence ──────────────────────────────────────────────
    function saveBookPosition(bookId, cfi) {
        try {
            const positions = JSON.parse(localStorage.getItem(BOOK_POS_KEY) || '{}');
            positions[bookId] = { cfi, timestamp: Date.now() };
            localStorage.setItem(BOOK_POS_KEY, JSON.stringify(positions));
        } catch(e) {}
    }

    function getBookPosition(bookId) {
        try {
            const positions = JSON.parse(localStorage.getItem(BOOK_POS_KEY) || '{}');
            return positions[bookId] || null;
        } catch(e) { return null; }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // ── Library Loading ───────────────────────────────────────────────────
    async function loadBookLibrary() {
        const data = await window.omega.books.getBookLibrary();
        if (data && data.books) {
            bookLibrary = data;
            renderBookGrid();
        } else {
            bookEmpty.classList.remove('hidden');
        }
    }

    bookAddFolder.addEventListener('click', async () => {
        bookAddFolder.textContent = "⏳ Scanning books...";
        bookAddFolder.classList.add('scanning');
        const result = await window.omega.books.openBookFolder();
        bookAddFolder.textContent = "📂 Add/Refresh Book Folder";
        bookAddFolder.classList.remove('scanning');

        if (result && result.books) {
            bookLibrary = result;
            renderBookGrid();
        }
    });

    const bookSort = document.getElementById('book-sort');

    // ── Book Grid Rendering & Sorting ─────────────────────────────────────
    function renderBookGrid(filter = '') {
        if (!bookLibrary || !bookLibrary.books) return;

        bookEmpty.classList.add('hidden');
        bookGrid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        let filtered = bookLibrary.books.filter(book => {
            if (!filter) return true;
            return book.title.toLowerCase().includes(lowerFilter) ||
                   (book.author || '').toLowerCase().includes(lowerFilter);
        });

        // ── Advanced Sorting & Series Grouping ──
        const sortVal = bookSort ? bookSort.value : 'recent';
        filtered.sort((a, b) => {
            if (sortVal === 'recent') {
                return (b.modified || 0) - (a.modified || 0);
            } else if (sortVal === 'az') {
                return a.title.localeCompare(b.title);
            } else if (sortVal === 'za') {
                return b.title.localeCompare(a.title);
            } else if (sortVal === 'author') {
                // Grouping by Author & Series
                const authA = (a.author || 'Unknown').toLowerCase();
                const authB = (b.author || 'Unknown').toLowerCase();
                if (authA !== authB) return authA.localeCompare(authB);
                // Inside author, sort by title to naturally cluster Series
                return a.title.localeCompare(b.title);
            }
            return 0;
        });

        if (filtered.length === 0) {
            bookGrid.innerHTML = '<div class="playlist-empty" style="grid-column:1/-1;">No books match your search.</div>';
        }

        // ── Continue Reading Carousel ──
        if (!filter) {
            const recentBooks = bookLibrary.books.filter(b => getBookPosition(b.id)).sort((a,b) => {
                const pa = getBookPosition(a.id);
                const pb = getBookPosition(b.id);
                return pb.timestamp - pa.timestamp;
            }).slice(0, 5);

            if (recentBooks.length > 0) {
                const ds = document.createElement('div');
                ds.style.gridColumn = '1 / -1';
                ds.style.marginBottom = '20px';
                ds.innerHTML = `
                    <div style="font-family:'Courier New'; font-size:12px; color:var(--gold-dim); font-weight:bold; letter-spacing:1.5px; margin-bottom:12px;">CONTINUE READING</div>
                    <div id="book-continue-scroll" style="display:flex; overflow-x:auto; gap:16px; padding-bottom:12px;"></div>
                    <div style="height:1px; background:rgba(212,175,55,0.15); margin-top:8px;"></div>
                `;
                bookGrid.appendChild(ds);
                const scrollContainer = ds.querySelector('#book-continue-scroll');
                
                for (const b of recentBooks) {
                    const card = document.createElement('div');
                    card.className = 'library-card book-card';
                    card.style.flex = '0 0 140px';
                    card.style.marginBottom = '0';
                    card.style.animation = 'none';
                    card.style.opacity = '1';
                    
                    const artContent = b.coverArt ? 
                        `<img src="${b.coverArt}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" />` :
                        `<div class="book-spine"></div><span class="library-card-fallback book-icon" style="font-size:24px;">📖</span>`;

                    card.innerHTML = `
                        <div class="library-card-art book-card-art" style="border: 1px solid var(--border-dark); border-radius: 4px; overflow: hidden; background: linear-gradient(145deg, #18181A, #0f0f11);">
                            ${artContent}
                        </div>
                        <div class="library-card-info" style="padding-top: 8px;">
                            <div class="library-card-title" style="font-size: 13px; line-height: 1.3em;">${b.title}</div>
                            <div style="font-size:10px; color:var(--gold-dim); margin-top:2px; font-weight:bold; letter-spacing:0.5px;">⟳ IN PROGRESS</div>
                        </div>
                    `;
                    card.addEventListener('click', () => openBook(b));
                    scrollContainer.appendChild(card);
                }
            }
        }

        filtered.forEach((book, i) => {
            const card = document.createElement('div');
            card.className = 'library-card book-card';
            // Subtle spring entrance staggered transition
            card.style.animationDelay = `${Math.min(i * 15, 300)}ms`;
            card.style.animation = `fadeUpIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`;
            card.style.opacity = '0';

            const savedPos = getBookPosition(book.id);
            let resumeHint = '';
            if (savedPos) {
                resumeHint = '<div style="font-size:10px; color:var(--gold-dim); margin-top:4px; font-weight:bold; letter-spacing:0.5px;">⟳ IN PROGRESS</div>';
            }

            const artContent = book.coverArt ? 
                `<img src="${book.coverArt}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />` :
                `<div class="book-spine"></div><span class="library-card-fallback book-icon">📖</span>`;

            card.innerHTML = `
                <div class="library-card-art book-card-art" style="border: 1px solid var(--border-dark); border-radius: 4px; overflow: hidden; background: linear-gradient(145deg, #18181A, #0f0f11);">
                    ${artContent}
                </div>
                <div class="library-card-info" style="padding-top: 8px;">
                    <div class="library-card-title" style="font-size: 13px; line-height: 1.3em;">${book.title}</div>
                    <div class="library-card-artist" style="color: var(--gold-mute); font-size: 11px; margin-top: 2px;">${book.author || 'Unknown Author'}</div>
                    ${resumeHint}
                </div>
            `;

            card.addEventListener('click', () => openBook(book));
            bookGrid.appendChild(card);
        });

        bookSearchCount.textContent = filter ? `${filtered.length} found` : `${bookLibrary.books.length} loaded`;
    }

    bookSearch.addEventListener('input', (e) => renderBookGrid(e.target.value));
    if (bookSort) {
        bookSort.addEventListener('change', () => renderBookGrid(bookSearch.value));
    }

    // ── Open Book (epub.js) ───────────────────────────────────────────────
    async function openBook(book) {
        currentBookData = book;
        bookLibraryEl.classList.add('hidden');
        bookReaderEl.classList.remove('hidden');
        bookReaderTitle.textContent = book.title;
        bookReaderArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">Loading book…</div>';

        try {
            // Read file from disk via IPC
            const fileBuffer = await window.omega.books.getBookFile(book.path);
            if (!fileBuffer) {
                bookReaderArea.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b;">Failed to load book file.</div>';
                return;
            }

            // Destroy previous book if any
            if (currentRendition) {
                try { currentRendition.destroy(); } catch(e) {}
            }
            if (currentBook) {
                try { currentBook.destroy(); } catch(e) {}
            }

            bookReaderArea.innerHTML = '';

            // Create epub.js book from ArrayBuffer
            currentBook = ePub(fileBuffer);

            // Extract metadata for the title bar
            currentBook.loaded.metadata.then(meta => {
                const title = meta.title || currentBookData.title;
                const author = meta.creator ? ` — ${meta.creator}` : '';
                document.getElementById('book-reader-title').textContent = `${title}${author}`;
            });

            currentRendition = currentBook.renderTo(bookReaderArea, {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: 'paginated'
            });

            // Apply theme
            applyReaderTheme();
            applyFontSize();

            // Restore position or start from beginning
            const savedPos = getBookPosition(book.id);
            if (savedPos && savedPos.cfi) {
                currentRendition.display(savedPos.cfi);
            } else {
                currentRendition.display();
            }

            // Position tracking
            currentRendition.on('relocated', (location) => {
                if (location && location.start && location.start.cfi) {
                    saveBookPosition(book.id, location.start.cfi);
                }
                updateProgress(location);
            });

            // Load TOC
            currentBook.loaded.navigation.then(nav => {
                renderTOC(nav.toc);
            });

            // Keyboard navigation inside iframe
            currentRendition.on('keyup', handleReaderKeys);

        } catch(e) {
            console.error('EPUB open error:', e);
            bookReaderArea.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;">Error: ${e.message}</div>`;
        }
    }

    function handleReaderKeys(e) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            currentRendition?.prev();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            currentRendition?.next();
        }
    }

    // ── Reader Controls ───────────────────────────────────────────────────
    bookPrevPage.addEventListener('click', () => currentRendition?.prev());
    bookNextPage.addEventListener('click', () => currentRendition?.next());

    bookReaderBack.addEventListener('click', () => {
        bookReaderEl.classList.add('hidden');
        bookLibraryEl.classList.remove('hidden');
        bookTocDrawer.classList.add('hidden');
        if (currentRendition) {
            try { currentRendition.destroy(); } catch(e) {}
        }
        if (currentBook) {
            try { currentBook.destroy(); } catch(e) {}
        }
        currentBook = null;
        currentRendition = null;
        currentBookData = null;
        renderBookGrid(bookSearch.value);
    });

    // Font size
    bookFontDown.addEventListener('click', () => {
        fontSize = Math.max(60, fontSize - 10);
        applyFontSize();
    });
    bookFontUp.addEventListener('click', () => {
        fontSize = Math.min(200, fontSize + 10);
        applyFontSize();
    });

    function applyFontSize() {
        if (!currentRendition) return;
        currentRendition.themes.fontSize(`${fontSize}%`);
    }

    // Theme toggle
    bookThemeToggle.addEventListener('click', () => {
        darkTheme = !darkTheme;
        applyReaderTheme();
    });

    function applyReaderTheme() {
        if (!currentRendition) return;
        if (darkTheme) {
            currentRendition.themes.register('dark', {
                'body': { 'color': 'rgba(255,255,255,0.85)', 'background': '#0a0a0c' },
                'p': { 'color': 'rgba(255,255,255,0.85)' },
                'h1,h2,h3,h4,h5,h6': { 'color': '#c5a044' },
                'a': { 'color': '#c5a044' }
            });
            currentRendition.themes.select('dark');
        } else {
            currentRendition.themes.register('light', {
                'body': { 'color': '#1a1a1a', 'background': '#f5f0e8' },
                'p': { 'color': '#1a1a1a' },
                'h1,h2,h3,h4,h5,h6': { 'color': '#2a2a2a' },
                'a': { 'color': '#8b6e26' }
            });
            currentRendition.themes.select('light');
        }
    }

    // Progress
    function updateProgress(location) {
        if (!location || !currentBook) {
            bookProgress.textContent = '-';
            return;
        }
        try {
            const pct = currentBook.locations ? 
                Math.round((location.start?.percentage || 0) * 100) : 0;
            bookProgress.textContent = pct > 0 ? `${pct}%` : '-';
        } catch(e) {
            bookProgress.textContent = '-';
        }
    }

    // TOC
    bookTocToggle.addEventListener('click', () => {
        bookTocDrawer.classList.toggle('hidden');
    });
    bookTocClose.addEventListener('click', () => {
        bookTocDrawer.classList.add('hidden');
    });

    function renderTOC(toc) {
        bookTocList.innerHTML = '';
        if (!toc || toc.length === 0) {
            bookTocList.innerHTML = '<div style="padding:20px;color:var(--text-tertiary);">No table of contents available.</div>';
            return;
        }

        function renderItems(items, depth) {
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'book-toc-item';
                el.style.paddingLeft = `${16 + depth * 16}px`;
                el.textContent = item.label?.trim() || 'Untitled';
                el.addEventListener('click', () => {
                    currentRendition.display(item.href);
                    bookTocDrawer.classList.add('hidden');
                });
                bookTocList.appendChild(el);

                if (item.subitems && item.subitems.length > 0) {
                    renderItems(item.subitems, depth + 1);
                }
            });
        }
        renderItems(toc, 0);
    }

    // Global keyboard for reader
    document.addEventListener('keyup', (e) => {
        if (!currentRendition || document.getElementById('panel-books')?.style.display === 'none') return;
        handleReaderKeys(e);
    });

    // ── Init ──────────────────────────────────────────────────────────────
    // Load on tab switch (lazy)
    window._sovereignBooksInit = loadBookLibrary;

})();
