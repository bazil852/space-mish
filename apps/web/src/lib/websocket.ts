'use client';

type WSHandler = (data: unknown) => void;

class SpaceMishSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<WSHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private url: string;

  constructor() {
    if (typeof window !== 'undefined') {
      // If explicit WS URL is set, use it
      if (process.env.NEXT_PUBLIC_WS_URL) {
        this.url = process.env.NEXT_PUBLIC_WS_URL;
      } else {
        // Auto-detect: use wss:// on HTTPS (tunnel), ws:// on HTTP (LAN)
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.protocol === 'https:' ? '' : ':3001';
        this.url = `${proto}//${host}${port}/ws`;
      }
    } else {
      this.url = 'ws://localhost:3001/ws';
    }
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connected', null);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event) {
            this.emit(msg.event, msg.data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.emit('disconnected', null);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(event: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }

  on(event: string, handler: WSHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: WSHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((h) => h(data));
    this.handlers.get('*')?.forEach((h) => h({ event, data }));
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

let instance: SpaceMishSocket | null = null;

export function getSocket(): SpaceMishSocket {
  if (!instance) {
    instance = new SpaceMishSocket();
  }
  return instance;
}
