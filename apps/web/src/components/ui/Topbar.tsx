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
      <header className="sticky top-0 z-40 glass-card-solid border-t-0 border-x-0 rounded-none px-5 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Satellite className="w-5 h-5 text-space-accent" />
            <h1 className="font-display font-bold text-base tracking-tight text-space-white leading-none">
              Space Mish
            </h1>
          </div>

          {/* Search pill — compact command palette trigger */}
          <button
            onClick={() => setPalette(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                       bg-space-void/50 border border-space-border hover:border-space-border-bright
                       transition-all duration-200 group cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-space-mist/40 group-hover:text-space-accent transition-colors" />
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-space-mist/30">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Connection dot */}
          <div
            className={connected
              ? 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
              : 'w-2.5 h-2.5 rounded-full bg-space-mist/25'
            }
            title={connected ? 'Connected to LAN' : 'Disconnected'}
          />
        </div>
      </header>

      {showPalette && <CommandPalette onClose={() => setPalette(false)} />}
    </>
  );
}
