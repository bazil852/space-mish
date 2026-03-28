import { execSync, spawn, ChildProcess } from 'child_process';
import * as os from 'os';

interface VSCodeInstance {
  port: number;
  projectPath: string;
  process: ChildProcess;
  url: string;
  networkUrl: string;
  startedAt: string;
  mode: 'serve-web' | 'code-server';
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

export function isInstalled(): boolean {
  return hasVSCode() || hasCodeServer();
}

function hasVSCode(): boolean {
  try {
    execSync('which code', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function hasCodeServer(): boolean {
  try {
    execSync('which code-server', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

export function startCodeServer(
  projectPath: string,
  port: number,
): { url: string; networkUrl: string; port: number; mode: string } {
  if (instances.has(port)) {
    const e = instances.get(port)!;
    return { url: e.url, networkUrl: e.networkUrl, port: e.port, mode: e.mode };
  }
  for (const inst of instances.values()) {
    if (inst.projectPath === projectPath) {
      return { url: inst.url, networkUrl: inst.networkUrl, port: inst.port, mode: inst.mode };
    }
  }

  const ip = getLocalIp();

  if (hasVSCode()) {
    const child = spawn('code', [
      'serve-web', '--port', String(port), '--host', '0.0.0.0',
      '--without-connection-token', '--accept-server-license-terms',
    ], { detached: true, stdio: 'ignore', shell: true, cwd: projectPath });
    child.unref();
    const url = `http://localhost:${port}`;
    const networkUrl = `http://${ip}:${port}`;
    instances.set(port, { port, projectPath, process: child, url, networkUrl, startedAt: new Date().toISOString(), mode: 'serve-web' });
    console.log(`[vscode] serve-web started on port ${port} for ${projectPath}`);
    return { url, networkUrl, port, mode: 'serve-web' };
  }

  if (hasCodeServer()) {
    const child = spawn('code-server', [
      '--port', String(port), '--auth', 'none', '--bind-addr', `0.0.0.0:${port}`, projectPath,
    ], { detached: true, stdio: 'ignore', shell: true });
    child.unref();
    const url = `http://localhost:${port}`;
    const networkUrl = `http://${ip}:${port}`;
    instances.set(port, { port, projectPath, process: child, url, networkUrl, startedAt: new Date().toISOString(), mode: 'code-server' });
    console.log(`[code-server] Started on port ${port} for ${projectPath}`);
    return { url, networkUrl, port, mode: 'code-server' };
  }

  throw new Error('VS Code is not installed. Install from https://code.visualstudio.com/');
}

export function stopCodeServer(port: number): boolean {
  const inst = instances.get(port);
  if (!inst) return false;
  try { inst.process.kill(); } catch {}
  instances.delete(port);
  console.log(`[vscode] Stopped on port ${port}`);
  return true;
}

export function getRunningInstances(): Array<{
  port: number; projectPath: string; url: string; networkUrl: string; startedAt: string; mode: string;
}> {
  return Array.from(instances.values()).map(i => ({
    port: i.port, projectPath: i.projectPath, url: i.url, networkUrl: i.networkUrl, startedAt: i.startedAt, mode: i.mode,
  }));
}
