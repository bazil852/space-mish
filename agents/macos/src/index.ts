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
  browseDirectory, uploadFile, downloadStream, moveFile, deleteFile, getFileInfo,
} from './files';
import {
  createSession, getSession, closeSession, closeAllSessions,
  listSessions, resizeSession, writeToSession,
} from './terminal';
import { advertiseAgent, stopAdvertising } from './discovery';
import { discoverProjects, discoverProjectsDeep } from './projects';
import {
  isInstalled as isCodeServerInstalled, startCodeServer, stopCodeServer, getRunningInstances,
} from './code-server';
import { captureScreenshot, getScreenSize, injectInput, type InputEvent } from './remote';

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

function ok<T>(data: T): ApiResponse<T> { return { ok: true, data }; }
function fail(error: string, _statusCode: number = 500): ApiResponse { return { ok: false, error }; }

function expandHome(p: string): string {
  if (p === '~' || p === '~/') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '0.0.0.0';
}

// ─── Health & Capabilities ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json(ok({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() }));
});

app.get('/capabilities', (_req, res) => {
  const doc: AgentCapabilityDoc = {
    deviceId: DEVICE_ID, name: DEVICE_NAME, os: 'macos', online: true,
    capabilities: {
      clipboardRead: true, clipboardWrite: true, files: true,
      terminal: true, codeServer: isCodeServerInstalled(), remoteView: true,
    },
    paths: { home: os.homedir(), projectsRoot: path.join(os.homedir(), 'Documents') },
    version: AGENT_VERSION, agentPort: AGENT_PORT,
  };
  res.json(ok(doc));
});

// ─── File Routes ─────────────────────────────────────────────────
app.get('/files', async (req, res) => {
  try {
    const dirPath = expandHome((req.query.path as string) || '~');
    res.json(ok(await browseDirectory(dirPath)));
  } catch (err) { res.status(400).json(fail(err instanceof Error ? err.message : String(err), 400)); }
});

app.post('/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.body.path) { res.status(400).json(fail('Missing target path', 400)); return; }
    if (!req.file) { res.status(400).json(fail('No file uploaded', 400)); return; }
    res.json(ok(await uploadFile(req.file.buffer, expandHome(req.body.path))));
  } catch (err) { res.status(400).json(fail(err instanceof Error ? err.message : String(err), 400)); }
});

app.get('/files/download', async (req, res) => {
  try {
    const resolved = expandHome(req.query.path as string);
    if (!resolved) { res.status(400).json(fail('Missing file path', 400)); return; }
    const info = await getFileInfo(resolved);
    res.setHeader('Content-Disposition', `attachment; filename="${info.name}"`);
    if (info.mime) res.setHeader('Content-Type', info.mime);
    downloadStream(resolved).pipe(res);
  } catch (err) { res.status(400).json(fail(err instanceof Error ? err.message : String(err), 400)); }
});

app.post('/files/move', async (req, res) => {
  try {
    const { source, destination } = req.body;
    if (!source || !destination) { res.status(400).json(fail('Missing source or destination', 400)); return; }
    res.json(ok(await moveFile(expandHome(source), expandHome(destination))));
  } catch (err) { res.status(400).json(fail(err instanceof Error ? err.message : String(err), 400)); }
});

app.delete('/files', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json(fail('Missing file path', 400)); return; }
    await deleteFile(expandHome(filePath));
    res.json(ok({ deleted: filePath }));
  } catch (err) { res.status(400).json(fail(err instanceof Error ? err.message : String(err), 400)); }
});

// ─── Clipboard Routes ────────────────────────────────────────────
app.post('/clipboard/read', (_req, res) => {
  try { res.json(ok({ text: readClipboard() })); }
  catch (err) { res.status(500).json(fail(err instanceof Error ? err.message : String(err))); }
});

app.post('/clipboard/write', (req, res) => {
  try {
    if (typeof req.body.text !== 'string') { res.status(400).json(fail('Missing text field', 400)); return; }
    writeClipboard(req.body.text);
    res.json(ok({ written: true }));
  } catch (err) { res.status(500).json(fail(err instanceof Error ? err.message : String(err))); }
});

