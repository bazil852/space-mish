'use client';

import Link from 'next/link';
import {
  Monitor, Laptop, Terminal, FolderOpen, Clipboard, Code2,
  MonitorSmartphone, ChevronRight,
} from 'lucide-react';
import { cn, getOsLabel } from '@/lib/utils';
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

const capabilities = [
  { key: 'terminal', icon: Terminal, tip: 'Terminal' },
  { key: 'files', icon: FolderOpen, tip: 'Files' },
  { key: 'clipboardRead', icon: Clipboard, tip: 'Clipboard' },
  { key: 'codeServer', icon: Code2, tip: 'VS Code' },
] as const;

export default function DeviceCard({ device, index }: Props) {
  const activeCaps = capabilities.filter(
    c => device.capabilities[c.key as keyof typeof device.capabilities]
  );

  return (
    <Link href={`/devices/${device.id}`}>
      <div
        className={cn(
          'glass-card group relative overflow-hidden p-5 cursor-pointer opacity-0 animate-slide-up',
        )}
        style={{ animationDelay: `${index * 0.06}s` }}
      >
        <div className="flex items-center gap-4">
          {/* OS icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
            style={{
              background: device.online ? '#1a1a1a' : '#f0f0f0',
              color: device.online ? '#ffffff' : '#c4c4c4',
            }}
          >
            {osIcons[device.os] || <Monitor className="w-6 h-6" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-[15px] truncate" style={{ color: '#1a1a1a' }}>
                {device.name}
              </h3>
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                device.online ? 'status-online' : 'status-offline',
              )} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-medium" style={{ color: '#a3a3a3' }}>
                {getOsLabel(device.os)}
              </span>
              <span style={{ color: '#d4d4d4' }}>&middot;</span>
              <span className="text-[11px] font-mono" style={{ color: '#b5b5b5' }}>
                {device.localIp}
              </span>
            </div>

            {/* Capability dots */}
            {device.online && activeCaps.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2.5">
                {activeCaps.map(({ key, icon: Icon, tip }) => (
                  <div
                    key={key}
                    title={tip}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors group-hover:bg-neutral-100"
                    style={{ background: '#f7f7f7', color: '#999' }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chevron */}
          <ChevronRight
            className="w-4 h-4 shrink-0 transform group-hover:translate-x-0.5 transition-all duration-300"
            style={{ color: '#d4d4d4' }}
          />
        </div>
      </div>
    </Link>
  );
}
