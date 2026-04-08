<div align="center">
  <h1>SOVEREIGN MEDIA</h1>
  <p><strong>All-in-One Premium Media Platform</strong></p>
  <p><em>Audiobooks. eBooks. Video. One sovereign interface.</em></p>
</div>

![Status](https://img.shields.io/badge/Status-ACTIVE-success?style=for-the-badge&labelColor=000000&color=d4af37)
![Platform](https://img.shields.io/badge/Platform-Windows-blue?style=for-the-badge&labelColor=000000)
![Stack](https://img.shields.io/badge/Electron-31.x-47848F?style=for-the-badge&labelColor=000000)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=000000)

---

Sovereign Media is a unified AIO media platform built with Electron. Native playback for audiobooks, eBooks (epub.js), and video (HTML5) within a single VERITAS-branded desktop application.

> **Your library. Your hardware. No subscriptions, no DRM, no cloud.**

## Features

- **Audiobook Player** - Full-featured audio playback with position persistence
- **eBook Reader** - epub.js-powered reader with bookmarks and progress tracking
- **Video Player** - HTML5 native video with position memory
- **3-Tab Navigation** - Audio / Books / Video with seamless switching
- **Position Persistence** - Resume exactly where you left off across all media types
- **Library Management** - Folder-based library scanning with metadata extraction
- **VERITAS Aesthetic** - Gold-and-black machined OS-level interface

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Shell** | Electron 31.x | Window management, IPC, file system access |
| **Audio** | HTML5 Audio API | Audiobook playback, chapter navigation |
| **Books** | epub.js | EPUB rendering, pagination, bookmarks |
| **Video** | HTML5 Video | Native video playback |
| **Storage** | localStorage + JSON | Position persistence, library index |

## Quick Start

`ash
npm install
npm start
`

Point the library scanner at your media directories. Sovereign Media indexes and organizes everything automatically.

## Mobile Companion

See [SovereignMediaMobile](https://github.com/VrtxOmega/SovereignMediaMobile) for the Android companion app with sync bridge.

## License

MIT

---

<div align="center">
  <sub>Built by <a href="https://github.com/VrtxOmega">RJ Lopez</a> | VERITAS Framework</sub>
</div>