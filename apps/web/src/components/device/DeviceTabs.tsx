'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Clipboard, FolderOpen, Terminal, Code2, Monitor, Settings,
} from 'lucide-react';

export type TabId = 'overview' | 'clipboard' | 'files' | 'terminal' | 'projects' | 'remote' | 'settings';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  capabilities: Record<string, boolean>;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode; capKey?: string }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'clipboard', label: 'Clipboard', icon: <Clipboard className="w-4 h-4" />, capKey: 'clipboardRead' },
  { id: 'files', label: 'Files', icon: <FolderOpen className="w-4 h-4" />, capKey: 'files' },
  { id: 'terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" />, capKey: 'terminal' },
  { id: 'projects', label: 'Projects', icon: <Code2 className="w-4 h-4" />, capKey: 'codeServer' },
  { id: 'remote', label: 'Remote', icon: <Monitor className="w-4 h-4" />, capKey: 'remoteView' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function DeviceTabs({ active, onChange, capabilities }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {tabs.map(tab => {
        if (tab.capKey && !capabilities[tab.capKey]) return null;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border',
              isActive
                ? 'text-white border-transparent'
                : 'border-transparent hover:bg-neutral-100',
            )}
            style={
              isActive
                ? { background: '#1a1a1a', color: '#ffffff' }
                : { color: '#888888' }
            }
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
