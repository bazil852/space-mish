'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Monitor, Laptop, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import Topbar from '@/components/ui/Topbar';
import DeviceTabs, { type TabId } from '@/components/device/DeviceTabs';
import OverviewTab from '@/components/device/OverviewTab';
import ClipboardTab from '@/components/clipboard/ClipboardTab';
import FilesTab from '@/components/files/FilesTab';
import TerminalTab from '@/components/terminal/TerminalTab';
import ProjectsTab from '@/components/projects/ProjectsTab';
import RemoteTab from '@/components/device/RemoteTab';
import SettingsTab from '@/components/device/SettingsTab';
import { useDevice } from '@/hooks/useDevices';

const osIcons: Record<string, React.ReactNode> = {
  windows: <Monitor className="w-5 h-5" />,
  macos: <Laptop className="w-5 h-5" />,
  linux: <MonitorSmartphone className="w-5 h-5" />,
};

export default function DeviceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const deviceId = params.id as string;
  const { device, loading } = useDevice(deviceId);

  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  if (loading) {
    return (
      <>
        <Topbar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-space-navy/50" />
              <div>
                <div className="w-48 h-6 rounded bg-space-navy/50 mb-2" />
                <div className="w-32 h-4 rounded bg-space-navy/30" />
              </div>
            </div>
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => <div key={i} className="w-24 h-9 rounded-xl bg-space-navy/30" />)}
            </div>
            <div className="w-full h-96 rounded-2xl bg-space-navy/20" />
          </div>
        </main>
      </>
    );
  }

  if (!device) {
    return (
      <>
        <Topbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-display font-bold text-xl text-space-mist/40 mb-2">Device not found</h2>
            <Link href="/" className="cosmic-button text-sm">Back to Dashboard</Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Device header */}
        <div className="flex items-center gap-4 mb-6 opacity-0 animate-slide-up">
          <Link
            href="/"
            className="p-2.5 rounded-xl glass-surface hover:border-space-accent/20 text-space-mist/40
                       hover:text-space-accent transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="p-3 rounded-xl bg-space-accent/10 text-space-accent">
            {osIcons[device.os] || <Monitor className="w-5 h-5" />}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-space-white">
                {device.name}
              </h2>
              <div className={device.online ? 'status-online' : 'status-offline'} />
            </div>
            <p className="text-xs font-mono text-space-mist/40 mt-0.5">
              {device.localIp} · {device.hostname}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 opacity-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <DeviceTabs
            active={activeTab}
            onChange={setActiveTab}
            capabilities={device.capabilities as unknown as Record<string, boolean>}
          />
        </div>

        {/* Tab content */}
        <div className="opacity-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {activeTab === 'overview' && <OverviewTab device={device} />}
          {activeTab === 'clipboard' && <ClipboardTab deviceId={device.id} />}
          {activeTab === 'files' && <FilesTab deviceId={device.id} />}
          {activeTab === 'terminal' && <TerminalTab deviceId={device.id} />}
          {activeTab === 'projects' && <ProjectsTab deviceId={device.id} />}
          {activeTab === 'remote' && <RemoteTab deviceId={device.id} />}
          {activeTab === 'settings' && <SettingsTab device={device} />}
        </div>
      </main>
    </>
  );
}
