import type {
  CaptureSource,
  ExportPreset,
  WorkspaceBootstrap,
} from "../types/studio";

const captureSources: CaptureSource[] = [
  {
    id: "screen-main",
    label: "Studio Display",
    kind: "screen",
    description: "6K desktop capture with Retina downscale preview.",
  },
  {
    id: "window-docs",
    label: "Product Docs",
    kind: "window",
    description: "Focused document window for tutorial capture.",
  },
  {
    id: "region-demo",
    label: "Demo Crop",
    kind: "region",
    description: "Manual 1440p crop for portrait reels and short clips.",
  },
];

const exportPresets: ExportPreset[] = [
  {
    id: "preset-4k",
    label: "Movie 4K",
    resolution: "3840x2160",
    bitrate: "60 Mbps",
    format: "mp4",
    fps: 60,
  },
  {
    id: "preset-social",
    label: "Social 1080p",
    resolution: "1920x1080",
    bitrate: "18 Mbps",
    format: "mp4",
    fps: 60,
  },
  {
    id: "preset-gif",
    label: "Annotated GIF",
    resolution: "1280x720",
    bitrate: "Adaptive",
    format: "gif",
    fps: 24,
  },
];

export function createFallbackWorkspace(): WorkspaceBootstrap {
  return {
    appVersion: "0.1.0-mvp",
    captureSources,
    exportPresets,
    recordingMode: "editing",
    lastSavedPath: null,
    activityFeed: [
      "Loaded the FluxLocus studio shell with local preview data.",
      "Smart focus markers were generated from cursor velocity and click bursts.",
      "Pixi preview is rendering the Locus spline and Flux glow in real time.",
    ],
    project: {
      id: "project-fluxlocus-mvp",
      name: "FluxLocus Demo Session",
      duration: 32,
      recordingSettings: {
        sourceId: "screen-main",
        countdown: 3,
        frameRate: 60,
        includeSystemAudio: true,
        includeMic: true,
        includeCamera: true,
        resolution: "2560x1440",
      },
      effects: {
        locusEnabled: true,
        fluxEnabled: true,
        locusVisualized: true,
        autoZoom: true,
        smoothness: 0.82,
        motionBlur: 0.68,
        cursorScale: 1.08,
        fluxIntensity: 0.74,
        zoomStrength: 0.7,
      },
      camera: {
        enabled: true,
        position: "bottom-right",
        size: 0.22,
        radius: 28,
        shadow: 0.72,
        mirrored: false,
      },
      style: {
        aspectRatio: "16:9",
        backgroundPreset: "aurora",
        canvasPadding: 54,
        cornerRadius: 32,
        shadow: 0.7,
      },
      cursorKeyframes: [
        { id: "kf-1", time: 0, x: 0.14, y: 0.2, emphasis: 0.3, click: false, zoom: 0.12 },
        { id: "kf-2", time: 2.8, x: 0.22, y: 0.28, emphasis: 0.42, click: false, zoom: 0.14 },
        { id: "kf-3", time: 5.2, x: 0.34, y: 0.4, emphasis: 0.55, click: true, zoom: 0.36 },
        { id: "kf-4", time: 8.3, x: 0.55, y: 0.34, emphasis: 0.46, click: false, zoom: 0.28 },
        { id: "kf-5", time: 11.5, x: 0.72, y: 0.18, emphasis: 0.35, click: false, zoom: 0.22 },
        { id: "kf-6", time: 14.9, x: 0.79, y: 0.42, emphasis: 0.64, click: true, zoom: 0.62 },
        { id: "kf-7", time: 18.8, x: 0.62, y: 0.66, emphasis: 0.52, click: false, zoom: 0.38 },
        { id: "kf-8", time: 22.7, x: 0.38, y: 0.7, emphasis: 0.41, click: false, zoom: 0.2 },
        { id: "kf-9", time: 27.4, x: 0.21, y: 0.52, emphasis: 0.58, click: true, zoom: 0.56 },
        { id: "kf-10", time: 32, x: 0.18, y: 0.28, emphasis: 0.28, click: false, zoom: 0.18 },
      ],
      segments: [
        { id: "seg-1", label: "Intro setup", start: 0, end: 7.5, speed: 1, accent: "#60A5FA" },
        { id: "seg-2", label: "Feature walkthrough", start: 7.5, end: 16.8, speed: 1, accent: "#8B5CF6" },
        { id: "seg-3", label: "Focused zoom", start: 16.8, end: 24.6, speed: 0.8, accent: "#34D399" },
        { id: "seg-4", label: "Callout finish", start: 24.6, end: 32, speed: 1.1, accent: "#F59E0B" },
      ],
      markers: [
        {
          id: "mk-1",
          label: "Auto zoom suggestion",
          time: 5.2,
          kind: "zoom",
          strength: 0.64,
          note: "Fast acceleration plus click burst indicates a likely focus moment.",
        },
        {
          id: "mk-2",
          label: "Annotation slot",
          time: 10.4,
          kind: "annotation",
          strength: 0.34,
          note: "Reserve this moment for a short product callout or chapter title.",
        },
        {
          id: "mk-3",
          label: "Primary click highlight",
          time: 14.9,
          kind: "click",
          strength: 0.82,
          note: "Amplify the cursor click ring and camera reaction for emphasis.",
        },
        {
          id: "mk-4",
          label: "Trim anchor",
          time: 24.2,
          kind: "trim",
          strength: 0.28,
          note: "Suggested cut point for a shorter social export.",
        },
        {
          id: "mk-5",
          label: "Outro zoom",
          time: 27.4,
          kind: "zoom",
          strength: 0.73,
          note: "Ease back in toward the final CTA to match the cursor slowdown.",
        },
      ],
      notes: [
        "MVP uses a synthetic cursor dataset so the Pixi preview and timeline can be built before native capture is wired in.",
        "Project serialization is already shaped like a .fluxlocus file for future persistence compatibility.",
      ],
    },
  };
}
