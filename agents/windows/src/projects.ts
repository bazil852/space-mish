import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  type: string;      // 'node' | 'python' | 'rust' | 'go' | 'dotnet' | 'generic'
  markers: string[];  // which files were found
  hasGit: boolean;
  lastModified: string;
}

// Files that indicate a directory is a project
const PROJECT_MARKERS: Record<string, string> = {
  'package.json': 'node',
  'Cargo.toml': 'rust',
  'go.mod': 'go',
  'requirements.txt': 'python',
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'pom.xml': 'java',
  'build.gradle': 'java',
  '*.sln': 'dotnet',
  '*.csproj': 'dotnet',
  'Makefile': 'generic',
  'CMakeLists.txt': 'cpp',
  'docker-compose.yml': 'generic',
  'Dockerfile': 'generic',
};

const PROJECT_ICONS: Record<string, string> = {
  node: '📦',
  rust: '🦀',
  go: '🐹',
  python: '🐍',
  java: '☕',
  dotnet: '🔷',
  cpp: '⚙️',
  generic: '📁',
};

/**
 * Get the directories to scan for projects.
 * Configurable via AGENT_PROJECT_DIRS env var, defaults to ~/Documents
 */
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
  // Default: Documents folder
  return [path.join(os.homedir(), 'Documents')];
}

/**
 * Scan a directory for project-like subdirectories (1 level deep).
 */
export function discoverProjects(): DiscoveredProject[] {
  const roots = getProjectRoots();
  const projects: DiscoveredProject[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(root, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;

        // Skip hidden dirs, node_modules, etc.
        if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue;

        // Check for project markers
        const markers: string[] = [];
        let projectType = 'generic';
        let isProject = false;

        let subEntries: string[];
        try {
          subEntries = fs.readdirSync(fullPath);
        } catch {
          continue;
        }

        for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
          if (marker.startsWith('*')) {
            // Glob match (e.g., *.sln)
            const ext = marker.slice(1);
            if (subEntries.some(f => f.endsWith(ext))) {
              markers.push(marker);
              projectType = type;
              isProject = true;
            }
          } else {
            if (subEntries.includes(marker)) {
              markers.push(marker);
              projectType = type;
              isProject = true;
            }
          }
        }

        const hasGit = subEntries.includes('.git');

        // If it has a .git folder, it's a project even without markers
        if (hasGit) isProject = true;

        // Also include folders that have subdirectories (likely workspace folders)
        // but only if they're in the root scan dirs
        if (!isProject) continue;

        const id = crypto.createHash('sha256')
          .update(fullPath)
          .digest('hex')
          .slice(0, 12);

        projects.push({
          id,
          name: entry,
          path: fullPath,
          type: projectType,
          markers,
          hasGit,
          lastModified: stat.mtime.toISOString(),
        });
      } catch {
        // Skip entries we can't read
      }
    }
  }

  // Sort by last modified (newest first)
  projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  return projects;
}

/**
 * Get the icon for a project type.
 */
export function getProjectIcon(type: string): string {
  return PROJECT_ICONS[type] || '📁';
}

/**
 * Scan deeper for projects (2 levels deep) — useful for monorepos or workspace folders.
 */
export function discoverProjectsDeep(): DiscoveredProject[] {
  const shallow = discoverProjects();

  // Also check one level inside each root for sub-projects
  const roots = getProjectRoots();
  const deepProjects: DiscoveredProject[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      const entries = fs.readdirSync(root);
      for (const entry of entries) {
        const subDir = path.join(root, entry);
        try {
          const stat = fs.statSync(subDir);
          if (!stat.isDirectory() || entry.startsWith('.')) continue;

          // Check sub-entries for more projects
          const subEntries = fs.readdirSync(subDir);
          for (const subEntry of subEntries) {
            const deepPath = path.join(subDir, subEntry);
            try {
              const deepStat = fs.statSync(deepPath);
              if (!deepStat.isDirectory() || subEntry.startsWith('.')) continue;

              const deepContents = fs.readdirSync(deepPath);
              const hasMarker = Object.keys(PROJECT_MARKERS).some(m =>
                m.startsWith('*') ? deepContents.some(f => f.endsWith(m.slice(1))) : deepContents.includes(m)
              );
              const hasGit = deepContents.includes('.git');

              if (hasMarker || hasGit) {
                // Only add if not already in shallow results
                if (!shallow.some(p => p.path === deepPath)) {
                  const id = crypto.createHash('sha256').update(deepPath).digest('hex').slice(0, 12);
                  let type = 'generic';
                  for (const [marker, t] of Object.entries(PROJECT_MARKERS)) {
                    if (marker.startsWith('*') ? deepContents.some(f => f.endsWith(marker.slice(1))) : deepContents.includes(marker)) {
                      type = t;
                      break;
                    }
                  }
                  deepProjects.push({
                    id,
                    name: `${entry}/${subEntry}`,
                    path: deepPath,
                    type,
                    markers: [],
                    hasGit,
                    lastModified: deepStat.mtime.toISOString(),
                  });
                }
              }
            } catch { continue; }
          }
        } catch { continue; }
      }
    } catch { continue; }
  }

  return [...shallow, ...deepProjects];
}
