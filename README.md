# Ω Sovereign Media

Premium standalone all-in-one media platform built with Electron.

**VERITAS Gold-and-Black aesthetic** — a machined, OS-level media environment.

![Sovereign Media](https://img.shields.io/badge/Electron-31.x-47848F?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-gold?style=flat-square)

## Media Types

- 🎧 **Audiobooks & Podcasts** — Full library with ID3 metadata, cover art, chapter navigation
- 📖 **eBooks** — EPUB reader with paginated/scroll modes, typography controls, reading progress
- 🎬 **Video** — Native video player with position persistence and thumbnail generation
- ♪ **YouTube Music** — Embedded web player

## Features

- **Deep ID3 Metadata Parsing** — Every track parsed individually via `music-metadata`. Album name, artist, title, duration, track number, and cover art extracted from tags.
- **Intelligent Album Grouping** — Files grouped by actual ID3 album tag, not folder path. SHA-256 deterministic IDs prevent collisions.
- **File-Based Cover Art** — Cover art extracted to disk (not base64). Zero JSON bloat, instant UI rendering.
- **Sort & Group** — Sort by Title, Author, Track Count. Group by Author view with gold section headers.
- **Playback Position Persistence** — Auto-saves position every 10 seconds. Resume prompts on album cards and detail view.
- **Sleep Timer** — 15/30/45/60/90 minute presets with live countdown.
- **Keyboard Shortcuts** — Space (play/pause), ←→ (seek ±15s), ↑↓ (volume), N/P (next/prev), Esc (back).
- **Hero Detail View** — Large cover art with dynamic desaturated blurred background and Sentinel gold flare.
- **Now-Playing Indicator** — Active album highlighted with gold border and pulsing badge.

## Design

The UI implements a "hardware rack" metaphor:

- **SVG noise overlay** at 3% opacity mimics matte studio hardware finish
- **Machined glass cards** with `backdrop-filter: blur(10px)` and inset cover shadows
- **Kinetic hover** — cards lift 8px and scale 2% with smooth deceleration easing
- **Bottom-up gold flare** with `mix-blend-mode: screen` creates a light-leak effect
- **Glassmorphism player bar** with `blur(24px)` backdrop creates depth separation

## Getting Started

```bash
cd sovereign-media
npm install
npm start
```

## Tech Stack

- **Electron** — Desktop runtime
- **music-metadata** — ID3 tag parser
- **epub.js** — EPUB rendering engine
- **video.js** — Video player controls
- **Node.js** — `crypto`, `fs`, `path`

## License

MIT
