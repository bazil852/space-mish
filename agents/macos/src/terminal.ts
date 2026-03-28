import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

export interface TerminalSession {
  id: string;
  pty: pty.IPty;
  shell: string;
  createdAt: string;
}

const sessions = new Map<string, TerminalSession>();

/**
 * Create a new terminal session.
 */
export function createSession(
  shell: string = 'zsh',
  cols: number = 80,
  rows: number = 24,
): TerminalSession {
  const id = uuidv4();
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.HOME || '/tmp',
    env: process.env as Record<string, string>,
  });

  const session: TerminalSession = {
    id,
    pty: ptyProcess,
    shell,
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
export function listSessions(): Array<{ id: string; shell: string; createdAt: string }> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    shell: s.shell,
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
 * Close ALL terminal sessions. Returns number killed.
 */
export function closeAllSessions(): number {
  let count = 0;
  for (const [id, session] of sessions) {
    try { session.pty.kill(); } catch {}
    sessions.delete(id);
    count++;
  }
  return count;
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
