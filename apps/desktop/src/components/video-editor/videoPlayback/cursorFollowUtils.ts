import type { CursorTelemetryPoint, ZoomFocus, ZoomRegion } from "../types";
import { ZOOM_DEPTH_SCALES } from "../types";
import { clampFocusToScale, type ViewportRatio } from "./focusUtils";

const CURSOR_INTERPOLATION_GAP_MS = 220;
const AUTO_FOCUS_LOOKAHEAD_MS = 90;
const AUTO_FOCUS_DISTANCE_FOR_MAX_SMOOTHING = 0.18;
const AUTO_FOCUS_SMOOTHING_MIN = 0.16;
const AUTO_FOCUS_SMOOTHING_MAX = 0.42;
const AUTO_FOCUS_MAX_STEP_PER_FRAME = 0.14;
const DEFAULT_FOCUS: ZoomFocus = { cx: 0.5, cy: 0.5 };

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

function getNearestCursorSample(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): CursorTelemetryPoint | null {
	if (samples.length === 0) {
		return null;
	}

	let nearest = samples[0];
	let nearestDistance = Math.abs(samples[0].timeMs - timeMs);

	for (let index = 1; index < samples.length; index += 1) {
		const sample = samples[index];
		const distance = Math.abs(sample.timeMs - timeMs);
		if (distance < nearestDistance) {
			nearest = sample;
			nearestDistance = distance;
		}
	}

	return nearestDistance <= CURSOR_INTERPOLATION_GAP_MS ? nearest : null;
}

export function interpolateCursorAt(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): ZoomFocus | null {
	if (samples.length === 0) {
		return null;
	}

	if (samples.length === 1) {
		const sample = getNearestCursorSample(samples, timeMs);
		return sample ? { cx: sample.cx, cy: sample.cy } : null;
	}

	for (let index = 1; index < samples.length; index += 1) {
		const previous = samples[index - 1];
		const next = samples[index];

		if (timeMs < previous.timeMs || timeMs > next.timeMs) {
			continue;
		}

		const gapMs = next.timeMs - previous.timeMs;
		if (gapMs <= 0) {
			return { cx: next.cx, cy: next.cy };
		}

		if (gapMs > CURSOR_INTERPOLATION_GAP_MS * 2) {
			break;
		}

		const progress = clamp01((timeMs - previous.timeMs) / gapMs);
		return {
			cx: lerp(previous.cx, next.cx, progress),
			cy: lerp(previous.cy, next.cy, progress),
		};
	}

	const nearest = getNearestCursorSample(samples, timeMs);
	return nearest ? { cx: nearest.cx, cy: nearest.cy } : null;
}

export function getAutoFocusTarget(options: {
	region: ZoomRegion;
	timeMs: number;
	cursorTelemetry?: CursorTelemetryPoint[];
	viewportRatio?: ViewportRatio;
}): ZoomFocus {
	const { region, timeMs, cursorTelemetry = [], viewportRatio } = options;
	const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
	const fallbackFocus = clampFocusToScale(region.focus, zoomScale, viewportRatio);

	if (region.focusMode !== "auto" || cursorTelemetry.length === 0) {
		return fallbackFocus;
	}

	const current = interpolateCursorAt(cursorTelemetry, timeMs);
	if (!current) {
		return fallbackFocus;
	}

	const lookahead = interpolateCursorAt(cursorTelemetry, timeMs + AUTO_FOCUS_LOOKAHEAD_MS);
	const target = lookahead
		? {
				cx: current.cx * 0.72 + lookahead.cx * 0.28,
				cy: current.cy * 0.72 + lookahead.cy * 0.28,
			}
		: current;

	return clampFocusToScale(target, zoomScale, viewportRatio);
}

export interface AutoFocusState {
	focus: ZoomFocus;
	initialized: boolean;
	lastTimeMs: number | null;
}

export function createAutoFocusState(): AutoFocusState {
	return {
		focus: { ...DEFAULT_FOCUS },
		initialized: false,
		lastTimeMs: null,
	};
}

export function resetAutoFocusState(state: AutoFocusState, focus: ZoomFocus = DEFAULT_FOCUS) {
	state.focus = { ...focus };
	state.initialized = false;
	state.lastTimeMs = null;
}

export function smoothAutoFocus(options: {
	state: AutoFocusState;
	targetFocus: ZoomFocus;
	timeMs: number;
	zoomScale: number;
	viewportRatio?: ViewportRatio;
}): ZoomFocus {
	const { state, targetFocus, timeMs, zoomScale, viewportRatio } = options;
	const clampedTarget = clampFocusToScale(targetFocus, zoomScale, viewportRatio);

	if (!state.initialized || state.lastTimeMs === null || timeMs < state.lastTimeMs) {
		state.focus = clampedTarget;
		state.initialized = true;
		state.lastTimeMs = timeMs;
		return state.focus;
	}

	const deltaMs = Math.max(1, Math.min(80, timeMs - state.lastTimeMs));
	state.lastTimeMs = timeMs;

	const dx = clampedTarget.cx - state.focus.cx;
	const dy = clampedTarget.cy - state.focus.cy;
	const distance = Math.hypot(dx, dy);
	if (distance < 0.0001) {
		state.focus = clampedTarget;
		return state.focus;
	}

	const distanceFactor = clamp01(distance / AUTO_FOCUS_DISTANCE_FOR_MAX_SMOOTHING);
	const frameFactor = Math.max(0.6, Math.min(1.6, deltaMs / (1000 / 60)));
	const smoothing = lerp(AUTO_FOCUS_SMOOTHING_MIN, AUTO_FOCUS_SMOOTHING_MAX, distanceFactor);
	const alpha = 1 - Math.pow(1 - smoothing, frameFactor);

	let nextCx = state.focus.cx + dx * alpha;
	let nextCy = state.focus.cy + dy * alpha;
	const moveDistance = Math.hypot(nextCx - state.focus.cx, nextCy - state.focus.cy);
	const maxStep = AUTO_FOCUS_MAX_STEP_PER_FRAME * frameFactor;

	if (moveDistance > maxStep) {
		const ratio = maxStep / moveDistance;
		nextCx = state.focus.cx + (nextCx - state.focus.cx) * ratio;
		nextCy = state.focus.cy + (nextCy - state.focus.cy) * ratio;
	}

	state.focus = clampFocusToScale({ cx: nextCx, cy: nextCy }, zoomScale, viewportRatio);
	return state.focus;
}
