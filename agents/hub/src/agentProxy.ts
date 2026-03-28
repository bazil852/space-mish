import { getDevice } from "./database";

/**
 * Look up the base URL for a device agent from the database.
 * Returns null if the device is not found or is offline.
 */
export function getAgentUrl(deviceId: string): string | null {
  const device = getDevice(deviceId);
  if (!device) return null;
  if (!device.online) return null;
  return `http://${device.localIp}:${device.agentPort}`;
}
