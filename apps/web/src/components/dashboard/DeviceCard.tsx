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
  windows: <Monitor className="w-8 h-8" />,
  macos: <Laptop className="w-8 h-8" />,
  linux: <MonitorSmartphone className="w-8 h-8" />,
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
          'glass-card group relative overflow-hidden p-5 cursor-pointer opacity-0 animate-slide-up',
          device.preferred && 'glow-border',
        )}
        style={{ animationDelay: `${index * 0.07}s` }}
      >
        {/* Hover glow effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                        bg-gradient-to-br from-space-accent/5 via-transparent to-space-cyan/3 pointer-events-none" />

        {/* Top row: OS icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300',
              device.online
                ? 'bg-space-accent/10 text-space-accent group-hover:bg-space-accent/15 group-hover:shadow-lg group-hover:shadow-space-accent/10'
                : 'bg-space-navy/50 text-space-mist/30',
            )}>
              {osIcons[device.os] || <Monitor className="w-8 h-8" />}
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-space-white group-hover:text-white transition-colors leading-tight">
                {device.name}
              </h3>
              <p className="text-xs text-space-mist/60 font-mono mt-0.5">
                {device.localIp}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={device.online ? 'status-online' : 'status-offline'} />
            <span className={cn(
              'text-[10px] font-mono uppercase tracking-wider',
              device.online ? 'text-emerald-400/70' : 'text-space-mist/30',
            )}>
              {device.online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 mb-4 text-xs text-space-mist/50">
          <span className="font-mono">{getOsLabel(device.os)}</span>
          <span className="w-px h-3 bg-space-border" />
          <span className="font-mono">{device.hostname}</span>
          <span className="w-px h-3 bg-space-border" />
          <span>{formatRelativeTime(device.lastSeenAt)}</span>
        </div>

        {/* Capabilities */}
        <div className="flex items-center gap-2 mb-4">
          {capabilityIcons.map(({ key, icon: Icon, label }) => {
            const enabled = device.capabilities[key as keyof typeof device.capabilities];
            return (
              <div
                key={key}
                title={label}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  enabled
                    ? 'bg-space-accent/8 text-space-accent/70 group-hover:bg-space-accent/12 group-hover:text-space-accent'
                    : 'bg-space-navy/30 text-space-mist/20',
                )}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Tags */}
        {device.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            {device.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider
                           bg-space-cyan/8 text-space-cyan/50 border border-space-cyan/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom action hint */}
        <div className="flex items-center justify-end text-xs text-space-mist/25 group-hover:text-space-accent/50 transition-colors">
          <span className="mr-1">Open</span>
          <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Decorative orbit ring */}
        <div className="orbit-ring w-[300px] h-[300px] -right-[100px] -bottom-[100px] opacity-0 group-hover:opacity-100
                        transition-opacity duration-700" />
      </div>
    </Link>
  );
}
