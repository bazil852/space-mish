'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Monitor, Laptop, Cpu, HardDrive, Network, Clock, Tag, Star,
  Terminal, FolderOpen, Clipboard, Code2, MonitorSmartphone,
  Trash2, Square, XCircle, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { getOsLabel, formatRelativeTime, hubFetch } from '@/lib/utils';
import type { Device } from '@/hooks/useDevices';

interface Props {
  device: Device;
}

interface TermSession {
  id: string;
  shell: string;
  profile: string;
  createdAt: string;
}

interface CodeSession {
  port: number;
  projectPath: string;
  url: string;
  startedAt: string;
}

interface AllSessions {
  terminals: TermSession[];
  codeServers: CodeSession[];
}

export default function OverviewTab({ device }: Props) {
  const [sessions, setSessions] = useState<AllSessions | null>(null);
  const [killing, setKilling] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const url = `http://${device.localIp}:${device.agentPort}/sessions`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) setSessions(data.data);
    } catch {
      setSessions(null);
    }
  }, [device.localIp, device.agentPort]);

  useEffect(() => {
    if (device.online) {
      fetchSessions();
      const interval = setInterval(fetchSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [device.online, fetchSessions]);

  async function killTerminal(id: string) {
    setKilling(id);
    try {
      await fetch(`http://${device.localIp}:${device.agentPort}/sessions/terminal/${id}`, { method: 'DELETE' });
      fetchSessions();
    } catch {}
    setKilling(null);
  }

  async function killCodeServer(port: number) {
    setKilling(`code-${port}`);
    try {
      await fetch(`http://${device.localIp}:${device.agentPort}/sessions/code/${port}`, { method: 'DELETE' });
      fetchSessions();
    } catch {}
    setKilling(null);
  }

  async function killAllTerminals() {
    setKilling('all-terminals');
    try {
      await fetch(`http://${device.localIp}:${device.agentPort}/sessions/terminals`, { method: 'DELETE' });
      fetchSessions();
    } catch {}
    setKilling(null);
  }

  async function killEverything() {
    if (!confirm('Kill ALL running sessions (terminals + code servers)?')) return;
    setKilling('everything');
    try {
      await fetch(`http://${device.localIp}:${device.agentPort}/sessions/all`, { method: 'DELETE' });
      fetchSessions();
    } catch {}
    setKilling(null);
  }

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

  const totalRunning = sessions
    ? sessions.terminals.length + sessions.codeServers.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Device info card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-space-accent/10 text-space-accent">{osIcon}</div>
            <div>
              <h3 className="font-display font-bold text-lg text-space-white">{device.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={device.online ? 'status-online' : 'status-offline'} />
                <span className="text-xs text-space-mist/50">{device.online ? 'Online' : 'Offline'}</span>
                {device.preferred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-1" />}
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
                <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider bg-space-cyan/8 text-space-cyan/60 border border-space-cyan/10">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {device.notes && (
            <p className="text-xs text-space-mist/40 mt-4 pt-4 border-t border-space-border/50">{device.notes}</p>
          )}
        </div>

        {/* Capabilities card */}
        <div className="glass-card p-6">
          <h4 className="font-display font-semibold text-sm text-space-mist/50 uppercase tracking-widest mb-5">Capabilities</h4>
          <div className="space-y-3">
            {caps.map(({ key, icon: Icon, label, enabled }) => (
              <div key={key} className={`flex items-center gap-3.5 p-3.5 rounded-xl transition-all ${
                enabled ? 'bg-space-accent/6 border border-space-accent/10' : 'bg-space-navy/20 border border-space-border/30 opacity-40'
              }`}>
                <div className={`p-2 rounded-lg ${enabled ? 'bg-space-accent/15 text-space-accent' : 'bg-space-navy/50 text-space-mist/30'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-sm font-medium flex-1 ${enabled ? 'text-space-white' : 'text-space-mist/30'}`}>{label}</span>
                <div className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  enabled ? 'bg-emerald-500/10 text-emerald-400/70' : 'bg-space-navy/30 text-space-mist/20'
                }`}>{enabled ? 'Ready' : 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ Running Sessions Manager ═══════ */}
      {device.online && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h4 className="font-display font-semibold text-space-white">Running Sessions</h4>
              {totalRunning > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/15">
                  {totalRunning} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchSessions}
                      className="p-2 rounded-lg hover:bg-space-navy/40 text-space-mist/40 hover:text-space-accent transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              {totalRunning > 0 && (
                <button
                  onClick={killEverything}
                  disabled={killing === 'everything'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-red-500/10 text-red-400/70 border border-red-500/15
                             hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Kill All
                </button>
              )}
            </div>
          </div>

          {!sessions ? (
            <p className="text-sm text-space-mist/30 italic">Loading sessions...</p>
          ) : totalRunning === 0 ? (
            <p className="text-sm text-space-mist/30">No active sessions. Terminals and code servers will appear here when running.</p>
          ) : (
            <div className="space-y-2">
              {/* Terminal sessions */}
              {sessions.terminals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-display font-semibold text-space-mist/40 uppercase tracking-widest flex items-center gap-2">
                      <Terminal className="w-3 h-3" />
                      Terminals ({sessions.terminals.length})
                    </h5>
                    {sessions.terminals.length > 1 && (
                      <button
                        onClick={killAllTerminals}
                        disabled={killing === 'all-terminals'}
                        className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        Close all terminals
                      </button>
                    )}
                  </div>
                  {sessions.terminals.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl glass-surface group">
                      <Terminal className="w-4 h-4 text-space-accent/50 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-space-white/80">{t.profile || t.shell}</p>
                        <p className="text-[10px] text-space-mist/30">
                          Started {formatRelativeTime(t.createdAt)} · {t.id.slice(0, 8)}
                        </p>
                      </div>
                      <button
                        onClick={() => killTerminal(t.id)}
                        disabled={killing === t.id}
                        className="p-2 rounded-lg text-space-mist/30 hover:bg-red-500/15 hover:text-red-400 transition-all
                                   opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Kill session"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Code server sessions */}
              {sessions.codeServers.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-display font-semibold text-space-mist/40 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Code2 className="w-3 h-3" />
                    Code Servers ({sessions.codeServers.length})
                  </h5>
                  {sessions.codeServers.map(c => (
                    <div key={c.port} className="flex items-center gap-3 p-3 rounded-xl glass-surface group">
                      <Code2 className="w-4 h-4 text-emerald-400/50 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-space-white/80">
                          {c.projectPath.split(/[/\\]/).pop()}
                        </p>
                        <p className="text-[10px] text-space-mist/30">
                          Port {c.port} · {formatRelativeTime(c.startedAt)}
                        </p>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener"
                        className="text-[11px] font-mono text-space-accent/60 hover:text-space-accent transition-colors"
                      >
                        Open
                      </a>
                      <button
                        onClick={() => killCodeServer(c.port)}
                        disabled={killing === `code-${c.port}`}
                        className="p-2 rounded-lg text-space-mist/30 hover:bg-red-500/15 hover:text-red-400 transition-all
                                   opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Stop code-server"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
