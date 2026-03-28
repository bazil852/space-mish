'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Folder, File, FileCode, FileText, Image, Film, Music, Archive,
  ChevronRight, ArrowLeft, Upload, Download, Trash2, Home,
  Globe, Palette,
} from 'lucide-react';
import { hubFetch, formatBytes, formatRelativeTime, cn } from '@/lib/utils';

interface Props {
  deviceId: string;
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  mime?: string;
}

const fileIcons: Record<string, React.ReactNode> = {
  folder: <Folder className="w-5 h-5" />,
  'file-code': <FileCode className="w-5 h-5" />,
  'file-text': <FileText className="w-5 h-5" />,
  'file-json': <FileCode className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
  film: <Film className="w-5 h-5" />,
  music: <Music className="w-5 h-5" />,
  archive: <Archive className="w-5 h-5" />,
  globe: <Globe className="w-5 h-5" />,
  palette: <Palette className="w-5 h-5" />,
  file: <File className="w-5 h-5" />,
};

function getIcon(name: string, isDir: boolean): React.ReactNode {
  if (isDir) return fileIcons.folder;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'file-code', tsx: 'file-code', js: 'file-code', jsx: 'file-code',
    py: 'file-code', rs: 'file-code', go: 'file-code', java: 'file-code',
    json: 'file-json', yaml: 'file-json', yml: 'file-json',
    md: 'file-text', txt: 'file-text', log: 'file-text',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image',
    mp4: 'film', mov: 'film',
    mp3: 'music', wav: 'music',
    zip: 'archive', tar: 'archive', gz: 'archive',
    html: 'globe', css: 'palette',
  };
  return fileIcons[map[ext] || 'file'];
}

export default function FilesTab({ deviceId }: Props) {
  const [currentPath, setCurrentPath] = useState('~');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    browseDirectory(currentPath);
  }, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  async function browseDirectory(path: string) {
    setLoading(true);
    try {
      const res = await hubFetch<{ ok: boolean; data: FileEntry[] }>(
        `/api/files/browse/${deviceId}?path=${encodeURIComponent(path)}`
      );
      if (res.ok && res.data) {
        setFiles(res.data);
      }
    } catch {
      setFiles(getDemoFiles());
    } finally {
      setLoading(false);
    }
  }

  function navigateTo(path: string) {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(path);
  }

  function goBack() {
    const prev = pathHistory[pathHistory.length - 1];
    if (prev) {
      setPathHistory(h => h.slice(0, -1));
      setCurrentPath(prev);
    }
  }

  function goHome() {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath('~');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);
    try {
      await fetch(`/api/files/upload/${deviceId}`, {
        method: 'POST',
        body: formData,
      });
      browseDirectory(currentPath);
    } catch {
      // Upload failed
    }
  }

  async function handleDownload(filePath: string, fileName: string) {
    try {
      const res = await fetch(`/api/files/download/${deviceId}?path=${encodeURIComponent(filePath)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed
    }
  }

  async function handleDelete(filePath: string) {
    if (!confirm('Delete this file?')) return;
    try {
      await hubFetch(`/api/files/${deviceId}?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
      browseDirectory(currentPath);
    } catch {
      // Delete failed
    }
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="glass-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-space-border">
        <button
          onClick={goBack}
          disabled={pathHistory.length === 0}
          className="p-2 rounded-lg hover:bg-space-navy/40 text-space-mist/50 hover:text-space-white
                     disabled:opacity-20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={goHome} className="p-2 rounded-lg hover:bg-space-navy/40 text-space-mist/50 hover:text-space-white transition-all">
          <Home className="w-4 h-4" />
        </button>

        {/* Breadcrumb path */}
        <div className="flex-1 flex items-center gap-1 text-sm font-mono text-space-mist/40 overflow-x-auto">
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1 whitespace-nowrap">
              {i > 0 && <ChevronRight className="w-3 h-3 text-space-mist/20" />}
              <button
                onClick={() => {
                  const path = breadcrumbs.slice(0, i + 1).join('/');
                  navigateTo(path.startsWith('~') ? path : '/' + path);
                }}
                className="hover:text-space-accent transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => uploadRef.current?.click()}
          className="cosmic-button flex items-center gap-2 text-xs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Upload</span>
        </button>
      </div>

      {/* File list */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-space-navy/50" />
                <div className="flex-1">
                  <div className="w-40 h-4 rounded bg-space-navy/50 mb-1.5" />
                  <div className="w-24 h-3 rounded bg-space-navy/30" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-space-mist/30">
            <Folder className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Empty directory</p>
          </div>
        ) : (
          <div className="divide-y divide-space-border/30">
            {files
              .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(file => (
                <div
                  key={file.path}
                  className={cn(
                    'flex items-center gap-3.5 px-5 py-3 transition-all duration-150 group',
                    file.isDirectory
                      ? 'cursor-pointer hover:bg-space-accent/5'
                      : 'hover:bg-space-navy/20',
                  )}
                  onClick={() => file.isDirectory && navigateTo(file.path)}
                >
                  <div className={cn(
                    'p-2.5 rounded-lg flex-shrink-0',
                    file.isDirectory
                      ? 'bg-space-accent/10 text-space-accent'
                      : 'bg-space-navy/40 text-space-mist/50',
                  )}>
                    {getIcon(file.name, file.isDirectory)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      file.isDirectory ? 'text-space-white' : 'text-space-mist/80',
                    )}>
                      {file.name}
                    </p>
                    <p className="text-[11px] text-space-mist/30 font-mono mt-0.5">
                      {file.isDirectory ? 'Directory' : formatBytes(file.size)}
                      {' · '}
                      {formatRelativeTime(file.modifiedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  {!file.isDirectory && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(file.path, file.name); }}
                        className="p-2 rounded-lg hover:bg-space-accent/15 text-space-mist/40 hover:text-space-accent transition-all"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.path); }}
                        className="p-2 rounded-lg hover:bg-red-500/15 text-space-mist/40 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {file.isDirectory && (
                    <ChevronRight className="w-4 h-4 text-space-mist/20 group-hover:text-space-accent/50
                                            transform group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getDemoFiles(): FileEntry[] {
  const now = new Date().toISOString();
  return [
    { name: 'Projects', path: '~/Projects', isDirectory: true, size: 0, modifiedAt: now },
    { name: 'Documents', path: '~/Documents', isDirectory: true, size: 0, modifiedAt: now },
    { name: 'Downloads', path: '~/Downloads', isDirectory: true, size: 0, modifiedAt: now },
    { name: '.zshrc', path: '~/.zshrc', isDirectory: false, size: 2048, modifiedAt: now },
    { name: 'notes.md', path: '~/notes.md', isDirectory: false, size: 4096, modifiedAt: now },
    { name: 'screenshot.png', path: '~/screenshot.png', isDirectory: false, size: 1_200_000, modifiedAt: now },
  ];
}
