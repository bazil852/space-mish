'use client';

import {
  Monitor, Laptop, Cpu, HardDrive, Network, Clock, Tag, Star,
  Terminal, FolderOpen, Clipboard, Code2, MonitorSmartphone,
} from 'lucide-react';
import { getOsLabel, formatRelativeTime } from '@/lib/utils';
import type { Device } from '@/hooks/useDevices';

interface Props {
  device: Device;
}

export default function OverviewTab({ device }: Props) {
  const osIcon = device.os === 'windows'
    ? <Monitor className="w-6 h-6" />
    : device.os === 'macos'
    ? <Laptop className="w-6 h-6" />
    : <MonitorSmartphone className="w-6 h-6" />;

  const infoItems = [
    { icon: <Network className="w-4 h-4" />, label: 'IP Address', value: device.localIp },
    { icon: <Cpu className="w-4 h-4" />, label: 'Hostname', value: device.hostname },
    { icon: <HardDrive className="w-4 h-4" />, label: 'OS', value: getOsLabel(device.os) },
    { icon: <Clock className="w-4 h-4" />, label: 'Last Seen', value: formatRelativeTime(device.lastSeenAt) },
    { icon: <Tag className="w-4 h-4" />, label: 'Agent Port', value: String(device.agentPort) },
  ];

  const caps = [
    { key: 'terminal', icon: Terminal, label: 'Terminal', enabled: device.capabilities.terminal },
    { key: 'files', icon: FolderOpen, label: 'File Browser', enabled: device.capabilities.files },
    { key: 'clipboardRead', icon: Clipboard, label: 'Clipboard', enabled: device.capabilities.clipboardRead },
    { key: 'codeServer', icon: Code2, label: 'Code Server', enabled: device.capabilities.codeServer },
    { key: 'remoteView', icon: Monitor, label: 'Remote View', enabled: device.capabilities.remoteView },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Device info card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-space-accent/10 text-space-accent">
            {osIcon}
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-space-white">{device.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={device.online ? 'status-online' : 'status-offline'} />
              <span className="text-xs text-space-mist/50">
                {device.online ? 'Online' : 'Offline'}
              </span>
              {device.preferred && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-1" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {infoItems.map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-space-border/50 last:border-0">
              <div className="flex items-center gap-2.5 text-space-mist/50">
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </div>
              <span className="text-sm font-mono text-space-white">{item.value}</span>
            </div>
          ))}
        </div>

        {device.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-space-border/50">
            {device.tags.map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider
                           bg-space-cyan/8 text-space-cyan/60 border border-space-cyan/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {device.notes && (
          <p className="text-xs text-space-mist/40 mt-4 pt-4 border-t border-space-border/50">
            {device.notes}
          </p>
        )}
      </div>

      {/* Capabilities card */}
      <div className="glass-card p-6">
        <h4 className="font-display font-semibold text-sm text-space-mist/50 uppercase tracking-widest mb-5">
          Capabilities
        </h4>
        <div className="space-y-3">
          {caps.map(({ key, icon: Icon, label, enabled }) => (
            <div
              key={key}
              className={`flex items-center gap-3.5 p-3.5 rounded-xl transition-all duration-200 ${
                enabled
                  ? 'bg-space-accent/6 border border-space-accent/10'
                  : 'bg-space-navy/20 border border-space-border/30 opacity-40'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                enabled ? 'bg-space-accent/15 text-space-accent' : 'bg-space-navy/50 text-space-mist/30'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className={`text-sm font-medium ${enabled ? 'text-space-white' : 'text-space-mist/30'}`}>
                  {label}
                </span>
              </div>
              <div className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-400/70'
                  : 'bg-space-navy/30 text-space-mist/20'
              }`}>
                {enabled ? 'Ready' : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
