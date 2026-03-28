'use client';

import { useState, useEffect } from 'react';
import {
  Code2, Terminal, FolderOpen, Play, Plus, ExternalLink, Edit3,
  Trash2, GitBranch, Settings,
} from 'lucide-react';
import { hubFetch, cn } from '@/lib/utils';

interface Props {
  deviceId: string;
}

interface Project {
  id: string;
  deviceId: string;
  name: string;
  path: string;
  repoUrl?: string;
  codeServerEnabled: boolean;
  codeServerPort?: number;
  startupCommand?: string;
  icon?: string;
  sortOrder: number;
}

export default function ProjectsTab({ deviceId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await hubFetch<{ ok: boolean; data: Project[] }>(`/api/projects?deviceId=${deviceId}`);
      if (res.ok && res.data) {
        setProjects(res.data);
      }
    } catch {
      setProjects(getDemoProjects(deviceId));
    } finally {
      setLoading(false);
    }
  }

  async function openCode(project: Project) {
    try {
      const res = await hubFetch<{ ok: boolean; data: { url: string } }>(`/api/projects/${project.id}/open-code`, {
        method: 'POST',
      });
      if (res.ok && res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      // Show fallback
      const port = project.codeServerPort || 8080;
      const url = `http://${window.location.hostname}:${port}/?folder=${encodeURIComponent(project.path)}`;
      window.open(url, '_blank');
    }
  }

  async function runStartup(project: Project) {
    if (!project.startupCommand) return;
    try {
      await hubFetch(`/api/projects/${project.id}/run`, { method: 'POST' });
    } catch {
      // Agent offline
    }
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project?')) return;
    try {
      await hubFetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch {
      // Failed
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h4 className="font-display font-semibold text-space-white text-lg">Projects</h4>
          <p className="text-xs text-space-mist/40 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="cosmic-button-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      {/* Add form */}
      {showAddForm && <AddProjectForm deviceId={deviceId} onClose={() => setShowAddForm(false)} onCreated={fetchProjects} />}

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="w-32 h-5 rounded bg-space-navy/50 mb-3" />
              <div className="w-48 h-3 rounded bg-space-navy/30 mb-4" />
              <div className="flex gap-2">
                <div className="w-20 h-8 rounded-lg bg-space-navy/30" />
                <div className="w-20 h-8 rounded-lg bg-space-navy/30" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center text-center">
          <Code2 className="w-12 h-12 text-space-mist/15 mb-4" />
          <h4 className="font-display font-medium text-space-mist/40 mb-1">No projects yet</h4>
          <p className="text-sm text-space-mist/25 mb-5">Add a project to quickly launch code workspaces</p>
          <button onClick={() => setShowAddForm(true)} className="cosmic-button flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.sort((a, b) => a.sortOrder - b.sortOrder).map((project, i) => (
            <div
              key={project.id}
              className="glass-card p-5 group opacity-0 animate-slide-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{project.icon || '📁'}</div>
                  <div>
                    <h5 className="font-display font-semibold text-space-white">{project.name}</h5>
                    <p className="text-xs font-mono text-space-mist/40 mt-0.5 truncate max-w-[200px]">{project.path}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 rounded-lg hover:bg-space-navy/50 text-space-mist/30 hover:text-space-mist transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/15 text-space-mist/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-3 mb-4 text-[11px] text-space-mist/30">
                {project.repoUrl && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    git
                  </span>
                )}
                {project.codeServerEnabled && (
                  <span className="flex items-center gap-1 text-space-cyan/50">
                    <Code2 className="w-3 h-3" />
                    code-server
                  </span>
                )}
                {project.startupCommand && (
                  <span className="flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    startup cmd
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {project.codeServerEnabled && (
                  <button
                    onClick={() => openCode(project)}
                    className="cosmic-button-primary flex items-center gap-2 text-xs py-2"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Open Code
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </button>
                )}
                <button
                  onClick={() => {
                    window.location.href = `/devices/${project.deviceId}?tab=terminal`;
                  }}
                  className="cosmic-button flex items-center gap-2 text-xs py-2"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Terminal
                </button>
                <button className="cosmic-button flex items-center gap-2 text-xs py-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Files
                </button>
                {project.startupCommand && (
                  <button
                    onClick={() => runStartup(project)}
                    className="cosmic-button flex items-center gap-2 text-xs py-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddProjectForm({
  deviceId,
  onClose,
  onCreated,
}: {
  deviceId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [startupCmd, setStartupCmd] = useState('');
  const [codeServer, setCodeServer] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await hubFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          deviceId,
          name,
          path,
          startupCommand: startupCmd || undefined,
          codeServerEnabled: codeServer,
          codeServerPort: 8080,
          sortOrder: 0,
        }),
      });
      onCreated();
      onClose();
    } catch {
      // Failed
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 mb-5 space-y-4">
      <h5 className="font-display font-semibold text-space-white">New Project</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-space-mist/40 mb-1.5">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="cosmic-input" placeholder="My Project" />
        </div>
        <div>
          <label className="block text-xs text-space-mist/40 mb-1.5">Path</label>
          <input value={path} onChange={e => setPath(e.target.value)} required className="cosmic-input font-mono" placeholder="/path/to/project" />
        </div>
        <div>
          <label className="block text-xs text-space-mist/40 mb-1.5">Startup Command</label>
          <input value={startupCmd} onChange={e => setStartupCmd(e.target.value)} className="cosmic-input font-mono" placeholder="npm run dev" />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={codeServer} onChange={e => setCodeServer(e.target.checked)}
                   className="w-4 h-4 rounded border-space-border bg-space-void text-space-accent focus:ring-space-accent/30" />
            <span className="text-sm text-space-mist/60">Enable code-server</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="cosmic-button-primary text-sm">Create Project</button>
        <button type="button" onClick={onClose} className="cosmic-button text-sm">Cancel</button>
      </div>
    </form>
  );
}

function getDemoProjects(deviceId: string): Project[] {
  return [
    {
      id: 'proj-1',
      deviceId,
      name: 'Space Mish',
      path: deviceId.includes('win') ? 'D:\\Projects\\space-mish' : '~/Projects/space-mish',
      repoUrl: 'https://github.com/user/space-mish',
      codeServerEnabled: true,
      codeServerPort: 8080,
      startupCommand: 'npm run dev',
      icon: '🛰️',
      sortOrder: 0,
    },
    {
      id: 'proj-2',
      deviceId,
      name: 'API Server',
      path: deviceId.includes('win') ? 'D:\\Projects\\api-server' : '~/Projects/api-server',
      codeServerEnabled: true,
      codeServerPort: 8081,
      startupCommand: 'cargo run',
      icon: '⚡',
      sortOrder: 1,
    },
  ];
}
