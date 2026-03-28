import Database from "better-sqlite3";
import path from "path";
import { v4 as uuid } from "uuid";

// ─── Inline shared types (avoids build-order dependency) ─────────
export interface Device {
  id: string;
  name: string;
  hostname: string;
  os: "windows" | "macos" | "linux";
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

export interface Session {
  id: string;
  deviceId: string;
  type: "terminal" | "remote" | "code";
  status: "active" | "idle" | "closed";
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
}

export interface ClipboardEntry {
  id: string;
  deviceId: string;
  direction: "read" | "write";
  mime: string;
  textPreview: string;
  createdAt: string;
}

export interface Shortcut {
  id: string;
  deviceId: string;
  name: string;
  type: "app" | "folder" | "script" | "url" | "command";
  target: string;
  args: string[];
  icon?: string;
}

// ─── Database initialization ─────────────────────────────────────

const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(__dirname, "..", "hub.db")
);

let _db: Database.Database;

export function initDatabase(): Database.Database {
  _db = new Database(DB_PATH);

  // Performance pragmas
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  createTables(_db);

  return _db;
}

export function getDb(): Database.Database {
  if (!_db) throw new Error("Database not initialized. Call initDatabase() first.");
  return _db;
}

// ─── Schema ──────────────────────────────────────────────────────

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      hostname       TEXT NOT NULL,
      os             TEXT NOT NULL CHECK(os IN ('windows','macos','linux')),
      local_ip       TEXT NOT NULL,
      last_seen_at   TEXT NOT NULL,
      online         INTEGER NOT NULL DEFAULT 1,
      capabilities_json TEXT NOT NULL DEFAULT '{}',
      tags_json      TEXT NOT NULL DEFAULT '[]',
      preferred      INTEGER NOT NULL DEFAULT 0,
      notes          TEXT NOT NULL DEFAULT '',
      agent_port     INTEGER NOT NULL DEFAULT 3100
    );

    CREATE TABLE IF NOT EXISTS projects (
      id                  TEXT PRIMARY KEY,
      device_id           TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      path                TEXT NOT NULL,
      repo_url            TEXT,
      code_server_enabled INTEGER NOT NULL DEFAULT 0,
      code_server_port    INTEGER,
      startup_command     TEXT,
      working_dir         TEXT,
      env_json            TEXT NOT NULL DEFAULT '{}',
      icon                TEXT,
      sort_order          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shortcuts (
      id         TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('app','folder','script','url','command')),
      target     TEXT NOT NULL,
      args_json  TEXT NOT NULL DEFAULT '[]',
      icon       TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN ('terminal','remote','code')),
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','idle','closed')),
      started_at  TEXT NOT NULL,
      ended_at    TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS clipboard_history (
      id          TEXT PRIMARY KEY,
      device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      direction   TEXT NOT NULL CHECK(direction IN ('read','write')),
      mime        TEXT NOT NULL DEFAULT 'text/plain',
      text_preview TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
}

// ─── Demo seed ───────────────────────────────────────────────────

