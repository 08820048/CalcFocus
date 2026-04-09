import { motion } from "framer-motion";
import { Pause, Play, ScissorsLineDashed, Sparkles } from "lucide-react";
import { useDeferredValue } from "react";
import { formatTime, markerColor } from "../lib/locus";
import type { StudioProject } from "../types/studio";

interface TimelinePanelProps {
  project: StudioProject;
  playhead: number;
  selectedMarkerId: string | null;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onScrub: (time: number) => void;
  onSelectMarker: (markerId: string) => void;
}

export function TimelinePanel({
  project,
  playhead,
  selectedMarkerId,
  isPlaying,
  onTogglePlayback,
  onScrub,
  onSelectMarker,
}: TimelinePanelProps) {
  const deferredPlayhead = useDeferredValue(playhead);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-slate-400 uppercase">
            Timeline
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">
            Smart cues, trim anchors, and spline-aware playback
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlayback}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-slate-100 transition hover:scale-[1.02] hover:bg-white/12"
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <div className="rounded-full border border-white/12 bg-black/20 px-4 py-2 text-sm text-slate-200">
            {formatTime(deferredPlayhead)} / {formatTime(project.duration)}
          </div>
        </div>
      </div>

      <div className="relative rounded-[28px] border border-white/10 bg-slate-950/60 px-5 py-5">
        <div className="mb-6 flex items-center justify-between text-xs tracking-[0.2em] text-slate-500 uppercase">
          <span>Professional Flow Track</span>
          <span>{project.segments.length} segments</span>
        </div>

        <div className="relative h-28 overflow-hidden rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(5,10,20,0.84))] px-3 py-5">
          <div className="absolute inset-x-0 top-0 flex justify-between px-5 pt-2 text-[10px] tracking-[0.24em] text-slate-500 uppercase">
            {new Array(7).fill(null).map((_, index) => (
              <span key={`tick-${index}`}>
                {formatTime((project.duration / 6) * index).slice(0, 5)}
              </span>
            ))}
          </div>

          {project.segments.map((segment) => {
            const left = `${(segment.start / project.duration) * 100}%`;
            const width = `${((segment.end - segment.start) / project.duration) * 100}%`;

            return (
              <motion.button
                key={segment.id}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                className="absolute top-10 flex h-12 items-center gap-2 rounded-2xl border border-white/12 px-4 text-left text-sm text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                style={{
                  left,
                  width,
                  background: `linear-gradient(135deg, ${segment.accent}55, rgba(15,23,42,0.88))`,
                }}
              >
                <Sparkles size={14} className="text-white/80" />
                <span className="truncate">{segment.label}</span>
                <span className="ml-auto text-xs text-white/60">{segment.speed}x</span>
              </motion.button>
            );
          })}

          {project.markers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => onSelectMarker(marker.id)}
              className="absolute inset-y-0 top-0 w-5 -translate-x-1/2"
              style={{ left: `${(marker.time / project.duration) * 100}%` }}
            >
              <div
                className={[
                  "mx-auto h-full w-px transition",
                  selectedMarkerId === marker.id ? "opacity-100" : "opacity-55",
                ].join(" ")}
                style={{ backgroundColor: markerColor(marker) }}
              />
              <div
                className="mx-auto mt-3 h-3 w-3 rounded-full border border-white/60 shadow-[0_0_24px_rgba(255,255,255,0.14)]"
                style={{ backgroundColor: markerColor(marker) }}
              />
            </button>
          ))}

          <div
            className="pointer-events-none absolute inset-y-2 z-20 w-px bg-white shadow-[0_0_18px_rgba(255,255,255,0.46)]"
            style={{ left: `${(playhead / project.duration) * 100}%` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={project.duration}
          step={0.01}
          value={playhead}
          onChange={(event) => onScrub(Number(event.currentTarget.value))}
          className="timeline-slider mt-5 w-full"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {project.markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            onClick={() => onSelectMarker(marker.id)}
            className={[
              "rounded-[22px] border px-4 py-4 text-left transition",
              selectedMarkerId === marker.id
                ? "border-white/16 bg-white/10"
                : "border-white/8 bg-white/4 hover:bg-white/8",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-100">{marker.label}</span>
              <span
                className="rounded-full px-2 py-1 text-[11px] tracking-[0.18em] uppercase text-slate-950"
                style={{ backgroundColor: markerColor(marker) }}
              >
                {marker.kind}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{marker.note}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{formatTime(marker.time)}</span>
              <span className="inline-flex items-center gap-1">
                <ScissorsLineDashed size={12} />
                {Math.round(marker.strength * 100)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
