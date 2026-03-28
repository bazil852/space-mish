'use client';

import { useState, useEffect, useCallback } from 'react';
import { hubFetch } from '@/lib/utils';
import { useSocket } from './useSocket';

export interface Device {
  id: string;
  name: string;
  hostname: string;
  os: 'windows' | 'macos' | 'linux';
  localIp: string;
  lastSeenAt: string;
  online: boolean;
  capabilities: {
    clipboardRead: boolean;
    clipboardWrite: boolean;
    files: boolean;
    terminal: boolean;
    codeServer: boolean;
    remoteView: boolean;
  };
  tags: string[];
  preferred: boolean;
  notes: string;
  agentPort: number;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { on } = useSocket();

  const fetchDevices = useCallback(async () => {
    try {
      const res = await hubFetch<{ ok: boolean; data: Device[] }>('/api/devices');
      if (res.ok && res.data) {
        setDevices(res.data);
      }
    } catch {
      // Hub may not be running, use demo data
      setDevices(getDemoDevices());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();

    const offOnline = on('device:online', fetchDevices);
    const offOffline = on('device:offline', fetchDevices);
    const offUpdated = on('device:updated', fetchDevices);
    const offList = on('devices:list', (data) => {
      if (Array.isArray(data)) setDevices(data as Device[]);
    });

    // Poll as fallback
    const interval = setInterval(fetchDevices, 10000);

    return () => {
      offOnline();
      offOffline();
      offUpdated();
      offList();
      clearInterval(interval);
    };
  }, [fetchDevices, on]);

  return { devices, loading, refetch: fetchDevices };
}

export function useDevice(id: string) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await hubFetch<{ ok: boolean; data: Device }>(`/api/devices/${id}`);
        if (res.ok && res.data) {
          setDevice(res.data);
        }
      } catch {
        // Use demo device
        const demo = getDemoDevices().find(d => d.id === id);
        if (demo) setDevice(demo);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  return { device, loading };
}

function getDemoDevices(): Device[] {
  return [
    {
      id: 'win-main',
      name: 'Windows Workstation',
      hostname: 'DESKTOP-BAZIL',
      os: 'windows',
      localIp: '192.168.1.100',
      lastSeenAt: new Date().toISOString(),
      online: true,
      capabilities: {
        clipboardRead: true, clipboardWrite: true, files: true,
        terminal: true, codeServer: true, remoteView: true,
      },
      tags: ['primary', 'dev'],
      preferred: true,
      notes: 'Main development machine',
      agentPort: 3002,
    },
    {
      id: 'mac-air',
      name: 'MacBook Air',
      hostname: 'Bazils-MacBook-Air',
      os: 'macos',
      localIp: '192.168.1.101',
      lastSeenAt: new Date(Date.now() - 30000).toISOString(),
      online: true,
      capabilities: {
        clipboardRead: true, clipboardWrite: true, files: true,
        terminal: true, codeServer: true, remoteView: false,
      },
      tags: ['portable', 'dev'],
      preferred: false,
      notes: 'Portable dev machine',
      agentPort: 3002,
    },
  ];
}
