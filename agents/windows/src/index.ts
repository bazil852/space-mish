import 'dotenv/config';
import * as os from 'os';
import * as crypto from 'crypto';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { execSync } from 'child_process';

import { readClipboard, writeClipboard } from './clipboard';
import {
  browseDirectory,
  uploadFile,
  downloadStream,
  moveFile,
  deleteFile,
  getFileInfo,
  isPathApproved,
} from './files';
import {
  createSession,
  getSession,
  closeSession,
  listSessions,
  resizeSession,
  writeToSession,
} from './terminal';
import { advertiseAgent, stopAdvertising } from './discovery';
import {
  discoverProjects,
  discoverProjectsDeep,
  type DiscoveredProject,
} from './projects';
import {
  isInstalled as isCodeServerInstalled,
  startCodeServer,
  stopCodeServer,
  getRunningInstances,
} from './code-server';
import {
  captureScreenshot,
  getScreenSize,
  injectInput,
  initRemote,
  type InputEvent,
} from './remote';

import type { AgentCapabilityDoc, ApiResponse } from '../../../packages/shared/src/types';

// ─── Config ──────────────────────────────────────────────────────
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '3002', 10);
const AGENT_VERSION = '1.0.0';
const DEVICE_ID = crypto.createHash('sha256').update(os.hostname()).digest('hex').slice(0, 12);
const DEVICE_NAME = process.env.AGENT_DEVICE_NAME || os.hostname();
const HUB_URL = process.env.AGENT_HUB_URL || process.env.HUB_URL;

// ─── Express + HTTP Server ───────────────────────────────────────
const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ─── Helpers ─────────────────────────────────────────────────────
function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

function fail(error: string, statusCode: number = 500): ApiResponse {
  return { ok: false, error };
}

// ─── Health & Capabilities ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json(ok({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));
});

app.get('/capabilities', (_req, res) => {
  const doc: AgentCapabilityDoc = {
    deviceId: DEVICE_ID,
    name: DEVICE_NAME,
    os: 'windows',
    online: true,
    capabilities: {
      clipboardRead: true,
      clipboardWrite: true,
      files: true,
      terminal: true,
      codeServer: isCodeServerInstalled(),
      remoteView: false,
    },
    paths: {
      home: os.homedir(),
      projectsRoot: path.join(os.homedir(), 'Projects'),
    },
    version: AGENT_VERSION,
    agentPort: AGENT_PORT,
  };
  res.json(ok(doc));
});

// ─── Helpers: resolve ~ to home dir ─────────────────────────────
function expandHome(p: string): string {
  if (p === '~' || p === '~/') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

// ─── File Routes ─────────────────────────────────────────────────
app.get('/files', async (req, res) => {
  try {
    const rawPath = (req.query.path as string) || '~';
    const dirPath = expandHome(rawPath);
    const entries = await browseDirectory(dirPath);
    res.json(ok(entries));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json(fail(message, 400));
  }
});

app.post('/files/upload', upload.single('file'), async (req, res) => {
  try {
    const targetPath = req.body.path as string;
    if (!targetPath) {
      res.status(400).json(fail('Missing target path', 400));
      return;
    }
    if (!req.file) {
      res.status(400).json(fail('No file uploaded', 400));
      return;
    }
    const entry = await uploadFile(req.file.buffer, expandHome(targetPath));
    res.json(ok(entry));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json(fail(message, 400));
  }
});

app.get('/files/download', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json(fail('Missing file path', 400));
      return;
    }
    const resolved = expandHome(filePath);
    const info = await getFileInfo(resolved);
    res.setHeader('Content-Disposition', `attachment; filename="${info.name}"`);
    if (info.mime) {
      res.setHeader('Content-Type', info.mime);
    }
    const stream = downloadStream(resolved);
    stream.pipe(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json(fail(message, 400));
  }
});

app.post('/files/move', async (req, res) => {
  try {
    const { source, destination } = req.body;
    if (!source || !destination) {
      res.status(400).json(fail('Missing source or destination', 400));
      return;
    }
    const entry = await moveFile(expandHome(source), expandHome(destination));
    res.json(ok(entry));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json(fail(message, 400));
  }
});

