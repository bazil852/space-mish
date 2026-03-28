'use client';

import Link from 'next/link';
import {
  Monitor, Laptop, Terminal, FolderOpen, Clipboard, Code2,
  MonitorSmartphone, ChevronRight,
} from 'lucide-react';
import { cn, formatRelativeTime, getOsLabel } from '@/lib/utils';
import type { Device } from '@/hooks/useDevices';

interface Props {
  device: Device;
  index: number;
}

const osIcons: Record<string, React.ReactNode> = {
  windows: <Monitor className="w-6 h-6" />,
  macos: <Laptop className="w-6 h-6" />,
  linux: <MonitorSmartphone className="w-6 h-6" />,
};

const capabilityIcons = [
  { key: 'terminal', icon: Terminal, label: 'Terminal' },
  { key: 'files', icon: FolderOpen, label: 'Files' },
  { key: 'clipboardRead', icon: Clipboard, label: 'Clipboard' },
  { key: 'codeServer', icon: Code2, label: 'Code' },
] as const;

export default function DeviceCard({ device, index }: Props) {
  return (
    <Link href={`/devices/${device.id}`}>
      <div
        className={cn(
          'glass-card group relative overflow-hidden p-6 cursor-pointer opacity-0 animate-slide-up',
          'hover:translate-y-[-2px] hover:shadow-lg hover:shadow-space-accent/5',
          device.preferred && 'glow-border',
        )}
        style={{ animationDelay: `${index * 0.06}s` }}
      >
        {/* Subtle hover gradient */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                        bg-gradient-to-br from-space-accent/5 via-transparent to-transparent pointer-events-none" />

        <div className="flex items-center gap-4">
          {/* OS icon — visual anchor */}
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
            device.online
              ? 'bg-space-accent/10 text-space-accent group-hover:bg-space-accent/15 group-hover:shadow-md group-hover:shadow-space-accent/10'
              : 'bg-space-navy/50 text-space-mist/25',
          )}>
            {osIcons[device.os] || <Monitor className="w-6 h-6" />}
          </div>

          {/* Name + IP */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-[15px] text-space-white group-hover:text-white transition-colors truncate">
                {device.name}
              </h3>
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                device.online ? 'status-online' : 'status-offline',
              )} />
            </div>
            <p className="text-xs text-space-mist/45 font-mono mt-1 truncate">
              {device.localIp}
            </p>
          </div>

          {/* Chevron hint */}
          <ChevronRight className="w-4 h-4 text-space-mist/15 group-hover:text-space-accent/40 shrink-0
                                   transform group-hover:translate-x-0.5 transition-all duration-300" />
        </div>
      </div>
    </Link>
  );
}
