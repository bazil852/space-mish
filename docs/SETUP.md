# Space Mish — Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+

## 1. Install Dependencies

```bash
cd space-mish
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your preferences
```

## 3. Start the Hub

The hub runs on your always-on LAN machine (can be the same machine as an agent):

```bash
npm run dev:hub
# Starts on port 3001
```

## 4. Start the Web App

```bash
npm run dev:web
# Starts on port 3000
```

Or start both together:

```bash
npm run dev
```

## 5. Install Agents on Target Devices

### macOS

```bash
cd agents/macos
npm install
npm run dev
```

**Required permissions:**
- **Terminal**: No special permissions needed
- **Clipboard**: Works out of the box
- **Files**: Access limited to approved directories
- **Remote View**: Requires **System Preferences → Privacy → Screen Recording** permission
- **Remote Input**: Requires **System Preferences → Privacy → Accessibility** permission

### Windows

```bash
cd agents\windows
npm install
npm run dev
```

**Notes:**
- PowerShell clipboard access works by default
- Terminal defaults to PowerShell; cmd.exe and WSL are optional profiles
- File paths use drive letters (e.g., `C:\Users`, `D:\Projects`)
- Remote UI may encounter UAC limitations for elevated prompts

## 6. Install code-server (Optional)

For browser-based VS Code:

```bash
# macOS
brew install code-server

# Windows (via npm)
npm install -g code-server

# Verify
code-server --version
```

The agent will detect code-server automatically and manage its lifecycle.

## 7. Access from iPad

1. Open Safari on your iPad
2. Navigate to `http://<hub-ip>:3000`
3. Tap **Share → Add to Home Screen** to install as PWA
4. Devices should appear automatically within 5 seconds

## Troubleshooting

### Devices not appearing
- Ensure hub and agents are on the same LAN
- Check that mDNS/Bonjour is not blocked by firewall
- Try manual device registration via the hub API

### Terminal not connecting
- Verify the agent is running on the target device
- Check WebSocket connectivity: `ws://<hub-ip>:3001`

### code-server not starting
- Run `code-server --version` on the target device
- Check that the port isn't already in use
- Review agent logs for errors

### Clipboard access denied (macOS)
- Grant Terminal.app (or the terminal you use) access in System Preferences → Privacy → Automation
