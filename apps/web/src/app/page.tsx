'use client';

import { Satellite, RefreshCw } from 'lucide-react';
import Topbar from '@/components/ui/Topbar';
import DeviceCard from '@/components/dashboard/DeviceCard';
import { useDevices } from '@/hooks/useDevices';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Dashboard() {
  const { devices, loading, refetch } = useDevices();

  const online = devices.filter(d => d.online).length;

  return (
    <>
      <Topbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-16 max-w-5xl mx-auto w-full">

        {/* Greeting with orb */}
        <div className="flex flex-col items-center text-center pt-8 pb-10">
          {/* Purple orb */}
          <div className="orb-container mb-6 opacity-0 animate-fade-in">
            <div className="orb">
              <div className="orb-inner" />
              <div className="orb-glow" />
            </div>
          </div>

          {/* Greeting text */}
          <h2
            className="font-display font-bold text-2xl sm:text-3xl tracking-tight opacity-0 animate-slide-up"
            style={{ color: '#1a1a1a', animationDelay: '0.2s' }}
          >
            {getGreeting()}, <span style={{ color: '#8b5cf6' }}>Bazil</span>
          </h2>
          <p
            className="text-sm mt-2 opacity-0 animate-slide-up"
            style={{ color: '#a3a3a3', animationDelay: '0.35s' }}
          >
            {online > 0
              ? `${online} device${online > 1 ? 's' : ''} online and ready`
              : 'Waiting for devices to connect'
            }
          </p>
        </div>

        {/* Section label */}
        {devices.length > 0 && (
          <div
            className="flex items-center gap-2 mb-4 opacity-0 animate-fade-in"
            style={{ animationDelay: '0.45s' }}
          >
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
                </div>
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 opacity-0 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <div
              className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-6"
              style={{ background: '#f7f7f7', border: '1px solid #e5e5e5' }}
            >
              <Satellite className="w-7 h-7" style={{ color: '#c4c4c4' }} />
            </div>
            <p className="text-sm mb-6 text-center max-w-xs leading-relaxed" style={{ color: '#a3a3a3' }}>
              No devices found on your network yet.
            </p>
            <button onClick={refetch} className="cosmic-button flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Scan Network</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device, index) => (
              <DeviceCard key={device.id} device={device} index={index + 3} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
