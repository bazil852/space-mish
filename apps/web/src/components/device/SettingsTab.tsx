'use client';

import { useState } from 'react';
import {
  Save, RotateCcw, Shield, FolderOpen, Star, Tag, Pencil,
} from 'lucide-react';
import { hubFetch } from '@/lib/utils';
import type { Device } from '@/hooks/useDevices';

interface Props {
  device: Device;
}

export default function SettingsTab({ device }: Props) {
  const [name, setName] = useState(device.name);
  const [notes, setNotes] = useState(device.notes);
  const [preferred, setPreferred] = useState(device.preferred);
  const [tags, setTags] = useState(device.tags.join(', '));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await hubFetch(`/api/devices/${device.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          notes,
          preferred,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
    } catch {
      // Failed
    } finally {
      setSaving(false);
    }
  }

  async function restartAgent() {
    if (!confirm('Restart the agent on this device?')) return;
    try {
      await hubFetch(`/api/commands/run/${device.id}`, {
        method: 'POST',
        body: JSON.stringify({ command: 'restart-agent' }),
      });
    } catch {
      // Failed
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Device settings */}
      <div className="glass-card p-6">
        <h4 className="font-display font-semibold text-space-white flex items-center gap-2 mb-5">
          <Pencil className="w-4 h-4 text-space-accent" />
          Device Settings
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-space-mist/40 mb-1.5">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="cosmic-input" />
          </div>

          <div>
            <label className="block text-xs text-space-mist/40 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="cosmic-input resize-none"
              placeholder="Add notes about this device..."
            />
          </div>

          <div>
            <label className="block text-xs text-space-mist/40 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3 h-3" />
              Tags
            </label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="cosmic-input font-mono"
              placeholder="primary, dev, server"
            />
            <p className="text-[10px] text-space-mist/25 mt-1">Comma-separated</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl glass-surface">
            <input
              type="checkbox"
              checked={preferred}
              onChange={e => setPreferred(e.target.checked)}
              className="w-4 h-4 rounded border-space-border bg-space-void text-space-accent focus:ring-space-accent/30"
            />
            <div>
              <div className="text-sm text-space-white flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Preferred Device
              </div>
              <p className="text-[10px] text-space-mist/30 mt-0.5">Show this device prominently on the dashboard</p>
            </div>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="cosmic-button-primary flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Approved directories */}
      <div className="glass-card p-6">
        <h4 className="font-display font-semibold text-space-white flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-space-cyan" />
          Approved Directories
        </h4>
        <p className="text-xs text-space-mist/40 mb-3">
          The agent only exposes files within these directories. Configure on the agent side.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-surface text-sm font-mono text-space-mist/60">
            <FolderOpen className="w-3.5 h-3.5 text-space-accent/40" />
            {device.os === 'windows' ? 'C:\\Users' : '~/'}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-surface text-sm font-mono text-space-mist/60">
            <FolderOpen className="w-3.5 h-3.5 text-space-accent/40" />
            {device.os === 'windows' ? 'D:\\Projects' : '~/Projects'}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-red-500/10">
        <h4 className="font-display font-semibold text-red-400/70 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" />
          Agent Control
        </h4>
        <button
          onClick={restartAgent}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                     bg-red-500/10 text-red-400/70 border border-red-500/15
                     hover:bg-red-500/15 hover:border-red-500/25 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Restart Agent
        </button>
      </div>
    </div>
  );
}
