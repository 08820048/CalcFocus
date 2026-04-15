import { describe, expect, it } from "vitest";

import {
	type CursorInteractionCandidate,
	getSuggestionProfile,
	planSuggestedZoomRegions,
} from "./zoomSuggestionUtils";

describe("planSuggestedZoomRegions", () => {
	it("merges nearby accepted suggestions into a single zoom span", () => {
		const candidates: CursorInteractionCandidate[] = [
			{
				centerTimeMs: 1000,
				focus: { cx: 0.2, cy: 0.3 },
				strength: 1500,
				kind: "double-click-like",
			},
			{
				centerTimeMs: 2900,
				focus: { cx: 0.25, cy: 0.35 },
				strength: 1200,
				kind: "dropdown-open",
			},
			{
				centerTimeMs: 7000,
				focus: { cx: 0.8, cy: 0.6 },
				strength: 900,
				kind: "click-like",
			},
		];

		expect(
			planSuggestedZoomRegions({
				candidates,
				totalMs: 10_000,
				defaultDurationMs: 1000,
				mergeNearbyGapMs: 1500,
			}),
		).toEqual([
			{
				startMs: 480,
				endMs: 5340,
				focus: { cx: 0.2, cy: 0.3 },
				depth: 4,
				kind: "double-click-like",
			},
			{
				startMs: 6580,
				endMs: 8080,
				focus: { cx: 0.8, cy: 0.6 },
				depth: 3,
				kind: "click-like",
			},
		]);
	});

	it("prefers stronger candidates and nudges suggestions around existing zooms", () => {
		const candidates: CursorInteractionCandidate[] = [
			{
				centerTimeMs: 4000,
				focus: { cx: 0.5, cy: 0.5 },
				strength: 1600,
				kind: "double-click-like",
			},
			{
				centerTimeMs: 4200,
				focus: { cx: 0.6, cy: 0.5 },
				strength: 900,
				kind: "click-like",
			},
			{
				centerTimeMs: 7200,
				focus: { cx: 0.7, cy: 0.2 },
				strength: 1300,
				kind: "text-selection",
			},
			{
				centerTimeMs: 8600,
				focus: { cx: 0.1, cy: 0.8 },
				strength: 1100,
				kind: "text-field-click",
			},
		];

		expect(
			planSuggestedZoomRegions({
				candidates,
				totalMs: 10_000,
				defaultDurationMs: 1000,
				reservedSpans: [{ start: 6700, end: 7700 }],
				suggestionSpacingMs: 1800,
				mergeNearbyGapMs: 1500,
			}),
		).toEqual([
			{
				startMs: 3480,
				endMs: 5380,
				focus: { cx: 0.5, cy: 0.5 },
				depth: 4,
				kind: "double-click-like",
			},
			{
				startMs: 7700,
				endMs: 10_000,
				focus: { cx: 0.7, cy: 0.2 },
				depth: 3,
				kind: "text-selection",
			},
		]);
	});

	it("assigns interaction-specific timing and depth profiles", () => {
		const base = {
			centerTimeMs: 1000,
			focus: { cx: 0.5, cy: 0.5 },
			strength: 900,
		};

		expect(getSuggestionProfile({ ...base, kind: "click-like" }, 1000)).toMatchObject({
			durationMs: 1500,
			depth: 3,
		});
		expect(getSuggestionProfile({ ...base, kind: "double-click-like" }, 1000)).toMatchObject({
			durationMs: 1900,
			depth: 4,
		});
		expect(getSuggestionProfile({ ...base, kind: "dropdown-open" }, 1000)).toMatchObject({
			durationMs: 2800,
			depth: 3,
		});
	});
});
