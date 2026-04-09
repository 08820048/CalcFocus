import { create } from "zustand";
import { createFallbackWorkspace } from "../lib/mock-project";
import type {
  CameraSettings,
  EffectSettings,
  RecentProject,
  RecordingMode,
  RecordingSettings,
  StyleSettings,
  StudioProject,
  WorkspaceBootstrap,
} from "../types/studio";

const initialWorkspace = createFallbackWorkspace();

function clampPlayhead(playhead: number, duration: number) {
  if (duration <= 0) {
    return 0;
  }

  if (playhead < 0) {
    return duration + (playhead % duration);
  }

  return playhead % duration;
}

interface StudioState {
  workspace: WorkspaceBootstrap;
  project: StudioProject;
  recordingMode: RecordingMode;
  playhead: number;
  isPlaying: boolean;
  focusMode: boolean;
  selectedMarkerId: string | null;
  selectedExportPresetId: string;
  statusMessage: string;
  lastSavedPath: string | null;
  hydrate: (workspace: WorkspaceBootstrap) => void;
  setProjectName: (name: string) => void;
  setPlayhead: (seconds: number) => void;
  advancePlayhead: (deltaSeconds: number) => void;
  togglePlayback: () => void;
  setPlaying: (playing: boolean) => void;
  toggleFocusMode: () => void;
  setFocusMode: (focusMode: boolean) => void;
  focusMarker: (markerId: string) => void;
  selectExportPreset: (presetId: string) => void;
  updateRecordingSettings: (patch: Partial<RecordingSettings>) => void;
  updateEffects: (patch: Partial<EffectSettings>) => void;
  updateCamera: (patch: Partial<CameraSettings>) => void;
  updateStyle: (patch: Partial<StyleSettings>) => void;
  setRecordingMode: (mode: RecordingMode, detail?: string) => void;
  setStatusMessage: (message: string) => void;
  markSaved: (path: string, recentProjects: RecentProject[]) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  workspace: initialWorkspace,
  project: initialWorkspace.project,
  recordingMode: initialWorkspace.recordingMode,
  playhead: 2.4,
  isPlaying: true,
  focusMode: false,
  selectedMarkerId: initialWorkspace.project.markers[0]?.id ?? null,
  selectedExportPresetId: initialWorkspace.exportPresets[0]?.id ?? "",
  statusMessage: initialWorkspace.activityFeed[0] ?? "FluxLocus workspace ready.",
  lastSavedPath: initialWorkspace.lastSavedPath ?? null,
  hydrate: (workspace) =>
    set(() => ({
      workspace,
      project: workspace.project,
      recordingMode: workspace.recordingMode,
      playhead: 2.4,
      isPlaying: true,
      focusMode: false,
      selectedMarkerId: workspace.project.markers[0]?.id ?? null,
      selectedExportPresetId: workspace.exportPresets[0]?.id ?? "",
      statusMessage: workspace.activityFeed[0] ?? "FluxLocus workspace ready.",
      lastSavedPath: workspace.lastSavedPath ?? null,
    })),
  setProjectName: (name) =>
    set((state) => ({
      project: {
        ...state.project,
        name,
      },
    })),
  setPlayhead: (seconds) =>
    set((state) => ({
      playhead: clampPlayhead(seconds, state.project.duration),
    })),
  advancePlayhead: (deltaSeconds) =>
    set((state) => {
      const delta = deltaSeconds * Math.max(0.35, state.project.effects.zoomStrength + 0.3);

      return {
        playhead: clampPlayhead(state.playhead + delta, state.project.duration),
      };
    }),
  togglePlayback: () =>
    set((state) => ({
      isPlaying: !state.isPlaying,
      statusMessage: state.isPlaying
        ? "Preview playback paused while you refine the edit."
        : "Preview playback resumed with live spline updates.",
    })),
  setPlaying: (playing) => set(() => ({ isPlaying: playing })),
  toggleFocusMode: () =>
    set((state) => ({
      focusMode: !state.focusMode,
      statusMessage: state.focusMode
        ? "Returned to the full studio layout."
        : "Entered focus mode. Side panels are tucked away.",
    })),
  setFocusMode: (focusMode) =>
    set(() => ({
      focusMode,
      statusMessage: focusMode
        ? "Entered focus mode. Side panels are tucked away."
        : "Returned to the full studio layout.",
    })),
  focusMarker: (markerId) =>
    set((state) => {
      const marker = state.project.markers.find((item) => item.id === markerId);

      return {
        selectedMarkerId: markerId,
        playhead: marker?.time ?? state.playhead,
        statusMessage: marker?.note ?? state.statusMessage,
      };
    }),
  selectExportPreset: (presetId) => set(() => ({ selectedExportPresetId: presetId })),
  updateRecordingSettings: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        recordingSettings: {
          ...state.project.recordingSettings,
          ...patch,
        },
      },
    })),
  updateEffects: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        effects: {
          ...state.project.effects,
          ...patch,
        },
      },
    })),
  updateCamera: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        camera: {
          ...state.project.camera,
          ...patch,
        },
      },
    })),
  updateStyle: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        style: {
          ...state.project.style,
          ...patch,
        },
      },
    })),
  setRecordingMode: (mode, detail) =>
    set((state) => ({
      recordingMode: mode,
      isPlaying: mode === "paused" ? false : state.isPlaying,
      statusMessage: detail ?? state.statusMessage,
    })),
  setStatusMessage: (message) => set(() => ({ statusMessage: message })),
  markSaved: (path, recentProjects) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        recentProjects,
        lastSavedPath: path,
        activityFeed: [
          `Saved ${state.project.name} to ${path}.`,
          ...state.workspace.activityFeed,
        ].slice(0, 4),
      },
      lastSavedPath: path,
      statusMessage: `Project state saved to ${path}.`,
    })),
}));

export function useSelectedExportPreset() {
  return useStudioStore((state) =>
    state.workspace.exportPresets.find(
      (preset) => preset.id === state.selectedExportPresetId,
    ),
  );
}
