'use client';

import { useState, useEffect } from 'react';
import { Code2, Terminal, FolderOpen, Play, ExternalLink, Monitor, Laptop, MonitorSmartphone } from 'lucide-react';
import Topbar from '@/components/ui/Topbar';
import { useDevices, type Device } from '@/hooks/useDevices';
import { hubFetch, cn } from '@/lib/utils';

interface Project {
  id: string;
  deviceId: string;
  name: string;
  path: string;
  codeServerEnabled: boolean;
  codeServerPort?: number;
  startupCommand?: string;
  icon?: string;
  sortOrder: number;
}

const osIcons: Record<string, React.ReactNode> = {
  windows: <Monitor className="w-4 h-4" />,
  macos: <Laptop className="w-4 h-4" />,
  linux: <MonitorSmartphone className="w-4 h-4" />,
};

export default function AllProjectsPage() {
  const { devices } = useDevices();
  const [projectsByDevice, setProjectsByDevice] = useState<Map<string, Project[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await hubFetch<{ ok: boolean; data: Project[] }>('/api/projects');
        if (res.ok && res.data) {
          const grouped = new Map<string, Project[]>();
          for (const p of res.data) {
            const existing = grouped.get(p.deviceId) || [];
            existing.push(p);
            grouped.set(p.deviceId, existing);
          }
          setProjectsByDevice(grouped);
        }
      } catch {
        // Use demo data
        const grouped = new Map<string, Project[]>();
        for (const d of devices) {
          grouped.set(d.id, [
            {
              id: `demo-${d.id}-1`, deviceId: d.id, name: 'BazilBot Universe',
              path: d.os === 'windows' ? 'D:\\Projects\\bazilbot' : '~/Projects/bazilbot',
              codeServerEnabled: true, codeServerPort: 8080, startupCommand: 'npm run dev',
              icon: '🤖', sortOrder: 0,
            },
            {
              id: `demo-${d.id}-2`, deviceId: d.id, name: 'API Server',
              path: d.os === 'windows' ? 'D:\\Projects\\api' : '~/Projects/api',
              codeServerEnabled: true, codeServerPort: 8081, startupCommand: 'cargo run',
              icon: '⚡', sortOrder: 1,
            },
          ]);
        }
        setProjectsByDevice(grouped);
      } finally {
        setLoading(false);
      }
    }
    if (devices.length > 0) loadProjects();
  }, [devices]);

  function getDevice(id: string): Device | undefined {
    return devices.find(d => d.id === id);
  }

  return (
    <>
      <Topbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="mb-8 opacity-0 animate-slide-up">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight" style={{ color: '#1a1a1a' }}>
            All Projects
          </h2>
          <p className="text-sm mt-1" style={{ color: '#a3a3a3' }}>
            Projects across all your devices
          </p>
        </div>

        {loading ? (
          <div className="space-y-8">
            {[0, 1].map(i => (
              <div key={i} className="animate-pulse">
                <div className="w-40 h-5 rounded mb-4" style={{ background: '#ebebeb' }} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card p-5 h-32" />
                  <div className="glass-card p-5 h-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(projectsByDevice.entries()).map(([deviceId, projects], groupIdx) => {
              const device = getDevice(deviceId);
              return (
                <div key={deviceId} className="opacity-0 animate-slide-up" style={{ animationDelay: `${groupIdx * 0.1}s` }}>
                  {/* Device header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg" style={{ background: '#f0f0f0', color: '#1a1a1a' }}>
                      {osIcons[device?.os || 'linux']}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold" style={{ color: '#1a1a1a' }}>
                        {device?.name || deviceId}
                      </h3>
                      <p className="text-[10px] font-mono" style={{ color: '#c4c4c4' }}>
                        {device?.localIp} · {projects.length} project{projects.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className={cn(
                      'ml-2',
                      device?.online ? 'status-online' : 'status-offline',
                    )} />
                  </div>

                  {/* Projects grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.sort((a, b) => a.sortOrder - b.sortOrder).map((project, i) => (
                      <div
                        key={project.id}
                        className="glass-card p-5 group opacity-0 animate-slide-up"
                        style={{ animationDelay: `${(groupIdx * 0.1) + (i * 0.05)}s` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xl">{project.icon || '📁'}</span>
                          <div>
                            <h5 className="font-display font-semibold text-sm" style={{ color: '#1a1a1a' }}>{project.name}</h5>
                            <p className="text-[10px] font-mono truncate max-w-[180px]" style={{ color: '#c4c4c4' }}>{project.path}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {project.codeServerEnabled && (
                            <button className="cosmic-button-primary flex items-center gap-1.5 text-[11px] py-1.5 px-3">
                              <Code2 className="w-3 h-3" />
                              Open Code
                              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                            </button>
                          )}
                          <a
                            href={`/devices/${project.deviceId}?tab=terminal`}
                            className="cosmic-button flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                          >
                            <Terminal className="w-3 h-3" />
                            Shell
                          </a>
                          <a
                            href={`/devices/${project.deviceId}?tab=files`}
                            className="cosmic-button flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                          >
                            <FolderOpen className="w-3 h-3" />
                            Files
                          </a>
                          {project.startupCommand && (
                            <button className="cosmic-button flex items-center gap-1.5 text-[11px] py-1.5 px-3">
                              <Play className="w-3 h-3" />
                              Run
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
