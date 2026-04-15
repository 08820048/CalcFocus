import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppWindow, Loader2, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { MdCheck } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";
import { flashSelectedScreen, getSources, selectSource } from "@/lib/backend";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import styles from "./SourceSelector.module.css";

const SOURCE_THUMBNAIL_SIZE = { width: 320, height: 180 };
const SCREEN_PREVIEW_TIMEOUT_MS = 5000;
const WINDOW_PREVIEW_TIMEOUT_MS = 9000;
const PREVIEW_REFRESH_INTERVAL_MS = 2200;

interface DesktopSource {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	originalName: string;
	sourceType: "screen" | "window";
	appName?: string;
	windowTitle?: string;
	windowId?: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

interface SourceGridProps {
	sources: DesktopSource[];
	selectedSource: DesktopSource | null;
	onSelect: (source: DesktopSource) => void;
	type: "screen" | "window";
	emptyMessage: string;
}

function mapSources(rawSources: ProcessedDesktopSource[]): DesktopSource[] {
	return rawSources.map((source) => {
		const metadata = parseSourceMetadata(source);

		return {
			id: source.id,
			name: metadata.displayName,
			thumbnail: source.thumbnail ?? null,
			display_id: source.display_id ?? source.displayId ?? "",
			appIcon: source.appIcon ?? source.app_icon ?? null,
			originalName: source.name,
			sourceType: metadata.sourceType,
			appName: metadata.appName,
			windowTitle: metadata.windowTitle,
			windowId: source.windowId ?? source.window_id,
			x: source.x,
			y: source.y,
			width: source.width,
			height: source.height,
		};
	});
}

function mergeSources(
	existingSources: DesktopSource[],
	incomingSources: DesktopSource[],
): DesktopSource[] {
	const incomingById = new Map(incomingSources.map((source) => [source.id, source]));
	const mergedSources = existingSources.map((source) => {
		const incoming = incomingById.get(source.id);
		if (!incoming) return source;
		return {
			...source,
			...incoming,
			thumbnail: incoming.thumbnail ?? source.thumbnail,
			appIcon: incoming.appIcon ?? source.appIcon,
		};
	});

	for (const source of incomingSources) {
		if (!existingSources.some((existing) => existing.id === source.id)) {
			mergedSources.push(source);
		}
	}

	return mergedSources;
}

function parseSourceMetadata(source: ProcessedDesktopSource) {
	const sourceType: "screen" | "window" =
		source.sourceType ??
		(source.source_type as "screen" | "window" | undefined) ??
		(source.id.startsWith("window:") ? "window" : "screen");

	const appName = source.appName ?? source.app_name;
	const windowTitle = source.windowTitle ?? source.window_title;

	if (sourceType === "window" && (appName || windowTitle)) {
		return {
			sourceType,
			appName,
			windowTitle: windowTitle ?? source.name,
			displayName: windowTitle ?? source.name,
		};
	}

	if (sourceType === "window") {
		const [appNamePart, ...windowTitleParts] = source.name.split(" — ");
		const parsedAppName = appNamePart?.trim() || undefined;
		const parsedWindowTitle = windowTitleParts.join(" — ").trim() || source.name.trim();

		return {
			sourceType,
			appName: parsedAppName,
			windowTitle: parsedWindowTitle,
			displayName: parsedWindowTitle,
		};
	}

	return {
		sourceType,
		appName: undefined,
		windowTitle: undefined,
		displayName: source.name,
	};
}

function SourceGrid({ sources, selectedSource, onSelect, type, emptyMessage }: SourceGridProps) {
	if (sources.length === 0) {
		return (
			<div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.04]">
				{type === "screen" ? (
					<Monitor className="h-5 w-5 text-zinc-500" />
				) : (
					<AppWindow className="h-5 w-5 text-zinc-500" />
				)}
				<p className="text-xs text-zinc-500">{emptyMessage}</p>
			</div>
		);
	}

