'use client';

import { useState } from 'react';
import { Copy, ClipboardPaste, RefreshCw, Clock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { hubFetch, formatRelativeTime } from '@/lib/utils';

interface Props {
  deviceId: string;
}

interface ClipboardEntry {
  id: string;
  direction: 'read' | 'write';
  textPreview: string;
  createdAt: string;
}

export default function ClipboardTab({ deviceId }: Props) {
  const [clipboardText, setClipboardText] = useState('');
  const [writeText, setWriteText] = useState('');
  const [history, setHistory] = useState<ClipboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function readClipboard() {
    setLoading(true);
    try {
      const res = await hubFetch<{ ok: boolean; data: { text: string } }>(`/api/clipboard/read/${deviceId}`, {
        method: 'POST',
      });
      if (res.ok && res.data) {
        setClipboardText(res.data.text);
      }
    } catch {
      setClipboardText('[Could not read clipboard — is the agent running?]');
    } finally {
      setLoading(false);
    }
  }

  async function writeClipboard() {
    if (!writeText.trim()) return;
    setLoading(true);
    try {
      await hubFetch(`/api/clipboard/write/${deviceId}`, {
        method: 'POST',
        body: JSON.stringify({ text: writeText }),
      });
      setWriteText('');
      readClipboard();
    } catch {
      // Agent may be offline
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await hubFetch<{ ok: boolean; data: ClipboardEntry[] }>(`/api/clipboard/history/${deviceId}`);
      if (res.ok && res.data) {
        setHistory(res.data);
      }
    } catch {
      // History unavailable
    }
  }

  function copyToLocal(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Read clipboard */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-display font-semibold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
            <Copy className="w-4 h-4" style={{ color: '#888888' }} />
            Read Clipboard
          </h4>
          <button
            onClick={readClipboard}
            disabled={loading}
            className="cosmic-button flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Fetch
          </button>
        </div>

        <div className="glass-surface p-4 min-h-[120px] rounded-xl">
          {clipboardText ? (
            <div className="relative group">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words" style={{ color: '#1a1a1a' }}>
                {clipboardText}
              </pre>
              <button
                onClick={() => copyToLocal(clipboardText)}
                className="absolute top-0 right-0 p-2 rounded-lg
                           opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: '#ebebeb', color: '#888888' }}
                title="Copy to local clipboard"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: '#a3a3a3' }}>
              Click &ldquo;Fetch&rdquo; to read the device clipboard
            </p>
          )}
        </div>
      </div>

      {/* Write clipboard */}
      <div className="glass-card p-6">
        <h4 className="font-display font-semibold flex items-center gap-2 mb-5" style={{ color: '#1a1a1a' }}>
          <ClipboardPaste className="w-4 h-4" style={{ color: '#888888' }} />
          Write Clipboard
        </h4>

        <textarea
          value={writeText}
          onChange={e => setWriteText(e.target.value)}
          placeholder="Type or paste text to send to device clipboard..."
          className="cosmic-input min-h-[120px] resize-none font-mono text-sm mb-4"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={writeClipboard}
            disabled={loading || !writeText.trim()}
            className="cosmic-button-primary flex items-center gap-2 text-sm disabled:opacity-30"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Send to Device
          </button>
          <button
            onClick={async () => {
              const text = await navigator.clipboard.readText();
              setWriteText(text);
            }}
            className="cosmic-button flex items-center gap-2 text-xs"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Local
          </button>
        </div>
      </div>

      {/* History */}
      <div className="glass-card p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-display font-semibold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
            <Clock className="w-4 h-4" style={{ color: '#888888' }} />
            Clipboard History
          </h4>
          <button onClick={loadHistory} className="cosmic-button text-xs">
            Load History
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm italic" style={{ color: '#a3a3a3' }}>No history yet</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {history.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-xl glass-surface group cursor-pointer"
                onClick={() => copyToLocal(entry.textPreview)}
              >
                <div
                  className="p-1.5 rounded-lg mt-0.5"
                  style={{
                    background: entry.direction === 'read' ? '#f0f0f0' : '#f0f0f0',
                    color: entry.direction === 'read' ? '#1a1a1a' : '#888888',
                  }}
                >
                  {entry.direction === 'read'
                    ? <ArrowDownToLine className="w-3 h-3" />
                    : <ArrowUpFromLine className="w-3 h-3" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate" style={{ color: '#1a1a1a' }}>{entry.textPreview}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#a3a3a3' }}>{formatRelativeTime(entry.createdAt)}</p>
                </div>
                <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#c4c4c4' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
