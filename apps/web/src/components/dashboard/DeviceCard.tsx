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
        )}
        style={{ animationDelay: `${index * 0.06}s` }}
      >
        <div className="flex items-center gap-4">
          {/* OS icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
            style={{
              background: device.online ? '#f0f0f0' : '#f7f7f7',
              color: device.online ? '#1a1a1a' : '#c4c4c4',
            }}
          >
            {osIcons[device.os] || <Monitor className="w-6 h-6" />}
          </div>

          {/* Name + IP */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="font-display font-semibold text-[15px] transition-colors truncate"
                style={{ color: '#1a1a1a' }}
              >
                {device.name}
              </h3>
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                device.online ? 'status-online' : 'status-offline',
              )} />
            </div>
            <p className="text-xs font-mono mt-1 truncate" style={{ color: '#888888' }}>
              {device.localIp}
            </p>
          </div>

          {/* Chevron hint */}
          <ChevronRight
            className="w-4 h-4 shrink-0 transform group-hover:translate-x-0.5 transition-all duration-300"
            style={{ color: '#d4d4d4' }}
          />
        </div>
      </div>
    </Link>
  );
}
