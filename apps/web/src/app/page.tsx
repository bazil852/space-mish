'use client';

import { Satellite, RefreshCw } from 'lucide-react';
import Topbar from '@/components/ui/Topbar';
import DeviceCard from '@/components/dashboard/DeviceCard';
import { useDevices } from '@/hooks/useDevices';

export default function Dashboard() {
  const { devices, loading, refetch } = useDevices();

  return (
    <>
      <Topbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-8 pb-16 max-w-5xl mx-auto w-full">
        {/* Device grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-space-navy/50" />
                  <div className="flex-1">
                    <div className="w-28 h-4 rounded bg-space-navy/50 mb-2.5" />
                    <div className="w-20 h-3 rounded bg-space-navy/30" />
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-space-navy/40" />
                </div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-0 animate-fade-in">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-2xl bg-space-accent/5 border border-space-accent/10 flex items-center justify-center">
                <Satellite className="w-9 h-9 text-space-mist/20" />
              </div>
            </div>
            <p className="text-sm text-space-mist/30 mb-8 text-center max-w-xs leading-relaxed">
              No devices online. Install the agent on a device to get started.
            </p>
            <button
              onClick={refetch}
              className="cosmic-button flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Scan Network</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {devices.map((device, index) => (
              <DeviceCard key={device.id} device={device} index={index} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
