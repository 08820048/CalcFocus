export type RecordingMode =
  | "idle"
  | "recording"
  | "paused"
  | "editing"
  | "exporting";

export type CaptureKind = "screen" | "window" | "region";
export type MarkerKind = "zoom" | "click" | "annotation" | "trim";
export type CameraPosition = "top-right" | "bottom-right" | "bottom-left";
export type ExportFormat = "mp4" | "gif";
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3";

export interface CaptureSource {
  id: string;
  label: string;
  kind: CaptureKind;
  description: string;
}

export interface ExportPreset {
  id: string;
  label: string;
  resolution: string;
  bitrate: string;
  format: ExportFormat;
  fps: number;
}

export interface CursorKeyframe {
  id: string;
  time: number;
  x: number;
  y: number;
  emphasis: number;
  click: boolean;
  zoom: number;
}

export interface TimelineSegment {
  id: string;
  label: string;
  start: number;
  end: number;
  speed: number;
  accent: string;
}

export interface TimelineMarker {
  id: string;
  label: string;
  time: number;
  kind: MarkerKind;
  strength: number;
  note: string;
}

export interface RecordingSettings {
  sourceId: string;
  countdown: number;
  frameRate: number;
  includeSystemAudio: boolean;
  includeMic: boolean;
  includeCamera: boolean;
  resolution: string;
}

export interface EffectSettings {
  locusEnabled: boolean;
  fluxEnabled: boolean;
  locusVisualized: boolean;
  autoZoom: boolean;
  smoothness: number;
  motionBlur: number;
  cursorScale: number;
  fluxIntensity: number;
  zoomStrength: number;
}

export interface CameraSettings {
  enabled: boolean;
  position: CameraPosition;
  size: number;
  radius: number;
  shadow: number;
  mirrored: boolean;
}

export interface StyleSettings {
  aspectRatio: AspectRatio;
  backgroundPreset: "obsidian" | "aurora" | "studio";
  canvasPadding: number;
  cornerRadius: number;
  shadow: number;
}

export interface StudioProject {
  id: string;
  name: string;
  duration: number;
  recordingSettings: RecordingSettings;
  effects: EffectSettings;
  camera: CameraSettings;
  style: StyleSettings;
  cursorKeyframes: CursorKeyframe[];
  segments: TimelineSegment[];
  markers: TimelineMarker[];
  notes: string[];
}

export interface WorkspaceBootstrap {
  appVersion: string;
  captureSources: CaptureSource[];
  exportPresets: ExportPreset[];
  project: StudioProject;
  recordingMode: RecordingMode;
  activityFeed: string[];
  lastSavedPath?: string | null;
}

export interface SaveProjectResponse {
  path: string;
}

export interface ExportRequest {
  presetId: string;
  format: ExportFormat;
}

export interface ExportResponse {
  path: string;
  detail: string;
}

export interface RecordingModeResponse {
  mode: RecordingMode;
  detail: string;
}