	return (
		<div
			className={`grid h-[280px] auto-rows-min grid-cols-2 gap-3 overflow-y-auto pr-1 ${styles.sourceGridScroll}`}
		>
			{sources.map((source) => {
				const isSelected = selectedSource?.id === source.id;

				return (
					<button
						type="button"
						key={source.id}
						className={`${styles.sourceCard} ${isSelected ? styles.selected : ""} p-2 text-left`}
						onClick={() => onSelect(source)}
					>
						<div className="relative mb-1.5 overflow-hidden rounded-lg bg-white/[0.06]">
							{source.thumbnail ? (
								<img
									src={source.thumbnail}
									alt={source.name}
									className="aspect-video w-full object-cover"
								/>
							) : (
								<div className="flex aspect-video w-full items-center justify-center text-zinc-500">
									{type === "screen" ? (
										<Monitor className="h-5 w-5" />
									) : source.appIcon ? (
										<img src={source.appIcon} alt="" className="h-5 w-5 rounded-sm" />
									) : (
										<AppWindow className="h-5 w-5" />
									)}
								</div>
							)}
							{isSelected && (
								<div className={`absolute right-1 top-1 ${styles.checkBadge}`}>
									<MdCheck size={12} className="text-white" />
								</div>
							)}
						</div>
						<div className="flex min-w-0 items-center gap-1.5">
							{source.appIcon ? (
								<img src={source.appIcon} alt="" className={`${styles.icon} shrink-0 rounded-sm`} />
							) : type === "screen" ? (
								<Monitor className={`${styles.icon} shrink-0`} />
							) : (
								<AppWindow className={`${styles.icon} shrink-0`} />
							)}
							<div className={`${styles.name} truncate`}>{source.name}</div>
						</div>
					</button>
				);
			})}
		</div>
	);
}