// ─── Terminal Routes ─────────────────────────────────────────────
app.post('/terminal/create', (req, res) => {
  try {
    const { shell, cols, rows } = req.body || {};
    const session = createSession(shell, cols, rows);
    res.json(ok({ sessionId: session.id, shell: session.shell, createdAt: session.createdAt }));
  } catch (err) { res.status(500).json(fail(err instanceof Error ? err.message : String(err))); }
});

app.get('/terminal/sessions', (_req, res) => { res.json(ok(listSessions())); });

app.delete('/terminal/:sessionId', (req, res) => {
  const closed = closeSession(req.params.sessionId);
  closed ? res.json(ok({ closed: req.params.sessionId })) : res.status(404).json(fail('Session not found', 404));
});

// ─── Session Manager Routes ─────────────────────────────────────
app.get('/sessions', (_req, res) => {
  res.json(ok({ terminals: listSessions(), codeServers: getRunningInstances() }));
});

app.delete('/sessions/terminal/:id', (req, res) => { res.json(ok({ closed: closeSession(req.params.id) })); });
app.delete('/sessions/terminals', (_req, res) => { res.json(ok({ killed: closeAllSessions() })); });
app.delete('/sessions/code/:port', (req, res) => { res.json(ok({ stopped: stopCodeServer(parseInt(req.params.port, 10)) })); });

app.delete('/sessions/all', (_req, res) => {
  const termCount = closeAllSessions();
  let codeCount = 0;
  for (const inst of getRunningInstances()) { stopCodeServer(inst.port); codeCount++; }
  res.json(ok({ terminalsKilled: termCount, codeServersKilled: codeCount }));
});

// ─── Project Routes ──────────────────────────────────────────────
app.get('/projects', (req, res) => {
  const projects = req.query.deep === 'true' ? discoverProjectsDeep() : discoverProjects();
  res.json(ok(projects));
});

app.get('/projects/sessions', (_req, res) => { res.json(ok(getRunningInstances())); });

app.post('/projects/open-code', (req, res) => {
  try {
    const { projectPath, port } = req.body;
    if (!projectPath) { res.status(400).json(fail('Missing projectPath', 400)); return; }
    const assignedPort = port || (8080 + getRunningInstances().length);
    const result = startCodeServer(expandHome(projectPath), assignedPort);
    const networkUrl = `http://${getLocalIp()}:${assignedPort}`;
    res.json(ok({ ...result, url: networkUrl, networkUrl }));
  } catch (err) { res.status(500).json(fail(err instanceof Error ? err.message : String(err))); }
});

app.post('/projects/stop-code', (req, res) => {
  if (!req.body.port) { res.status(400).json(fail('Missing port', 400)); return; }
  res.json(ok({ stopped: stopCodeServer(req.body.port) }));
});

// ─── Command Route ───────────────────────────────────────────────
app.post('/commands/run', (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) { res.status(400).json(fail('Missing command', 400)); return; }
    const cmdString = args && Array.isArray(args) ? `${command} ${args.join(' ')}` : command;
    const output = execSync(cmdString, { encoding: 'utf-8', timeout: 30000, cwd: os.homedir() });
    res.json(ok({ command: cmdString, output }));
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message?: string };
    res.status(500).json(fail(execErr.stderr || execErr.message || String(err)));
  }
});

// ─── Remote View Routes ─────────────────────────────────────────
app.get('/remote/screenshot', (req, res) => {
  const quality = parseInt((req.query.quality as string) || '50', 10);
  const buffer = captureScreenshot(quality);
  if (buffer) { res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'no-cache'); res.send(buffer); }
  else { res.status(500).json(fail('Screenshot capture failed')); }
});

app.get('/remote/screen-info', (_req, res) => { res.json(ok(getScreenSize())); });

app.post('/remote/input', (req, res) => {
  try {
    if (!req.body.action) { res.status(400).json(fail('Missing action')); return; }
    injectInput(req.body as InputEvent);
    res.json(ok({ injected: true }));
  } catch (err) { res.status(500).json(fail(err instanceof Error ? err.message : String(err))); }
});

