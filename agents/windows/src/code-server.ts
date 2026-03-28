import { execSync, spawn, ChildProcess } from 'child_process';
import * as os from 'os';

interface VSCodeInstance {
  port: number;
  projectPath: string;
  process: ChildProcess;
  url: string;
  networkUrl: string;
  startedAt: string;
  mode: 'serve-web' | 'tunnel' | 'code-server';
}

const instances = new Map<number, VSCodeInstance>();

function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '0.0.0.0';
}

/**
 * Check what's available: official VS Code CLI, or code-server as fallback.
 */
export function isInstalled(): boolean {
  return hasVSCode() || hasCodeServer();
}

function hasVSCode(): boolean {
  try {
    execSync('where code', { encoding: 'utf-8', timeout: 5000, windowsHide: true, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasCodeServer(): boolean {
  try {
    execSync('where code-server', { encoding: 'utf-8', timeout: 5000, windowsHide: true, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a VS Code web server for the given project.
 * Tries official `code serve-web` first, falls back to `code-server`.
 */
export function startCodeServer(
  projectPath: string,
  port: number,
): { url: string; networkUrl: string; port: number; mode: string } {
  // Check if already running on this port
  if (instances.has(port)) {
    const existing = instances.get(port)!;
    return { url: existing.url, networkUrl: existing.networkUrl, port: existing.port, mode: existing.mode };
  }

  // Also check if this project is already open on a different port
  for (const inst of instances.values()) {
    if (inst.projectPath === projectPath) {
      return { url: inst.url, networkUrl: inst.networkUrl, port: inst.port, mode: inst.mode };
    }
  }

  const ip = getLocalIp();

  // Try official VS Code first
  if (hasVSCode()) {
    return startVSCodeServeWeb(projectPath, port, ip);
  }

  // Fallback to code-server
  if (hasCodeServer()) {
    return startCodeServerFallback(projectPath, port, ip);
  }

  throw new Error(
    'VS Code is not installed. Install Visual Studio Code from https://code.visualstudio.com/ ' +
    '— the "code" CLI is included and enables browser-based editing.'
  );
}

function startVSCodeServeWeb(
  projectPath: string,
  port: number,
  ip: string,
): { url: string; networkUrl: string; port: number; mode: string } {
  // `code serve-web` serves the full VS Code UI on a local port
  const child = spawn('code', [
    'serve-web',
    '--port', String(port),
    '--host', '0.0.0.0',
    '--without-connection-token',
    '--accept-server-license-terms',
  ], {
    detached: true,
    stdio: 'ignore',
    shell: true,
    cwd: projectPath,
  });

  child.unref();

  const url = `http://localhost:${port}`;
  const networkUrl = `http://${ip}:${port}`;

  instances.set(port, {
    port, projectPath, process: child,
    url, networkUrl,
    startedAt: new Date().toISOString(),
    mode: 'serve-web',
  });

  console.log(`[vscode] serve-web started on port ${port} for ${projectPath}`);
  return { url, networkUrl, port, mode: 'serve-web' };
}

function startCodeServerFallback(
  projectPath: string,
  port: number,
  ip: string,
): { url: string; networkUrl: string; port: number; mode: string } {
  const child = spawn('code-server', [
    '--port', String(port),
    '--auth', 'none',
    '--bind-addr', `0.0.0.0:${port}`,
    projectPath,
  ], {
    detached: true,
    stdio: 'ignore',
    shell: true,
  });

  child.unref();

  const url = `http://localhost:${port}`;
  const networkUrl = `http://${ip}:${port}`;

  instances.set(port, {
    port, projectPath, process: child,
    url, networkUrl,
    startedAt: new Date().toISOString(),
    mode: 'code-server',
  });

  console.log(`[code-server] Started on port ${port} for ${projectPath}`);
  return { url, networkUrl, port, mode: 'code-server' };
}

/**
 * Stop an instance running on the given port.
 */
export function stopCodeServer(port: number): boolean {
  const instance = instances.get(port);
  if (!instance) return false;

  try {
    // On Windows, need to kill the process tree
    if (instance.process.pid) {
      try {
        execSync(`taskkill /PID ${instance.process.pid} /T /F`, {
          timeout: 5000, windowsHide: true, stdio: 'ignore',
        });
      } catch {
        instance.process.kill();
      }
    } else {
      instance.process.kill();
    }
  } catch {}

  instances.delete(port);
  console.log(`[vscode] Stopped on port ${port}`);
  return true;
}

/**
 * Get all running instances.
 */
export function getRunningInstances(): Array<{
  port: number;
  projectPath: string;
  url: string;
  networkUrl: string;
  startedAt: string;
  mode: string;
}> {
  return Array.from(instances.values()).map((i) => ({
    port: i.port,
    projectPath: i.projectPath,
    url: i.url,
    networkUrl: i.networkUrl,
    startedAt: i.startedAt,
    mode: i.mode,
  }));
}
