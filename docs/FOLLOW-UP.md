# Space Mish — Follow-up Tasks

Items deferred from v1 that should be addressed in future iterations.

## High Priority

- [ ] **Real WebRTC remote view** — Current remote view module is a placeholder. Implement actual screen capture + WebRTC streaming for macOS and Windows
- [ ] **node-pty native build** — node-pty requires native compilation. Add proper build scripts and prebuild binaries for macOS/Windows
- [ ] **Agent auto-update mechanism** — Currently agents must be updated manually
- [ ] **PWA service worker** — Add offline caching and background sync
- [ ] **HTTPS/TLS on LAN** — Self-signed cert generation for encrypted local traffic

## Medium Priority

- [ ] **Authentication layer** — Token-based auth for when the hub is exposed beyond LAN
- [ ] **File preview** — Image thumbnails, text file preview, PDF rendering in the file browser
- [ ] **Terminal session persistence** — Reconnect to existing terminal sessions after browser refresh
- [ ] **Drag-and-drop file upload** — iPad-friendly file upload with drag and drop
- [ ] **Multi-file transfer** — Batch file downloads as zip
- [ ] **clipboard image support** — Currently text-only; extend to images
- [ ] **Agent health dashboard** — CPU, memory, disk usage per device
- [ ] **Keyboard shortcuts** — Global shortcuts for power users (Cmd+K already works for command palette)

## Low Priority

- [ ] **Tailscale/VPN integration** — Secure remote access beyond LAN
- [ ] **Notification system** — Agent offline alerts, command completion notifications
- [ ] **Theme customization** — User-selectable themes beyond the cosmic default
- [ ] **Project templates** — Quick-start templates for common project types
- [ ] **Agent plugins** — Extensible capability system for custom agent features
- [ ] **Docker deployment** — Containerized hub for easy deployment
- [ ] **Tests** — Unit tests for hub routes, integration tests for agent capabilities
- [ ] **Linux agent** — Full Linux support (partial via macOS agent already)

## Known Limitations

- Remote UI is a placeholder in v1 — no actual screen streaming
- Agent discovery relies on mDNS which may not work across VLANs
- No authentication in LAN mode (by design for v1)
- code-server management assumes it's already installed on the host
- Windows clipboard uses PowerShell which may be slow for large content
