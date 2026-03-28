# Space Mish — Architecture

## Overview

Space Mish follows a **hub-and-spoke** architecture where a central hub service coordinates between browser clients and device agents.

## Components

### Web App (`apps/web`)
- Next.js 14 with App Router
- Client-side rendering for real-time updates
- WebSocket connection to hub for live state
- PWA-capable with offline-aware UI
- Proxies API calls to hub via Next.js rewrites

### Hub Service (`agents/hub`)
- **Express** HTTP server for REST API
- **WebSocket** server for real-time events (device presence, terminal data, clipboard sync)
- **SQLite** database for device registry, projects, clipboard history, settings
- **mDNS discovery** using bonjour-service to find agents on LAN
- Routes incoming requests to the correct device agent

### Device Agents (`agents/macos`, `agents/windows`)
- Lightweight Express server running on each managed device
- Exposes typed REST API matching the capability contract
- Advertises itself via mDNS
- Platform-specific implementations:
  - **Clipboard**: `pbcopy/pbpaste` (macOS) or PowerShell `Get-Clipboard/Set-Clipboard` (Windows)
  - **Terminal**: node-pty spawning platform-native shell
  - **Files**: Node.js `fs` with path validation against approved directories
  - **Code Server**: Manages code-server lifecycle

### Shared Types (`packages/shared`)
- TypeScript type definitions shared across all packages
- Device, Project, Session, Clipboard, WebSocket event types
- API response contracts

## Data Flow

### Device Discovery
1. Agent starts → advertises via mDNS (`_spacemish._tcp`)
2. Hub discovers agent → reads TXT records → upserts in SQLite
3. Hub broadcasts `device:online` via WebSocket
4. Browser receives event → updates UI

### Command Execution (e.g., clipboard read)
1. Browser → `POST /api/clipboard/read/:deviceId` → Hub
2. Hub looks up agent IP:port from SQLite
3. Hub → `POST /clipboard/read` → Agent
4. Agent executes `pbpaste` → returns text
5. Hub → Browser (with result)

### Terminal Sessions
1. Browser requests terminal → Hub creates session → Agent spawns PTY
2. WebSocket relay: Browser ↔ Hub ↔ Agent PTY
3. xterm.js renders output, captures input

## Design Decisions

- **Node.js agents** over Rust for v1 — faster to ship, same capability
- **SQLite** over Postgres — zero-config, single-file, perfect for local hub
- **Hub proxy pattern** — browser only talks to hub, never directly to agents
- **mDNS primary** — zero-config LAN discovery, UDP broadcast fallback
- **No auth in v1** — LAN-only trust model, architecture ready for future auth layer
- **PWA** — installable on iPad without App Store

## Port Allocation

| Service | Default Port |
|---------|-------------|
| Web App | 3000 |
| Hub API/WS | 3001 |
| Agent | 3002 |
| code-server | 8080+ |
