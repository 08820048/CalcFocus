import { clamp } from "./locus";
import type {
  CursorKeyframe,
  RecordingSample,
  StudioProject,
  TimelineMarker,
  TimelineSegment,
} from "../types/studio";

const segmentAccents = ["#60A5FA", "#8B5CF6", "#34D399", "#F59E0B"];
const segmentLabels = [
  "Capture opening",
  "Cursor pass",
  "Interaction peak",
  "Closing beat",
];

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function velocityScore(previous: RecordingSample, current: RecordingSample) {
  const deltaTime = Math.max(1 / 60, current.time - previous.time);
  const unitsPerSecond = distance(previous, current) / deltaTime;
  return clamp(unitsPerSecond / 1.4, 0, 1);
}

function normalizeRecordingSamples(samples: RecordingSample[]) {
  if (samples.length === 0) {
    return [
      { time: 0, x: 0.5, y: 0.5, click: false },
      { time: 0.35, x: 0.5, y: 0.5, click: false },
    ] satisfies RecordingSample[];
  }

  const normalized = samples
    .slice()
    .sort((left, right) => left.time - right.time)
    .map((sample) => ({
      ...sample,
      x: clamp(sample.x, 0.04, 0.96),
      y: clamp(sample.y, 0.06, 0.94),
    }));

  if (normalized[0].time > 0) {
    normalized.unshift({ ...normalized[0], time: 0 });
  }

  if (normalized.length === 1) {
    normalized.push({
      ...normalized[0],
      time: normalized[0].time + 0.35,
      click: false,
    });
  }

  return normalized;
}

function buildCursorKeyframes(samples: RecordingSample[]) {
  const keyframes: CursorKeyframe[] = [];
  let lastKeptSample: RecordingSample | null = null;

  for (const [index, sample] of samples.entries()) {
    const previous = samples[Math.max(0, index - 1)];
    const speed = velocityScore(previous, sample);
    const movedEnough =
      !lastKeptSample || distance(lastKeptSample, sample) >= 0.006 || sample.click;
    const enoughTimePassed =
      !lastKeptSample || sample.time - lastKeptSample.time >= 1 / 24;
    const shouldKeep =
      index === 0 ||
      index === samples.length - 1 ||
      sample.click ||
      (movedEnough && enoughTimePassed);

    if (!shouldKeep) {
      continue;
    }

    keyframes.push({
      id: `rkf-${index + 1}`,
      time: sample.time,
      x: sample.x,
      y: sample.y,
      emphasis: clamp(0.18 + speed * 0.56 + (sample.click ? 0.2 : 0), 0.18, 1),
      click: sample.click,
      zoom: clamp(0.08 + speed * 0.48 + (sample.click ? 0.24 : 0), 0.08, 1),
    });
    lastKeptSample = sample;
  }

  return keyframes.length > 1 ? keyframes : [...keyframes, { ...keyframes[0], id: "rkf-2", time: keyframes[0].time + 0.35 }];
}

function buildMarkers(keyframes: CursorKeyframe[], duration: number) {
  const markers: TimelineMarker[] = [];

  for (const [index, keyframe] of keyframes.entries()) {
    const lastMarker = markers.at(-1);
    if (!keyframe.click) {
      continue;
    }

    if (lastMarker && Math.abs(lastMarker.time - keyframe.time) < 0.55) {
      continue;
    }

    markers.push({
      id: `rmk-click-${index + 1}`,
      label: `Click emphasis ${markers.length + 1}`,
      time: keyframe.time,
      kind: "click",
      strength: clamp(keyframe.emphasis, 0.2, 1),
      note: "Detected a live pointer click burst and elevated the emphasis ring.",
    });
  }

  const zoomCandidates = keyframes
    .filter((keyframe) => !keyframe.click)
    .sort((left, right) => right.zoom - left.zoom);

  for (const candidate of zoomCandidates) {
    if (markers.filter((marker) => marker.kind === "zoom").length >= 2) {
      break;
    }

    const tooClose = markers.some((marker) => Math.abs(marker.time - candidate.time) < 1.2);
    const nearEdge = candidate.time < 0.8 || candidate.time > duration - 0.8;
    if (tooClose || nearEdge) {
      continue;
    }

    markers.push({
      id: `rmk-zoom-${markers.length + 1}`,
      label: `Focus sweep ${markers.filter((marker) => marker.kind === "zoom").length + 1}`,
      time: candidate.time,
      kind: "zoom",
      strength: clamp(candidate.zoom, 0.18, 1),
      note: "High cursor velocity suggests a natural focus sweep for Flux auto zoom.",
    });
  }

  if (duration >= 3.2) {
    markers.push({
      id: "rmk-trim-1",
      label: "Trim anchor",
      time: clamp(duration * 0.86, 0.9, duration - 0.4),
      kind: "trim",
      strength: 0.26,
      note: "Suggested tail trim point generated from the live recording duration.",
    });
  }

  return markers.sort((left, right) => left.time - right.time);
}

function buildSegments(duration: number) {
  const segmentCount = duration < 6 ? 2 : duration < 12 ? 3 : 4;
  const segments: TimelineSegment[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const start = (duration / segmentCount) * index;
    const end = index === segmentCount - 1 ? duration : (duration / segmentCount) * (index + 1);

    segments.push({
      id: `rseg-${index + 1}`,
      label: segmentLabels[index] ?? `Pass ${index + 1}`,
      start,
      end,
      speed: index === 1 && duration >= 6 ? 0.9 : 1,
      accent: segmentAccents[index % segmentAccents.length],
    });
  }

  return segments;
}

export function buildProjectFromRecordingSamples(
  sourceProject: StudioProject,
  inputSamples: RecordingSample[],
) {
  const samples = normalizeRecordingSamples(inputSamples);
  const cursorKeyframes = buildCursorKeyframes(samples);
  const lastSample = samples.at(-1) ?? samples[0];
  const duration = clamp(lastSample.time + 0.35, 4, 120);
  const markers = buildMarkers(cursorKeyframes, duration);
  const clickCount = cursorKeyframes.filter((keyframe) => keyframe.click).length;
  const focusCount = markers.filter((marker) => marker.kind === "zoom").length;

  return {
    ...sourceProject,
    duration,
    cursorKeyframes,
    segments: buildSegments(duration),
    markers,
    notes: [
      `Live cursor recording captured ${samples.length} samples over ${duration.toFixed(1)}s.`,
      clickCount > 0
        ? `Detected ${clickCount} click pulses and ${focusCount} motion-driven focus peaks from the take.`
        : `Detected ${focusCount} motion-driven focus peaks from the take. Add clicks in the next pass for stronger emphasis.`,
      "This take records pointer metadata inside the FluxLocus studio window while native screen video capture is still being wired.",
    ],
  };
}
