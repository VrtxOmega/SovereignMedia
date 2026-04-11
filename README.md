# Ω Sovereign Media

> [!WARNING]
> **STATUS: PROJECT COMPLETELY FROZEN**
> This project has been sealed and locked by the VERITAS Ω command. Do not touch or modify the core functionality.


Premium standalone all-in-one media platform built with Electron.

---

![Sovereign Media](https://img.shields.io/badge/Electron-31.x-47848F?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-gold?style=flat-square)

## Media Types

- 🎧 **Audiobooks & Podcasts** — Full library with ID3 metadata, cover art, chapter navigation
- 📖 **eBooks** — EPUB reader with paginated/scroll modes, typography controls, reading progress
- 🎬 **Video** — Native video player with position persistence and thumbnail generation
- ♪ **YouTube Music** — Embedded web player

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

## Getting Started

```bash
cd sovereign-media
npm install
npm start
`

Point the library scanner at your media directories. Sovereign Media indexes and organizes everything automatically.

- **Electron** — Desktop runtime
- **music-metadata** — ID3 tag parser
- **epub.js** — EPUB rendering engine
- **video.js** — Video player controls
- **Node.js** — `crypto`, `fs`, `path`

## License

MIT

---

<div align="center">
  <sub>Built by <a href="https://github.com/VrtxOmega">RJ Lopez</a> | VERITAS Framework</sub>
</div>