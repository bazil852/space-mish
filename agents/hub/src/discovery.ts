import { Bonjour, Service } from "bonjour-service";
import os from "os";
import { v4 as uuid } from "uuid";
import {
  getDb,
  getDevices,
  getDevice,
  upsertDevice,
  markDeviceOnline,
  type Device,
  type DeviceCapabilities,
} from "./database";

const STALE_THRESHOLD_MS = 15_000;
const OFFLINE_THRESHOLD_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 10_000;

let bonjour: Bonjour;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start mDNS discovery for Space Mish agents and advertise the hub.
 * @param wsBroadcast - function to push events to all connected WS clients
 */
export function startDiscovery(
  wsBroadcast: (event: string, data: unknown) => void
): void {
  bonjour = new Bonjour();

  // Advertise hub
  const hubPort = Number(process.env.HUB_PORT) || 3001;
  bonjour.publish({
    name: `space-mish-hub-${os.hostname()}`,
    type: "spacemish-hub",
    protocol: "tcp",
    port: hubPort,
    txt: { version: "1.0.0", hostname: os.hostname() },
  });

  console.log("[discovery] Advertised hub as _spacemish-hub._tcp on port", hubPort);

  // Browse for agents
  const browser = bonjour.find({ type: "spacemish", protocol: "tcp" });

  browser.on("up", (service: Service) => {
    handleServiceUp(service, wsBroadcast);
  });

  browser.on("down", (service: Service) => {
    handleServiceDown(service, wsBroadcast);
  });

  console.log("[discovery] Browsing for _spacemish._tcp services...");

  // Start heartbeat checker
  heartbeatTimer = setInterval(() => {
    checkHeartbeats(wsBroadcast);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop discovery and heartbeat.
 */
export function stopDiscovery(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (bonjour) {
    bonjour.unpublishAll();
    bonjour.destroy();
  }
}

// ─── Service event handlers ──────────────────────────────────────

function handleServiceUp(
  service: Service,
  wsBroadcast: (event: string, data: unknown) => void
): void {
  const txt = (service.txt || {}) as Record<string, string>;
  const deviceId = txt.deviceId || txt.id || uuid();
  const agentPort = service.port || 3100;
  const localIp =
    service.addresses?.find((a) => a.includes(".")) || "0.0.0.0";

  // Agents send capabilities as a comma-separated string: "clipboard,files,terminal,projects,code-server"
  const capList = (txt.capabilities || "").toLowerCase().split(",").map((c) => c.trim());
  const hasCap = (name: string) => capList.includes(name);

  const capabilities: DeviceCapabilities = {
    clipboardRead: hasCap("clipboard") || txt.clipboardRead === "true",
    clipboardWrite: hasCap("clipboard") || txt.clipboardWrite === "true",
    files: hasCap("files") || txt.files === "true" || txt.files !== "false",
    terminal: hasCap("terminal") || txt.terminal === "true" || txt.terminal !== "false",
    codeServer: hasCap("code-server") || txt.codeServer === "true",
    remoteView: hasCap("remote-view") || txt.remoteView === "true",
  };

  const device = upsertDevice({
    id: deviceId,
    name: txt.name || service.name || "Unknown Agent",
    hostname: service.host || "unknown",
    os: (txt.os as Device["os"]) || "linux",
    localIp,
    online: true,
    capabilities,
    tags: [],
    preferred: false,
    notes: "",
    agentPort,
  });

  console.log(`[discovery] Agent UP: ${device.name} (${device.localIp}:${device.agentPort})`);
  wsBroadcast("discovery:found", device);
  wsBroadcast("device:online", device);
}

function handleServiceDown(
  service: Service,
  wsBroadcast: (event: string, data: unknown) => void
): void {
  const txt = (service.txt || {}) as Record<string, string>;
  const deviceId = txt.deviceId || txt.id;
  if (!deviceId) return;

  const device = getDevice(deviceId);
  if (device) {
    markDeviceOnline(deviceId, false);
    console.log(`[discovery] Agent DOWN: ${device.name}`);
    wsBroadcast("discovery:lost", { ...device, online: false });
    wsBroadcast("device:offline", { ...device, online: false });
  }
}

// ─── Heartbeat ───────────────────────────────────────────────────

function checkHeartbeats(
  wsBroadcast: (event: string, data: unknown) => void
): void {
  const devices = getDevices();
  const now = Date.now();

  for (const device of devices) {
    if (!device.online) continue;

    const lastSeen = new Date(device.lastSeenAt).getTime();
    const elapsed = now - lastSeen;

    if (elapsed > OFFLINE_THRESHOLD_MS) {
      markDeviceOnline(device.id, false);
      console.log(`[heartbeat] Marked offline (${elapsed}ms stale): ${device.name}`);
      wsBroadcast("device:offline", { ...device, online: false });
    } else if (elapsed > STALE_THRESHOLD_MS) {
      // Attempt a ping to confirm liveness
      pingAgent(device).catch(() => {
        markDeviceOnline(device.id, false);
        console.log(`[heartbeat] Ping failed, marked offline: ${device.name}`);
        wsBroadcast("device:offline", { ...device, online: false });
      });
    }
  }
}

async function pingAgent(device: Device): Promise<void> {
  const url = `http://${device.localIp}:${device.agentPort}/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      markDeviceOnline(device.id, true);
    } else {
      throw new Error(`Agent responded ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Manually register a device (not discovered via mDNS).
 */
export function registerDeviceManually(
  data: Partial<Device> & { localIp: string; agentPort: number },
  wsBroadcast: (event: string, data: unknown) => void
): Device {
  const device = upsertDevice({
    id: data.id || uuid(),
    name: data.name || "Manual Device",
    hostname: data.hostname || data.localIp,
    os: data.os || "linux",
    localIp: data.localIp,
    online: true,
    capabilities: data.capabilities || {
      clipboardRead: true,
      clipboardWrite: true,
      files: true,
      terminal: true,
      codeServer: false,
      remoteView: false,
    },
    tags: data.tags || [],
    preferred: data.preferred || false,
    notes: data.notes || "",
    agentPort: data.agentPort,
  });

  wsBroadcast("device:online", device);
  return device;
}
