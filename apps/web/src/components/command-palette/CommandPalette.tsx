'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal, FolderOpen, Play, RotateCcw, Code2, Copy, Monitor,
  Clipboard, Search, X,
} from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';

interface Props {
  onClose: () => void;
}

interface PaletteCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

export default function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { devices } = useDevices();

  const commands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [];
    for (const device of devices) {
      if (device.capabilities.terminal) {
        cmds.push({
          id: `terminal-${device.id}`,
          label: `Open Terminal`,
          description: device.name,
          icon: <Terminal className="w-4 h-4" />,
          action: () => { window.location.href = `/devices/${device.id}?tab=terminal`; },
          keywords: ['terminal', 'shell', 'bash', 'zsh', device.name.toLowerCase()],
        });
      }
      if (device.capabilities.files) {
        cmds.push({
          id: `files-${device.id}`,
          label: `Browse Files`,
          description: device.name,
          icon: <FolderOpen className="w-4 h-4" />,
          action: () => { window.location.href = `/devices/${device.id}?tab=files`; },
          keywords: ['files', 'browse', 'folder', device.name.toLowerCase()],
        });
      }
      if (device.capabilities.clipboardRead) {
        cmds.push({
          id: `clipboard-${device.id}`,
          label: `Clipboard`,
          description: device.name,
          icon: <Clipboard className="w-4 h-4" />,
          action: () => { window.location.href = `/devices/${device.id}?tab=clipboard`; },
          keywords: ['clipboard', 'paste', 'copy', device.name.toLowerCase()],
        });
      }
      if (device.capabilities.codeServer) {
        cmds.push({
          id: `code-${device.id}`,
          label: `Launch Code Workspace`,
          description: device.name,
          icon: <Code2 className="w-4 h-4" />,
          action: () => { window.location.href = `/devices/${device.id}?tab=projects`; },
          keywords: ['code', 'vscode', 'editor', 'workspace', device.name.toLowerCase()],
        });
      }
      if (device.capabilities.remoteView) {
        cmds.push({
          id: `remote-${device.id}`,
          label: `Remote View`,
          description: device.name,
          icon: <Monitor className="w-4 h-4" />,
          action: () => { window.location.href = `/devices/${device.id}?tab=remote`; },
          keywords: ['remote', 'screen', 'desktop', 'view', device.name.toLowerCase()],
        });
      }
      cmds.push({
        id: `info-${device.id}`,
        label: `Copy Device Info`,
        description: `${device.name} — ${device.localIp}`,
        icon: <Copy className="w-4 h-4" />,
        action: () => {
          navigator.clipboard.writeText(`${device.name}\n${device.hostname}\n${device.localIp}\n${device.os}`);
          onClose();
        },
        keywords: ['copy', 'info', 'ip', device.name.toLowerCase(), device.localIp],
      });
    }
    cmds.push(
      {
        id: 'projects',
        label: 'All Projects',
        description: 'View all projects across devices',
        icon: <Play className="w-4 h-4" />,
        action: () => { window.location.href = '/projects'; },
        keywords: ['projects', 'all', 'view'],
      },
      {
        id: 'refresh',
        label: 'Refresh Devices',
        description: 'Re-scan LAN for devices',
        icon: <RotateCcw className="w-4 h-4" />,
        action: () => { window.location.reload(); },
        keywords: ['refresh', 'scan', 'reload', 'discover'],
      }
    );
    return cmds;
  }, [devices, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.keywords.some(k => k.includes(q))
    );
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, filtered, selectedIndex]);

  useEffect(() => setSelectedIndex(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-space-void/70 backdrop-blur-md" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 glass-card-solid overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-space-border">
          <Search className="w-5 h-5 text-space-accent/60 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-space-white text-base font-body outline-none placeholder:text-space-mist/35"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-space-navy/50 transition-colors">
            <X className="w-4 h-4 text-space-mist/50" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-space-mist/40 text-sm">
              No commands found
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); onClose(); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-all duration-150
                ${i === selectedIndex
                  ? 'bg-space-accent/15 border border-space-accent/20 text-space-white'
                  : 'border border-transparent text-space-mist hover:bg-space-navy/40 hover:text-space-white'
                }`}
            >
              <div className={`flex-shrink-0 p-2 rounded-lg ${
                i === selectedIndex ? 'bg-space-accent/20 text-space-accent' : 'bg-space-navy/50 text-space-mist/60'
              }`}>
                {cmd.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cmd.label}</div>
                <div className="text-xs text-space-mist/50 truncate">{cmd.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-space-border flex items-center gap-4 text-[10px] font-mono text-space-mist/30">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
