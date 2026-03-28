import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

/**
 * Attach a WebSocket server to the given HTTP server.
 */
export function setupWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const remoteAddr =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    console.log(`[ws] Client connected from ${remoteAddr}`);
    clients.add(ws);

    // Send a welcome message
    sendTo(ws, "devices:list", { message: "Connected to Space Mish Hub" });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        sendTo(ws, "error" as any, { error: "Invalid JSON" });
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

  console.log("[ws] WebSocket server ready on /ws");
  return wss;
}

/**
 * Broadcast an event to all connected clients.
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

/**
 * Send a message to a specific client.
 */
function sendTo(ws: WebSocket, event: string, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    })
  );
}

// ─── Incoming message handler ────────────────────────────────────

interface IncomingMessage {
  event: string;
  data?: any;
  sessionId?: string;
  deviceId?: string;
}

function handleMessage(ws: WebSocket, msg: IncomingMessage): void {
  switch (msg.event) {
    case "terminal:data": {
      // Relay terminal input to the device agent via REST, or store for
      // the agent to poll. In a full implementation, the hub would
      // maintain a WS connection to each agent. For now, broadcast to
      // all clients (agents listen on the same WS).
      broadcast("terminal:data", {
        sessionId: msg.sessionId,
        deviceId: msg.deviceId,
        data: msg.data,
      });
      break;
    }

    case "terminal:resize": {
      broadcast("terminal:resize", {
        sessionId: msg.sessionId,
        cols: msg.data?.cols,
        rows: msg.data?.rows,
      });
      break;
    }

    case "clipboard:sync": {
      broadcast("clipboard:synced", {
        deviceId: msg.deviceId,
        content: msg.data?.content,
        mime: msg.data?.mime || "text/plain",
      });
      break;
    }

    case "ping": {
      sendTo(ws, "pong" as any, { time: Date.now() });
      break;
    }

    default:
      console.log(`[ws] Unknown event: ${msg.event}`);
  }
}

/**
 * Get the count of connected clients.
 */
export function getClientCount(): number {
  return clients.size;
}
