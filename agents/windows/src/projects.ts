import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from '../../../packages/shared/src/types';

/** Resolve the data directory: %APPDATA%/.spacemish on Windows. */
function getDataDir(): string {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Roaming');
  return path.join(appData, '.spacemish');
}

const DATA_DIR = getDataDir();
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

/** Ensure the data directory and file exist. */
function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, '[]', 'utf-8');
  }
}

/** Read all projects from disk. */
function readAll(): Project[] {
  ensureFile();
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

/** Write projects to disk. */
function writeAll(projects: Project[]): void {
  ensureFile();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

/**
 * Get all projects.
 */
export function getProjects(): Project[] {
  return readAll();
}

/**
 * Get a single project by id.
 */
export function getProject(id: string): Project | undefined {
  return readAll().find((p) => p.id === id);
}

/**
 * Create a new project.
 */
export function createProject(
  data: Omit<Project, 'id'>,
): Project {
  const projects = readAll();
  const project: Project = {
    ...data,
    id: uuidv4(),
  };
  projects.push(project);
  writeAll(projects);
  return project;
}

/**
 * Update an existing project.
 */
export function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id'>>,
): Project | undefined {
  const projects = readAll();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;

  projects[idx] = { ...projects[idx], ...data, id };
  writeAll(projects);
  return projects[idx];
}

/**
 * Delete a project by id. Returns true if found and deleted.
 */
export function deleteProject(id: string): boolean {
  const projects = readAll();
  const filtered = projects.filter((p) => p.id !== id);
  if (filtered.length === projects.length) return false;
  writeAll(filtered);
  return true;
}
