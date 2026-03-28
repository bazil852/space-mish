import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  type: string;
  markers: string[];
  hasGit: boolean;
  lastModified: string;
}

const PROJECT_MARKERS: Record<string, string> = {
  'package.json': 'node',
  'Cargo.toml': 'rust',
  'go.mod': 'go',
  'requirements.txt': 'python',
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'pom.xml': 'java',
  'build.gradle': 'java',
  'Makefile': 'generic',
  'CMakeLists.txt': 'cpp',
  'docker-compose.yml': 'generic',
  'Dockerfile': 'generic',
  '*.xcodeproj': 'swift',
  '*.xcworkspace': 'swift',
};

function getProjectRoots(): string[] {
  const envDirs = process.env.AGENT_PROJECT_DIRS;
  if (envDirs) {
    return envDirs.split(',').map(d => {
      const trimmed = d.trim();
      if (trimmed === '~' || trimmed.startsWith('~/')) {
        return path.join(os.homedir(), trimmed.slice(1));
      }
      return trimmed;
    });
  }
  // macOS default: ~/Documents
  return [path.join(os.homedir(), 'Documents')];
}

export function discoverProjects(): DiscoveredProject[] {
  const roots = getProjectRoots();
  const projects: DiscoveredProject[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    let entries: string[];
    try { entries = fs.readdirSync(root); } catch { continue; }

    for (const entry of entries) {
      const fullPath = path.join(root, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;
        if (entry.startsWith('.') || entry.startsWith('$') || entry.startsWith('~')) continue;
        const lower = entry.toLowerCase();
        if (['node_modules', '__pycache__', 'dist', 'build', 'out', '.trash', 'library'].includes(lower)) continue;

        let subEntries: string[];
        try { subEntries = fs.readdirSync(fullPath); } catch { continue; }

        const markers: string[] = [];
        let projectType = 'generic';
        let isProject = false;

        for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
          if (marker.startsWith('*')) {
            const ext = marker.slice(1);
            if (subEntries.some(f => f.endsWith(ext))) {
              markers.push(marker);
              projectType = type;
              isProject = true;
            }
          } else if (subEntries.includes(marker)) {
            markers.push(marker);
            projectType = type;
            isProject = true;
          }
        }

        const hasGit = subEntries.includes('.git');
        if (!isProject) continue;

        const id = crypto.createHash('sha256').update(fullPath).digest('hex').slice(0, 12);
        projects.push({ id, name: entry, path: fullPath, type: projectType, markers, hasGit, lastModified: stat.mtime.toISOString() });
      } catch { continue; }
    }
  }

  projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  return projects;
}

export function discoverProjectsDeep(): DiscoveredProject[] {
  return discoverProjects();
}
