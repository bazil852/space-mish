'use client';

import { Satellite, Plus, RefreshCw } from 'lucide-react';
import Topbar from '@/components/ui/Topbar';
import DeviceCard from '@/components/dashboard/DeviceCard';
import StatusBar from '@/components/dashboard/StatusBar';
import { useDevices } from '@/hooks/useDevices';

export default function Dashboard() {
  const { devices, loading, refetch } = useDevices();

  return (
    <>
      <Topbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Header section */}
        <div className="flex items-start justify-between mb-8 opacity-0 animate-slide-up">
          <div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-space-white tracking-tight">
              Mission Control
            </h2>
            <p className="text-sm text-space-mist/50 mt-1 font-body">
              {devices.filter(d => d.online).length} devices online on your network
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              className="cosmic-button flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="mb-8">
          <StatusBar devices={devices} />
        </div>

        {/* Device grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-space-navy/50" />
                  <div>
                    <div className="w-32 h-4 rounded bg-space-navy/50 mb-2" />
                    <div className="w-24 h-3 rounded bg-space-navy/30" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(j => (
                    <div key={j} className="w-16 h-7 rounded-lg bg-space-navy/30" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-0 animate-fade-in">
            <div className="relative mb-6">
              <Satellite className="w-16 h-16 text-space-mist/15 animate-float" />
              <div className="orbit-ring w-32 h-32 -left-4 -top-4 animate-orbit opacity-30" />
            </div>
            <h3 className="font-display font-semibold text-xl text-space-mist/40 mb-2">
              No devices found
            </h3>
            <p className="text-sm text-space-mist/25 mb-6 text-center max-w-sm">
              Install the Space Mish agent on your devices to get started. They will appear here automatically.
            </p>
            <button className="cosmic-button-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Device Manually
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device, index) => (
              <DeviceCard key={device.id} device={device} index={index} />
            ))}
          </div>
        )}

        {/* Quick access section */}
        {devices.length > 0 && (
          <div className="mt-10 opacity-0 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h3 className="font-display font-semibold text-sm text-space-mist/40 uppercase tracking-widest mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {devices.filter(d => d.online).flatMap(device => [
                device.capabilities.terminal && (
                  <a
                    key={`term-${device.id}`}
                    href={`/devices/${device.id}?tab=terminal`}
                    className="glass-surface p-4 flex flex-col items-center gap-2 text-center
                               hover:border-space-accent/20 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-space-accent/10 text-space-accent group-hover:bg-space-accent/15 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-space-mist/60 group-hover:text-space-white transition-colors">
                      {device.name}
                    </span>
                    <span className="text-[10px] text-space-mist/30">Terminal</span>
                  </a>
                ),
              ]).filter(Boolean).slice(0, 4)}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-[10px] font-mono text-space-mist/20 tracking-widest uppercase">
          Space Mish v1.0 — LAN Mode
        </p>
      </footer>
    </>
  );
}
