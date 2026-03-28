import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { FileEntry } from '../../../packages/shared/src/types';

/** Directories the agent is allowed to access. */
function getApprovedDirs(): string[] {
  const envDirs = process.env.AGENT_APPROVED_DIRS;
  if (envDirs) {
    return envDirs.split(',').map((d) => d.trim());
  }
  return [os.homedir(), 'C:\\Users'];
}

/**
 * Normalize a Windows path for comparison: resolve, lowercase, use backslashes.
 */
function normalizePath(p: string): string {
  return path.resolve(p).toLowerCase().replace(/\//g, '\\');
}

/**
 * Check whether a given absolute path falls within one of the approved directories.
 */
export function isPathApproved(targetPath: string): boolean {
  const resolved = normalizePath(targetPath);
  return getApprovedDirs().some((dir) => resolved.startsWith(normalizePath(dir)));
}

function assertPathApproved(targetPath: string): void {
  if (!isPathApproved(targetPath)) {
    throw new Error(`Access denied: ${targetPath} is outside approved directories`);
  }
}

/** Guess a MIME type from the file extension. */
function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.exe': 'application/x-msdownload',
    '.msi': 'application/x-msi',
    '.dll': 'application/x-msdownload',
    '.ps1': 'application/x-powershell',
    '.bat': 'application/x-bat',
    '.cmd': 'application/x-bat',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Get info about a single file/directory.
 */
export async function getFileInfo(filePath: string): Promise<FileEntry> {
  assertPathApproved(filePath);
  const stat = await fs.promises.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    mime: stat.isDirectory() ? undefined : guessMime(filePath),
  };
}

/**
 * List entries in a directory.
 */
export async function browseDirectory(dirPath: string): Promise<FileEntry[]> {
  const resolved = path.resolve(dirPath);
  assertPathApproved(resolved);

  const entries = await fs.promises.readdir(resolved);
  const results: FileEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(resolved, entry);
    try {
      const stat = await fs.promises.stat(fullPath);
      results.push({
        name: entry,
        path: fullPath,
        isDirectory: stat.isDirectory(),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        mime: stat.isDirectory() ? undefined : guessMime(fullPath),
      });
    } catch {
      // Skip entries we can't stat (permission denied, broken symlinks, etc.)
    }
  }

  return results;
}

/**
 * Save an uploaded file buffer to a target path.
 */
export async function uploadFile(
  buffer: Buffer,
  targetPath: string,
): Promise<FileEntry> {
  assertPathApproved(targetPath);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);
  return getFileInfo(targetPath);
}

/**
 * Create a read stream for downloading a file.
 */
export function downloadStream(filePath: string): fs.ReadStream {
  assertPathApproved(filePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.createReadStream(filePath);
}

/**
 * Move or rename a file/directory.
 */
export async function moveFile(
  sourcePath: string,
  destPath: string,
): Promise<FileEntry> {
  assertPathApproved(sourcePath);
  assertPathApproved(destPath);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.rename(sourcePath, destPath);
  return getFileInfo(destPath);
}

/**
 * Delete a file or directory.
 */
export async function deleteFile(targetPath: string): Promise<void> {
  assertPathApproved(targetPath);
  const stat = await fs.promises.stat(targetPath);
  if (stat.isDirectory()) {
    await fs.promises.rm(targetPath, { recursive: true });
  } else {
    await fs.promises.unlink(targetPath);
  }
}
