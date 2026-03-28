'use client';

import { useState } from 'react';
import { Satellite, Search, Command, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import CommandPalette from '@/components/command-palette/CommandPalette';

export default function Topbar() {
  const { connected } = useSocket();
  const [showPalette, setPalette] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 glass-card-solid border-t-0 border-x-0 rounded-none px-5 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Satellite className="w-7 h-7 text-space-accent" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-space-cyan animate-pulse-glow" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-tight text-space-white leading-none">
                Space Mish
              </h1>
              <p className="text-[10px] font-mono text-space-mist/60 tracking-widest uppercase mt-0.5">
                Control Hub
              </p>
            </div>
          </div>

          {/* Search / Command Palette trigger */}
          <button
            onClick={() => setPalette(true)}
            className="flex-1 max-w-md flex items-center gap-3 px-4 py-2.5 rounded-xl
                       bg-space-void/60 border border-space-border hover:border-space-border-bright
                       transition-all duration-300 group cursor-pointer"
          >
            <Search className="w-4 h-4 text-space-mist/50 group-hover:text-space-accent transition-colors" />
            <span className="text-sm text-space-mist/40 group-hover:text-space-mist/60 transition-colors">
              Search devices, commands...
            </span>
            <kbd className="ml-auto hidden sm:flex items-center gap-1 text-[10px] font-mono text-space-mist/30
                            px-1.5 py-0.5 rounded border border-space-border">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Connection status */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-surface">
              {connected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-mono text-emerald-400/80">LAN</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-space-mist/40" />
                  <span className="text-xs font-mono text-space-mist/40">OFF</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {showPalette && <CommandPalette onClose={() => setPalette(false)} />}
    </>
  );
}
