import amongusDefaultCursorUrl from "@/assets/cursors/amongus/default.png";
import amongusPointerCursorUrl from "@/assets/cursors/amongus/pointer.png";
import chooperDefaultCursorUrl from "@/assets/cursors/chooper/default.png";
import chooperPointerCursorUrl from "@/assets/cursors/chooper/pointer.png";
import lavenderDefaultCursorUrl from "@/assets/cursors/lavender/default.png";
import lavenderPointerCursorUrl from "@/assets/cursors/lavender/pointer.png";
import minimalCursorUrl from "@/assets/cursors/Minimal Cursor.svg";
import parchedDefaultCursorUrl from "@/assets/cursors/parched/default.png";
import parchedPointerCursorUrl from "@/assets/cursors/parched/pointer.png";
import turtleDefaultCursorUrl from "@/assets/cursors/turtle/default.png";
import turtlePointerCursorUrl from "@/assets/cursors/turtle/pointer.png";
import type { CursorStyle } from "../types";

export type CursorPackStyle = Extract<
	CursorStyle,
	"lavender" | "parched" | "chooper" | "amongus" | "turtle"
>;
export type CursorPackVariant = "default" | "pointer";

export type CursorPackSource = {
	defaultUrl: string;
	pointerUrl: string;
	defaultAnchor: { x: number; y: number };
	pointerAnchor: { x: number; y: number };
};

// To add a first-party cursor pack:
// 1. Add `default.png` + `pointer.png` under `src/assets/cursors/<style>/`
// 2. Extend `CursorStyle` in `types.ts`
// 3. Register the label and source URLs below
export const CURSOR_STYLE_OPTIONS: Array<{ value: CursorStyle; label: string }> = [
	{ value: "tahoe", label: "Tahoe" },
	{ value: "dot", label: "Dot" },
	{ value: "figma", label: "Minimal" },
	{ value: "mono", label: "Inverted" },
	{ value: "lavender", label: "Lavender" },
	{ value: "parched", label: "Parched" },
	{ value: "chooper", label: "Chooper" },
	{ value: "amongus", label: "Among Us" },
	{ value: "turtle", label: "Turtle" },
];

const DEFAULT_CURSOR_PACK_ANCHOR = { x: 0.08, y: 0.08 } as const;
const POINTER_CURSOR_PACK_ANCHOR = { x: 0.48, y: 0.1 } as const;
const CENTERED_CURSOR_PACK_ANCHOR = { x: 0.5, y: 0.5 } as const;

export const CURSOR_PACK_SOURCES: Record<CursorPackStyle, CursorPackSource> = {
	lavender: {
		defaultUrl: lavenderDefaultCursorUrl,
		pointerUrl: lavenderPointerCursorUrl,
		defaultAnchor: DEFAULT_CURSOR_PACK_ANCHOR,
		pointerAnchor: POINTER_CURSOR_PACK_ANCHOR,
	},
	parched: {
		defaultUrl: parchedDefaultCursorUrl,
		pointerUrl: parchedPointerCursorUrl,
		defaultAnchor: DEFAULT_CURSOR_PACK_ANCHOR,
		pointerAnchor: POINTER_CURSOR_PACK_ANCHOR,
	},
	chooper: {
		defaultUrl: chooperDefaultCursorUrl,
		pointerUrl: chooperPointerCursorUrl,
		defaultAnchor: DEFAULT_CURSOR_PACK_ANCHOR,
		pointerAnchor: POINTER_CURSOR_PACK_ANCHOR,
	},
	amongus: {
		defaultUrl: amongusDefaultCursorUrl,
		pointerUrl: amongusPointerCursorUrl,
		defaultAnchor: CENTERED_CURSOR_PACK_ANCHOR,
		pointerAnchor: CENTERED_CURSOR_PACK_ANCHOR,
	},
	turtle: {
		defaultUrl: turtleDefaultCursorUrl,
		pointerUrl: turtlePointerCursorUrl,
		defaultAnchor: CENTERED_CURSOR_PACK_ANCHOR,
		pointerAnchor: CENTERED_CURSOR_PACK_ANCHOR,
	},
};

export const CURSOR_STYLE_STATIC_PREVIEW_URLS: Partial<Record<CursorStyle, string>> = {
	figma: minimalCursorUrl,
	lavender: lavenderDefaultCursorUrl,
	parched: parchedDefaultCursorUrl,
	chooper: chooperDefaultCursorUrl,
	amongus: amongusDefaultCursorUrl,
	turtle: turtleDefaultCursorUrl,
};

export { minimalCursorUrl };
