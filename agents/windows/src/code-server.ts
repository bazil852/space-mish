import { execSync, spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as readline from 'readline';

interface TunnelState {
  process: ChildProcess | null;
  url: string | null;
  machineName: string | null;
  status: 'stopped' | 'starting' | 'running' | 'needs-auth';
  authMessage: string | null;
  startedAt: string | null;
}

interface ProjectSession {
  projectPath: string;
  url: string;
  startedAt: string;
}

const tunnel: TunnelState = {
  process: null, url: null, machineName: null,
  status: 'stopped', authMessage: null, startedAt: null,
};

const projectSessions = new Map<string, ProjectSession>();

/**
 * Check if VS Code CLI is available.
 */
export function isInstalled(): boolean {
  try {
    execSync('where code', { encoding: 'utf-8', timeout: 5000, windowsHide: true, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start the VS Code tunnel if not already running.
 * Returns the tunnel URL or an auth message if first-time setup is needed.
 */
export function startCodeServer(
  projectPath: string,
  _port: number = 0,
): { url: string; networkUrl: string; port: number; mode: string } {
  if (!isInstalled()) {
    throw new Error(
      'VS Code is not installed. Install it from https://code.visualstudio.com/ — the tunnel feature is built in.'
    );
  }

  // If tunnel is running and we have a URL, just return it with the project folder
  if (tunnel.status === 'running' && tunnel.url) {
    const projectUrl = buildProjectUrl(tunnel.url, projectPath);
    trackProject(projectPath, projectUrl);
    return { url: projectUrl, networkUrl: projectUrl, port: 0, mode: 'tunnel' };
  }

  // If tunnel needs auth, tell the user
  if (tunnel.status === 'needs-auth' && tunnel.authMessage) {
    throw new Error(tunnel.authMessage);
  }

  // Start the tunnel
  if (tunnel.status === 'stopped' || tunnel.status === 'needs-auth') {
    launchTunnel();
  }

  // If still starting, wait briefly for URL
  if (tunnel.status === 'starting') {
    // Give it a few seconds
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (tunnel.url) {
        const projectUrl = buildProjectUrl(tunnel.url, projectPath);
        trackProject(projectPath, projectUrl);
        return { url: projectUrl, networkUrl: projectUrl, port: 0, mode: 'tunnel' };
      }
      if (tunnel.status === 'needs-auth') {
        throw new Error(tunnel.authMessage || 'Authentication required. Run "code tunnel" manually once to authenticate.');
      }
      // Busy wait (this is in a sync context)
      execSync('timeout /t 1 /nobreak >nul 2>&1', { windowsHide: true, stdio: 'ignore' });
    }
  }

  if (tunnel.url) {
    const projectUrl = buildProjectUrl(tunnel.url, projectPath);
    trackProject(projectPath, projectUrl);
    return { url: projectUrl, networkUrl: projectUrl, port: 0, mode: 'tunnel' };
  }

  throw new Error(
    'Tunnel is starting up. Try again in a few seconds. If this is your first time, ' +
    'run "code tunnel" in a terminal on this machine to complete one-time authentication.'
  );
}

function buildProjectUrl(tunnelBaseUrl: string, projectPath: string): string {
  // tunnelBaseUrl is like https://vscode.dev/tunnel/machine-name
  // Append the folder path
  const folderParam = encodeURIComponent(projectPath);
  return `${tunnelBaseUrl}/${folderParam}`;
}

function trackProject(projectPath: string, url: string) {
  if (!projectSessions.has(projectPath)) {
    projectSessions.set(projectPath, {
      projectPath, url, startedAt: new Date().toISOString(),
    });
  }
}

function launchTunnel() {
  if (tunnel.process) return;

  tunnel.status = 'starting';
  tunnel.authMessage = null;
  console.log('[vscode] Starting VS Code tunnel...');

  const child = spawn('code', [
    'tunnel',
    '--accept-server-license-terms',
  ], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  tunnel.process = child;

  // Read stdout line by line to find the URL or auth code
  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      console.log(`[vscode-tunnel] ${line}`);

      // Look for the tunnel URL
      const urlMatch = line.match(/(https:\/\/vscode\.dev\/tunnel\/[^\s]+)/);
      if (urlMatch) {
        tunnel.url = urlMatch[1];
        tunnel.machineName = urlMatch[1].replace('https://vscode.dev/tunnel/', '').split('/')[0];
        tunnel.status = 'running';
        tunnel.startedAt = new Date().toISOString();
        console.log(`[vscode] Tunnel ready: ${tunnel.url}`);
      }

      // Look for device code authentication prompt
      if (line.includes('github.com/login/device') || line.includes('use code')) {
        const codeMatch = line.match(/code\s+([A-Z0-9]{4}-[A-Z0-9]{4})/);
        const deviceCode = codeMatch ? codeMatch[1] : '';
        tunnel.status = 'needs-auth';
        tunnel.authMessage =
          `First-time setup required. Go to https://github.com/login/device and enter code: ${deviceCode}. ` +
          `Or run "code tunnel" in a terminal on this machine to complete authentication.`;
        console.log(`[vscode] Auth required: ${tunnel.authMessage}`);
      }
    });
  }

  if (child.stderr) {
    const errRl = readline.createInterface({ input: child.stderr });
    errRl.on('line', (line) => {
      console.log(`[vscode-tunnel-err] ${line}`);
      // Sometimes the URL appears in stderr
      const urlMatch = line.match(/(https:\/\/vscode\.dev\/tunnel\/[^\s]+)/);
      if (urlMatch) {
        tunnel.url = urlMatch[1];
        tunnel.machineName = urlMatch[1].replace('https://vscode.dev/tunnel/', '').split('/')[0];
        tunnel.status = 'running';
        tunnel.startedAt = new Date().toISOString();
      }
    });
  }

  child.on('exit', (code) => {
    console.log(`[vscode] Tunnel process exited with code ${code}`);
    tunnel.process = null;
    tunnel.status = 'stopped';
    // Don't clear the URL — tunnel may have been stopped but the URL might still work
    // if the service is running separately
  });
}

/**
 * Stop the tunnel.
 */
export function stopCodeServer(_port: number = 0): boolean {
  if (tunnel.process) {
    try {
      if (tunnel.process.pid) {
        execSync(`taskkill /PID ${tunnel.process.pid} /T /F`, {
          timeout: 5000, windowsHide: true, stdio: 'ignore',
        });
      }
    } catch {
      try { tunnel.process.kill(); } catch {}
    }
    tunnel.process = null;
    tunnel.status = 'stopped';
    tunnel.url = null;
    tunnel.machineName = null;
    tunnel.startedAt = null;
    projectSessions.clear();
    console.log('[vscode] Tunnel stopped');
    return true;
  }
  return false;
}

/**
 * Get running instances info.
 */
export function getRunningInstances(): Array<{
  port: number;
  projectPath: string;
  url: string;
  networkUrl: string;
  startedAt: string;
  mode: string;
}> {
  const result: Array<{
    port: number; projectPath: string; url: string; networkUrl: string; startedAt: string; mode: string;
  }> = [];

  // Add the tunnel itself if running
  if (tunnel.status === 'running' && tunnel.url) {
    result.push({
      port: 0,
      projectPath: 'VS Code Tunnel',
      url: tunnel.url,
      networkUrl: tunnel.url,
      startedAt: tunnel.startedAt || new Date().toISOString(),
      mode: 'tunnel',
    });
  }

  // Add tracked project sessions
  for (const session of projectSessions.values()) {
    result.push({
      port: 0,
      projectPath: session.projectPath,
      url: session.url,
      networkUrl: session.url,
      startedAt: session.startedAt,
      mode: 'tunnel',
    });
  }

  return result;
}

/**
 * Get tunnel status.
 */
export function getTunnelStatus(): {
  status: string;
  url: string | null;
  machineName: string | null;
  authMessage: string | null;
} {
  return {
    status: tunnel.status,
    url: tunnel.url,
    machineName: tunnel.machineName,
    authMessage: tunnel.authMessage,
  };
}
