'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  deviceId: string;
}

interface TermSession {
  id: string;
  label: string;
}

export default function TerminalTab({ deviceId }: Props) {
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const xtermRefs = useRef<Map<string, unknown>>(new Map());
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  const createSession = useCallback(async () => {
    const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSession: TermSession = {
      id: sessionId,
      label: `Shell ${sessions.length + 1}`,
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSession(sessionId);

    // Connect to terminal WebSocket after DOM update
    setTimeout(() => connectTerminal(sessionId), 100);
  }, [sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connectTerminal(sessionId: string) {
    const container = terminalRefs.current.get(sessionId);
    if (!container) return;

    try {
      // Dynamic import xterm
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');
      // CSS is imported via globals.css xterm overrides
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'bar',
        theme: {
          background: '#080d24',
          foreground: '#e2e8f0',
          cursor: '#3b82f6',
          selectionBackground: 'rgba(59, 130, 246, 0.3)',
          black: '#0a0f2e',
          red: '#f87171',
          green: '#34d399',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e2e8f0',
          brightBlack: '#475569',
          brightRed: '#fca5a5',
          brightGreen: '#6ee7b7',
          brightYellow: '#fde68a',
          brightBlue: '#93c5fd',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#f8fafc',
        },
      });

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(container);
      fitAddon.fit();

      xtermRefs.current.set(sessionId, term);

      // Connect to agent terminal WebSocket — auto-detect protocol for tunnel support
      let hubWs: string;
      if (process.env.NEXT_PUBLIC_WS_URL) {
        hubWs = process.env.NEXT_PUBLIC_WS_URL;
      } else if (window.location.protocol === 'https:') {
        hubWs = `wss://${window.location.hostname}`;
      } else {
        hubWs = `ws://${window.location.hostname}:3001`;
      }
      const ws = new WebSocket(`${hubWs}/terminal/${deviceId}/${sessionId}`);

      ws.onopen = () => {
        term.write('\r\n  \x1b[1;34m✦ Space Mish Terminal\x1b[0m\r\n  \x1b[90mConnected to device\x1b[0m\r\n\r\n');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        term.write('\r\n\x1b[90m[session closed]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        term.write('\r\n  \x1b[33m⚠ Could not connect to agent terminal.\x1b[0m\r\n');
        term.write('  \x1b[90mMake sure the Space Mish agent is running on the target device.\x1b[0m\r\n\r\n');
        // Provide a local echo for demo
        let buffer = '';
        term.write('\x1b[1;36m❯\x1b[0m ');
        term.onData((data: string) => {
          if (data === '\r') {
            term.write('\r\n');
            if (buffer.trim()) {
              term.write(`\x1b[90m$ ${buffer}\x1b[0m\r\n`);
              term.write(`\x1b[33mCommand would execute on ${deviceId}\x1b[0m\r\n`);
            }
            buffer = '';
            term.write('\x1b[1;36m❯\x1b[0m ');
          } else if (data === '\x7f') {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              term.write('\b \b');
            }
          } else {
            buffer += data;
            term.write(data);
          }
        });
      };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data }));
        }
      });

      wsRefs.current.set(sessionId, ws);

      // Resize observer
      const observer = new ResizeObserver(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      });
      observer.observe(container);
    } catch (err) {
      console.error('Terminal init error:', err);
    }
  }

  function closeSession(sessionId: string) {
    wsRefs.current.get(sessionId)?.close();
    wsRefs.current.delete(sessionId);
    const term = xtermRefs.current.get(sessionId) as { dispose?: () => void } | undefined;
    term?.dispose?.();
    xtermRefs.current.delete(sessionId);
    terminalRefs.current.delete(sessionId);

    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (activeSession === sessionId) {
        setActiveSession(next[next.length - 1]?.id || null);
      }
      return next;
    });
  }

  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRefs.current.forEach(ws => ws.close());
      xtermRefs.current.forEach((term) => {
        (term as { dispose?: () => void })?.dispose?.();
      });
    };
  }, []);

  return (
    <div className={cn(
      'glass-card overflow-hidden flex flex-col',
      fullscreen && 'fixed inset-0 z-50 rounded-none',
    )}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-space-border bg-space-void/40">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all group',
                activeSession === session.id
                  ? 'bg-space-accent/15 text-space-accent border border-space-accent/20'
                  : 'text-space-mist/40 hover:text-space-mist/70 hover:bg-space-navy/30 border border-transparent',
              )}
              onClick={() => setActiveSession(session.id)}
            >
              <span>{session.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                className="p-0.5 rounded hover:bg-space-navy/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={createSession}
          className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
          title="New terminal"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setFullscreen(f => !f)}
          className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Terminal containers */}
      <div className="flex-1 relative" style={{ minHeight: fullscreen ? '100%' : '500px' }}>
        {sessions.map(session => (
          <div
            key={session.id}
            ref={(el) => { if (el) terminalRefs.current.set(session.id, el); }}
            className={cn(
              'absolute inset-0 bg-[#080d24]',
              activeSession === session.id ? 'block' : 'hidden',
            )}
          />
        ))}
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-space-mist/30 text-sm">
            No terminal sessions
          </div>
        )}
      </div>
    </div>
  );
}
