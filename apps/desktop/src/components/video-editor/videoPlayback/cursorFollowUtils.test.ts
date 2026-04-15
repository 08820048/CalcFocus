import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint, ZoomRegion } from "../types";
import {
	createAutoFocusState,
	getAutoFocusTarget,
	interpolateCursorAt,
	smoothAutoFocus,
} from "./cursorFollowUtils";

describe("cursorFollowUtils", () => {
	it("interpolates cursor telemetry between nearby samples", () => {
		const telemetry: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.2, cy: 0.2 },
			{ timeMs: 100, cx: 0.6, cy: 0.4 },
		];

		const focus = interpolateCursorAt(telemetry, 50);
		expect(focus?.cx).toBeCloseTo(0.4);
		expect(focus?.cy).toBeCloseTo(0.3);
	});

	it("uses lookahead cursor target for auto focus zooms", () => {
		const region: ZoomRegion = {
			id: "zoom-1",
			startMs: 0,
			endMs: 1000,
			depth: 3,
			focus: { cx: 0.5, cy: 0.5 },
			focusMode: "auto",
		};
		const telemetry: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.2, cy: 0.2 },
			{ timeMs: 90, cx: 0.8, cy: 0.7 },
		];

		const focus = getAutoFocusTarget({
			region,
			timeMs: 0,
			cursorTelemetry: telemetry,
		});

		expect(focus.cx).toBeGreaterThan(0.35);
		expect(focus.cy).toBeGreaterThan(0.3);
	});

	it("smooths abrupt auto focus jumps", () => {
		const state = createAutoFocusState();
		const first = smoothAutoFocus({
			state,
			targetFocus: { cx: 0.2, cy: 0.2 },
			timeMs: 0,
			zoomScale: 1.8,
		});
		const second = smoothAutoFocus({
			state,
			targetFocus: { cx: 0.8, cy: 0.8 },
			timeMs: 16,
			zoomScale: 1.8,
		});

		expect(first).toEqual({ cx: 0.2777777777777778, cy: 0.2777777777777778 });
		expect(second.cx).toBeLessThan(0.8);
		expect(second.cy).toBeLessThan(0.8);
	});
});
