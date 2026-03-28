'use client';

import { useState, useEffect } from 'react';
import {
  Code2, Terminal, FolderOpen, Play, ExternalLink, GitBranch,
  RefreshCw, Square, Loader2, Search, Server,
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

const TYPE_COLORS: Record<string, string> = {
  node: 'text-green-400', rust: 'text-orange-400', go: 'text-cyan-400',
  python: 'text-yellow-400', java: 'text-red-400', dotnet: 'text-purple-400',
  cpp: 'text-blue-400', generic: 'text-space-mist/50',
};

export default function ProjectsTab({ deviceId }: Props) {
  const [projects, setProjects] = useState<DiscoveredProject[]>([]);
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [codeServerInstalled, setCodeServerInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchSessions();
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await hubFetch<{ ok: boolean; data: DiscoveredProject[] }>(
        `/api/files/browse/${deviceId}?special=projects`
      );
      if (res.ok && res.data) {
        setProjects(res.data);
        setLoading(false);
        return;
      }
    } catch {}

    // Try direct agent projects endpoint via hub proxy
    try {
      const res = await hubFetch<{ ok: boolean; data: DiscoveredProject[] }>(
        `/api/projects?deviceId=${deviceId}`
      );
      if (res.ok && res.data) {
        setProjects(res.data);
        setLoading(false);
        return;
      }
    } catch {}

    // Direct to agent as fallback
    try {
      const agentUrl = `http://${window.location.hostname}:3002`;
      const res = await fetch(`${agentUrl}/projects?deep=true`);
      const data = await res.json();
      if (data.ok && data.data) {
        setProjects(data.data);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchSessions() {
    try {
      const agentUrl = `http://${window.location.hostname}:3002`;
      const res = await fetch(`${agentUrl}/projects/sessions`);
      const data = await res.json();
      if (data.ok && data.data) {
        setSessions(data.data);
      }
    } catch {}
  }

  async function openCode(project: DiscoveredProject) {
    setLaunching(project.id);
    try {
      // Check if already running for this path
      const existing = sessions.find(s => s.projectPath === project.path);
      if (existing) {
        window.open(existing.url, '_blank');
        setLaunching(null);
        return;
      }

      const agentUrl = `http://${window.location.hostname}:3002`;
      const res = await fetch(`${agentUrl}/projects/open-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.path }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        // Wait a moment for code-server to start
        await new Promise(r => setTimeout(r, 2000));
        window.open(data.data.networkUrl || data.data.url, '_blank');
        fetchSessions();
      } else {
        alert(data.error || 'Failed to start code-server');
      }
    } catch (err) {
      alert('Could not connect to agent. Is it running?');
    } finally {
      setLaunching(null);
    }
  }

  async function stopCode(port: number) {
    try {
      const agentUrl = `http://${window.location.hostname}:3002`;
      await fetch(`${agentUrl}/projects/stop-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      fetchSessions();
    } catch {}
  }

  const filtered = filter
    ? projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.type.toLowerCase().includes(filter.toLowerCase())
      )
    : projects;

  const runningPaths = new Set(sessions.map(s => s.projectPath));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h4 className="font-display font-semibold text-space-white text-lg">Projects</h4>
          <p className="text-xs text-space-mist/40 mt-0.5">
            Auto-discovered from your Documents folder — {projects.length} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface text-xs font-mono">
              <Server className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">{sessions.length}</span>
              <span className="text-space-mist/40">running</span>
            </div>
          )}
          <button
            onClick={() => { fetchProjects(); fetchSessions(); }}
            className="cosmic-button flex items-center gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rescan
          </button>
        </div>
      </div>

      {/* Running sessions */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <h5 className="text-xs font-display font-semibold text-space-mist/40 uppercase tracking-widest mb-3">
            Active Code Sessions
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map(session => (
              <div key={session.port} className="glass-card p-4 flex items-center gap-3 glow-border">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-space-white truncate">
                    {session.projectPath.split(/[/\\]/).pop()}
                  </p>
                  <p className="text-[10px] font-mono text-space-mist/30 truncate">
                    Port {session.port} · {formatRelativeTime(session.startedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={session.url}
                    target="_blank"
                    rel="noopener"
                    className="cosmic-button-primary flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                  >
                    <Code2 className="w-3 h-3" />
                    Open
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                  <button
                    onClick={() => stopCode(session.port)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400/70 hover:bg-red-500/20 transition-all"
                    title="Stop session"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-space-mist/30" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter projects..."
            className="cosmic-input pl-10"
          />
        </div>
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-space-navy/50" />
                <div className="w-32 h-4 rounded bg-space-navy/50" />
              </div>
              <div className="w-48 h-3 rounded bg-space-navy/30" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center text-center">
          <Code2 className="w-12 h-12 text-space-mist/15 mb-4" />
          <h4 className="font-display font-medium text-space-mist/40 mb-1">
            {filter ? 'No matching projects' : 'No projects found'}
          </h4>
          <p className="text-sm text-space-mist/25 mb-4 max-w-sm">
            {filter
              ? 'Try a different search term'
              : 'No projects detected in your Documents folder. Set AGENT_PROJECT_DIRS in .env to scan other directories.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((project, i) => {
            const isRunning = runningPaths.has(project.path);
            const isLaunching = launching === project.id;
            const session = sessions.find(s => s.projectPath === project.path);

            return (
              <div
                key={project.id}
                className={cn(
                  'glass-card p-5 group opacity-0 animate-slide-up',
                  isRunning && 'border-emerald-500/20',
                )}
                style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-xl">{TYPE_ICONS[project.type] || '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-display font-semibold text-space-white text-sm truncate">
                      {project.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] font-mono uppercase', TYPE_COLORS[project.type] || 'text-space-mist/30')}>
                        {project.type}
                      </span>
                      {project.hasGit && (
                        <span className="flex items-center gap-0.5 text-[10px] text-space-mist/30">
                          <GitBranch className="w-2.5 h-2.5" />
                          git
                        </span>
                      )}
                      {isRunning && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          running
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Path */}
                <p className="text-[10px] font-mono text-space-mist/25 truncate mb-3" title={project.path}>
                  {project.path}
                </p>

                {/* Modified time */}
                <p className="text-[10px] text-space-mist/20 mb-3">
                  Modified {formatRelativeTime(project.lastModified)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isRunning && session ? (
                    <a
                      href={session.url}
                      target="_blank"
                      rel="noopener"
                      className="cosmic-button-primary flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                    >
                      <Code2 className="w-3 h-3" />
                      Open Editor
                      <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </a>
                  ) : (
                    <button
                      onClick={() => openCode(project)}
                      disabled={isLaunching}
                      className="cosmic-button-primary flex items-center gap-1.5 text-[11px] py-1.5 px-3 disabled:opacity-50"
                    >
                      {isLaunching ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Code2 className="w-3 h-3" />
                      )}
                      {isLaunching ? 'Starting...' : 'Open in VS Code'}
                    </button>
                  )}
                  <a
                    href={`/devices/${deviceId}?tab=terminal`}
                    className="cosmic-button flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                  >
                    <Terminal className="w-3 h-3" />
                    Shell
                  </a>
                  <a
                    href={`/devices/${deviceId}?tab=files`}
                    className="cosmic-button flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Files
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* code-server install hint */}
      {!loading && projects.length > 0 && codeServerInstalled === false && (
        <div className="mt-6 glass-surface p-4 rounded-xl">
          <p className="text-sm text-amber-400/70 mb-2 font-medium">code-server not detected</p>
          <p className="text-xs text-space-mist/40 mb-2">
            Install code-server to open VS Code in your browser:
          </p>
          <code className="text-xs font-mono text-space-accent/70 bg-space-void/40 px-2 py-1 rounded">
            npm install -g code-server
          </code>
        </div>
      )}
    </div>
  );
}
