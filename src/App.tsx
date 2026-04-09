import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Command,
  FolderOpen,
  Download,
  Mic,
  Monitor,
  MousePointer2,
  Pause,
  Radio,
  Save,
  Sparkles,
  Square,
  Video,
  WandSparkles,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CommandPalette,
  type CommandPaletteItem,
} from "./components/command-palette";
import { GlassPanel } from "./components/glass-panel";
import { PreviewCanvas } from "./components/preview-canvas";
import { TimelinePanel } from "./components/timeline-panel";
import { formatTime } from "./lib/locus";
import {
  bootstrapWorkspace,
  exportProject,
  openProject,
  saveProject,
  updateRecordingMode,
} from "./lib/tauri";
import { useSelectedExportPreset, useStudioStore } from "./store/studio-store";
import type {
  ExportPreset,
  RecentProject,
  RecordingMode,
} from "./types/studio";

const aspectRatios = ["16:9", "9:16", "1:1", "4:3"] as const;
const backgroundPresets = ["aurora", "obsidian", "studio"] as const;
const recentProjectDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatRecentProjectTime(updatedAt: number) {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return "Saved earlier";
  }

  return recentProjectDateFormatter.format(updatedAt);
}

function App() {
  const workspace = useStudioStore((state) => state.workspace);
  const project = useStudioStore((state) => state.project);
  const recordingMode = useStudioStore((state) => state.recordingMode);
  const playhead = useStudioStore((state) => state.playhead);
  const isPlaying = useStudioStore((state) => state.isPlaying);
  const focusMode = useStudioStore((state) => state.focusMode);
  const selectedMarkerId = useStudioStore((state) => state.selectedMarkerId);
  const statusMessage = useStudioStore((state) => state.statusMessage);
  const lastSavedPath = useStudioStore((state) => state.lastSavedPath);
  const hydrate = useStudioStore((state) => state.hydrate);
  const setProjectName = useStudioStore((state) => state.setProjectName);
  const setPlayhead = useStudioStore((state) => state.setPlayhead);
  const advancePlayhead = useStudioStore((state) => state.advancePlayhead);
  const togglePlayback = useStudioStore((state) => state.togglePlayback);
  const setPlaying = useStudioStore((state) => state.setPlaying);
  const toggleFocusMode = useStudioStore((state) => state.toggleFocusMode);
  const focusMarker = useStudioStore((state) => state.focusMarker);
  const selectExportPreset = useStudioStore((state) => state.selectExportPreset);
  const updateEffects = useStudioStore((state) => state.updateEffects);
  const updateCamera = useStudioStore((state) => state.updateCamera);
  const updateStyle = useStudioStore((state) => state.updateStyle);
  const updateRecordingSettings = useStudioStore(
    (state) => state.updateRecordingSettings,
  );
  const applyRecordingMode = useStudioStore((state) => state.setRecordingMode);
  const setStatusMessage = useStudioStore((state) => state.setStatusMessage);
  const markSaved = useStudioStore((state) => state.markSaved);
  const selectedPreset = useSelectedExportPreset();

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const lastFrameRef = useRef<number | null>(null);
  const deferredCommandQuery = useDeferredValue(commandQuery);

  const selectedMarker =
    project.markers.find((marker) => marker.id === selectedMarkerId) ??
    project.markers[0] ??
    null;

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const workspacePayload = await bootstrapWorkspace();
        if (!cancelled) {
          hydrate(workspacePayload);
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(
            `Bootstrap failed, using the local workspace model instead. ${String(error)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [hydrate, setStatusMessage]);

  const animatePreview = useEffectEvent((now: number) => {
    if (lastFrameRef.current === null) {
      lastFrameRef.current = now;
      return;
    }

    const deltaSeconds = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;
    advancePlayhead(deltaSeconds);
  });

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }

    let frame = 0;

    const loop = (now: number) => {
      animatePreview(now);
      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [animatePreview, isPlaying]);

  async function handleRecordingMode(mode: RecordingMode) {
    setBusyAction(mode);

    try {
      const response = await updateRecordingMode(mode);
      applyRecordingMode(response.mode, response.detail);

      if (response.mode === "recording") {
        setPlaying(true);
      }

      if (response.mode === "paused") {
        setPlaying(false);
      }
    } catch (error) {
      setStatusMessage(`Unable to switch studio mode: ${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    setBusyAction("save");

    try {
      const response = await saveProject(project);
      markSaved(response.path, response.recentProjects);
    } catch (error) {
      setStatusMessage(`Saving the project failed: ${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenProject(path: string) {
    setBusyAction(`open:${path}`);

    try {
      const workspacePayload = await openProject(path);
      hydrate(workspacePayload);
    } catch (error) {
      setStatusMessage(`Opening the project failed: ${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExport() {
    const preset = selectedPreset ?? workspace.exportPresets[0];

    if (!preset) {
      setStatusMessage("No export preset is available yet.");
      return;
    }

    setBusyAction("export");

    try {
      const response = await exportProject({
        presetId: preset.id,
        format: preset.format,
      });
      applyRecordingMode("exporting", response.detail);
      setStatusMessage(`${response.detail} Output: ${response.path}`);
    } catch (error) {
      setStatusMessage(`Export queue failed: ${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  function openCommandPalette() {
    startTransition(() => {
      setCommandQuery("");
      setActiveCommandIndex(0);
      setIsCommandPaletteOpen(true);
    });
  }

  function closeCommandPalette() {
    startTransition(() => {
      setIsCommandPaletteOpen(false);
      setCommandQuery("");
      setActiveCommandIndex(0);
    });
  }

  interface StudioCommand extends CommandPaletteItem {
    keywords?: string[];
    run: () => void;
  }

  const commands: StudioCommand[] = [
    {
      id: "command-palette-record",
      title: "Start recording",
      section: "Transport",
      description: "Switch the workspace into recording mode and keep preview playback live.",
      shortcut: "Shift R",
      keywords: ["record", "capture", "transport"],
      run: () => void handleRecordingMode("recording"),
    },
    {
      id: "command-palette-pause-recording",
      title: "Pause recording",
      section: "Transport",
      description: "Freeze the recording transport without leaving the current workspace.",
      shortcut: "Shift P",
      keywords: ["pause", "recording", "transport"],
      run: () => void handleRecordingMode("paused"),
    },
    {
      id: "command-palette-stop-recording",
      title: "Stop and return to editing",
      section: "Transport",
      description: "Leave capture mode and return to edit mode with the current session.",
      keywords: ["stop", "editing", "transport"],
      run: () => void handleRecordingMode("editing"),
    },
    {
      id: "command-palette-toggle-playback",
      title: isPlaying ? "Pause preview playback" : "Resume preview playback",
      section: "Preview",
      description: "Toggle the timeline transport inside the live FluxLocus preview.",
      shortcut: "Space",
      keywords: ["preview", "play", "pause", "timeline"],
      run: togglePlayback,
    },
    {
      id: "command-palette-focus-mode",
      title: focusMode ? "Exit focus mode" : "Enter focus mode",
      section: "Layout",
      description: "Hide or restore both side panels to concentrate on preview and timeline.",
      shortcut: "Shift F",
      keywords: ["focus", "layout", "panels", "studio"],
      run: toggleFocusMode,
    },
    {
      id: "command-palette-save",
      title: "Save project",
      section: "Project",
      description: "Serialize the current studio state to a local .fluxlocus project file.",
      shortcut: "Cmd/Ctrl S",
      keywords: ["save", "project", "file"],
      run: () => void handleSave(),
    },
    ...(workspace.recentProjects[0]
      ? [
          {
            id: "command-palette-open-latest",
            title: `Open latest project: ${workspace.recentProjects[0].name}`,
            section: "Recent",
            description: `Resume the most recently saved session from ${formatRecentProjectTime(
              workspace.recentProjects[0].updatedAt,
            )}.`,
            keywords: ["open", "latest", "recent", workspace.recentProjects[0].name],
            run: () => void handleOpenProject(workspace.recentProjects[0].path),
          } satisfies StudioCommand,
        ]
      : []),
    {
      id: "command-palette-export",
      title: "Queue export",
      section: "Project",
      description: "Send the selected export preset into the Rust export queue placeholder.",
      shortcut: "Shift E",
      keywords: ["export", "render", "share"],
      run: () => void handleExport(),
    },
    {
      id: "command-palette-toggle-locus",
      title: project.effects.locusEnabled ? "Disable Locus smoothing" : "Enable Locus smoothing",
      section: "Effects",
      description: "Toggle spline-driven cursor interpolation and motion trail rendering.",
      keywords: ["locus", "cursor", "smoothing"],
      run: () => updateEffects({ locusEnabled: !project.effects.locusEnabled }),
    },
    {
      id: "command-palette-toggle-flux",
      title: project.effects.fluxEnabled ? "Disable Flux flow" : "Enable Flux flow",
      section: "Effects",
      description: "Toggle dynamic focus glow and spatial flow cues inside the preview.",
      keywords: ["flux", "glow", "focus"],
      run: () => updateEffects({ fluxEnabled: !project.effects.fluxEnabled }),
    },
    {
      id: "command-palette-toggle-autozoom",
      title: project.effects.autoZoom ? "Disable auto zoom" : "Enable auto zoom",
      section: "Effects",
      description: "Toggle cursor-driven focus magnification suggestions.",
      keywords: ["auto zoom", "camera", "focus"],
      run: () => updateEffects({ autoZoom: !project.effects.autoZoom }),
    },
    ...aspectRatios.map((aspectRatio) => ({
      id: `command-palette-aspect-${aspectRatio}`,
      title: `Set aspect ratio to ${aspectRatio}`,
      section: "Canvas",
      description: "Reframe the preview and output canvas around a new composition ratio.",
      keywords: ["aspect", "ratio", aspectRatio],
      run: () => updateStyle({ aspectRatio }),
    })),
    ...project.markers.map((marker) => ({
      id: `command-palette-marker-${marker.id}`,
      title: `Jump to ${marker.label}`,
      section: "Markers",
      description: marker.note,
      keywords: [marker.kind, marker.label, formatTime(marker.time)],
      run: () => focusMarker(marker.id),
    })),
    ...workspace.recentProjects.slice(1).map((recentProject) => ({
      id: `command-palette-recent-${recentProject.path}`,
      title: `Open ${recentProject.name}`,
      section: "Recent",
      description: `Resume ${recentProject.name} from ${formatRecentProjectTime(
        recentProject.updatedAt,
      )}.`,
      keywords: [
        "open",
        "recent",
        "project",
        recentProject.name,
        recentProject.path,
      ],
      run: () => void handleOpenProject(recentProject.path),
    })),
  ];

  const filteredCommands = commands.filter((command) => {
    const query = deferredCommandQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    const haystack = [
      command.title,
      command.section,
      command.description,
      ...(command.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const activeCommand = filteredCommands[activeCommandIndex] ?? filteredCommands[0] ?? null;

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [deferredCommandQuery, isCommandPaletteOpen]);

  const executeCommand = useEffectEvent((command: StudioCommand) => {
    command.run();
    closeCommandPalette();
  });

  const handleGlobalKeydown = useEffectEvent((event: KeyboardEvent) => {
    const metaOrCtrl = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const typingTarget = isTextInputTarget(event.target);

    if (metaOrCtrl && key === "k") {
      event.preventDefault();
      if (isCommandPaletteOpen) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
      return;
    }

    if (isCommandPaletteOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((index) =>
          filteredCommands.length === 0 ? 0 : (index + 1) % filteredCommands.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((index) =>
          filteredCommands.length === 0
            ? 0
            : (index - 1 + filteredCommands.length) % filteredCommands.length,
        );
        return;
      }

      if (event.key === "Enter" && activeCommand) {
        event.preventDefault();
        executeCommand(activeCommand);
      }
      return;
    }

    if (metaOrCtrl && key === "s") {
      event.preventDefault();
      void handleSave();
      return;
    }

    if (typingTarget) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      togglePlayback();
      return;
    }

    if (event.shiftKey && key === "r") {
      event.preventDefault();
      void handleRecordingMode("recording");
      return;
    }

    if (event.shiftKey && key === "p") {
      event.preventDefault();
      void handleRecordingMode("paused");
      return;
    }

    if (event.shiftKey && key === "e") {
      event.preventDefault();
      void handleExport();
      return;
    }

    if (event.shiftKey && key === "f") {
      event.preventDefault();
      toggleFocusMode();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleGlobalKeydown(event);
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [handleGlobalKeydown]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(167,139,250,0.16),transparent_32%),linear-gradient(180deg,#030712,#02050d_35%,#02040a)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_22%,rgba(52,211,153,0.03)_76%,transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1840px] flex-col gap-4 p-4 lg:p-5">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="flex flex-col gap-4 rounded-[30px] border border-white/12 bg-slate-950/48 px-5 py-4 shadow-[0_30px_100px_rgba(2,6,23,0.48)] backdrop-blur-2xl xl:flex-row xl:items-center xl:justify-between"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(96,165,250,0.24),rgba(167,139,250,0.22))] shadow-[0_0_30px_rgba(96,165,250,0.18)]">
              <WandSparkles size={20} className="text-cyan-100" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.22em] text-cyan-100 uppercase">
                  FluxLocus Studio
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] tracking-[0.18em] text-slate-300 uppercase">
                  {recordingMode}
                </span>
                {isBootstrapping ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] tracking-[0.18em] text-amber-100 uppercase">
                    Bootstrapping
                  </span>
                ) : null}
              </div>
              <input
                value={project.name}
                onChange={(event) => setProjectName(event.currentTarget.value)}
                className="mt-2 w-full bg-transparent text-2xl font-semibold tracking-tight text-slate-50 outline-none placeholder:text-slate-500"
                placeholder="FluxLocus Project"
              />
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                All-in-One recording, locus smoothing, flux zoom styling, and export
                orchestration in a single professional workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              icon={<Monitor size={14} />}
              label={project.recordingSettings.resolution}
            />
            <StatusPill
              icon={<Sparkles size={14} />}
              label={`${project.recordingSettings.frameRate} fps`}
            />
            <StatusPill icon={<Command size={14} />} label="Cmd/Ctrl + K" />
            <StatusPill
              icon={<Monitor size={14} />}
              label={focusMode ? "Focus Mode" : "Studio Mode"}
            />

            <ActionButton
              label="Palette"
              icon={<Command size={15} />}
              onClick={openCommandPalette}
              pending={false}
            />
            <ActionButton
              label={focusMode ? "Studio" : "Focus"}
              icon={<Sparkles size={15} />}
              onClick={toggleFocusMode}
              pending={false}
              active={focusMode}
            />
            <ActionButton
              label="Record"
              icon={<Radio size={15} />}
              onClick={() => handleRecordingMode("recording")}
              active={recordingMode === "recording"}
              pending={busyAction === "recording"}
              tone="rose"
            />
            <ActionButton
              label="Pause"
              icon={<Pause size={15} />}
              onClick={() => handleRecordingMode("paused")}
              pending={busyAction === "paused"}
            />
            <ActionButton
              label="Stop"
              icon={<Square size={15} />}
              onClick={() => handleRecordingMode("editing")}
              pending={busyAction === "editing"}
            />
            <ActionButton
              label="Save"
              icon={<Save size={15} />}
              onClick={handleSave}
              pending={busyAction === "save"}
            />
            <ActionButton
              label="Export"
              icon={<Download size={15} />}
              onClick={handleExport}
              pending={busyAction === "export"}
              tone="cyan"
            />
          </div>
        </motion.header>

        <div
          className={[
            "grid flex-1 gap-4",
            focusMode
              ? "xl:grid-cols-[minmax(0,1fr)]"
              : "xl:grid-cols-[280px_minmax(0,1fr)_300px]",
          ].join(" ")}
        >
          <AnimatePresence initial={false}>
            {!focusMode ? (
              <motion.aside
                key="left-sidebar"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="order-2 flex min-h-0 flex-col gap-4 xl:order-1"
              >
                <GlassPanel
                  title="Capture"
                  subtitle="Native recording configuration and immediate effect toggles for the next session."
                  className="space-y-5"
                >
                  <SelectField
                    label="Capture Source"
                    value={project.recordingSettings.sourceId}
                    options={workspace.captureSources.map((source) => ({
                      value: source.id,
                      label: `${source.label} · ${source.kind}`,
                    }))}
                    onChange={(value) => updateRecordingSettings({ sourceId: value })}
                  />

                  <div className="grid gap-3">
                    <ToggleRow
                      label="System audio"
                      description="Keep desktop sound routed into the source clip."
                      checked={project.recordingSettings.includeSystemAudio}
                      icon={<Monitor size={14} />}
                      onChange={(checked) =>
                        updateRecordingSettings({ includeSystemAudio: checked })
                      }
                    />
                    <ToggleRow
                      label="Microphone"
                      description="Record narration and align the waveform into the timeline."
                      checked={project.recordingSettings.includeMic}
                      icon={<Mic size={14} />}
                      onChange={(checked) =>
                        updateRecordingSettings({ includeMic: checked })
                      }
                    />
                    <ToggleRow
                      label="Camera bubble"
                      description="Prepare a presenter overlay and drive it from the studio layout."
                      checked={project.recordingSettings.includeCamera}
                      icon={<Video size={14} />}
                      onChange={(checked) =>
                        updateRecordingSettings({ includeCamera: checked })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Countdown"
                      value={`${project.recordingSettings.countdown}s`}
                    />
                    <MetricCard label="Bundle Goal" value="< 50MB" />
                    <MetricCard label="Transport" value="Tauri 2" />
                  </div>
                </GlassPanel>

                <GlassPanel
                  title="Quick Toggles"
                  subtitle="Fast switches for the core Locus and Flux engines while you iterate."
                  className="space-y-4"
                >
                  <ToggleRow
                    label="Locus smoothing"
                    description="Spline-based cursor interpolation and refined easing."
                    checked={project.effects.locusEnabled}
                    icon={<MousePointer2 size={14} />}
                    onChange={(checked) => updateEffects({ locusEnabled: checked })}
                  />
                  <ToggleRow
                    label="Flux flow"
                    description="Dynamic glow, motion wash, and context-sensitive focus."
                    checked={project.effects.fluxEnabled}
                    icon={<Sparkles size={14} />}
                    onChange={(checked) => updateEffects({ fluxEnabled: checked })}
                  />
                  <ToggleRow
                    label="Auto zoom"
                    description="Translate cursor speed into camera-like focus suggestions."
                    checked={project.effects.autoZoom}
                    icon={<Camera size={14} />}
                    onChange={(checked) => updateEffects({ autoZoom: checked })}
                  />
                  <ToggleRow
                    label="Path visualizer"
                    description="Expose the math trail for tutorials and teaching moments."
                    checked={project.effects.locusVisualized}
                    icon={<WandSparkles size={14} />}
                    onChange={(checked) => updateEffects({ locusVisualized: checked })}
                  />
                </GlassPanel>

                <GlassPanel
                  title="Recent Projects"
                  subtitle="Resume saved .fluxlocus sessions or switch context without leaving the studio."
                  className="space-y-3"
                >
                  {workspace.recentProjects.length > 0 ? (
                    workspace.recentProjects.slice(0, 5).map((recentProject) => (
                      <RecentProjectButton
                        key={recentProject.path}
                        project={recentProject}
                        active={lastSavedPath === recentProject.path}
                        pending={busyAction === `open:${recentProject.path}`}
                        onClick={() => handleOpenProject(recentProject.path)}
                      />
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-4 text-sm leading-6 text-slate-400">
                      Save the first session to start a recent-project stack.
                    </div>
                  )}
                </GlassPanel>

                <GlassPanel
                  title="Notes"
                  subtitle="Implementation reminders carried directly from the MVP project model."
                  className="space-y-3"
                >
                  {project.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-[22px] border border-white/8 bg-white/6 px-4 py-3 text-sm leading-6 text-slate-300"
                    >
                      {note}
                    </div>
                  ))}
                </GlassPanel>
              </motion.aside>
            ) : null}
          </AnimatePresence>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
            className={[
              "order-1 grid min-h-0 gap-4",
              focusMode ? "xl:order-1 xl:grid-rows-[minmax(0,1fr)_340px]" : "xl:order-2 xl:grid-rows-[minmax(0,1fr)_340px]",
            ].join(" ")}
          >
            <GlassPanel className="relative flex min-h-[440px] flex-col gap-4 px-3 py-3">
              <div className="min-h-0 flex-1">
                <PreviewCanvas
                  project={project}
                  playhead={playhead}
                  recordingMode={recordingMode}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
                <div className="pointer-events-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-3 rounded-full border border-white/12 bg-slate-950/64 px-5 py-3 shadow-[0_22px_80px_rgba(2,8,23,0.44)] backdrop-blur-2xl">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-slate-50 transition hover:scale-[1.03] hover:bg-white/16"
                    >
                      {isPlaying ? <Pause size={16} /> : <Radio size={16} />}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {selectedMarker?.label ?? "Flux preview transport"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {selectedMarker?.note ?? statusMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-300">
                    <span>{formatTime(playhead)}</span>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                      Focus {Math.round(project.effects.zoomStrength * 100)}%
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">
                      {selectedPreset?.label ?? "No preset"}
                    </span>
                  </div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="min-h-[320px] overflow-hidden">
              <TimelinePanel
                project={project}
                playhead={playhead}
                selectedMarkerId={selectedMarkerId}
                isPlaying={isPlaying}
                onTogglePlayback={togglePlayback}
                onScrub={setPlayhead}
                onSelectMarker={focusMarker}
              />
            </GlassPanel>
          </motion.section>

          <AnimatePresence initial={false}>
            {!focusMode ? (
              <motion.aside
                key="right-sidebar"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="order-3 flex min-h-0 flex-col gap-4"
              >
                <GlassPanel
                  title="Locus"
                  subtitle="Precision controls for cursor smoothing, blur stacking, and emphasis."
                  className="space-y-5"
                >
                  <RangeField
                    label="Spline Smoothness"
                    value={project.effects.smoothness}
                    min={0.2}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateEffects({ smoothness: value })}
                  />
                  <RangeField
                    label="Motion Blur"
                    value={project.effects.motionBlur}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateEffects({ motionBlur: value })}
                  />
                  <RangeField
                    label="Cursor Scale"
                    value={project.effects.cursorScale}
                    min={0.7}
                    max={1.8}
                    step={0.01}
                    onChange={(value) => updateEffects({ cursorScale: value })}
                  />
                </GlassPanel>

                <GlassPanel
                  title="Flux"
                  subtitle="Automatic focus strength and spatial energy for movie-style motion."
                  className="space-y-5"
                >
                  <RangeField
                    label="Flux Intensity"
                    value={project.effects.fluxIntensity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateEffects({ fluxIntensity: value })}
                  />
                  <RangeField
                    label="Zoom Ceiling"
                    value={project.effects.zoomStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateEffects({ zoomStrength: value })}
                  />
                  <RangeField
                    label="Camera Size"
                    value={project.camera.size}
                    min={0.14}
                    max={0.32}
                    step={0.01}
                    onChange={(value) => updateCamera({ size: value })}
                  />
                </GlassPanel>

                <GlassPanel
                  title="Canvas Style"
                  subtitle="Aspect ratio, background temperament, and preview framing."
                  className="space-y-5"
                >
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">
                      Aspect Ratio
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {aspectRatios.map((aspectRatio) => (
                        <button
                          key={aspectRatio}
                          type="button"
                          onClick={() => updateStyle({ aspectRatio })}
                          className={[
                            "rounded-2xl border px-3 py-2 text-sm transition",
                            project.style.aspectRatio === aspectRatio
                              ? "border-cyan-300/22 bg-cyan-400/12 text-cyan-100"
                              : "border-white/8 bg-white/4 text-slate-300 hover:bg-white/8",
                          ].join(" ")}
                        >
                          {aspectRatio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">
                      Background
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {backgroundPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateStyle({ backgroundPreset: preset })}
                          className={[
                            "rounded-2xl border px-3 py-2 text-sm capitalize transition",
                            project.style.backgroundPreset === preset
                              ? "border-violet-300/20 bg-violet-400/12 text-violet-100"
                              : "border-white/8 bg-white/4 text-slate-300 hover:bg-white/8",
                          ].join(" ")}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <RangeField
                    label="Canvas Padding"
                    value={project.style.canvasPadding}
                    min={28}
                    max={96}
                    step={1}
                    onChange={(value) => updateStyle({ canvasPadding: value })}
                    valueDisplay={`${project.style.canvasPadding}px`}
                  />
                  <RangeField
                    label="Corner Radius"
                    value={project.style.cornerRadius}
                    min={12}
                    max={40}
                    step={1}
                    onChange={(value) => updateStyle({ cornerRadius: value })}
                    valueDisplay={`${project.style.cornerRadius}px`}
                  />
                </GlassPanel>

                <GlassPanel
                  title="Export"
                  subtitle="Wire the Tauri export queue early so the UI contract is stable before the encoder lands."
                  className="space-y-4"
                >
                  <SelectField
                    label="Preset"
                    value={selectedPreset?.id ?? ""}
                    options={workspace.exportPresets.map((preset) => ({
                      value: preset.id,
                      label: `${preset.label} · ${preset.resolution}`,
                    }))}
                    onChange={selectExportPreset}
                  />

                  <PresetCard preset={selectedPreset ?? workspace.exportPresets[0]} />

                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-slate-300">
                    <p className="font-medium text-slate-100">Studio status</p>
                    <p className="mt-2">{statusMessage}</p>
                    {lastSavedPath ? (
                      <p className="mt-3 break-all text-xs text-slate-500">
                        {lastSavedPath}
                      </p>
                    ) : null}
                  </div>
                </GlassPanel>
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      </main>

      <CommandPalette
        open={isCommandPaletteOpen}
        query={commandQuery}
        items={filteredCommands}
        activeIndex={activeCommandIndex}
        onClose={closeCommandPalette}
        onQueryChange={setCommandQuery}
        onActiveIndexChange={setActiveCommandIndex}
        onSelect={(item) => {
          const selectedCommand = commands.find((command) => command.id === item.id);
          if (selectedCommand) {
            executeCommand(selectedCommand);
          }
        }}
      />
    </div>
  );
}

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function StatusPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-slate-200">
      {icon}
      {label}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  pending = false,
  active = false,
  tone = "neutral",
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pending?: boolean;
  active?: boolean;
  tone?: "neutral" | "rose" | "cyan";
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-300/18 bg-rose-400/12 text-rose-50 hover:bg-rose-400/18"
      : tone === "cyan"
        ? "border-cyan-300/18 bg-cyan-400/12 text-cyan-50 hover:bg-cyan-400/18"
        : "border-white/10 bg-white/8 text-slate-100 hover:bg-white/12";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition disabled:cursor-wait disabled:opacity-70",
        toneClass,
        active ? "shadow-[0_0_24px_rgba(244,63,94,0.24)]" : "",
      ].join(" ")}
    >
      {icon}
      {pending ? "Working..." : label}
    </button>
  );
}

function RecentProjectButton({
  project,
  active,
  pending,
  onClick,
}: {
  project: RecentProject;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={[
        "w-full rounded-[22px] border px-4 py-4 text-left transition disabled:cursor-wait disabled:opacity-70",
        active
          ? "border-cyan-300/18 bg-cyan-400/10"
          : "border-white/8 bg-white/4 hover:bg-white/8",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/8 p-2 text-slate-200">
          <FolderOpen size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-slate-100">{project.name}</p>
            <span
              className={[
                "shrink-0 rounded-full px-3 py-1 text-[11px] tracking-[0.2em] uppercase",
                active
                  ? "border border-cyan-300/18 bg-cyan-400/12 text-cyan-100"
                  : "border border-white/10 bg-white/6 text-slate-400",
              ].join(" ")}
            >
              {pending ? "Opening" : active ? "Current" : "Open"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{formatRecentProjectTime(project.updatedAt)}</p>
          <p className="mt-2 break-all text-xs leading-5 text-slate-500">{project.path}</p>
        </div>
      </div>
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3">
      <p className="text-[11px] tracking-[0.22em] text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="flex w-full items-start gap-3 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-left transition hover:bg-white/8"
    >
      <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/8 p-2 text-slate-200">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-100">{label}</p>
          <span
            className={[
              "rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.2em] uppercase",
              checked
                ? "border border-cyan-300/18 bg-cyan-400/12 text-cyan-100"
                : "border border-white/10 bg-white/6 text-slate-400",
            ].join(" ")}
          >
            {checked ? "On" : "Off"}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </button>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueDisplay,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  valueDisplay?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        <span className="text-sm text-slate-400">
          {valueDisplay ?? `${Math.round(value * 100)}%`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="studio-slider mt-3 w-full"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-3 w-full rounded-[20px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/24"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PresetCard({ preset }: { preset?: ExportPreset }) {
  if (!preset) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-100">{preset.label}</p>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] tracking-[0.18em] text-slate-300 uppercase">
          {preset.format}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Resolution" value={preset.resolution} />
        <MetricCard label="Bitrate" value={preset.bitrate} />
        <MetricCard label="Frame Rate" value={`${preset.fps} fps`} />
      </div>
    </div>
  );
}

export default App;
