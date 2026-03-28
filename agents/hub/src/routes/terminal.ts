import { Router, Request, Response } from "express";
import {
  getSessions,
  getSession,
  createSession,
  updateSession,
} from "../database";
import { getAgentUrl } from "../agentProxy";
import { broadcast } from "../websocket";

const router = Router();

// POST /api/terminal/create/:deviceId - Create terminal session on device
router.post("/create/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const { shell, cwd, cols, rows } = req.body;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const agentRes = await fetch(`${agentUrl}/terminal/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shell: shell || undefined,
          cwd: cwd || undefined,
          cols: cols || 80,
          rows: rows || 24,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result = await agentRes.json();

      if (result.ok && result.data) {
        // Track session in the hub database
        const session = createSession({
          deviceId: req.params.deviceId,
          type: "terminal",
          metadata: {
            agentSessionId: result.data.sessionId,
            shell: shell || "default",
            cwd: cwd || "~",
          },
        });

        broadcast("session:created", session);

        res.status(201).json({
          ok: true,
          data: {
            ...session,
            agentSessionId: result.data.sessionId,
          },
        });
      } else {
        res.json(result);
      }
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

// GET /api/terminal/sessions/:deviceId - List active terminal sessions
router.get("/sessions/:deviceId", (req: Request, res: Response) => {
  try {
    const sessions = getSessions(req.params.deviceId).filter(
      (s) => s.type === "terminal" && s.status !== "closed"
    );
    res.json({ ok: true, data: sessions });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/terminal/:sessionId - Close terminal session
router.delete("/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    // Try to close on the agent
    const agentUrl = getAgentUrl(session.deviceId);
    if (agentUrl) {
      const agentSessionId =
        (session.metadata as any)?.agentSessionId || req.params.sessionId;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        await fetch(`${agentUrl}/terminal/${agentSessionId}`, {
          method: "DELETE",
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch {
        clearTimeout(timeout);
        // Agent unreachable, still mark session closed locally
      }
    }

    const updated = updateSession(req.params.sessionId, {
      status: "closed",
      endedAt: new Date().toISOString(),
    });

    broadcast("session:closed", updated);
    res.json({ ok: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
