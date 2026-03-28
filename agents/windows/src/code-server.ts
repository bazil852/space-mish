import { execSync, spawn, ChildProcess } from 'child_process';

interface CodeServerInstance {
  port: number;
  projectPath: string;
  process: ChildProcess;
  url: string;
  startedAt: string;
}

const instances = new Map<number, CodeServerInstance>();

/**
 * Check whether code-server is installed and available on PATH.
 */
export function isInstalled(): boolean {
  try {
    execSync('where code-server', { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a code-server instance for the given project path and port.
 */
export function startCodeServer(
  projectPath: string,
  port: number,
): { url: string; port: number } {
  if (instances.has(port)) {
    const existing = instances.get(port)!;
    return { url: existing.url, port: existing.port };
  }

  if (!isInstalled()) {
    throw new Error('code-server is not installed. Install it from https://github.com/coder/code-server');
  }

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
  const instance: CodeServerInstance = {
    port,
    projectPath,
    process: child,
    url,
    startedAt: new Date().toISOString(),
  };

  instances.set(port, instance);
  console.log(`[code-server] Started on port ${port} for ${projectPath}`);
  return { url, port };
}

/**
 * Stop a code-server instance running on the given port.
 */
export function stopCodeServer(port: number): boolean {
  const instance = instances.get(port);
  if (!instance) return false;

  try {
    instance.process.kill('SIGTERM');
  } catch {
    // Process may already be dead
  }

  instances.delete(port);
  console.log(`[code-server] Stopped on port ${port}`);
  return true;
}

/**
 * Get all running code-server instances (without process handles).
 */
export function getRunningInstances(): Array<{
  port: number;
  projectPath: string;
  url: string;
  startedAt: string;
}> {
  return Array.from(instances.values()).map((i) => ({
    port: i.port,
    projectPath: i.projectPath,
    url: i.url,
    startedAt: i.startedAt,
  }));
}
