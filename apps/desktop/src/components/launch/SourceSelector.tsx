import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppWindow, Loader2, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { MdCheck } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";
import { flashSelectedScreen, getSources, selectSource } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { getSourceGridColumnClass } from "./sourceGridLayout";

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
			<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/50 py-12">
				{type === "screen" ? (
					<Monitor className="h-5 w-5 text-muted-foreground" />
				) : (
					<AppWindow className="h-5 w-5 text-muted-foreground" />
				)}
				<p className="text-sm text-muted-foreground">{emptyMessage}</p>
			</div>
		);
	}

	const isWindow = type === "window";

	return (
		<div
			className={cn(
				"grid gap-2",
				isWindow ? "grid-cols-3" : getSourceGridColumnClass(type, sources.length),
			)}
		>
			{sources.map((source) => {
				const isSelected = selectedSource?.id === source.id;

				return (
					<button
						type="button"
						key={source.id}
						className={cn(
							"rounded-lg border bg-card text-left transition-colors hover:bg-accent",
							isWindow ? "p-1.5" : "p-2",
							isSelected ? "border-primary ring-2 ring-primary/30" : "border-border",
						)}
						onClick={() => onSelect(source)}
					>
						<div
							className={cn(
								"relative overflow-hidden rounded-md bg-muted",
								isWindow ? "mb-1 aspect-[16/10]" : "mb-2 aspect-video",
							)}
						>
							{source.thumbnail ? (
								<img
									src={source.thumbnail}
									alt={source.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-muted-foreground">
									{type === "screen" ? (
										<Monitor className={isWindow ? "h-4 w-4" : "h-5 w-5"} />
									) : source.appIcon ? (
										<img
											src={source.appIcon}
											alt=""
											className={cn("rounded-sm", isWindow ? "h-4 w-4" : "h-5 w-5")}
										/>
									) : (
										<AppWindow className={isWindow ? "h-4 w-4" : "h-5 w-5"} />
									)}
								</div>
							)}
							{isSelected && (
								<div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
									<MdCheck className="h-2.5 w-2.5" />
								</div>
							)}
						</div>
						<p className={cn("truncate font-medium", isWindow ? "text-xs" : "text-sm")}>
							{source.name}
						</p>
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
			<div className="rounded-2xl border border-border bg-background p-6 shadow-xl">
				<div className="flex flex-col items-center gap-3">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						{t("sourceSelector.finding", "Finding sources...")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-border bg-background p-4 shadow-xl">
			<h1 className="mb-4 text-lg font-semibold">
				{t("sourceSelector.title", "Choose what to share")}
			</h1>

			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as "screens" | "windows")}
			>
				<TabsList>
					<TabsTrigger value="screens" className="gap-1.5">
						<Monitor className="h-3.5 w-3.5" />
						{t("sourceSelector.screens", "Screens")}
						<span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs leading-none">
							{screenSources.length}
						</span>
					</TabsTrigger>
					<TabsTrigger value="windows" className="gap-1.5">
						<AppWindow className="h-3.5 w-3.5" />
						{t("sourceSelector.windows", "Windows")}
						<span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs leading-none">
							{windowSources.length}
							{windowsLoading ? "..." : ""}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent value="screens" className="mt-3">
					<SourceGrid
						sources={screenSources}
						selectedSource={selectedSource}
						onSelect={handleSourceSelect}
						type="screen"
						emptyMessage={t("sourceSelector.noScreens", "No screens available")}
					/>
				</TabsContent>

				<TabsContent value="windows" className="mt-3">
					<SourceGrid
						sources={windowSources}
						selectedSource={selectedSource}
						onSelect={handleSourceSelect}
						type="window"
						emptyMessage={t("sourceSelector.noWindows", "No windows available")}
					/>
				</TabsContent>
			</Tabs>

			<div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
				<Button variant="outline" onClick={() => getCurrentWindow().close()}>
					{t("sourceSelector.cancel", "Cancel")}
				</Button>
				<Button onClick={() => void handleShare()} disabled={!selectedSource}>
					{t("sourceSelector.share", "Share Source")}
				</Button>
			</div>
		</div>
	);
}
