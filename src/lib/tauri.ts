import { invoke } from "@tauri-apps/api/core";
import { createFallbackWorkspace } from "./mock-project";
import type {
  ExportRequest,
  ExportResponse,
  RecentProject,
  RecordingMode,
  RecordingModeResponse,
  SaveProjectResponse,
  StudioProject,
  WorkspaceBootstrap,
} from "../types/studio";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

const recentProjectsStorageKey = "fluxlocus:recent-projects";
const currentProjectPathStorageKey = "fluxlocus:current-project-path";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectStorageKey(path: string) {
  return `fluxlocus:project:${path}`;
}

function sortRecentProjects(recentProjects: RecentProject[]) {
  return [...recentProjects].sort(
    (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
  );
}

function readRecentProjects() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const payload = window.localStorage.getItem(recentProjectsStorageKey);
    if (!payload) {
      return [];
    }

    const parsed = JSON.parse(payload) as RecentProject[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortRecentProjects(
      parsed.filter(
        (item): item is RecentProject =>
          Boolean(item) &&
          typeof item.path === "string" &&
          typeof item.name === "string" &&
          typeof item.updatedAt === "number",
      ),
    );
  } catch {
    return [];
  }
}

function writeRecentProjects(recentProjects: RecentProject[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    recentProjectsStorageKey,
    JSON.stringify(sortRecentProjects(recentProjects)),
  );
}

function readStoredProject(path: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const payload = window.localStorage.getItem(projectStorageKey(path));
    if (!payload) {
      return null;
    }

    return JSON.parse(payload) as StudioProject;
  } catch {
    return null;
  }
}

function writeStoredProject(path: string, project: StudioProject) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(projectStorageKey(path), JSON.stringify(project));
}

function readCurrentProjectPath() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(currentProjectPathStorageKey);
}

function writeCurrentProjectPath(path: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(currentProjectPathStorageKey, path);
}

function buildBrowserWorkspace(
  project: StudioProject,
  recentProjects: RecentProject[],
  lastSavedPath: string | null,
  activityFeed: string[],
): WorkspaceBootstrap {
  const fallback = createFallbackWorkspace();

  return {
    ...fallback,
    project,
    activityFeed,
    recentProjects,
    lastSavedPath,
  };
}

export async function bootstrapWorkspace() {
  if (!isTauriRuntime()) {
    const fallback = createFallbackWorkspace();
    const recentProjects = readRecentProjects();
    const candidatePaths = [
      readCurrentProjectPath(),
      ...recentProjects.map((project) => project.path),
    ].filter((path): path is string => Boolean(path));
    const currentProjectPath =
      candidatePaths.find((path) => Boolean(readStoredProject(path))) ?? null;
    const currentProject = currentProjectPath ? readStoredProject(currentProjectPath) : null;

    if (currentProject && currentProjectPath) {
      return buildBrowserWorkspace(currentProject, recentProjects, currentProjectPath, [
        `Resumed ${currentProject.name} from browser preview storage.`,
        "Recent browser projects are indexed and ready to reopen.",
        "Local preview persistence mirrors the .fluxlocus project shape.",
      ]);
    }

    return {
      ...fallback,
      recentProjects,
      lastSavedPath: currentProjectPath,
      activityFeed:
        recentProjects.length > 0
          ? [
              "Recent browser projects are available in the studio sidebar.",
              ...fallback.activityFeed.slice(0, 2),
            ]
          : fallback.activityFeed,
    };
  }

  return invoke<WorkspaceBootstrap>("bootstrap_workspace");
}

export async function saveProject(project: StudioProject) {
  if (!isTauriRuntime()) {
    const slug = slugify(project.name) || "fluxlocus-project";
    const path = `/tmp/${slug}.fluxlocus`;
    const recentProjects = sortRecentProjects([
      {
        path,
        name: project.name,
        updatedAt: Date.now(),
      },
      ...readRecentProjects().filter((item) => item.path !== path),
    ]);

    writeStoredProject(path, project);
    writeRecentProjects(recentProjects);
    writeCurrentProjectPath(path);

    return {
      path,
      recentProjects,
    } satisfies SaveProjectResponse;
  }

  return invoke<SaveProjectResponse>("save_project", { project });
}

export async function openProject(path: string) {
  if (!isTauriRuntime()) {
    const project = readStoredProject(path);

    if (!project) {
      throw new Error(`No browser preview project exists at ${path}.`);
    }

    const recentProjects = readRecentProjects();
    writeCurrentProjectPath(path);

    return buildBrowserWorkspace(project, recentProjects, path, [
      `Opened ${project.name} from browser preview storage.`,
      "Recent browser projects are indexed and ready to reopen.",
      "Local preview persistence mirrors the .fluxlocus project shape.",
    ]);
  }

  return invoke<WorkspaceBootstrap>("open_project", { path });
}

export async function updateRecordingMode(mode: RecordingMode) {
  if (!isTauriRuntime()) {
    return {
      mode,
      detail: `Switched studio state to ${mode} in browser preview mode.`,
    } satisfies RecordingModeResponse;
  }

  return invoke<RecordingModeResponse>("set_recording_mode", { mode });
}

export async function exportProject(request: ExportRequest) {
  if (!isTauriRuntime()) {
    return {
      path: `/tmp/fluxlocus-export.${request.format}`,
      detail: "Queued a synthetic browser export.",
    } satisfies ExportResponse;
  }

  return invoke<ExportResponse>("queue_export", { request });
}