app.delete('/files', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json(fail('Missing file path', 400));
      return;
    }
    await deleteFile(expandHome(filePath));
    res.json(ok({ deleted: filePath }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json(fail(message, 400));
  }
});

// ─── Clipboard Routes ────────────────────────────────────────────
app.post('/clipboard/read', (_req, res) => {
  try {
    const text = readClipboard();
    res.json(ok({ text }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json(fail(message));
  }
});

app.post('/clipboard/write', (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') {
      res.status(400).json(fail('Missing text field', 400));
      return;
    }
    writeClipboard(text);
    res.json(ok({ written: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json(fail(message));
  }
});

// ─── Terminal Routes ─────────────────────────────────────────────
app.post('/terminal/create', (req, res) => {
  try {
    const { shell, cols, rows } = req.body || {};
    const session = createSession(shell, cols, rows);
    res.json(ok({
      sessionId: session.id,
      shell: session.shell,
      profile: session.profile,
      createdAt: session.createdAt,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json(fail(message));
  }
});

app.get('/terminal/sessions', (_req, res) => {
  res.json(ok(listSessions()));
});

app.delete('/terminal/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const closed = closeSession(sessionId);
  if (closed) {
    res.json(ok({ closed: sessionId }));
  } else {
    res.status(404).json(fail('Session not found', 404));
  }
});

// ─── Project Routes ──────────────────────────────────────────────
// Auto-discover projects from configured directories
app.get('/projects', (req, res) => {
  const deep = req.query.deep === 'true';
  const projects = deep ? discoverProjectsDeep() : discoverProjects();
  res.json(ok(projects));
});

// Get running code-server instances
app.get('/projects/sessions', (_req, res) => {
  res.json(ok(getRunningInstances()));
});

// Launch code-server for a project path
app.post('/projects/open-code', (req, res) => {
  try {
    const { projectPath, port } = req.body;
    if (!projectPath) {
      res.status(400).json(fail('Missing projectPath', 400));
      return;
    }

    // Auto-assign port if not specified (base 8080, increment per instance)
    const assignedPort = port || (8080 + getRunningInstances().length);
    const result = startCodeServer(expandHome(projectPath), assignedPort);

    // Return the URL that's accessible from the network (not localhost)
    const networkUrl = `http://${getLocalIp()}:${assignedPort}`;
    res.json(ok({ ...result, url: networkUrl, networkUrl }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json(fail(message));
  }
});

// Stop a code-server instance
app.post('/projects/stop-code', (req, res) => {
  const { port } = req.body;
  if (!port) {
    res.status(400).json(fail('Missing port', 400));
    return;
  }
  const stopped = stopCodeServer(port);
  res.json(ok({ stopped }));
});

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

// ─── Command Route ───────────────────────────────────────────────
app.post('/commands/run', (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) {
      res.status(400).json(fail('Missing command', 400));
      return;
    }
    const cmdString = args && Array.isArray(args)
      ? `${command} ${args.join(' ')}`
      : command;

    const output = execSync(cmdString, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: os.homedir(),
      shell: 'powershell.exe',
    });
    res.json(ok({ command: cmdString, output }));
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message?: string };
    const message = execErr.stderr || execErr.message || String(err);
    res.status(500).json(fail(message));
  }
});

// ─── Remote View Routes ─────────────────────────────────────────
app.get('/remote/screenshot', (_req, res) => {
  const quality = parseInt((_req.query.quality as string) || '50', 10);
  const buffer = captureScreenshot(quality);
  if (buffer) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } else {
    res.status(500).json(fail('Screenshot capture failed'));
  }
});

app.get('/remote/screen-info', (_req, res) => {
  const size = getScreenSize();
  res.json(ok(size));
});

app.post('/remote/input', (req, res) => {
  try {
    const event = req.body as InputEvent;
    if (!event.action) {
      res.status(400).json(fail('Missing action'));
      return;
    }
    injectInput(event);
    res.json(ok({ injected: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json(fail(message));
  }
});

// ─── WebSocket for Terminal + Remote Streaming ──────────────────
const terminalWss = new WebSocketServer({ noServer: true });
const remoteWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';

  // Match /remote/stream
  if (url.startsWith('/remote/stream')) {
    remoteWss.handleUpgrade(req, socket, head, (ws) => {
      remoteWss.emit('connection', ws, req);
    });
    return;
  }

  // Match /terminal/:sessionId
  const match = url.match(/^\/terminal\/([a-f0-9-]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = match[1];
  const session = getSession(sessionId);
  if (!session) {
    socket.destroy();
    return;
  }

  terminalWss.handleUpgrade(req, socket, head, (ws) => {
    terminalWss.emit('connection', ws, req, sessionId);
  });
});

// ─── Remote Stream WebSocket ────────────────────────────────────
remoteWss.on('connection', (ws: WebSocket) => {
  console.log('[remote] Stream client connected');
  let streaming = true;
  let quality = 40;
  let interval = 300; // ms between frames (~3 FPS)

  const streamLoop = async () => {
    while (streaming && ws.readyState === WebSocket.OPEN) {
      try {
        const frame = captureScreenshot(quality);
        if (frame && ws.readyState === WebSocket.OPEN) {
          ws.send(frame);
        }
      } catch {
        // Skip frame on error
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  };

  // Handle messages from browser (input events + settings)
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input') {
        injectInput(msg.event as InputEvent);
      } else if (msg.type === 'settings') {
        if (msg.quality) quality = Math.max(10, Math.min(90, msg.quality));
        if (msg.fps) interval = Math.max(100, Math.round(1000 / msg.fps));
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    streaming = false;
    console.log('[remote] Stream client disconnected');
  });

  ws.on('error', () => {
    streaming = false;
  });

  // Start streaming
  streamLoop();
});

// ─── Terminal WebSocket ──────────────────────────────────────────
terminalWss.on('connection', (ws: WebSocket, _req: unknown, sessionId: string) => {
  const session = getSession(sessionId);
  if (!session) {
    ws.close(1008, 'Session not found');
    return;
  }

  // Stream pty output to WebSocket
  const dataHandler = session.pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'terminal:data', data }));
    }
  });

  const exitHandler = session.pty.onExit(({ exitCode, signal }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'terminal:exit', data: { exitCode, signal } }));
      ws.close(1000, 'Process exited');
    }
  });

  // Receive input or resize from client
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'terminal:data' && typeof msg.data === 'string') {
        writeToSession(sessionId, msg.data);
      } else if (msg.event === 'terminal:resize' && msg.data) {
        const { cols, rows } = msg.data;
        if (typeof cols === 'number' && typeof rows === 'number') {
          resizeSession(sessionId, cols, rows);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    dataHandler.dispose();
    exitHandler.dispose();
  });
});

// ─── Startup ─────────────────────────────────────────────────────
server.listen(AGENT_PORT, async () => {
  console.log(`[space-mish] Windows agent started`);
  console.log(`[space-mish] Device ID : ${DEVICE_ID}`);
  console.log(`[space-mish] Device    : ${DEVICE_NAME}`);
  console.log(`[space-mish] Listening : http://0.0.0.0:${AGENT_PORT}`);

  // Start mDNS advertising
  try {
    await advertiseAgent({
      deviceId: DEVICE_ID,
      deviceName: DEVICE_NAME,
      version: AGENT_VERSION,
      port: AGENT_PORT,
      capabilities: ['clipboard', 'files', 'terminal', 'projects', 'code-server'],
      hubUrl: HUB_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[space-mish] Discovery advertising failed: ${message}`);
  }
});

// ─── Graceful Shutdown ───────────────────────────────────────────
function shutdown() {
  console.log('\n[space-mish] Shutting down...');
  stopAdvertising();

  // Close all terminal sessions
  for (const s of listSessions()) {
    closeSession(s.id);
  }

  // Stop all code-server instances
  for (const inst of getRunningInstances()) {
    stopCodeServer(inst.port);
  }

  server.close(() => {
    console.log('[space-mish] Agent stopped');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
