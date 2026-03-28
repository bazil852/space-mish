'use client';

import { Satellite, RefreshCw, Monitor, Terminal, FolderOpen, Code2, Wifi } from 'lucide-react';
import Topbar from '@/components/ui/Topbar';
import DeviceCard from '@/components/dashboard/DeviceCard';
import { useDevices } from '@/hooks/useDevices';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { devices, loading, refetch } = useDevices();

  const online = devices.filter(d => d.online).length;
  const totalTerminals = devices.filter(d => d.online && d.capabilities.terminal).length;
  const totalFiles = devices.filter(d => d.online && d.capabilities.files).length;
  const totalCode = devices.filter(d => d.online && d.capabilities.codeServer).length;

  return (
    <>
      <Topbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-16 max-w-5xl mx-auto w-full">

        {/* Hero section */}
        <div className="mb-8 opacity-0 animate-slide-up">
          <div
            className="rounded-[20px] p-6 sm:p-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
            }}
          >
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {getGreeting()}
                </p>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
                  BazilBot Universe
                </h2>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {online > 0
                    ? `${online} device${online > 1 ? 's' : ''} online and ready`
                    : 'Waiting for devices to connect'
                  }
                </p>
              </div>

              <button
                onClick={refetch}
                className="p-2.5 rounded-xl transition-all hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <RefreshCw className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Stats row */}
            {online > 0 && (
              <div className="relative flex items-center gap-3 mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Wifi className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                  <span className="text-xs font-mono text-white/60">{online} online</span>
                </div>
                {totalTerminals > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Terminal className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-mono text-white/40">{totalTerminals} shell{totalTerminals > 1 ? 's' : ''}</span>
                  </div>
                )}
                {totalFiles > 0 && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <FolderOpen className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-mono text-white/40">{totalFiles} file system{totalFiles > 1 ? 's' : ''}</span>
                  </div>
                )}
                {totalCode > 0 && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Code2 className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-mono text-white/40">{totalCode} code</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section label */}
        {devices.length > 0 && (
          <div className="flex items-center gap-2 mb-4 opacity-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-xs font-display font-semibold uppercase tracking-widest" style={{ color: '#a3a3a3' }}>
              Devices
            </h3>
            <div className="flex-1 h-px" style={{ background: '#e5e5e5' }} />
          </div>
        )}

        {/* Device grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl" style={{ background: '#f0f0f0' }} />
                  <div className="flex-1">
                    <div className="w-28 h-4 rounded mb-2.5" style={{ background: '#ebebeb' }} />
                    <div className="w-20 h-3 rounded" style={{ background: '#f0f0f0' }} />
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e5e5e5' }} />
                </div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-0 animate-fade-in">
            <div
              className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-6"
              style={{ background: '#f7f7f7', border: '1px solid #e5e5e5' }}
            >
              <Satellite className="w-7 h-7" style={{ color: '#c4c4c4' }} />
            </div>
            <p className="text-sm mb-6 text-center max-w-xs leading-relaxed" style={{ color: '#a3a3a3' }}>
              No devices online. Install the agent on a machine to get started.
            </p>
            <button onClick={refetch} className="cosmic-button flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Scan Network</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device, index) => (
              <DeviceCard key={device.id} device={device} index={index} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
