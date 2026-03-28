// ─── Device ──────────────────────────────────────────────────────
export interface Device {
  id: string;
  name: string;
  hostname: string;
  os: 'windows' | 'macos' | 'linux';
  localIp: string;
  lastSeenAt: string;
  online: boolean;
  capabilities: DeviceCapabilities;
  tags: string[];
  preferred: boolean;
  notes: string;
  agentPort: number;
}

export interface DeviceCapabilities {
  clipboardRead: boolean;
  clipboardWrite: boolean;
  files: boolean;
  terminal: boolean;
  codeServer: boolean;
  remoteView: boolean;
}

// ─── Project ─────────────────────────────────────────────────────
export interface Project {
  id: string;
  deviceId: string;
  name: string;
  path: string;
  repoUrl?: string;
  codeServerEnabled: boolean;
  codeServerPort?: number;
  startupCommand?: string;
  workingDir?: string;
  env: Record<string, string>;
  icon?: string;
  sortOrder: number;
}

// ─── Shortcut ────────────────────────────────────────────────────
export type ShortcutType = 'app' | 'folder' | 'script' | 'url' | 'command';

export interface Shortcut {
  id: string;
  deviceId: string;
  name: string;
  type: ShortcutType;
  target: string;
  args: string[];
  icon?: string;
}

// ─── Session ─────────────────────────────────────────────────────
export type SessionType = 'terminal' | 'remote' | 'code';
export type SessionStatus = 'active' | 'idle' | 'closed';

export interface Session {
  id: string;
  deviceId: string;
  type: SessionType;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
}

// ─── Clipboard ───────────────────────────────────────────────────
export type ClipboardDirection = 'read' | 'write';

export interface ClipboardEntry {
  id: string;
  deviceId: string;
  direction: ClipboardDirection;
  mime: string;
  textPreview: string;
  createdAt: string;
}

// ─── File System ─────────────────────────────────────────────────
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  mime?: string;
}

// ─── Settings ────────────────────────────────────────────────────
export interface AppSettings {
  key: string;
  value: unknown;
}

// ─── WebSocket Events ────────────────────────────────────────────
export type WSEventType =
  | 'device:online'
  | 'device:offline'
  | 'device:updated'
  | 'devices:list'
  | 'clipboard:synced'
  | 'terminal:data'
  | 'terminal:resize'
  | 'session:created'
  | 'session:closed'
  | 'discovery:found'
  | 'discovery:lost';

export interface WSMessage<T = unknown> {
  event: WSEventType;
  data: T;
  timestamp: string;
}

// ─── API Responses ───────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─── Command Palette ─────────────────────────────────────────────
export type CommandType = 'open-folder' | 'run-script' | 'open-terminal' | 'restart-agent' | 'launch-code' | 'copy-info' | 'open-remote';

export interface Command {
  id: string;
  label: string;
  type: CommandType;
  deviceId?: string;
  target?: string;
  icon?: string;
  shortcut?: string;
}

// ─── Agent Capability Document ───────────────────────────────────
export interface AgentCapabilityDoc {
  deviceId: string;
  name: string;
  os: Device['os'];
  online: boolean;
  capabilities: DeviceCapabilities;
  paths: {
    home: string;
    projectsRoot: string;
  };
  version: string;
  agentPort: number;
}
