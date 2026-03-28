'use client';

import { useState } from 'react';
import {
  Monitor, Wifi, Settings2, Maximize2, Minimize2,
  MousePointer, Keyboard, RefreshCcw, Signal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  deviceId: string;
}

type Quality = 'auto' | 'crisp' | 'balanced' | 'low-latency';

export default function RemoteTab({ deviceId }: Props) {
  const [connected, setConnected] = useState(false);
  const [quality, setQuality] = useState<Quality>('auto');
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  async function startSession() {
    setConnected(true);
    // In production, this would establish a WebRTC or streaming connection
  }

  const qualities: { id: Quality; label: string; desc: string }[] = [
    { id: 'auto', label: 'Auto', desc: 'Adapts to network' },
    { id: 'crisp', label: 'Crisp', desc: 'Best quality' },
    { id: 'balanced', label: 'Balanced', desc: 'Good trade-off' },
    { id: 'low-latency', label: 'Low Latency', desc: 'Fastest response' },
  ];

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
          <span className={cn(
            'text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md',
            connected
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400',
          )}>
            {connected ? 'Connected' : 'Beta'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {connected && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface text-[10px] font-mono text-space-mist/40 mr-2">
                <Signal className="w-3 h-3 text-emerald-400" />
                <span>12ms</span>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
                      title="Touch pointer mode">
                <MousePointer className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all"
                      title="Keyboard input">
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
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 glass-card rounded-none border-t-0 mb-0">
          <h5 className="text-xs font-display font-semibold text-space-mist/40 uppercase tracking-widest mb-3">
            Quality Preset
          </h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {qualities.map(q => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={cn(
                  'p-3 rounded-xl text-left transition-all',
                  quality === q.id
                    ? 'bg-space-accent/15 border border-space-accent/25 text-space-white'
                    : 'glass-surface text-space-mist/50 hover:text-space-mist/80',
                )}
              >
                <div className="text-sm font-medium">{q.label}</div>
                <div className="text-[10px] text-space-mist/30 mt-0.5">{q.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stream area */}
      <div className="flex-1 glass-card rounded-t-none border-t-0 overflow-hidden" style={{ minHeight: '500px' }}>
        {connected ? (
          <div className="relative w-full h-full bg-space-void flex items-center justify-center">
            {/* This would be the actual stream canvas/video element */}
            <div className="text-center">
              <Monitor className="w-20 h-20 text-space-accent/20 mx-auto mb-4" />
              <p className="text-space-mist/40 text-sm">
                Remote stream would appear here
              </p>
              <p className="text-space-mist/20 text-xs mt-1">
                WebRTC or fallback stream from {deviceId}
              </p>
              <button
                onClick={() => setConnected(false)}
                className="cosmic-button flex items-center gap-2 text-xs mt-4 mx-auto"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="relative mb-8">
              <Monitor className="w-24 h-24 text-space-accent/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-10 rounded border-2 border-dashed border-space-accent/20 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-space-accent/30 animate-pulse" />
                </div>
              </div>
            </div>

            <h4 className="font-display font-semibold text-lg text-space-white mb-2">
              Remote Desktop Access
            </h4>
            <p className="text-sm text-space-mist/40 text-center max-w-sm mb-6 leading-relaxed">
              Stream the full desktop UI from this device. Best used on LAN for low latency.
              This is a secondary feature — use clipboard, files, and terminal for faster workflows.
            </p>

            <button
              onClick={startSession}
              className="cosmic-button-primary flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Start Remote Session
            </button>

            <p className="text-[10px] text-space-mist/20 mt-4 font-mono">
              Requires Screen Recording permission on macOS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