function seedDemoDevices(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM devices").get() as {
    cnt: number;
  };
  if (count.cnt > 0) return;

  const now = new Date().toISOString();

  const demoDevices: Array<{
    id: string;
    name: string;
    hostname: string;
    os: string;
    localIp: string;
    capabilities: DeviceCapabilities;
    port: number;
  }> = [
    {
      id: uuid(),
      name: "Mac Studio",
      hostname: "mac-studio.local",
      os: "macos",
      localIp: "192.168.1.10",
      capabilities: {
        clipboardRead: true,
        clipboardWrite: true,
        files: true,
        terminal: true,
        codeServer: true,
        remoteView: false,
      },
      port: 3100,
    },
    {
      id: uuid(),
      name: "Dev Server",
      hostname: "dev-server.local",
      os: "linux",
      localIp: "192.168.1.20",
      capabilities: {
        clipboardRead: true,
        clipboardWrite: true,
        files: true,
        terminal: true,
        codeServer: true,
        remoteView: true,
      },
      port: 3100,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO devices (id, name, hostname, os, local_ip, last_seen_at, online, capabilities_json, tags_json, preferred, notes, agent_port)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, '[]', 0, '', ?)
  `);

  const tx = db.transaction(() => {
    for (const d of demoDevices) {
      insert.run(
        d.id,
        d.name,
        d.hostname,
        d.os,
        d.localIp,
        now,
        JSON.stringify(d.capabilities),
        d.port
      );
    }
  });
  tx();
}

// ─── Helpers: row <-> domain ─────────────────────────────────────

function rowToDevice(row: any): Device {
  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    os: row.os,
    localIp: row.local_ip,
    lastSeenAt: row.last_seen_at,
    online: !!row.online,
    capabilities: JSON.parse(row.capabilities_json || "{}"),
    tags: JSON.parse(row.tags_json || "[]"),
    preferred: !!row.preferred,
    notes: row.notes || "",
    agentPort: row.agent_port,
  };
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    deviceId: row.device_id,
    name: row.name,
    path: row.path,
    repoUrl: row.repo_url || undefined,
    codeServerEnabled: !!row.code_server_enabled,
    codeServerPort: row.code_server_port || undefined,
    startupCommand: row.startup_command || undefined,
    workingDir: row.working_dir || undefined,
    env: JSON.parse(row.env_json || "{}"),
    icon: row.icon || undefined,
    sortOrder: row.sort_order,
  };
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    deviceId: row.device_id,
    type: row.type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    metadata: JSON.parse(row.metadata_json || "{}"),
  };
}

function rowToClipboardEntry(row: any): ClipboardEntry {
  return {
    id: row.id,
    deviceId: row.device_id,
    direction: row.direction,
    mime: row.mime,
    textPreview: row.text_preview,
    createdAt: row.created_at,
  };
}

// ─── Devices ─────────────────────────────────────────────────────

const _stmtCache: Record<string, Database.Statement> = {};

function stmt(key: string, sql: string): Database.Statement {
  if (!_stmtCache[key]) {
    _stmtCache[key] = getDb().prepare(sql);
  }
  return _stmtCache[key];
}

export function getDevices(): Device[] {
  const rows = stmt(
    "getDevices",
    "SELECT * FROM devices ORDER BY preferred DESC, name ASC"
  ).all();
  return rows.map(rowToDevice);
}

export function getDevice(id: string): Device | undefined {
  const row = stmt("getDevice", "SELECT * FROM devices WHERE id = ?").get(id);
  return row ? rowToDevice(row) : undefined;
}

export function upsertDevice(device: Partial<Device> & { id: string }): Device {
  const existing = getDevice(device.id);
  const now = new Date().toISOString();

  if (existing) {
    const merged = { ...existing, ...device, lastSeenAt: now };
    stmt(
      "updateDevice",
      `UPDATE devices SET name=?, hostname=?, os=?, local_ip=?, last_seen_at=?,
       online=?, capabilities_json=?, tags_json=?, preferred=?, notes=?, agent_port=?
       WHERE id=?`
    ).run(
      merged.name,
      merged.hostname,
      merged.os,
      merged.localIp,
      merged.lastSeenAt,
      merged.online ? 1 : 0,
      JSON.stringify(merged.capabilities),
      JSON.stringify(merged.tags),
      merged.preferred ? 1 : 0,
      merged.notes,
      merged.agentPort,
      merged.id
    );
    return getDevice(merged.id)!;
  }

  const id = device.id || uuid();
  stmt(
    "insertDevice",
    `INSERT INTO devices (id, name, hostname, os, local_ip, last_seen_at, online, capabilities_json, tags_json, preferred, notes, agent_port)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    device.name || "Unknown",
    device.hostname || "unknown",
    device.os || "linux",
    device.localIp || "0.0.0.0",
    now,
    device.online !== false ? 1 : 0,
    JSON.stringify(device.capabilities || {}),
    JSON.stringify(device.tags || []),
    device.preferred ? 1 : 0,
    device.notes || "",
    device.agentPort || 3100
  );
  return getDevice(id)!;
}

export function deleteDevice(id: string): boolean {
  const info = stmt("deleteDevice", "DELETE FROM devices WHERE id = ?").run(id);
  return info.changes > 0;
}

export function markDeviceOnline(id: string, online: boolean): void {
  stmt(
    "markDeviceOnline",
    "UPDATE devices SET online = ?, last_seen_at = ? WHERE id = ?"
  ).run(online ? 1 : 0, new Date().toISOString(), id);
}

// ─── Projects ────────────────────────────────────────────────────

export function getProjects(): Project[] {
  const rows = stmt(
    "getProjects",
    "SELECT * FROM projects ORDER BY sort_order ASC, name ASC"
  ).all();
  return rows.map(rowToProject);
}

export function getProjectsByDevice(deviceId: string): Project[] {
  const rows = stmt(
    "getProjectsByDevice",
    "SELECT * FROM projects WHERE device_id = ? ORDER BY sort_order ASC, name ASC"
  ).all(deviceId);
  return rows.map(rowToProject);
}

