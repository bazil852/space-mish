import Bonjour, { Service } from 'bonjour-service';
import * as http from 'http';

let bonjourInstance: Bonjour | null = null;
let publishedService: Service | null = null;

export interface AdvertiseConfig {
  deviceId: string;
  deviceName: string;
  version: string;
  port: number;
  capabilities: string[];
  hubUrl?: string;
}

/**
 * Advertise the agent over mDNS and optionally register with the hub.
 */
export async function advertiseAgent(config: AdvertiseConfig): Promise<void> {
  // Publish via Bonjour / mDNS
  bonjourInstance = new Bonjour();
  publishedService = bonjourInstance.publish({
    name: config.deviceName,
    type: 'spacemish',
    port: config.port,
    txt: {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      os: 'windows',
      version: config.version,
      capabilities: config.capabilities.join(','),
    },
  });

  console.log(`[discovery] mDNS advertised as _spacemish._tcp on port ${config.port}`);

  // Register with hub if URL is provided
  if (config.hubUrl) {
    try {
      await registerWithHub(config);
      console.log(`[discovery] Registered with hub at ${config.hubUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[discovery] Failed to register with hub: ${message}`);
    }
  }
}

/**
 * POST registration data to the hub.
 */
function registerWithHub(config: AdvertiseConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/agents/register', config.hubUrl);
    const body = JSON.stringify({
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      os: 'windows',
      version: config.version,
      port: config.port,
      capabilities: config.capabilities,
    });

    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Hub responded with status ${res.statusCode}`));
        }
        res.resume();
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Stop mDNS advertising and clean up.
 */
export function stopAdvertising(): void {
  if (publishedService) {
    publishedService.stop?.();
    publishedService = null;
  }
  if (bonjourInstance) {
    bonjourInstance.destroy();
    bonjourInstance = null;
  }
  console.log('[discovery] Stopped advertising');
}
