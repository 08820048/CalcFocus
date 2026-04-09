import { invoke } from "@tauri-apps/api/core";
import { createFallbackWorkspace } from "./mock-project";
import type {
  ExportRequest,
  ExportResponse,
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

export async function bootstrapWorkspace() {
  if (!isTauriRuntime()) {
    return createFallbackWorkspace();
  }

  return invoke<WorkspaceBootstrap>("bootstrap_workspace");
}

export async function saveProject(project: StudioProject) {
  if (!isTauriRuntime()) {
    return {
      path: `/tmp/${project.name.toLowerCase().replace(/\s+/g, "-")}.fluxlocus`,
    } satisfies SaveProjectResponse;
  }

  return invoke<SaveProjectResponse>("save_project", { project });
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
