import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";

import { initDatabase, upsertDevice } from "./database";
import { setupWebSocket, broadcast } from "./websocket";
import { startDiscovery } from "./discovery";

// Route modules
import devicesRouter from "./routes/devices";
import clipboardRouter from "./routes/clipboard";
import filesRouter from "./routes/files";
import terminalRouter from "./routes/terminal";
import projectsRouter from "./routes/projects";
import commandsRouter from "./routes/commands";
import os from "os";

// ─── Configuration ───────────────────────────────────────────────

const HUB_PORT = Number(process.env.HUB_PORT) || 3001;
const HOST = process.env.HUB_HOST || "0.0.0.0";

// ─── Express app ─────────────────────────────────────────────────

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.url}`);
  next();
});

// ─── Health check ────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "space-mish-hub", uptime: process.uptime() });
});

// ─── Mount API routes ────────────────────────────────────────────

app.use("/api/devices", devicesRouter);
app.use("/api/clipboard", clipboardRouter);
app.use("/api/files", filesRouter);
app.use("/api/terminal", terminalRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/commands", commandsRouter);

// ─── Agent self-registration endpoint ─────────────────────────────
// Agents POST here on startup to register themselves with the hub
app.post("/api/agents/register", (req, res) => {
  try {
    const { deviceId, deviceName, os: agentOs, port, capabilities, localIp } = req.body;
    // Prefer the agent's self-reported IP, fall back to request IP
    const agentIp =
      localIp ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress?.replace("::ffff:", "") ||
      "127.0.0.1";

    const capList = Array.isArray(capabilities) ? capabilities : [];
    const hasCap = (name: string) => capList.some((c: string) => c.toLowerCase().includes(name));

    const device = upsertDevice({
      id: deviceId,
      name: deviceName || "Agent",
      hostname: deviceName || agentIp,
      os: agentOs || "linux",
      localIp: agentIp,
      online: true,
      capabilities: {
        clipboardRead: hasCap("clipboard"),
        clipboardWrite: hasCap("clipboard"),
        files: hasCap("files"),
        terminal: hasCap("terminal"),
        codeServer: hasCap("code-server"),
        remoteView: hasCap("remote"),
      },
      tags: [],
      preferred: false,
      notes: "",
      agentPort: port || 3002,
    });

    broadcast("device:online", device);
    console.log(`[register] Agent registered: ${device.name} (${device.localIp}:${device.agentPort})`);
    res.status(201).json({ ok: true, data: device });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── 404 fallback ────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// ─── Error handler ───────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[error]", err.stack || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
);

// ─── Bootstrap ───────────────────────────────────────────────────

function main(): void {
  // 1. Initialize database
  const db = initDatabase();
  console.log("[db] SQLite database initialized");

  // 2. Create HTTP server
  const server = http.createServer(app);

  // 3. Attach WebSocket server
  setupWebSocket(server);

  // 4. Start mDNS discovery + heartbeat
  startDiscovery(broadcast);

  // 5. Listen
  server.listen(HUB_PORT, HOST, () => {
    console.log("");
    console.log("  ╔══════════════════════════════════════════╗");
    console.log("  ║         Space Mish Hub v1.0.0            ║");
    console.log("  ╠══════════════════════════════════════════╣");
    console.log(`  ║  HTTP  → http://${HOST}:${HUB_PORT}          ║`);
    console.log(`  ║  WS    → ws://${HOST}:${HUB_PORT}/ws          ║`);
    console.log("  ║  mDNS  → _spacemish-hub._tcp             ║");
    console.log("  ╚══════════════════════════════════════════╝");
    console.log("");
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[hub] Shutting down...");
    server.close(() => {
      db.close();
      process.exit(0);
    });
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5_000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
