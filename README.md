# Sovereign Media

**Operator-grade all-in-one desktop media platform for the VERITAS & Sovereign Ecosystem.**

![Electron](https://img.shields.io/badge/Electron-30.x-47848F?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-C5A365?style=flat-square) ![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?style=flat-square) ![Status](https://img.shields.io/badge/Status-Stable-gold?style=flat-square)

---

## Ecosystem Canon

Sovereign Media is the primary media consumption node within the Omega Universe — a purpose-built Electron application engineered to consolidate audiobook, eBook, and video playback into a single, sovereign operator environment. It operates entirely offline and on-device; no cloud dependency, no telemetry, no third-party handshakes. The application maintains persistent session state across all media types, ensuring the operator resumes with full fidelity at any re-entry point. Architecturally, Sovereign Media is not a wrapper around a browser media stack — it is a hardened desktop runtime with IPC-isolated renderer processes, a ghost-executable launcher for clean system identity, and a mobile-remote bridge for secondary-screen control. Within the Omega operator stack, it serves as the canonical media layer, complementing the intelligence infrastructure provided by Aegis, omega-brain-mcp, and Ollama-Omega.

---

## Overview

Sovereign Media delivers a unified audiobook, eBook, and video library in a single Electron shell. Operators point the scanner at local media directories; the application indexes metadata, extracts cover art, and persists playback position across sessions. The interface enforces the Gold & Obsidian VERITAS aesthetic — machined, zero-noise, built for long operational runs.

---

## Features

| Feature | Description |
|---|---|
| **Audiobook Player** | Full-featured audio playback with chapter navigation, ID3 metadata, cover art, and position persistence |
| **eBook Reader** | epub.js-powered renderer with paginated and scroll modes, typography controls, and reading progress |
| **Video Player** | HTML5 native video with position memory and thumbnail generation |
| **YouTube Music** | Embedded operator web player for streaming |
| **3-Tab Navigation** | Audio / Books / Video with seamless context switching |
| **Position Persistence** | Session state saved per media item across all types; resume exactly where you left off |
| **Library Management** | Folder-based scanner with automatic metadata extraction and cover art fetching |
| **Mobile Remote** | Local network bridge with QR code pairing for secondary-screen control |
| **System Tray Integration** | Minimize to tray; single-instance lock prevents duplicate processes |
| **Ghost Launcher** | Custom executable identity in Task Manager via `launcher.js` |

---

## Architecture

```
+------------------------------------------------------------------+
|                        SOVEREIGN MEDIA                           |
|                      (Electron 30.x Shell)                       |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    Renderer Process                        |  |
|  |   +----------+   +----------+   +--------------------+    |  |
|  |   |  Audio   |   |  Books   |   |       Video        |    |  |
|  |   |  Tab     |   |  Tab     |   |       Tab          |    |  |
|  |   | HTML5    |   | epub.js  |   |   HTML5 Video      |    |  |
|  |   | Audio API|   | renderer |   |   + video.js       |    |  |
|  |   +-----+----+   +-----+----+   +----------+---------+    |  |
|  +---------|--------------|--------------------|--------------+  |
|            |   contextBridge / preload.js      |                 |
|  +---------|--------------|--------------------|--------------+  |
|  |         |        Main Process               |              |  |
|  |   +-----v--------------v-------------------v-----------+  |  |
|  |   |              IPC Handlers (main.js)                 |  |  |
|  |   |   fs / crypto / dialog / music-metadata             |  |  |
|  |   +----------------------+---------------------------------+  |  |
|  |                          |                              |  |  |
|  |   +----------------------v------------------------------+  |  |
|  |   |        Persistent Storage (userData)                |  |  |
|  |   |  omega_audio_library.json                           |  |  |
|  |   |  sovereign_book_library.json                        |  |  |
|  |   |  sovereign_video_library.json                       |  |  |
|  |   |  covers/  book_covers/  thumbnails/                 |  |  |
|  |   +-----------------------------------------------------+  |  |
|  |                                                             |  |
|  |   +-----------------------------------------------------+  |  |
|  |   |     Mobile Remote Bridge (mobile_remote.js)         |  |  |
|  |   |     Express + Socket.IO + localtunnel + QR          |  |  |
|  |   +-----------------------------------------------------+  |  |
|  +-------------------------------------------------------------+  |
|                                                                  |
|  launcher.js -- Ghost Executable Identity (SovereignMedia.exe)  |
+------------------------------------------------------------------+
```

**Runtime dependency stack:**

| Layer | Library | Role |
|---|---|---|
| Shell | Electron 30.x | Window management, IPC, file system access |
| Audio | HTML5 Audio API + music-metadata | Audiobook playback, ID3 parsing, cover art |
| Books | epub.js (epubjs) | EPUB rendering, pagination, bookmarks |
| Video | HTML5 Video + video.js | Native video playback with controls |
| Remote | Express + Socket.IO + localtunnel + qrcode | Mobile LAN bridge |
| Storage | JSON files (userData) | Position persistence, library index |
| Archive | adm-zip | ZIP/archive operations |

---

## Quickstart

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (bundled with Node.js)
- **Windows** (the ghost launcher targets `electron.exe`; macOS/Linux skip that step gracefully)

### Install

```bash
git clone https://github.com/VrtxOmega/SovereignMedia.git
cd SovereignMedia
npm install
```

### Run

```bash
npm start
```

`npm start` invokes `node launcher.js`, which creates a named ghost executable (`SovereignMedia.exe`) and spawns Electron against the project root.

For verbose logging and Node.js inspector:

```bash
node launcher.js --dev
```

### Build / Package

Packaging is operator-managed. To produce a distributable using `electron-builder`, install it and configure it against `main.js` as the entry point:

```bash
# Install electron-builder (one-time)
npm install --save-dev electron-builder

# Build Windows installer
npx electron-builder --win
```

No pre-configured build script is included in `package.json`; operators should add one matching their target platform and signing workflow.

---

## Configuration

Sovereign Media stores all runtime data in the Electron `userData` directory (typically `%APPDATA%\sovereign-media` on Windows):

| File / Directory | Purpose |
|---|---|
| `omega_audio_library.json` | Audiobook library index and playback positions |
| `sovereign_book_library.json` | eBook library index, bookmarks, reading progress |
| `sovereign_video_library.json` | Video library index and playback positions |
| `covers/` | Extracted audiobook cover art cache |
| `book_covers/` | Extracted eBook cover art cache |
| `thumbnails/` | Video thumbnail cache |

No `.env` file or external configuration is required for standard operation. The application resolves all paths relative to `userData` at runtime.

**Mobile Remote:** When enabled, the mobile bridge starts a local Express server and optionally establishes a `localtunnel` connection. A QR code is generated for pairing. No credentials are required; access is proximity-based via local network or tunnel URL.

---

## Security & Sovereignty

- **Fully offline by default.** No analytics, no telemetry, no outbound calls unless the mobile remote bridge is explicitly activated by the operator.
- **Single-instance enforcement.** Electron's `requestSingleInstanceLock` prevents duplicate processes and associated resource contention.
- **Context isolation enabled.** The renderer runs with `contextIsolation: true` and `nodeIntegration: false`; all Node.js access is brokered through `preload.js` via `contextBridge`.
- **Local storage only.** All library data is written to `userData` on the operator's machine. No cloud sync, no remote index.
- **Mobile bridge advisory.** The `localtunnel` integration exposes a local port to a public relay for remote access. Operators should disable the mobile remote in high-security environments or restrict to LAN-only mode.

> This section describes the current architectural posture. It is not a security guarantee or warranty. Operators are responsible for their own environment hardening.

---

## Roadmap

The following capabilities are under consideration for future operator-authorized releases:

- Hardened mobile remote with token-based authentication
- Electron auto-updater integration
- Playlist and queue management across media types
- Per-library encryption at rest
- Native macOS / Linux launcher parity
- Plugin architecture for additional media type support

> The core application is currently in sealed/stable operation. Roadmap items are proposals only and subject to operator authorization before implementation.

---

## Omega Universe

Sovereign Media is one node in the Omega operator ecosystem. Related repositories:

| Repository | Role |
|---|---|
| [sovereign-arcade](https://github.com/VrtxOmega/sovereign-arcade) | Operator gaming layer |
| [drift](https://github.com/VrtxOmega/drift) | Real-time telemetry and drift monitoring |
| [omega-brain-mcp](https://github.com/VrtxOmega/omega-brain-mcp) | AI inference orchestration (MCP server) |
| [Ollama-Omega](https://github.com/VrtxOmega/Ollama-Omega) | Local LLM runtime integration |
| [Aegis](https://github.com/VrtxOmega/Aegis) | Security and access control layer |
| [aegis-rewrite](https://github.com/VrtxOmega/aegis-rewrite) | Next-generation Aegis architecture |
| [veritas-vault](https://github.com/VrtxOmega/veritas-vault) | Encrypted credential and secrets store |

---

## License

MIT — see [LICENSE](./LICENSE) for full terms.

---

<div align="center">
  <sub>SOVEREIGN MEDIA — VERITAS &amp; Omega Universe | Built by <a href="https://github.com/VrtxOmega">RJ Lopez</a></sub>
</div>
