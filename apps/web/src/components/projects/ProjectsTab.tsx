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
          <h4 className="font-display font-semibold text-space-white text-lg">Projects</h4>
          <p className="text-xs text-space-mist/40 mt-0.5">
            {projects.length} projects found · Tap &quot;Start VS Code&quot; to open a browser IDE session
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface text-xs font-mono">
              <Server className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{sessions.length}</span>
              <span className="text-space-mist/40">active</span>
            </div>
          )}
          <button onClick={() => { fetchProjects(); fetchSessions(); }}
                  className="cosmic-button flex items-center gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Rescan
          </button>
        </div>
      </div>

      {/* ═══════ Active code-server sessions ═══════ */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h5 className="text-xs font-display font-semibold text-emerald-400/70 uppercase tracking-widest mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Running VS Code Sessions
          </h5>
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.port} className="glass-card p-5 border-emerald-500/20 glow-border">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-display font-semibold text-space-white">
                      {session.projectPath.split(/[/\\]/).pop()}
                    </p>
                    <p className="text-xs font-mono text-space-mist/30 truncate mt-0.5">
                      {session.projectPath}
                    </p>
                    <p className="text-[11px] text-space-mist/40 mt-1">
                      Port {session.port} · Started {formatRelativeTime(session.startedAt)}
                    </p>
                  </div>
                </div>

                {/* URL + Actions */}
                <div className="mt-4 p-3 rounded-xl bg-space-void/50 border border-space-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <code className="flex-1 text-sm font-mono text-space-accent break-all select-all">
                      {session.url}
                    </code>
                    <button
                      onClick={() => copyUrl(session.url)}
                      className="p-2 rounded-lg hover:bg-space-navy/50 text-space-mist/50 hover:text-space-accent transition-all flex-shrink-0"
                      title="Copy URL"
                    >
                      {copiedUrl === session.url
                        ? <Check className="w-4 h-4 text-emerald-400" />
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
                                 bg-red-500/10 text-red-400/80 border border-red-500/15
                                 hover:bg-red-500/20 transition-all"
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

      {/* ═══════ Search ═══════ */}
      {projects.length > 5 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-space-mist/30" />
            <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                   placeholder="Filter projects..." className="cosmic-input pl-10" />
          </div>
        </div>
      )}

      {/* ═══════ Projects list ═══════ */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-space-navy/50" />
              <div className="flex-1">
                <div className="w-40 h-4 rounded bg-space-navy/50 mb-2" />
                <div className="w-64 h-3 rounded bg-space-navy/30" />
              </div>
              <div className="w-32 h-10 rounded-xl bg-space-navy/30" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center text-center">
          <Code2 className="w-12 h-12 text-space-mist/15 mb-4" />
          <h4 className="font-display font-medium text-space-mist/40 mb-1">
            {filter ? 'No matching projects' : 'No projects found'}
          </h4>
          <p className="text-sm text-space-mist/25">
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
                className={cn(
                  'glass-card p-4 flex items-center gap-4 transition-all hover:border-space-border-bright',
                  isRunning && 'border-emerald-500/15 bg-emerald-500/[0.02]',
                )}
              >
                {/* Icon */}
                <div className="text-2xl flex-shrink-0 w-10 text-center">
                  {TYPE_ICONS[project.type] || '📁'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-display font-semibold text-space-white text-sm truncate">
                      {project.name}
                    </h5>
                    {project.hasGit && (
                      <GitBranch className="w-3 h-3 text-space-mist/25 flex-shrink-0" />
                    )}
                    {isRunning && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        live
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-space-mist/25 truncate mt-0.5">
                    {project.path}
                  </p>
                </div>

                {/* ══ ACTION BUTTON ══ */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isRunning && session ? (
                    <>
                      <button
                        onClick={() => copyUrl(session.url)}
                        className="p-2.5 rounded-xl glass-surface hover:border-space-accent/20 text-space-mist/40 hover:text-space-accent transition-all"
                        title="Copy URL"
                      >
                        {copiedUrl === session.url
                          ? <Check className="w-4 h-4 text-emerald-400" />
                          : <Copy className="w-4 h-4" />
                        }
                      </button>
                      <a
                        href={session.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold
                                   bg-emerald-500/15 text-emerald-400 border border-emerald-500/20
                                   hover:bg-emerald-500/25 transition-all"
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
                      className={cn(
                        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold transition-all',
                        isLaunching
                          ? 'bg-space-accent/10 text-space-accent/50 border border-space-accent/10'
                          : 'bg-space-accent/20 text-space-accent border border-space-accent/25 hover:bg-space-accent/30 hover:shadow-lg hover:shadow-space-accent/10',
                      )}
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
        <p className="text-xs text-space-mist/30 mb-1 font-display font-medium">Prerequisites</p>
        <p className="text-[11px] text-space-mist/20">
          Install <code className="text-space-accent/50 bg-space-void/40 px-1 rounded">code-server</code> on your Windows machine:{' '}
          <code className="text-space-accent/50 bg-space-void/40 px-1 rounded">npm install -g code-server</code>
          {' '}— then tap &quot;Start VS Code&quot; on any project. Copy the URL and open it on your iPad.
        </p>
      </div>
    </div>
  );
}
