'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor, Settings2, Maximize2, Minimize2,
  MousePointer, Keyboard, Signal, Play, Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  deviceId: string;
}

type Quality = 'auto' | 'crisp' | 'balanced' | 'low-latency';

const QUALITY_SETTINGS: Record<Quality, { quality: number; fps: number; label: string }> = {
  'auto': { quality: 40, fps: 3, label: 'Auto' },
  'crisp': { quality: 70, fps: 2, label: 'Crisp' },
  'balanced': { quality: 50, fps: 4, label: 'Balanced' },
  'low-latency': { quality: 25, fps: 6, label: 'Low Latency' },
};

export default function RemoteTab({ deviceId }: Props) {
  const [connected, setConnected] = useState(false);
  const [quality, setQuality] = useState<Quality>('balanced');
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fps, setFps] = useState(0);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [keyboardMode, setKeyboardMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const screenSizeRef = useRef({ width: 1920, height: 1080 });

  const startSession = useCallback(() => {
    let hubWs: string;
    if (process.env.NEXT_PUBLIC_WS_URL) {
      hubWs = process.env.NEXT_PUBLIC_WS_URL;
    } else if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      hubWs = `wss://${window.location.hostname}`;
    } else {
      hubWs = `ws://${window.location.hostname}:3001`;
    }

    const ws = new WebSocket(`${hubWs}/remote/${deviceId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send quality settings
      const settings = QUALITY_SETTINGS[quality];
      ws.send(JSON.stringify({
        type: 'settings',
        quality: settings.quality,
        fps: settings.fps,
      }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary frame — render to canvas
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            screenSizeRef.current = { width: img.width, height: img.height };
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
          }
          URL.revokeObjectURL(url);
          frameCountRef.current++;
        };
        img.src = url;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [deviceId, quality]);

  function stopSession() {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }

  // FPS counter
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // Send quality changes to agent
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const settings = QUALITY_SETTINGS[quality];
      wsRef.current.send(JSON.stringify({
        type: 'settings',
        quality: settings.quality,
        fps: settings.fps,
      }));
    }
  }, [quality]);

  // Cleanup
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // Convert canvas coordinates to screen coordinates
  function canvasToScreen(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = screenSizeRef.current.width / rect.width;
    const scaleY = screenSizeRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function sendInput(action: string, extra: Record<string, unknown> = {}) {
    if (!inputEnabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'input',
      event: { action, ...extra },
    }));
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = canvasToScreen(e);
    sendInput('click', { x: pos.x, y: pos.y, button: e.button === 2 ? 'right' : 'left' });
  }

  function handleCanvasDblClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = canvasToScreen(e);
    sendInput('dblclick', { x: pos.x, y: pos.y });
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    // Only send move on mouse down (drag) to reduce traffic
    if (e.buttons > 0) {
      const pos = canvasToScreen(e);
      sendInput('move', { x: pos.x, y: pos.y });
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const pos = canvasToScreen(e as React.MouseEvent<HTMLCanvasElement>);
    sendInput('click', { x: pos.x, y: pos.y, button: 'right' });
  }

  // Keyboard capture
  useEffect(() => {
    if (!keyboardMode || !connected) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      // Map common keys to SendKeys format
      const keyMap: Record<string, string> = {
        'Enter': '{ENTER}', 'Backspace': '{BACKSPACE}', 'Tab': '{TAB}',
        'Escape': '{ESC}', 'Delete': '{DELETE}', 'Home': '{HOME}',
        'End': '{END}', 'ArrowUp': '{UP}', 'ArrowDown': '{DOWN}',
        'ArrowLeft': '{LEFT}', 'ArrowRight': '{RIGHT}',
        'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}',
        'F5': '{F5}', 'F6': '{F6}', 'F7': '{F7}', 'F8': '{F8}',
        'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}',
      };
      const key = keyMap[e.key] || (e.key.length === 1 ? e.key : '');
      if (key) {
        sendInput('type', { key });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboardMode, connected, inputEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn(
      'flex flex-col',
      fullscreen && 'fixed inset-0 z-50 bg-space-void',
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 glass-card-solid rounded-b-none mb-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-4 h-4 text-space-accent" />
          <span className="text-sm font-display font-medium text-space-white">Remote View</span>
          {connected && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface text-[10px] font-mono text-space-mist/40">
              <Signal className="w-3 h-3 text-emerald-400" />
              <span>{fps} fps</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {connected && (
            <>
              <button
                onClick={() => setInputEnabled(e => !e)}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  inputEnabled
                    ? 'bg-space-accent/15 text-space-accent'
                    : 'hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent',
                )}
                title="Mouse input"
              >
                <MousePointer className="w-4 h-4" />
              </button>
              <button
                onClick={() => setKeyboardMode(k => !k)}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  keyboardMode
                    ? 'bg-space-accent/15 text-space-accent'
                    : 'hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent',
                )}
                title={keyboardMode ? 'Keyboard capture ON' : 'Keyboard capture OFF'}
              >
                <Keyboard className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowSettings(s => !s)}
            className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {connected ? (
            <button
              onClick={stopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium
                         hover:bg-red-500/25 transition-all"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          ) : (
            <button
              onClick={startSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-accent/15 text-space-accent text-xs font-medium
                         hover:bg-space-accent/25 transition-all"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Quality settings */}
      {showSettings && (
        <div className="px-4 py-3 glass-card rounded-none border-t-0 mb-0">
          <h5 className="text-xs font-display font-semibold text-space-mist/40 uppercase tracking-widest mb-3">
            Quality Preset
          </h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(QUALITY_SETTINGS) as [Quality, typeof QUALITY_SETTINGS[Quality]][]).map(([id, cfg]) => (
              <button
                key={id}
                onClick={() => setQuality(id)}
                className={cn(
                  'p-3 rounded-xl text-left transition-all',
                  quality === id
                    ? 'bg-space-accent/15 border border-space-accent/25 text-space-white'
                    : 'glass-surface text-space-mist/50 hover:text-space-mist/80',
                )}
              >
                <div className="text-sm font-medium">{cfg.label}</div>
                <div className="text-[10px] text-space-mist/30 mt-0.5">Q{cfg.quality} / {cfg.fps}fps</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stream area */}
      <div
        ref={containerRef}
        className="flex-1 glass-card rounded-t-none border-t-0 overflow-hidden relative"
        style={{ minHeight: fullscreen ? '100%' : '500px' }}
      >
        {connected ? (
          <div className="w-full h-full flex items-center justify-center bg-black/50">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain cursor-crosshair"
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDblClick}
              onMouseMove={handleCanvasMove}
              onContextMenu={handleContextMenu}
            />
            {keyboardMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-space-accent/20
                              text-space-accent text-xs font-mono animate-pulse-glow">
                Keyboard capture active — press keys to type
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="relative mb-8">
              <Monitor className="w-24 h-24 text-space-accent/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-8 h-8 text-space-accent/30" />
              </div>
            </div>
            <h4 className="font-display font-semibold text-lg text-space-white mb-2">
              Remote Desktop
            </h4>
            <p className="text-sm text-space-mist/40 text-center max-w-sm mb-6 leading-relaxed">
              Stream the screen from this device. Click, type, and interact directly.
              Best performance on LAN.
            </p>
            <button
              onClick={startSession}
              className="cosmic-button-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Remote Session
            </button>
            <p className="text-[10px] text-space-mist/20 mt-4 font-mono">
              Windows: works out of the box | macOS: requires Screen Recording permission
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
