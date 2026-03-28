import { Router, Request, Response } from "express";
import { getDevices, getProjects } from "../database";
import { getAgentUrl } from "../agentProxy";

const router = Router();

// POST /api/commands/run/:deviceId - Run arbitrary command on device agent
router.post("/run/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const { command, cwd, env, timeout: cmdTimeout } = req.body;
    if (!command) {
      return res.status(400).json({ ok: false, error: "command is required" });
    }

    const controller = new AbortController();
    const timeoutMs = Math.min(cmdTimeout || 30_000, 120_000); // max 2 min
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const agentRes = await fetch(`${agentUrl}/commands/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          cwd: cwd || undefined,
          env: env || {},
          timeout: timeoutMs,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
      res.json(result);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        res.status(504).json({ ok: false, error: "Command timed out" });
      } else {
        res.status(502).json({
          ok: false,
          error: `Agent unreachable: ${fetchErr.message}`,
        });
      }
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/commands/palette - Get available commands for command palette
router.get("/palette", (_req: Request, res: Response) => {
  try {
    const devices = getDevices();
    const projects = getProjects();

    const commands: Array<{
      id: string;
      label: string;
      type: string;
      deviceId?: string;
      target?: string;
      icon?: string;
    }> = [];

    // Global commands
    commands.push({
      id: "cmd:refresh-devices",
      label: "Refresh Device List",
      type: "restart-agent",
      icon: "refresh",
    });

    // Per-device commands
    for (const device of devices) {
      commands.push({
        id: `cmd:terminal:${device.id}`,
        label: `Open Terminal on ${device.name}`,
        type: "open-terminal",
        deviceId: device.id,
        icon: "terminal",
      });

      commands.push({
        id: `cmd:copy-ip:${device.id}`,
        label: `Copy IP of ${device.name}`,
        type: "copy-info",
        deviceId: device.id,
        target: device.localIp,
        icon: "clipboard",
      });

      if (device.capabilities.files) {
        commands.push({
          id: `cmd:browse-files:${device.id}`,
          label: `Browse Files on ${device.name}`,
          type: "open-folder",
          deviceId: device.id,
          icon: "folder",
        });
      }

      if (device.capabilities.remoteView) {
        commands.push({
          id: `cmd:remote-view:${device.id}`,
          label: `Remote View ${device.name}`,
          type: "open-remote",
          deviceId: device.id,
          icon: "monitor",
        });
      }
    }

    // Per-project commands
    for (const project of projects) {
      const device = devices.find((d) => d.id === project.deviceId);
      const deviceLabel = device ? ` (${device.name})` : "";

      if (project.codeServerEnabled) {
        commands.push({
          id: `cmd:code:${project.id}`,
          label: `Launch Code for ${project.name}${deviceLabel}`,
          type: "launch-code",
          deviceId: project.deviceId,
          target: project.path,
          icon: "code",
        });
      }

      if (project.startupCommand) {
        commands.push({
          id: `cmd:run:${project.id}`,
          label: `Run ${project.name}${deviceLabel}`,
          type: "run-script",
          deviceId: project.deviceId,
          target: project.startupCommand,
          icon: "play",
        });
      }
    }

    res.json({ ok: true, data: commands });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