export function getProject(id: string): Project | undefined {
  const row = stmt("getProject", "SELECT * FROM projects WHERE id = ?").get(id);
  return row ? rowToProject(row) : undefined;
}

export function createProject(data: Omit<Project, "id">): Project {
  const id = uuid();
  stmt(
    "insertProject",
    `INSERT INTO projects (id, device_id, name, path, repo_url, code_server_enabled, code_server_port, startup_command, working_dir, env_json, icon, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.deviceId,
    data.name,
    data.path,
    data.repoUrl || null,
    data.codeServerEnabled ? 1 : 0,
    data.codeServerPort || null,
    data.startupCommand || null,
    data.workingDir || null,
    JSON.stringify(data.env || {}),
    data.icon || null,
    data.sortOrder || 0
  );
  return getProject(id)!;
}

export function updateProject(
  id: string,
  data: Partial<Omit<Project, "id">>
): Project | undefined {
  const existing = getProject(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...data };
  stmt(
    "updateProject",
    `UPDATE projects SET device_id=?, name=?, path=?, repo_url=?, code_server_enabled=?,
     code_server_port=?, startup_command=?, working_dir=?, env_json=?, icon=?, sort_order=?
     WHERE id=?`
  ).run(
    merged.deviceId,
    merged.name,
    merged.path,
    merged.repoUrl || null,
    merged.codeServerEnabled ? 1 : 0,
    merged.codeServerPort || null,
    merged.startupCommand || null,
    merged.workingDir || null,
    JSON.stringify(merged.env || {}),
    merged.icon || null,
    merged.sortOrder,
    id
  );
  return getProject(id)!;
}

export function deleteProject(id: string): boolean {
  const info = stmt("deleteProject", "DELETE FROM projects WHERE id = ?").run(id);
  return info.changes > 0;
}

// ─── Clipboard History ───────────────────────────────────────────

export function getClipboardHistory(
  deviceId: string,
  limit = 50
): ClipboardEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM clipboard_history WHERE device_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(deviceId, limit);
  return rows.map(rowToClipboardEntry);
}

export function addClipboardEntry(
  entry: Omit<ClipboardEntry, "id" | "createdAt">
): ClipboardEntry {
  const id = uuid();
  const createdAt = new Date().toISOString();
  stmt(
    "insertClipboard",
    `INSERT INTO clipboard_history (id, device_id, direction, mime, text_preview, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, entry.deviceId, entry.direction, entry.mime, entry.textPreview, createdAt);
  return { id, ...entry, createdAt };
}

// ─── Sessions ────────────────────────────────────────────────────

export function getSessions(deviceId?: string): Session[] {
  if (deviceId) {
    const rows = stmt(
      "getSessionsByDevice",
      "SELECT * FROM sessions WHERE device_id = ? ORDER BY started_at DESC"
    ).all(deviceId);
    return rows.map(rowToSession);
  }
  const rows = stmt(
    "getAllSessions",
    "SELECT * FROM sessions ORDER BY started_at DESC"
  ).all();
  return rows.map(rowToSession);
}

export function getSession(id: string): Session | undefined {
  const row = stmt("getSession", "SELECT * FROM sessions WHERE id = ?").get(id);
  return row ? rowToSession(row) : undefined;
}

export function createSession(
  data: Pick<Session, "deviceId" | "type" | "metadata">
): Session {
  const id = uuid();
  const startedAt = new Date().toISOString();
  stmt(
    "insertSession",
    `INSERT INTO sessions (id, device_id, type, status, started_at, metadata_json)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(id, data.deviceId, data.type, startedAt, JSON.stringify(data.metadata || {}));
  return getSession(id)!;
}

export function updateSession(
  id: string,
  data: Partial<Pick<Session, "status" | "endedAt" | "metadata">>
): Session | undefined {
  const existing = getSession(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...data };
  stmt(
    "updateSession",
    `UPDATE sessions SET status=?, ended_at=?, metadata_json=? WHERE id=?`
  ).run(
    merged.status,
    merged.endedAt || null,
    JSON.stringify(merged.metadata || {}),
    id
  );
  return getSession(id)!;
}

// ─── Settings ────────────────────────────────────────────────────

export function getSettings(): Array<{ key: string; value: unknown }> {
  const rows = getDb()
    .prepare("SELECT * FROM settings ORDER BY key ASC")
    .all() as Array<{ key: string; value: string }>;
  return rows.map((r) => ({ key: r.key, value: JSON.parse(r.value) }));
}

export function getSetting(key: string): unknown | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}

export function setSetting(key: string, value: unknown): void {
  stmt(
    "upsertSetting",
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, JSON.stringify(value));
}
