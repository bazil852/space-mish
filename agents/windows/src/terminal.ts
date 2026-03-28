import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

export type ShellProfile = 'powershell' | 'cmd' | 'wsl';

export interface TerminalSession {
  id: string;
  pty: pty.IPty;
  shell: string;
  profile: ShellProfile;
  createdAt: string;
}

const sessions = new Map<string, TerminalSession>();

/** Resolve a shell profile to the actual executable path. */
function resolveShell(profile: ShellProfile): string {
  switch (profile) {
    case 'powershell':
      return 'powershell.exe';
    case 'cmd':
      return 'cmd.exe';
    case 'wsl':
      return 'wsl.exe';
    default:
      return 'powershell.exe';
  }
}

/**
 * Create a new terminal session.
 */
export function createSession(
  shell?: string,
  cols: number = 80,
  rows: number = 24,
): TerminalSession {
  const id = uuidv4();

  // Determine profile and shell executable
  let profile: ShellProfile = 'powershell';
  let shellExe: string;

  if (shell) {
    const lower = shell.toLowerCase();
    if (lower === 'cmd' || lower === 'cmd.exe') {
      profile = 'cmd';
    } else if (lower === 'wsl' || lower === 'wsl.exe') {
      profile = 'wsl';
    } else {
      profile = 'powershell';
    }
    shellExe = resolveShell(profile);
  } else {
    shellExe = resolveShell('powershell');
  }

  const ptyProcess = pty.spawn(shellExe, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.USERPROFILE || process.env.HOME || 'C:\\',
    env: process.env as Record<string, string>,
  });

  const session: TerminalSession = {
    id,
    pty: ptyProcess,
    shell: shellExe,
    profile,
    createdAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  return session;
}

/**
 * Get an existing session by id.
 */
export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

/**
 * Close and remove a session.
 */
export function closeSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  try {
    session.pty.kill();
  } catch {
    // Process may already be dead
  }

  sessions.delete(id);
  return true;
}

/**
 * List all active sessions (without the pty handle).
 */
export function listSessions(): Array<{
  id: string;
  shell: string;
  profile: ShellProfile;
  createdAt: string;
}> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    shell: s.shell,
    profile: s.profile,
    createdAt: s.createdAt,
  }));
}

/**
 * Resize a session's terminal.
 */
export function resizeSession(id: string, cols: number, rows: number): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.pty.resize(cols, rows);
  return true;
}

/**
 * Write data to a session's terminal.
 */
export function writeToSession(id: string, data: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.pty.write(data);
  return true;
}
