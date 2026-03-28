import { Router, Request, Response } from "express";
import {
  getDevices,
  getDevice,
  upsertDevice,
  deleteDevice,
  markDeviceOnline,
} from "../database";
import { getAgentUrl } from "../agentProxy";
import { broadcast } from "../websocket";

const router = Router();

// GET /api/devices - List all devices
router.get("/", (_req: Request, res: Response) => {
  try {
    const devices = getDevices();
    res.json({ ok: true, data: devices });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/devices/:id - Get single device
router.get("/:id", (req: Request, res: Response) => {
  try {
    const device = getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ ok: false, error: "Device not found" });
    }
    res.json({ ok: true, data: device });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/devices - Manually register a device
router.post("/", (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.localIp) {
      return res.status(400).json({ ok: false, error: "localIp is required" });
    }
    const device = upsertDevice({
      id: body.id,
      name: body.name || "Manual Device",
      hostname: body.hostname || body.localIp,
      os: body.os || "linux",
      localIp: body.localIp,
      online: true,
      capabilities: body.capabilities || {
        clipboardRead: true,
        clipboardWrite: true,
        files: true,
        terminal: true,
        codeServer: false,
        remoteView: false,
      },
      tags: body.tags || [],
      preferred: body.preferred || false,
      notes: body.notes || "",
      agentPort: body.agentPort || 3100,
    });
    broadcast("device:online", device);
    res.status(201).json({ ok: true, data: device });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/devices/:id - Update device
router.put("/:id", (req: Request, res: Response) => {
  try {
    const existing = getDevice(req.params.id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Device not found" });
    }
    const device = upsertDevice({ ...req.body, id: req.params.id });
    broadcast("device:updated", device);
    res.json({ ok: true, data: device });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/devices/:id - Remove device
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const device = getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ ok: false, error: "Device not found" });
    }
    deleteDevice(req.params.id);
    broadcast("device:offline", device);
    res.json({ ok: true, data: { id: req.params.id } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/devices/:id/wake - Ping/wake a device agent
router.post("/:id/wake", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.id);
    if (!agentUrl) {
      return res.status(404).json({ ok: false, error: "Device not found" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const agentRes = await fetch(`${agentUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (agentRes.ok) {
        markDeviceOnline(req.params.id, true);
        const device = getDevice(req.params.id);
        broadcast("device:online", device);
        res.json({ ok: true, data: { status: "awake", device } });
      } else {
        res.json({
          ok: false,
          error: `Agent responded with status ${agentRes.status}`,
        });
      }
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.json({
        ok: false,
        error: `Agent unreachable: ${fetchErr.message}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
