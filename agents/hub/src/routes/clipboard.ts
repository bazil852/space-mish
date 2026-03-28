import { Router, Request, Response } from "express";
import { getClipboardHistory, addClipboardEntry, getDevice } from "../database";
import { getAgentUrl } from "../agentProxy";
import { broadcast } from "../websocket";

const router = Router();

// POST /api/clipboard/read/:deviceId - Read clipboard from device agent
router.post("/read/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const agentRes = await fetch(`${agentUrl}/clipboard/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result = await agentRes.json();

      if (result.ok && result.data) {
        // Log to clipboard history
        addClipboardEntry({
          deviceId: req.params.deviceId,
          direction: "read",
          mime: result.data.mime || "text/plain",
          textPreview: (result.data.content || "").substring(0, 500),
        });

        broadcast("clipboard:synced", {
          deviceId: req.params.deviceId,
          direction: "read",
          content: result.data.content,
        });
      }

      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.status(502).json({
        ok: false,
        error: `Agent unreachable: ${fetchErr.message}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/clipboard/write/:deviceId - Write clipboard to device agent
router.post("/write/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const { content, mime } = req.body;
    if (!content) {
      return res.status(400).json({ ok: false, error: "content is required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const agentRes = await fetch(`${agentUrl}/clipboard/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mime: mime || "text/plain" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result = await agentRes.json();

      if (result.ok) {
        addClipboardEntry({
          deviceId: req.params.deviceId,
          direction: "write",
          mime: mime || "text/plain",
          textPreview: content.substring(0, 500),
        });

        broadcast("clipboard:synced", {
          deviceId: req.params.deviceId,
          direction: "write",
          content,
        });
      }

      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      res.status(502).json({
        ok: false,
        error: `Agent unreachable: ${fetchErr.message}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/clipboard/history/:deviceId - Get clipboard history
router.get("/history/:deviceId", (req: Request, res: Response) => {
  try {
    const device = getDevice(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ ok: false, error: "Device not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = getClipboardHistory(req.params.deviceId, limit);
    res.json({ ok: true, data: history });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
