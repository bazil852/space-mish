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
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0, 0, 0, 0.15)' }} />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 overflow-hidden animate-slide-up"
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e5e5e5',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #ebebeb' }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: '#a3a3a3' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-base font-body outline-none"
            style={{ color: '#1a1a1a' }}
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: '#a3a3a3' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#a3a3a3' }}>
              No commands found
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); onClose(); }}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-all duration-150"
              style={{
                background: i === selectedIndex ? '#f5f5f5' : 'transparent',
                border: i === selectedIndex ? '1px solid #e0e0e0' : '1px solid transparent',
                color: '#1a1a1a',
              }}
            >
              <div
                className="flex-shrink-0 p-2 rounded-lg"
                style={{
                  background: i === selectedIndex ? '#ebebeb' : '#f7f7f7',
                  color: i === selectedIndex ? '#1a1a1a' : '#888888',
                }}
              >
                {cmd.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cmd.label}</div>
                <div className="text-xs truncate" style={{ color: '#a3a3a3' }}>{cmd.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-2.5 flex items-center gap-4 text-[10px] font-mono"
          style={{ borderTop: '1px solid #ebebeb', color: '#c4c4c4' }}
        >
          <span>&#8593;&#8595; navigate</span>
          <span>&#8629; select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
