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
            <div className="p-3 rounded-xl" style={{ background: '#f0f0f0', color: '#1a1a1a' }}>{osIcon}</div>
            <div>
              <h3 className="font-display font-bold text-lg" style={{ color: '#1a1a1a' }}>{device.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={device.online ? 'status-online' : 'status-offline'} />
                <span className="text-xs" style={{ color: '#888888' }}>{device.online ? 'Online' : 'Offline'}</span>
                {device.preferred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-1" />}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {infoItems.map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div className="flex items-center gap-2.5" style={{ color: '#888888' }}>
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-sm font-mono" style={{ color: '#1a1a1a' }}>{item.value}</span>
              </div>
            ))}
          </div>
          {device.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid #f0f0f0' }}>
              {device.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider"
                  style={{ background: '#f7f7f7', color: '#888888', border: '1px solid #ebebeb' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {device.notes && (
            <p className="text-xs mt-4 pt-4" style={{ color: '#a3a3a3', borderTop: '1px solid #f0f0f0' }}>{device.notes}</p>
          )}
        </div>

        {/* Capabilities card */}
        <div className="glass-card p-6">
          <h4 className="font-display font-semibold text-sm uppercase tracking-widest mb-5" style={{ color: '#888888' }}>Capabilities</h4>
          <div className="space-y-3">
            {caps.map(({ key, icon: Icon, label, enabled }) => (
              <div
                key={key}
                className="flex items-center gap-3.5 p-3.5 rounded-xl transition-all"
                style={{
                  background: enabled ? '#f7f7f7' : '#fafafa',
                  border: enabled ? '1px solid #e5e5e5' : '1px solid #f0f0f0',
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                <div
                  className="p-2 rounded-lg"
                  style={{
                    background: enabled ? '#ebebeb' : '#f0f0f0',
                    color: enabled ? '#1a1a1a' : '#c4c4c4',
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: enabled ? '#1a1a1a' : '#c4c4c4' }}>{label}</span>
                <div
                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{
                    background: enabled ? 'rgba(34,197,94,0.08)' : '#f5f5f5',
                    color: enabled ? '#22c55e' : '#c4c4c4',
                  }}
                >{enabled ? 'Ready' : 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Running Sessions Manager */}
      {device.online && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h4 className="font-display font-semibold" style={{ color: '#1a1a1a' }}>Running Sessions</h4>
              {totalRunning > 0 && (
                <span
                  className="px-2.5 py-0.5 rounded-lg text-xs font-mono"
                  style={{ background: 'rgba(251,191,36,0.08)', color: '#d97706', border: '1px solid rgba(251,191,36,0.15)' }}
                >
                  {totalRunning} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSessions}
                className="p-2 rounded-lg transition-all"
                style={{ color: '#a3a3a3' }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {totalRunning > 0 && (
                <button
                  onClick={killEverything}
                  disabled={killing === 'everything'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium
                             transition-all disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.12)' }}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Kill All
                </button>
              )}
            </div>
          </div>

          {!sessions ? (
            <p className="text-sm italic" style={{ color: '#a3a3a3' }}>Loading sessions...</p>
          ) : totalRunning === 0 ? (
            <p className="text-sm" style={{ color: '#a3a3a3' }}>No active sessions. Terminals and code servers will appear here when running.</p>
          ) : (
            <div className="space-y-2">
              {/* Terminal sessions */}
              {sessions.terminals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-display font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: '#a3a3a3' }}>
                      <Terminal className="w-3 h-3" />
                      Terminals ({sessions.terminals.length})
                    </h5>
                    {sessions.terminals.length > 1 && (
                      <button
                        onClick={killAllTerminals}
                        disabled={killing === 'all-terminals'}
                        className="text-[10px] transition-colors disabled:opacity-50"
                        style={{ color: '#ef4444' }}
                      >
                        Close all terminals
                      </button>
                    )}
                  </div>
                  {sessions.terminals.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl glass-surface group">
                      <Terminal className="w-4 h-4 flex-shrink-0" style={{ color: '#888888' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono" style={{ color: '#1a1a1a' }}>{t.profile || t.shell}</p>
                        <p className="text-[10px]" style={{ color: '#a3a3a3' }}>
                          Started {formatRelativeTime(t.createdAt)} · {t.id.slice(0, 8)}
                        </p>
                      </div>
                      <button
                        onClick={() => killTerminal(t.id)}
                        disabled={killing === t.id}
                        className="p-2 rounded-lg transition-all
                                   opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        style={{ color: '#ef4444' }}
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
                  <h5 className="text-xs font-display font-semibold uppercase tracking-widest flex items-center gap-2 mb-2" style={{ color: '#a3a3a3' }}>
                    <Code2 className="w-3 h-3" />
                    Code Servers ({sessions.codeServers.length})
                  </h5>
                  {sessions.codeServers.map(c => (
                    <div key={c.port} className="flex items-center gap-3 p-3 rounded-xl glass-surface group">
                      <Code2 className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono" style={{ color: '#1a1a1a' }}>
                          {c.projectPath.split(/[/\\]/).pop()}
                        </p>
                        <p className="text-[10px]" style={{ color: '#a3a3a3' }}>
                          Port {c.port} · {formatRelativeTime(c.startedAt)}
                        </p>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener"
                        className="text-[11px] font-mono transition-colors"
                        style={{ color: '#1a1a1a' }}
                      >
                        Open
                      </a>
                      <button
                        onClick={() => killCodeServer(c.port)}
                        disabled={killing === `code-${c.port}`}
                        className="p-2 rounded-lg transition-all
                                   opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        style={{ color: '#ef4444' }}
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