// ─── WebSocket: Terminal + Remote ────────────────────────────────
const terminalWss = new WebSocketServer({ noServer: true });
const remoteWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';

  if (url.startsWith('/remote/stream')) {
    remoteWss.handleUpgrade(req, socket, head, (ws) => { remoteWss.emit('connection', ws, req); });
    return;
  }

  const match = url.match(/^\/terminal\/([a-f0-9-]+)$/);
  if (!match) { socket.destroy(); return; }
  const session = getSession(match[1]);
  if (!session) { socket.destroy(); return; }
  terminalWss.handleUpgrade(req, socket, head, (ws) => { terminalWss.emit('connection', ws, req, match[1]); });
});

// Remote stream
remoteWss.on('connection', (ws: WebSocket) => {
  console.log('[remote] Stream client connected');
  let streaming = true;
  let quality = 40;
  let interval = 300;

  const streamLoop = async () => {
    while (streaming && ws.readyState === WebSocket.OPEN) {
      try {
        const frame = captureScreenshot(quality);
        if (frame && ws.readyState === WebSocket.OPEN) ws.send(frame);
      } catch {}
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  };

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input') injectInput(msg.event as InputEvent);
      else if (msg.type === 'settings') {
        if (msg.quality) quality = Math.max(10, Math.min(90, msg.quality));
        if (msg.fps) interval = Math.max(100, Math.round(1000 / msg.fps));
      }
    } catch {}
  });

  ws.on('close', () => { streaming = false; console.log('[remote] Stream client disconnected'); });
  ws.on('error', () => { streaming = false; });
  streamLoop();
});

// Terminal stream
terminalWss.on('connection', (ws: WebSocket, _req: unknown, sessionId: string) => {
  const session = getSession(sessionId);
  if (!session) { ws.close(1008, 'Session not found'); return; }

  const dataHandler = session.pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'terminal:data', data }));
  });

  const exitHandler = session.pty.onExit(({ exitCode, signal }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'terminal:exit', data: { exitCode, signal } }));
      ws.close(1000, 'Process exited');
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'terminal:data' && typeof msg.data === 'string') writeToSession(sessionId, msg.data);
      else if (msg.event === 'terminal:resize' && msg.data) {
        const { cols, rows } = msg.data;
        if (typeof cols === 'number' && typeof rows === 'number') resizeSession(sessionId, cols, rows);
      }
    } catch {}
  });

  ws.on('close', () => {
    dataHandler.dispose();
    exitHandler.dispose();
    closeSession(sessionId);
    console.log(`[terminal] Session ${sessionId} closed and PTY killed`);
  });
});

// ─── Startup ─────────────────────────────────────────────────────
server.listen(AGENT_PORT, async () => {
  console.log(`[space-mish] macOS agent started`);
  console.log(`[space-mish] Device ID : ${DEVICE_ID}`);
  console.log(`[space-mish] Device    : ${DEVICE_NAME}`);
  console.log(`[space-mish] IP        : ${getLocalIp()}`);
  console.log(`[space-mish] Listening : http://0.0.0.0:${AGENT_PORT}`);

  try {
    await advertiseAgent({
      deviceId: DEVICE_ID, deviceName: DEVICE_NAME, version: AGENT_VERSION,
      port: AGENT_PORT,
      capabilities: ['clipboard', 'files', 'terminal', 'projects', 'code-server', 'remote-view'],
      hubUrl: HUB_URL,
    });
  } catch (err) {
    console.warn(`[space-mish] Discovery advertising failed: ${err instanceof Error ? err.message : err}`);
  }
});

// ─── Graceful Shutdown ───────────────────────────────────────────
function shutdown() {
  console.log('\n[space-mish] Shutting down...');
  stopAdvertising();
  closeAllSessions();
  for (const inst of getRunningInstances()) stopCodeServer(inst.port);
  server.close(() => { console.log('[space-mish] Agent stopped'); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
