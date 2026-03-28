# Space Mish

**Your iPad becomes the cockpit. Your machines become execution nodes.**

Space Mish is a browser-first device control hub that makes your iPad (or any browser) the main command center while Windows and macOS machines act as always-on execution hosts.

## What it does

- **Device Discovery** — Automatically finds devices on your LAN via mDNS
- **Clipboard Sync** — Read/write clipboard across devices
- **File Browser** — Browse, upload, download files on remote machines
- **Browser Terminal** — Full shell access from any browser
- **Project Launcher** — Save projects and launch code-server workspaces
- **Remote View** — Optional full desktop streaming (beta)
- **PWA** — Install as an app on your iPad

## Architecture

```
[iPad / iPhone / Browser]
        |
        | HTTPS + WebSocket on LAN
        v
[Space Mish Hub]  ←── SQLite + WebSocket + mDNS
        |
        +──→ [Windows Agent]  (clipboard, files, terminal, code-server)
        |
        +──→ [macOS Agent]    (clipboard, files, terminal, code-server)
```

## Quick Start

```bash
# Clone and install
cd space-mish
npm install

# Start the hub + web app
npm run dev

# On each device, start the agent
npm run dev:agent:macos   # on macOS
npm run dev:agent:windows # on Windows
```

Then open `http://<hub-ip>:3000` on your iPad.

## Project Structure

```
space-mish/
├── apps/web/          # Next.js PWA (the browser UI)
├── agents/
│   ├── hub/           # Central hub service (Express + WS + SQLite)
│   ├── macos/         # macOS host agent
│   └── windows/       # Windows host agent
├── packages/shared/   # Shared TypeScript types
└── docs/              # Documentation
```

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `HUB_PORT` | 3001 | Hub API/WS port |
| `NEXT_PUBLIC_HUB_URL` | http://localhost:3001 | Hub URL for web app |
| `AGENT_PORT` | 3002 | Agent HTTP port |
| `AGENT_APPROVED_DIRS` | ~ | Comma-separated directories the agent exposes |

## Design

Space Mish uses a **cosmic cockpit** aesthetic — deep space navy blues, crisp whites, and electric cyan accents. The UI is optimized for iPad touch targets with glassmorphic cards and subtle star field effects.

**Typography**: Outfit (display) + Plus Jakarta Sans (body) + JetBrains Mono (code)

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, xterm.js
- **Hub**: Express, WebSocket, better-sqlite3, bonjour-service
- **Agents**: Node.js, node-pty, platform-native clipboard
- **Discovery**: mDNS / Bonjour

## Security

v1 runs in **LAN-only mode with no authentication**. The architecture supports adding auth later. Filesystem access is limited to approved directories.

## License

MIT