export function SourceSelector() {
	const t = useScopedT("launch");
	const [sources, setSources] = useState<DesktopSource[]>([]);
	const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
	const [activeTab, setActiveTab] = useState<"screens" | "windows">(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get("tab");
		return tab === "windows" ? "windows" : "screens";
	});
	const [loading, setLoading] = useState(true);
	const [windowsLoading, setWindowsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		async function fetchSources() {
			setLoading(true);
			try {
				const rawSources = await getSources({
					types: ["screen", "window"],
					thumbnailSize: SOURCE_THUMBNAIL_SIZE,
					withThumbnails: true,
					timeoutMs: WINDOW_PREVIEW_TIMEOUT_MS,
				});
				if (!cancelled) {
					setSources(mapSources(rawSources));
				}
			} catch (error) {
				console.error("Error loading source previews:", error);

				try {
					const fallbackSources = await getSources({
						types: ["screen", "window"],
						thumbnailSize: SOURCE_THUMBNAIL_SIZE,
					});

					if (!cancelled) {
						setSources(mapSources(fallbackSources));
					}
				} catch (fallbackError) {
					console.error("Error loading fallback sources:", fallbackError);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
					setWindowsLoading(false);
				}
			}
		}

		void fetchSources();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (loading) {
			return;
		}

		let cancelled = false;
		let refreshInFlight = false;

		const refreshVisiblePreviews = async () => {
			if (refreshInFlight) {
				return;
			}

			refreshInFlight = true;
			const sourceType = activeTab === "windows" ? "window" : "screen";
			try {
				const refreshedSources = await getSources({
					types: [sourceType],
					thumbnailSize: SOURCE_THUMBNAIL_SIZE,
					withThumbnails: true,
					timeoutMs:
						sourceType === "window" ? WINDOW_PREVIEW_TIMEOUT_MS : SCREEN_PREVIEW_TIMEOUT_MS,
				});

				if (!cancelled) {
					setSources((prev) => mergeSources(prev, mapSources(refreshedSources)));
				}
			} catch (error) {
				console.error("Error refreshing source previews:", error);
			} finally {
				refreshInFlight = false;
			}
		};

		void refreshVisiblePreviews();
		const interval = window.setInterval(refreshVisiblePreviews, PREVIEW_REFRESH_INTERVAL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [activeTab, loading]);

	const screenSources = sources.filter((source) => source.sourceType === "screen");
	const windowSources = sources.filter((source) => source.sourceType === "window");

	useEffect(() => {
		if (loading) {
			return;
		}

		if (screenSources.length === 0 && windowSources.length > 0) {
			setActiveTab("windows");
			return;
		}

		if (windowSources.length === 0 && screenSources.length > 0) {
			setActiveTab("screens");
		}
	}, [loading, screenSources.length, windowSources.length]);

	const handleSourceSelect = (source: DesktopSource) => {
		setSelectedSource(source);

		if (source.sourceType !== "screen") {
			return;
		}

		void flashSelectedScreen(source).catch((error) => {
			console.warn("Unable to flash selected screen border:", error);
		});
	};

	const handleShare = async () => {
		if (selectedSource) {
			await selectSource(selectedSource);
		}
	};

	if (loading) {
		return (
			<div
				className={`flex h-screen w-screen items-center justify-center ${styles.glassContainer}`}
			>
				<div className="flex flex-col items-center gap-3">
					<Loader2 className="h-5 w-5 animate-spin text-[#34b27b]" />
					<p className="text-xs text-zinc-400">
						{t("sourceSelector.finding", "Finding sources...")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`flex h-screen w-screen flex-col overflow-hidden ${styles.glassContainer}`}>
			<div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as "screens" | "windows")}
					className="flex min-h-0 flex-1 flex-col"
				>
					<TabsList className="mb-3 grid grid-cols-2 rounded-[8px] bg-white/5 p-1">
						<TabsTrigger
							value="screens"
							className="gap-1.5 rounded-[8px] py-1 text-xs text-zinc-400 transition-all data-[state=active]:bg-white/15 data-[state=active]:text-white"
						>
							<Monitor className="h-3.5 w-3.5" />
							{t("sourceSelector.screens", "Screens")}
							<span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none text-zinc-300">
								{screenSources.length}
							</span>
						</TabsTrigger>
						<TabsTrigger
							value="windows"
							className="gap-1.5 rounded-[8px] py-1 text-xs text-zinc-400 transition-all data-[state=active]:bg-white/15 data-[state=active]:text-white"
						>
							<AppWindow className="h-3.5 w-3.5" />
							{t("sourceSelector.windows", "Windows")}
							<span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none text-zinc-300">
								{windowSources.length}
								{windowsLoading ? "..." : ""}
							</span>
						</TabsTrigger>
					</TabsList>

					<div className="min-h-0 flex-1">
						<TabsContent value="screens" className="mt-0 h-full">
							<SourceGrid
								sources={screenSources}
								selectedSource={selectedSource}
								onSelect={handleSourceSelect}
								type="screen"
								emptyMessage={t("sourceSelector.noScreens", "No screens available")}
							/>
						</TabsContent>

						<TabsContent value="windows" className="mt-0 h-full">
							<SourceGrid
								sources={windowSources}
								selectedSource={selectedSource}
								onSelect={handleSourceSelect}
								type="window"
								emptyMessage={t("sourceSelector.noWindows", "No windows available")}
							/>
						</TabsContent>
					</div>
				</Tabs>
			</div>

			<div className="flex shrink-0 justify-center gap-2 p-3">
				<Button
					variant="ghost"
					onClick={() => getCurrentWindow().close()}
					className="h-8 rounded-[8px] px-5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
				>
					{t("sourceSelector.cancel", "Cancel")}
				</Button>
				<Button
					onClick={() => void handleShare()}
					disabled={!selectedSource}
					className="h-8 rounded-[8px] bg-[#34b27b] px-5 text-xs text-white hover:bg-[#2e9f6f] disabled:bg-zinc-700 disabled:opacity-30"
				>
					{t("sourceSelector.share", "Share")}
				</Button>
			</div>
		</div>
	);
}
