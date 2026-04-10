import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { formatBinding, SHORTCUT_ACTIONS, type ShortcutAction } from "@/lib/shortcuts";

interface AllShortcutsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
	label: string;
	mac: string;
	other: string;
}

function getShortcutLabel(t: ReturnType<typeof useScopedT>, action: ShortcutAction) {
	switch (action) {
		case "addZoom":
			return t("actions.addZoom", "Add Zoom");
		case "addTrim":
			return t("actions.addTrim", "Add Trim");
		case "addSpeed":
			return t("actions.addSpeed", "Add Speed");
		case "addAnnotation":
			return t("actions.addAnnotation", "Add Annotation");
		case "addKeyframe":
			return t("actions.addKeyframe", "Add Keyframe");
		case "deleteSelected":
			return t("actions.deleteSelected", "Delete Selected");
		case "playPause":
			return t("actions.playPause", "Play / Pause");
	}
}

export function AllShortcutsDialog({ open, onOpenChange }: AllShortcutsDialogProps) {
	const t = useScopedT("shortcuts");
	const { shortcuts, isMac } = useShortcuts();

	const fileShortcuts: ShortcutEntry[] = [
		{ label: t("file.openProject", "Open Project"), mac: "⌘ + O", other: "Ctrl + O" },
		{ label: t("file.saveProject", "Save Project"), mac: "⌘ + S", other: "Ctrl + S" },
		{
			label: t("file.saveProjectAs", "Save Project As"),
			mac: "⌘ + ⇧ + S",
			other: "Ctrl + Shift + S",
		},
	];

	const editShortcuts: ShortcutEntry[] = [
		{ label: t("edit.undo", "Undo"), mac: "⌘ + Z", other: "Ctrl + Z" },
		{ label: t("edit.redo", "Redo"), mac: "⌘ + ⇧ + Z", other: "Ctrl + Y" },
	];

	const editorShortcuts: ShortcutEntry[] = SHORTCUT_ACTIONS.map((action) => ({
		label: getShortcutLabel(t, action),
		mac: formatBinding(shortcuts[action], true),
		other: formatBinding(shortcuts[action], false),
	}));

	const navigationShortcuts: ShortcutEntry[] = [
		{ label: t("navigation.cycleForward", "Cycle Annotations Forward"), mac: "Tab", other: "Tab" },
		{
			label: t("navigation.cycleBackward", "Cycle Annotations Backward"),
			mac: "⇧ + Tab",
			other: "Shift + Tab",
		},
		{
			label: t("navigation.deleteAlt", "Delete Selected (alt)"),
			mac: "Del / ⌫",
			other: "Del / Backspace",
		},
		{
			label: t("timeline.pan", "Pan Timeline"),
			mac: "⇧ + ⌘ + Scroll",
			other: "Shift + Ctrl + Scroll",
		},
		{
			label: t("timeline.zoom", "Zoom Timeline"),
			mac: "⌘ + Scroll",
			other: "Ctrl + Scroll",
		},
	];

	const sections = [
		{ title: t("sections.file", "File"), shortcuts: fileShortcuts },
		{ title: t("sections.edit", "Edit"), shortcuts: editShortcuts },
		{ title: t("sections.editor", "Editor"), shortcuts: editorShortcuts },
		{ title: t("sections.navigation", "Navigation"), shortcuts: navigationShortcuts },
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md bg-[#09090b] border-white/10 text-slate-200">
				<DialogHeader>
					<DialogTitle className="text-sm font-semibold text-slate-100">
						{t("title", "Keyboard Shortcuts")}
					</DialogTitle>
					<DialogDescription className="text-xs text-slate-500">
						{isMac
							? t("platform.mac", "Showing macOS shortcuts")
							: t("platform.other", "Showing Windows / Linux shortcuts")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
					{sections.map((section) => (
						<div key={section.title}>
							<h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
								{section.title}
							</h3>
							<div className="space-y-1">
								{section.shortcuts.map((shortcut) => (
									<div
										key={shortcut.label}
										className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5"
									>
										<span className="text-xs text-slate-300">{shortcut.label}</span>
										<kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#09cf67] font-mono min-w-[40px] text-center">
											{isMac ? shortcut.mac : shortcut.other}
										</kbd>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
