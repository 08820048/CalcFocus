import { HelpCircle, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { formatBinding, SHORTCUT_ACTIONS, type ShortcutAction } from "@/lib/shortcuts";
import { formatShortcut } from "@/utils/platformUtils";

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

export function KeyboardShortcutsHelp() {
	console.log("render <KeyboardShortcutsHelp>");
	const t = useScopedT("shortcuts");
	const { shortcuts, isMac, openConfig } = useShortcuts();

	const [scrollLabels, setScrollLabels] = useState({
		pan: t("timeline.panDefault", "Shift + Ctrl + Scroll"),
		zoom: t("timeline.zoomDefault", "Ctrl + Scroll"),
	});

	useEffect(() => {
		Promise.all([
			formatShortcut(["shift", "mod", "Scroll"]),
			formatShortcut(["mod", "Scroll"]),
		]).then(([pan, zoom]) => setScrollLabels({ pan, zoom }));
	}, []);

	return (
		<div className="relative group">
			<HelpCircle className="w-4 h-4 text-slate-500 hover:text-[#09cf67] transition-colors cursor-help" />

			<div className="absolute right-0 top-full mt-2 w-64 bg-[#09090b] border border-white/10 rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
				<div className="flex items-center justify-between mb-2">
					<span className="text-xs font-semibold text-slate-200">
						{t("title", "Keyboard Shortcuts")}
					</span>
					<button
						type="button"
						onClick={openConfig}
						title={t("customize", "Customize")}
						className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#09cf67] transition-colors"
					>
						<Settings2 className="w-3 h-3" />
						{t("customize", "Customize")}
					</button>
				</div>

				<div className="space-y-1.5 text-[10px]">
					{SHORTCUT_ACTIONS.map((action) => (
						<div key={action} className="flex items-center justify-between">
							<span className="text-slate-400">{getShortcutLabel(t, action)}</span>
							<kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#09cf67] font-mono">
								{formatBinding(shortcuts[action], isMac)}
							</kbd>
						</div>
					))}

					<div className="pt-1 border-t border-white/5 mt-1">
						<div className="flex items-center justify-between">
							<span className="text-slate-400">{t("timeline.pan", "Pan Timeline")}</span>
							<kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#09cf67] font-mono">
								{scrollLabels.pan}
							</kbd>
						</div>
						<div className="flex items-center justify-between mt-1.5">
							<span className="text-slate-400">{t("timeline.zoom", "Zoom Timeline")}</span>
							<kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#09cf67] font-mono">
								{scrollLabels.zoom}
							</kbd>
						</div>
						<div className="flex items-center justify-between mt-1.5">
							<span className="text-slate-400">
								{t("timeline.cycleAnnotations", "Cycle Annotations")}
							</span>
							<kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#09cf67] font-mono">
								Tab
							</kbd>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
