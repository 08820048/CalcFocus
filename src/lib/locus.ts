import type { AspectRatio, CursorKeyframe, TimelineMarker } from "../types/studio";

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    ((2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function sampleCursorKeyframe(
  keyframes: CursorKeyframe[],
  time: number,
): CursorKeyframe {
  if (keyframes.length === 0) {
    return {
      id: "fallback",
      time: 0,
      x: 0.5,
      y: 0.5,
      emphasis: 0.2,
      click: false,
      zoom: 0.1,
    };
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  if (time <= sorted[0].time) {
    return sorted[0];
  }

  const last = sorted[sorted.length - 1];

  if (time >= last.time) {
    return last;
  }

  let index = 0;
  while (index < sorted.length - 1 && time > sorted[index + 1].time) {
    index += 1;
  }

  const p0 = sorted[Math.max(0, index - 1)];
  const p1 = sorted[index];
  const p2 = sorted[index + 1];
  const p3 = sorted[Math.min(sorted.length - 1, index + 2)];
  const span = Math.max(0.001, p2.time - p1.time);
  const t = clamp((time - p1.time) / span, 0, 1);
  const click =
    sorted.some((keyframe) => keyframe.click && Math.abs(keyframe.time - time) < 0.22);

  return {
    id: `${p1.id}-${p2.id}`,
    time,
    x: clamp(catmullRom(p0.x, p1.x, p2.x, p3.x, t), 0.04, 0.96),
    y: clamp(catmullRom(p0.y, p1.y, p2.y, p3.y, t), 0.06, 0.94),
    emphasis: clamp(
      catmullRom(p0.emphasis, p1.emphasis, p2.emphasis, p3.emphasis, t),
      0.15,
      1,
    ),
    click,
    zoom: clamp(catmullRom(p0.zoom, p1.zoom, p2.zoom, p3.zoom, t), 0, 1),
  };
}

export function buildCursorTrail(
  keyframes: CursorKeyframe[],
  time: number,
  lookback = 5.5,
  steps = 48,
) {
  const start = Math.max(0, time - lookback);
  const points: Point[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const sample = sampleCursorKeyframe(keyframes, lerp(start, time, step / steps));
    points.push({ x: sample.x, y: sample.y });
  }

  return points;
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const hundredths = Math.floor((seconds % 1) * 100)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}.${hundredths}`;
}

export function aspectRatioValue(aspectRatio: AspectRatio) {
  switch (aspectRatio) {
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "16:9":
    default:
      return 16 / 9;
  }
}

export function markerColor(marker: TimelineMarker) {
  switch (marker.kind) {
    case "zoom":
      return "#60A5FA";
    case "click":
      return "#34D399";
    case "annotation":
      return "#A78BFA";
    case "trim":
    default:
      return "#F59E0B";
  }
}
