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
      <header
        className="sticky top-0 z-40 px-5 py-2.5"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Satellite className="w-5 h-5" style={{ color: '#1a1a1a' }} />
            <h1 className="font-display font-bold text-base tracking-tight leading-none" style={{ color: '#1a1a1a' }}>
              BazilBot Universe
            </h1>
          </div>

          {/* Search pill -- compact command palette trigger */}
          <button
            onClick={() => setPalette(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                       transition-all duration-200 group cursor-pointer"
            style={{
              background: '#f5f5f5',
              border: '1px solid #e0e0e0',
            }}
          >
            <Search className="w-3.5 h-3.5 transition-colors" style={{ color: '#a3a3a3' }} />
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono" style={{ color: '#a3a3a3' }}>
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Connection dot */}
          <div
            className={connected
              ? 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
              : 'w-2.5 h-2.5 rounded-full'
            }
            style={!connected ? { background: '#d4d4d4' } : undefined}
            title={connected ? 'Connected to LAN' : 'Disconnected'}
          />
        </div>
      </header>

      {showPalette && <CommandPalette onClose={() => setPalette(false)} />}
    </>
  );
}
