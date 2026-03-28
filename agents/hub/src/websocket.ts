import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Duplex } from "stream";
import { getAgentUrl } from "./agentProxy";

let generalWss: WebSocketServer;
let terminalWss: WebSocketServer;
const clients = new Set<WebSocket>();

/**
 * Attach WebSocket servers to the given HTTP server.
 * - /ws             → general events (device presence, clipboard, etc.)
 * - /terminal/:deviceId/:sessionId → terminal proxy to agent
 */
export function setupWebSocket(server: HttpServer): void {
  generalWss = new WebSocketServer({ noServer: true });
  terminalWss = new WebSocketServer({ noServer: true });

  // Route upgrade requests to the correct WSS
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url || "";

    if (url === "/ws" || url === "/ws/") {
      generalWss.handleUpgrade(req, socket, head, (ws) => {
        generalWss.emit("connection", ws, req);
      });
    } else if (url.startsWith("/terminal/")) {
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        terminalWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // ─── General WS ─────────────────────────────────────────────────
  generalWss.on("connection", (ws, req) => {
    const remoteAddr =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    console.log(`[ws] Client connected from ${remoteAddr}`);
    clients.add(ws);

    sendTo(ws, "devices:list", { message: "Connected to Space Mish Hub" });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        sendTo(ws, "error" as never, { error: "Invalid JSON" });
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[ws] Client disconnected (${remoteAddr})`);
    });

    ws.on("error", (err) => {
      console.error("[ws] Client error:", err.message);
      clients.delete(ws);
    });
  });

  // ─── Terminal WS Proxy ──────────────────────────────────────────
  terminalWss.on("connection", async (browserWs: WebSocket, req: IncomingMessage) => {
    const url = req.url || "";
    // Parse /terminal/:deviceId/:sessionId
    const parts = url.replace(/^\/terminal\//, "").split("/");
    const deviceId = parts[0];
    const browserSessionId = parts[1];

    if (!deviceId) {
      browserWs.close(1008, "Missing deviceId");
      return;
    }

    const agentUrl = getAgentUrl(deviceId);
    if (!agentUrl) {
      browserWs.close(1008, "Device not found or offline");
      return;
    }

    console.log(`[terminal] Browser requesting terminal for device ${deviceId}`);

    // Step 1: Create a terminal session on the agent via REST
    let agentSessionId: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${agentUrl}/terminal/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 80, rows: 24 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await res.json() as { ok: boolean; data?: { sessionId: string } };
      if (!result.ok || !result.data?.sessionId) {
        browserWs.close(1008, "Failed to create terminal session on agent");
        return;
      }
      agentSessionId = result.data.sessionId;
      console.log(`[terminal] Agent session created: ${agentSessionId}`);
    } catch (err) {
      console.error("[terminal] Failed to create agent session:", err);
      browserWs.close(1008, "Agent unreachable");
      return;
    }

    // Step 2: Open WebSocket to agent's terminal
    const agentWsUrl = agentUrl.replace(/^http/, "ws") + `/terminal/${agentSessionId}`;
    let agentWs: WebSocket;
    try {
      agentWs = new WebSocket(agentWsUrl);
    } catch (err) {
      console.error("[terminal] Failed to connect to agent WS:", err);
      browserWs.close(1008, "Cannot connect to agent terminal");
      return;
    }

    agentWs.on("open", () => {
      console.log(`[terminal] Proxying: browser <-> agent (${deviceId}/${agentSessionId})`);
    });

    // Agent → Browser: forward terminal output
    agentWs.on("message", (data) => {
      if (browserWs.readyState === WebSocket.OPEN) {
        try {
          // Agent sends JSON { event: "terminal:data", data: "..." }
          const msg = JSON.parse(data.toString());
          if (msg.event === "terminal:data" && typeof msg.data === "string") {
            browserWs.send(msg.data);
          } else if (msg.event === "terminal:exit") {
            browserWs.send("\r\n[process exited]\r\n");
            browserWs.close(1000, "Process exited");
          } else {
            // Forward raw
            browserWs.send(data.toString());
          }
        } catch {
          // Forward as raw text
          browserWs.send(data.toString());
        }
      }
    });

    // Browser → Agent: forward input & resize
    browserWs.on("message", (raw) => {
      if (agentWs.readyState === WebSocket.OPEN) {
        try {
          const msg = JSON.parse(raw.toString());
          // Browser sends { type: "data", data: "..." } or { type: "resize", cols, rows }
          if (msg.type === "data") {
            agentWs.send(JSON.stringify({ event: "terminal:data", data: msg.data }));
          } else if (msg.type === "resize") {
            agentWs.send(
              JSON.stringify({
                event: "terminal:resize",
                data: { cols: msg.cols, rows: msg.rows },
              })
            );
          }
        } catch {
          // Forward raw
          agentWs.send(raw.toString());
        }
      }
    });

    // Cleanup on either side closing
    browserWs.on("close", () => {
      console.log(`[terminal] Browser disconnected (${deviceId}/${agentSessionId})`);
      if (agentWs.readyState === WebSocket.OPEN) agentWs.close();
    });

    agentWs.on("close", () => {
      console.log(`[terminal] Agent WS closed (${deviceId}/${agentSessionId})`);
      if (browserWs.readyState === WebSocket.OPEN) browserWs.close();
    });

    agentWs.on("error", (err) => {
      console.error(`[terminal] Agent WS error:`, err.message);
      if (browserWs.readyState === WebSocket.OPEN) {
        browserWs.close(1008, "Agent connection error");
      }
    });

    browserWs.on("error", (err) => {
      console.error(`[terminal] Browser WS error:`, err.message);
      if (agentWs.readyState === WebSocket.OPEN) agentWs.close();
    });
  });

  console.log("[ws] WebSocket server ready (/ws + /terminal/*)");
}

/**
 * Broadcast an event to all connected general clients.
 */
export function broadcast(event: string, data: unknown): void {
  const payload = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendTo(ws: WebSocket, event: string, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  );
}

interface IncomingMsg {
  event: string;
  data?: unknown;
  sessionId?: string;
  deviceId?: string;
}

function handleMessage(ws: WebSocket, msg: IncomingMsg): void {
  switch (msg.event) {
    case "clipboard:sync":
      broadcast("clipboard:synced", {
        deviceId: msg.deviceId,
        content: (msg.data as Record<string, unknown>)?.content,
        mime: (msg.data as Record<string, unknown>)?.mime || "text/plain",
      });
      break;

    case "ping":
      sendTo(ws, "pong", { time: Date.now() });
      break;

    default:
      break;
  }
}

export function getClientCount(): number {
  return clients.size;
}
