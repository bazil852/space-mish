'use client';

import { Cpu, HardDrive, Wifi } from 'lucide-react';
import type { Device } from '@/hooks/useDevices';

interface Props {
  devices: Device[];
}

export default function StatusBar({ devices }: Props) {
  const online = devices.filter(d => d.online).length;
  const total = devices.length;
  const capabilities = {
    terminals: devices.filter(d => d.online && d.capabilities.terminal).length,
    files: devices.filter(d => d.online && d.capabilities.files).length,
    codeServers: devices.filter(d => d.online && d.capabilities.codeServer).length,
  };

  return (
    <div className="flex items-center gap-3 flex-wrap opacity-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-surface">
        <Wifi className="w-3.5 h-3.5 text-space-accent/60" />
        <span className="text-xs font-mono text-space-mist/70">
          <span className="text-emerald-400 font-semibold">{online}</span>
          <span className="text-space-mist/30"> / </span>
          <span>{total}</span>
          <span className="text-space-mist/40 ml-1.5">devices</span>
        </span>
      </div>

      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-surface">
        <Cpu className="w-3.5 h-3.5 text-space-cyan/50" />
        <span className="text-xs font-mono text-space-mist/50">
          {capabilities.terminals} terminals
        </span>
      </div>

      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-surface">
        <HardDrive className="w-3.5 h-3.5 text-space-cyan/50" />
        <span className="text-xs font-mono text-space-mist/50">
          {capabilities.files} file systems
        </span>
      </div>
    </div>
  );
}
