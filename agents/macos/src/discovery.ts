import Bonjour from 'bonjour-service';
import * as http from 'http';
import * as os from 'os';
import * as net from 'net';

let bonjourInstance: Bonjour | null = null;

export interface AdvertiseConfig {
  deviceId: string;
  deviceName: string;
  version: string;
  port: number;
  capabilities: string[];
  hubUrl?: string;
}

/**
 * Advertise the agent over mDNS and auto-discover + register with the hub.
 */
export async function advertiseAgent(config: AdvertiseConfig): Promise<void> {
  // 1. Publish via mDNS
  bonjourInstance = new Bonjour();
  bonjourInstance.publish({
    name: config.deviceName,
    type: 'spacemish',
    port: config.port,
    txt: {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      name: config.deviceName,
      os: 'macos',
      version: config.version,
      capabilities: config.capabilities.join(','),
    },
  });
  console.log(`[discovery] mDNS advertised as _spacemish._tcp on port ${config.port}`);

  // 2. Find the hub — use explicit URL if set, otherwise scan the LAN
  let hubUrl = config.hubUrl;

  if (!hubUrl || hubUrl.includes('localhost')) {
    console.log('[discovery] Scanning LAN for hub...');
    hubUrl = await findHub();
  }

  if (hubUrl) {
    await doRegister(hubUrl, config);
    // Heartbeat every 30s
    setInterval(() => { doRegister(hubUrl!, config).catch(() => {}); }, 30_000);
  } else {
    console.warn('[discovery] Hub not found yet. Retrying every 15s...');
    const retry = setInterval(async () => {
      const found = await findHub();
      if (found) {
        hubUrl = found;
        await doRegister(found, config);
        clearInterval(retry);
        setInterval(() => { doRegister(hubUrl!, config).catch(() => {}); }, 30_000);
      }
    }, 15_000);
  }
}

async function doRegister(hubUrl: string, config: AdvertiseConfig) {
  try {
    await registerWithHub(hubUrl, config);
    console.log(`[discovery] Registered with hub at ${hubUrl}`);
  } catch (err) {
    console.warn(`[discovery] Registration failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Scan the local subnet for the Space Mish hub on port 3001.
 */
async function findHub(): Promise<string | null> {
  const localIp = getLocalIp();
  if (!localIp) return null;

  const subnet = localIp.split('.').slice(0, 3).join('.');
  console.log(`[discovery] Scanning ${subnet}.1-254 for hub...`);

  const checks = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    if (ip === localIp) continue;
    checks.push(checkHub(ip));
  }

  const results = await Promise.all(checks);
  return results.find(r => r !== null) || null;
}

function checkHub(ip: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on('connect', () => {
      socket.destroy();
      const req = http.get(`http://${ip}:3001/health`, { timeout: 1500 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve(body.includes('space-mish') ? `http://${ip}:3001` : null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => { socket.destroy(); resolve(null); });
    socket.connect(3001, ip);
  });
}

function getLocalIp(): string | null {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function registerWithHub(hubUrl: string, config: AdvertiseConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const localIp = getLocalIp() || '0.0.0.0';
    const body = JSON.stringify({
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      os: 'macos',
      version: config.version,
      port: config.port,
      localIp,
      capabilities: config.capabilities,
    });

    const url = new URL('/api/agents/register', hubUrl);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.statusCode && res.statusCode < 300 ? resolve() : reject(new Error(`Status ${res.statusCode}`));
      res.resume();
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function stopAdvertising(): void {
  if (bonjourInstance) { bonjourInstance.unpublishAll(); bonjourInstance.destroy(); bonjourInstance = null; }
}
