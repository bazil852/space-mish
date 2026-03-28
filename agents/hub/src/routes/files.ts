import { Router, Request, Response } from "express";
import multer from "multer";
import { getAgentUrl } from "../agentProxy";

const router = Router();

// Configure multer for temporary file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// GET /api/files/browse/:deviceId?path= - Browse files on device
router.get("/browse/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const dirPath = req.query.path as string || "/";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(
        `${agentUrl}/files/browse?path=${encodeURIComponent(dirPath)}`,
        { signal: controller.signal }
      );
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

// POST /api/files/upload/:deviceId - Upload file to device
router.post(
  "/upload/:deviceId",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const agentUrl = getAgentUrl(req.params.deviceId);
      if (!agentUrl) {
        return res
          .status(404)
          .json({ ok: false, error: "Device not found or offline" });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      const destPath = req.body.path || "/tmp";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        // Build FormData to forward to agent
        const formData = new FormData();
        const blob = new Blob([req.file.buffer], {
          type: req.file.mimetype,
        });
        formData.append("file", blob, req.file.originalname);
        formData.append("path", destPath);

        const agentRes = await fetch(`${agentUrl}/files/upload`, {
          method: "POST",
          body: formData,
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
  }
);

// GET /api/files/download/:deviceId?path= - Download file from device
router.get("/download/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ ok: false, error: "path query parameter is required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const agentRes = await fetch(
        `${agentUrl}/files/download?path=${encodeURIComponent(filePath)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!agentRes.ok) {
        const errBody = await agentRes.json().catch(() => ({}));
        return res
          .status(agentRes.status)
          .json({ ok: false, error: (errBody as any).error || "Download failed" });
      }

      // Stream the file back to the client
      const contentType =
        agentRes.headers.get("content-type") || "application/octet-stream";
      const contentDisposition = agentRes.headers.get("content-disposition");

      res.setHeader("Content-Type", contentType);
      if (contentDisposition) {
        res.setHeader("Content-Disposition", contentDisposition);
      }

      const buffer = Buffer.from(await agentRes.arrayBuffer());
      res.send(buffer);
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

// POST /api/files/move/:deviceId - Move/rename file on device
router.post("/move/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const { source, destination } = req.body;
    if (!source || !destination) {
      return res
        .status(400)
        .json({ ok: false, error: "source and destination are required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(`${agentUrl}/files/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, destination }),
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

// DELETE /api/files/:deviceId?path= - Delete file on device
router.delete("/:deviceId", async (req: Request, res: Response) => {
  try {
    const agentUrl = getAgentUrl(req.params.deviceId);
    if (!agentUrl) {
      return res
        .status(404)
        .json({ ok: false, error: "Device not found or offline" });
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      return res
        .status(400)
        .json({ ok: false, error: "path query parameter is required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const agentRes = await fetch(
        `${agentUrl}/files/delete?path=${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
          signal: controller.signal,
        }
      );
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
