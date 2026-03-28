import { Router, Request, Response } from "express";
import { getAgentUrl } from "../agentProxy";
import { getDevices } from "../database";

const router = Router();

// GET /api/projects - Discover projects from agents
// If deviceId is provided, query that device. Otherwise query all online devices.
router.get("/", async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const deep = req.query.deep === "true";

    if (deviceId) {
      // Single device
      const projects = await fetchAgentProjects(deviceId, deep);
      return res.json({ ok: true, data: projects });
    }

    // All online devices
    const devices = getDevices().filter((d) => d.online);
    const allProjects: Array<Record<string, unknown>> = [];

    await Promise.all(
      devices.map(async (device) => {
        const projects = await fetchAgentProjects(device.id, deep);
        for (const p of projects) {
          allProjects.push({ ...p, deviceId: device.id, deviceName: device.name });
        }
      })
    );

    res.json({ ok: true, data: allProjects });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/projects/open-code/:deviceId - Launch code-server on a device
router.post("/open-code/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res.status(404).json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(`${agentUrl}/projects/open-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.status(502).json({ ok: false, error: `Agent unreachable: ${fetchErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/projects/stop-code/:deviceId - Stop code-server on a device
router.post("/stop-code/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res.status(404).json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const agentRes = await fetch(`${agentUrl}/projects/stop-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.status(502).json({ ok: false, error: `Agent unreachable: ${fetchErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/projects/sessions/:deviceId - Get running code-server sessions
router.get("/sessions/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res.status(404).json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const agentRes = await fetch(`${agentUrl}/projects/sessions`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.status(502).json({ ok: false, error: `Agent unreachable: ${fetchErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Helper ─────────────────────────────────────────────────────
async function fetchAgentProjects(
  deviceId: string,
  deep: boolean
): Promise<Record<string, unknown>[]> {
  const agentUrl = getAgentUrl(deviceId);
  if (!agentUrl) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${agentUrl}/projects?deep=${deep}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

export default router;
