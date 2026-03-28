'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Code2, Terminal, FolderOpen, ExternalLink, GitBranch,
  RefreshCw, Square, Loader2, Search, Server, Copy, Check,
  Play,
} from 'lucide-react';
import { hubFetch, cn, formatRelativeTime } from '@/lib/utils';

interface Props {
  deviceId: string;
}

interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  type: string;
  markers: string[];
  hasGit: boolean;
  lastModified: string;
}

interface CodeSession {
  port: number;
  projectPath: string;
  url: string;
  startedAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  node: '📦', rust: '🦀', go: '🐹', python: '🐍',
  java: '☕', dotnet: '🔷', cpp: '⚙️', generic: '📁',
};

export default function ProjectsTab({ deviceId }: Props) {
  const [projects, setProjects] = useState<DiscoveredProject[]>([]);
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Go through hub which proxies to the agent
      const res = await hubFetch<{ ok: boolean; data: DiscoveredProject[] }>(
        `/api/projects?deviceId=${deviceId}&deep=true`
      );
      if (res.ok && res.data) {
        setProjects(res.data);
      }
    } catch {
      // Projects endpoint may not be proxying correctly, try empty
      setProjects([]);
    }
    setLoading(false);
  }, [deviceId]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await hubFetch<{ ok: boolean; data: CodeSession[] }>(
        `/api/projects/sessions/${deviceId}`
      );
      if (res.ok && res.data) {
        setSessions(res.data);
      }
    } catch {
      setSessions([]);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchProjects();
    fetchSessions();
    // Poll sessions every 5s
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects, fetchSessions]);

  async function launchCodeServer(project: DiscoveredProject) {
    // Check if already running
    const existing = sessions.find(s =>
      s.projectPath === project.path ||
      s.projectPath.replace(/\\/g, '/') === project.path.replace(/\\/g, '/')
    );
    if (existing) {
      window.open(existing.url, '_blank');
      return;
    }

    setLaunching(project.id);
    try {
      const res = await hubFetch<{ ok: boolean; data: { url: string; networkUrl: string; port: number }; error?: string }>(
        `/api/projects/open-code/${deviceId}`,
        {
          method: 'POST',
          body: JSON.stringify({ projectPath: project.path }),
        }
      );

      if (res.ok && res.data) {
        const url = res.data.networkUrl || res.data.url;
        // Give code-server 3s to start
        await new Promise(r => setTimeout(r, 3000));
        window.open(url, '_blank');
        fetchSessions();
      } else {
        alert(res.error || 'Failed to launch code-server. Make sure it is installed: npm install -g code-server');
      }
    } catch {
      alert('Could not reach the agent. Is it running?');
    } finally {
      setLaunching(null);
    }
  }

  async function stopCodeSession(port: number) {
    try {
      await hubFetch(`/api/projects/stop-code/${deviceId}`, {
        method: 'POST',
        body: JSON.stringify({ port }),
      });
      fetchSessions();
    } catch {}
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  function getSessionForProject(project: DiscoveredProject): CodeSession | undefined {
    return sessions.find(s =>
      s.projectPath === project.path ||
      s.projectPath.replace(/\\/g, '/') === project.path.replace(/\\/g, '/')
    );
  }

  const filtered = filter
    ? projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.type.toLowerCase().includes(filter.toLowerCase())
      )
    : projects;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h4 className="font-display font-semibold text-lg" style={{ color: '#1a1a1a' }}>Projects</h4>
          <p className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>
            {projects.length} projects found · Tap &quot;Start VS Code&quot; to open a browser IDE session
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-surface text-xs font-mono">
              <Server className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 font-bold">{sessions.length}</span>
              <span style={{ color: '#a3a3a3' }}>active</span>
            </div>
          )}
          <button onClick={() => { fetchProjects(); fetchSessions(); }}
                  className="cosmic-button flex items-center gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Rescan
          </button>
        </div>
      </div>

      {/* Active code-server sessions */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h5 className="text-xs font-display font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#22c55e' }}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Running VS Code Sessions
          </h5>
          <div className="space-y-3">
            {sessions.map(session => (
              <div
                key={session.port}
                className="glass-card p-5"
                style={{ borderColor: 'rgba(34, 197, 94, 0.2)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-display font-semibold" style={{ color: '#1a1a1a' }}>
                      {session.projectPath.split(/[/\\]/).pop()}
                    </p>
                    <p className="text-xs font-mono truncate mt-0.5" style={{ color: '#c4c4c4' }}>
                      {session.projectPath}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#a3a3a3' }}>
                      Port {session.port} · Started {formatRelativeTime(session.startedAt)}
                    </p>
                  </div>
                </div>

                {/* URL + Actions */}
                <div className="mt-4 p-3 rounded-xl" style={{ background: '#f7f7f7', border: '1px solid #ebebeb' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="flex-1 text-sm font-mono break-all select-all" style={{ color: '#1a1a1a' }}>
                      {session.url}
                    </code>
                    <button
                      onClick={() => copyUrl(session.url)}
                      className="p-2 rounded-lg transition-all flex-shrink-0"
                      style={{ color: '#a3a3a3' }}
                      title="Copy URL"
                    >
                      {copiedUrl === session.url
                        ? <Check className="w-4 h-4 text-emerald-500" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={session.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cosmic-button-primary flex items-center gap-2 text-sm py-2.5 px-5"
                    >
                      <Code2 className="w-4 h-4" />
                      Open VS Code in Browser
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                    <button
                      onClick={() => stopCodeSession(session.port)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                                 transition-all"
                      style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.12)' }}
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      {projects.length > 5 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#c4c4c4' }} />
            <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                   placeholder="Filter projects..." className="cosmic-input pl-10" />
          </div>
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg" style={{ background: '#f0f0f0' }} />
              <div className="flex-1">
                <div className="w-40 h-4 rounded mb-2" style={{ background: '#ebebeb' }} />
                <div className="w-64 h-3 rounded" style={{ background: '#f5f5f5' }} />
              </div>
              <div className="w-32 h-10 rounded-xl" style={{ background: '#f0f0f0' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center text-center">
          <Code2 className="w-12 h-12 mb-4" style={{ color: '#d4d4d4' }} />
          <h4 className="font-display font-medium mb-1" style={{ color: '#a3a3a3' }}>
            {filter ? 'No matching projects' : 'No projects found'}
          </h4>
          <p className="text-sm" style={{ color: '#c4c4c4' }}>
            {filter ? 'Try a different search term' : 'Set AGENT_PROJECT_DIRS in your .env to scan the right folders.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => {
            const session = getSessionForProject(project);
            const isRunning = !!session;
            const isLaunching = launching === project.id;

            return (
              <div
                key={project.id}
                className="glass-card p-4 flex items-center gap-4 transition-all"
                style={isRunning ? { borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.02)' } : undefined}
              >
                {/* Icon */}
                <div className="text-2xl flex-shrink-0 w-10 text-center">
                  {TYPE_ICONS[project.type] || '📁'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-display font-semibold text-sm truncate" style={{ color: '#1a1a1a' }}>
                      {project.name}
                    </h5>
                    {project.hasGit && (
                      <GitBranch className="w-3 h-3 flex-shrink-0" style={{ color: '#c4c4c4' }} />
                    )}
                    {isRunning && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        live
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: '#c4c4c4' }}>
                    {project.path}
                  </p>
                </div>

                {/* ACTION BUTTON */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isRunning && session ? (
                    <>
                      <button
                        onClick={() => copyUrl(session.url)}
                        className="p-2.5 rounded-xl glass-surface transition-all"
                        style={{ color: '#a3a3a3' }}
                        title="Copy URL"
                      >
                        {copiedUrl === session.url
                          ? <Check className="w-4 h-4 text-emerald-500" />
                          : <Copy className="w-4 h-4" />
                        }
                      </button>
                      <a
                        href={session.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold
                                   transition-all"
                        style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.15)' }}
                      >
                        <Code2 className="w-4 h-4" />
                        Open Editor
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </a>
                    </>
                  ) : (
                    <button
                      onClick={() => launchCodeServer(project)}
                      disabled={isLaunching}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold transition-all duration-300"
                      style={
                        isLaunching
                          ? { background: '#f5f5f5', color: '#a3a3a3', border: '1.5px solid #e5e5e5' }
                          : { background: 'transparent', color: '#1a1a1a', border: '1.5px solid #d4d4d4' }
                      }
                      onMouseEnter={(e) => {
                        if (!isLaunching) {
                          e.currentTarget.style.background = '#1a1a1a';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.borderColor = '#1a1a1a';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLaunching) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#1a1a1a';
                          e.currentTarget.style.borderColor = '#d4d4d4';
                        }
                      }}
                    >
                      {isLaunching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Start VS Code
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Install hint */}
      <div className="mt-8 glass-surface p-4 rounded-xl">
        <p className="text-xs mb-1 font-display font-medium" style={{ color: '#888888' }}>Prerequisites</p>
        <p className="text-[11px]" style={{ color: '#a3a3a3' }}>
          Install <code className="px-1 rounded" style={{ color: '#1a1a1a', background: '#f0f0f0' }}>code-server</code> on your Windows machine:{' '}
          <code className="px-1 rounded" style={{ color: '#1a1a1a', background: '#f0f0f0' }}>npm install -g code-server</code>
          {' '}--- then tap &quot;Start VS Code&quot; on any project. Copy the URL and open it on your iPad.
        </p>
      </div>
    </div>
  );
}
