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
          <div className="flex flex-col items-center justify-center py-32 opacity-0 animate-fade-in">
            <div className="relative mb-8">
              <div
                className="w-20 h-20 rounded-[20px] flex items-center justify-center"
                style={{ background: '#f7f7f7', border: '1px solid #e5e5e5' }}
              >
                <Satellite className="w-9 h-9" style={{ color: '#c4c4c4' }} />
              </div>
            </div>
            <p className="text-sm mb-8 text-center max-w-xs leading-relaxed" style={{ color: '#a3a3a3' }}>
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
