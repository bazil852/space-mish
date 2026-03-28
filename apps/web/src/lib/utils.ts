import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function getOsIcon(os: string): string {
  switch (os) {
    case 'windows': return '🪟';
    case 'macos': return '🍎';
    case 'linux': return '🐧';
    default: return '💻';
  }
}

export function getOsLabel(os: string): string {
  switch (os) {
    case 'windows': return 'Windows';
    case 'macos': return 'macOS';
    case 'linux': return 'Linux';
    default: return os;
  }
}

export function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return 'folder';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    ts: 'file-code', tsx: 'file-code', js: 'file-code', jsx: 'file-code',
    py: 'file-code', rs: 'file-code', go: 'file-code', java: 'file-code',
    json: 'file-json', yaml: 'file-json', yml: 'file-json', toml: 'file-json',
    md: 'file-text', txt: 'file-text', log: 'file-text',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
    mp4: 'film', mov: 'film', avi: 'film',
    mp3: 'music', wav: 'music', flac: 'music',
    zip: 'archive', tar: 'archive', gz: 'archive', rar: 'archive',
    pdf: 'file-text',
    html: 'globe', css: 'palette',
  };
  return iconMap[ext] || 'file';
}

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3001';

export async function hubFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${HUB_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res.json();
}
