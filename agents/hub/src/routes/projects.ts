import { Router, Request, Response } from "express";
import {
  getProjects,
  getProjectsByDevice,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "../database";
import { getAgentUrl } from "../agentProxy";

const router = Router();

// GET /api/projects - List all projects (optionally filter by deviceId)
router.get("/", (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const projects = deviceId
      ? getProjectsByDevice(deviceId)
      : getProjects();
    res.json({ ok: true, data: projects });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/projects/:id - Get single project
router.get("/:id", (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }
    res.json({ ok: true, data: project });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/projects - Create project
router.post("/", (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.deviceId || !body.name || !body.path) {
      return res
        .status(400)
        .json({ ok: false, error: "deviceId, name, and path are required" });
    }

    const project = createProject({
      deviceId: body.deviceId,
      name: body.name,
      path: body.path,
      repoUrl: body.repoUrl,
      codeServerEnabled: body.codeServerEnabled || false,
      codeServerPort: body.codeServerPort,
      startupCommand: body.startupCommand,
      workingDir: body.workingDir,
      env: body.env || {},
      icon: body.icon,
      sortOrder: body.sortOrder || 0,
    });

    res.status(201).json({ ok: true, data: project });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", (req: Request, res: Response) => {
  try {
    const project = updateProject(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }
    res.json({ ok: true, data: project });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const existed = deleteProject(req.params.id);
    if (!existed) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }
    res.json({ ok: true, data: { id: req.params.id } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/projects/:id/open-code - Launch code-server for project
router.post("/:id/open-code", async (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    const agentUrl = getAgentUrl(project.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(`${agentUrl}/code-server/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath: project.path,
          port: project.codeServerPort || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
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

// POST /api/projects/:id/run - Run startup command for project
router.post("/:id/run", async (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    if (!project.startupCommand) {
      return res
        .status(400)
        .json({ ok: false, error: "Project has no startup command configured" });
    }

    const agentUrl = getAgentUrl(project.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(`${agentUrl}/commands/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: project.startupCommand,
          cwd: project.workingDir || project.path,
          env: project.env || {},
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await agentRes.json();
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

export default router;
