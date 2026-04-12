import Block from "@uiw/react-color-block";
import {
	Camera,
	Crop,
	type LucideIcon,
	MousePointer2,
	Palette,
	SlidersHorizontal,
	Trash2,
	Upload,
	Volume2,
	X,
} from "lucide-react";
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScopedT } from "@/contexts/I18nContext";
import {
	createDefaultFacecamSettings,
	FACECAM_ANCHORS,
	type FacecamSettings,
} from "@/lib/recordingSession";
import { cn } from "@/lib/utils";
import { BUILT_IN_WALLPAPERS, type BuiltInWallpaper, WALLPAPER_PATHS } from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import { CropControl } from "./CropControl";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import type {
	AnnotationRegion,
	AnnotationType,
	CropRegion,
	CursorStyle,
	FigureData,
	PlaybackSpeed,
	ZoomDepth,
} from "./types";
import { SPEED_OPTIONS } from "./types";
import {
	CURSOR_STYLE_OPTIONS,
	CURSOR_STYLE_STATIC_PREVIEW_URLS,
	minimalCursorUrl,
} from "./videoPlayback/cursorStyleAssets";
import {
	UPLOADED_CURSOR_SAMPLE_SIZE,
	uploadedCursorAssets,
} from "./videoPlayback/uploadedCursorAssets";

const GRADIENTS = [
	"linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
	"linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
	"radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
	"linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
	"linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
	"linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
	"radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
	"linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
	"linear-gradient(135deg, #FBC8B4, #2447B1)",
	"linear-gradient(109.6deg, #F635A6, #36D860)",
	"linear-gradient(90deg, #FF0101, #4DFF01)",
	"linear-gradient(315deg, #EC0101, #5044A9)",
	"linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
	"linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
	"linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
	"linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
	"linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
	"linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
	"linear-gradient(to right, #fa709a 0%, #fee140 100%)",
	"linear-gradient(to top, #30cfd0 0%, #330867 100%)",
	"linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
	"linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
	"linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
	"linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

const COLOR_PALETTE = [
	"#FF0000",
	"#FFD700",
	"#00FF00",
	"#FFFFFF",
	"#0000FF",
	"#FF6B00",
	"#9B59B6",
	"#E91E63",
	"#00BCD4",
	"#FF5722",
	"#8BC34A",
	"#FFC107",
	"#09cf67",
	"#000000",
	"#607D8B",
	"#795548",
];

type SettingsSidebarTab = "appearance" | "cursor" | "camera" | "background" | "audio";

type SettingsTabDefinition = {
	id: SettingsSidebarTab;
	label: string;
	description: string;
	icon: LucideIcon;
};

interface SettingsPanelProps {
	selected: string;
	onWallpaperChange: (path: string) => void;
	audioMuted?: boolean;
	onAudioMutedChange?: (muted: boolean) => void;
	audioVolume?: number;
	onAudioVolumeChange?: (volume: number) => void;
	selectedZoomDepth?: ZoomDepth | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	selectedZoomId?: string | null;
	onZoomDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onTrimDelete?: (id: string) => void;
	shadowIntensity?: number;
	onShadowChange?: (intensity: number) => void;
	backgroundBlur?: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlur?: number;
	onZoomMotionBlurChange?: (amount: number) => void;
	connectZooms?: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	showCursor?: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	loopCursor?: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorStyle?: CursorStyle;
	onCursorStyleChange?: (style: CursorStyle) => void;
	cursorSize?: number;
	onCursorSizeChange?: (size: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (smoothing: number) => void;
	cursorMotionBlur?: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorClickBounce?: number;
	onCursorClickBounceChange?: (amount: number) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding?: number;
	onPaddingChange?: (padding: number) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	facecamVideoPath?: string | null;
	facecamSettings?: FacecamSettings;
	onFacecamSettingsChange?: (settings: FacecamSettings) => void;
	aspectRatio: AspectRatio;
	videoElement?: HTMLVideoElement | null;
	selectedAnnotationId?: string | null;
	annotationRegions?: AnnotationRegion[];
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationDelete?: (id: string) => void;
	selectedSpeedId?: string | null;
	selectedSpeedValue?: PlaybackSpeed | null;
	onSpeedChange?: (speed: PlaybackSpeed) => void;
	onSpeedDelete?: (id: string) => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

const normalizeWallpaperValue = (value: string) =>
	value.replace(/^file:\/\//, "").replace(/^\//, "");

function isBuiltInWallpaperSelected(selectedValue: string, wallpaper: BuiltInWallpaper) {
	const normalizedSelected = normalizeWallpaperValue(selectedValue);

	return [wallpaper.publicPath, wallpaper.relativePath, wallpaper.thumbnailPublicPath].some(
		(candidate) => {
			const normalizedCandidate = normalizeWallpaperValue(candidate);
			return (
				normalizedSelected === normalizedCandidate ||
				normalizedSelected.endsWith(normalizedCandidate) ||
				normalizedCandidate.endsWith(normalizedSelected)
			);
		},
	);
}

type WallpaperPreviewTileProps = {
	label: string;
	previewSrc: string;
	isSelected: boolean;
	onSelect: () => void;
	children?: ReactNode;
};

const flatControlClass = "pb-2";
const flatRowControlClass = "flex items-center justify-between gap-3 pb-2";
const flatTabsListClass = "mb-2 w-full grid grid-cols-3 h-7 rounded-none bg-transparent p-0";
const flatTabsTriggerClass =
	"rounded-none border-b-2 border-transparent data-[state=active]:border-[#09cf67] data-[state=active]:bg-transparent data-[state=active]:text-white text-slate-400 text-[10px] py-1 transition-colors";
const flatOptionButtonClass =
	"h-auto w-full rounded-none border-x-0 border-t-0 bg-transparent px-1 py-2 text-center shadow-none transition-all duration-200 ease-out opacity-100 cursor-pointer";

function WallpaperPreviewTile({
	label,
	previewSrc,
	isSelected,
	onSelect,
	children,
}: WallpaperPreviewTileProps) {
	return (
		<div
			className={cn(
				"aspect-square w-9 h-9 rounded-none border-2 overflow-hidden cursor-pointer transition-all duration-200 relative shadow-none group",
				isSelected
					? "border-[#09cf67] ring-1 ring-[#09cf67]/30"
					: "border-white/10 hover:border-[#09cf67]/40 opacity-80 hover:opacity-100 bg-transparent",
			)}
			aria-label={label}
			title={label}
			onClick={onSelect}
			role="button"
		>
			<img
				src={previewSrc}
				alt={label}
				loading="lazy"
				decoding="async"
				draggable={false}
				className="pointer-events-none h-full w-full object-cover"
			/>
			{children}
		</div>
	);
}

function loadPreviewImage(url: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.decoding = "async";
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Failed to load preview asset: ${url}`));
		image.src = url;
	});
}

function trimCanvasToAlpha(canvas: HTMLCanvasElement, hotspot?: { x: number; y: number }) {
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width: canvas.width,
			height: canvas.height,
			hotspot,
		};
	}

	const { width, height } = canvas;
	const imageData = ctx.getImageData(0, 0, width, height);
	const { data } = imageData;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha === 0) {
				continue;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (maxX < minX || maxY < minY) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width,
			height,
			hotspot,
		};
	}

	const croppedWidth = maxX - minX + 1;
	const croppedHeight = maxY - minY + 1;
	const croppedCanvas = document.createElement("canvas");
	croppedCanvas.width = croppedWidth;
	croppedCanvas.height = croppedHeight;
	const croppedCtx = croppedCanvas.getContext("2d")!;
	croppedCtx.drawImage(
		canvas,
		minX,
		minY,
		croppedWidth,
		croppedHeight,
		0,
		0,
		croppedWidth,
		croppedHeight,
	);

	return {
		dataUrl: croppedCanvas.toDataURL("image/png"),
		width: croppedWidth,
		height: croppedHeight,
		hotspot: hotspot
			? {
					x: hotspot.x - minX,
					y: hotspot.y - minY,
				}
			: undefined,
	};
}

async function createTrimmedSvgPreview(
	url: string,
	sampleSize: number,
	trim?: { x: number; y: number; width: number; height: number },
	hotspot?: { x: number; y: number },
) {
	const image = await loadPreviewImage(url);
	const canvas = document.createElement("canvas");
	canvas.width = sampleSize;
	canvas.height = sampleSize;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

	if (!trim) {
		return trimCanvasToAlpha(canvas, hotspot).dataUrl;
	}

	const croppedCanvas = document.createElement("canvas");
	croppedCanvas.width = trim.width;
	croppedCanvas.height = trim.height;
	const croppedCtx = croppedCanvas.getContext("2d")!;
	croppedCtx.drawImage(
		canvas,
		trim.x,
		trim.y,
		trim.width,
		trim.height,
		0,
		0,
		trim.width,
		trim.height,
	);

	return trimCanvasToAlpha(croppedCanvas, hotspot).dataUrl;
}

async function createInvertedPreview(url: string) {
	const image = await loadPreviewImage(url);
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(image, 0, 0);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const { data } = imageData;
	for (let index = 0; index < data.length; index += 4) {
		if (data[index + 3] === 0) {
			continue;
		}

		data[index] = 255 - data[index];
		data[index + 1] = 255 - data[index + 1];
		data[index + 2] = 255 - data[index + 2];
	}
	ctx.putImageData(imageData, 0, 0);
	return canvas.toDataURL("image/png");
}

function CursorStylePreview({
	style,
	previewUrls,
}: {
	style: CursorStyle;
	previewUrls: Partial<Record<"tahoe" | "figma" | "mono", string>>;
}) {
	if (style === "tahoe") {
		return (
			<img
				src={previewUrls.tahoe ?? uploadedCursorAssets.arrow?.url}
				alt=""
				className="h-8 w-8 object-contain drop-shadow-[0_8px_12px_rgba(15,23,42,0.18)]"
				draggable={false}
			/>
		);
	}

	if (style === "figma") {
		return (
			<img
				src={previewUrls.figma ?? minimalCursorUrl}
				alt=""
				className="h-8 w-8 object-contain"
				draggable={false}
			/>
		);
	}

	if (style === "dot") {
		return (
			<span className="h-[14px] w-[14px] rounded-full border-[2.5px] border-slate-900 bg-white shadow-[0_8px_12px_rgba(15,23,42,0.16)]" />
		);
	}

	if (style === "mono") {
		return (
			<img
				src={previewUrls.mono ?? previewUrls.tahoe ?? uploadedCursorAssets.arrow?.url}
				alt=""
				className="h-8 w-8 object-contain"
				draggable={false}
			/>
		);
	}

	const previewUrl = CURSOR_STYLE_STATIC_PREVIEW_URLS[style];

	return (
		<img src={previewUrl} alt="" className="h-8 w-8 object-contain" draggable={false} />
	);
}

function SettingsPanelInner({
	selected,
	onWallpaperChange,
	audioMuted = false,
	onAudioMutedChange,
	audioVolume = 1,
	onAudioVolumeChange,
	selectedZoomDepth,
	onZoomDepthChange,
	selectedZoomId,
	onZoomDelete,
	selectedTrimId,
	onTrimDelete,
	shadowIntensity = 0,
	onShadowChange,
	backgroundBlur = 0,
	onBackgroundBlurChange,
	zoomMotionBlur = 0,
	onZoomMotionBlurChange,
	connectZooms = true,
	onConnectZoomsChange,
	showCursor = false,
	onShowCursorChange,
	loopCursor = false,
	onLoopCursorChange,
	cursorStyle = "tahoe",
	onCursorStyleChange,
	cursorSize = 5,
	onCursorSizeChange,
	cursorSmoothing = 2,
	onCursorSmoothingChange,
	cursorMotionBlur = 0.35,
	onCursorMotionBlurChange,
	cursorClickBounce = 1,
	onCursorClickBounceChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	padding = 50,
	onPaddingChange,
	cropRegion,
	onCropChange,
	facecamVideoPath,
	facecamSettings = createDefaultFacecamSettings(false),
	onFacecamSettingsChange,
	aspectRatio,
	videoElement,
	selectedAnnotationId,
	annotationRegions = [],
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationDelete,
	selectedSpeedId,
	selectedSpeedValue,
	onSpeedChange,
	onSpeedDelete,
}: SettingsPanelProps) {
	const t = useScopedT("settings");
	const [activeTab, setActiveTab] = useState<SettingsSidebarTab>("appearance");
	const [backgroundTab, setBackgroundTab] = useState<"image" | "color" | "gradient">("image");
	const [customImages, setCustomImages] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedColor, setSelectedColor] = useState("#ADADAD");
	const [gradient, setGradient] = useState<string>(GRADIENTS[0]);
	const [showCropModal, setShowCropModal] = useState(false);
	const [cursorPreviewUrls, setCursorPreviewUrls] = useState<
		Partial<Record<"tahoe" | "figma" | "mono", string>>
	>({});
	const cropSnapshotRef = useRef<CropRegion | null>(null);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const tahoeAsset = uploadedCursorAssets.arrow;
				const tahoePreview = tahoeAsset
					? await createTrimmedSvgPreview(
							tahoeAsset.url,
							UPLOADED_CURSOR_SAMPLE_SIZE,
							tahoeAsset.trim,
						)
					: undefined;
				const figmaPreview = await createTrimmedSvgPreview(minimalCursorUrl, 512);
				const monoPreview = tahoePreview ? await createInvertedPreview(tahoePreview) : undefined;

				if (!cancelled) {
					setCursorPreviewUrls({
						tahoe: tahoePreview,
						figma: figmaPreview,
						mono: monoPreview,
					});
				}
			} catch {
				if (!cancelled) {
					setCursorPreviewUrls({
						tahoe: uploadedCursorAssets.arrow?.url,
						figma: minimalCursorUrl,
						mono: uploadedCursorAssets.arrow?.url,
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const settingsSidebarTabs = useMemo<SettingsTabDefinition[]>(
		() => [
			{
				id: "appearance",
				label: t("tabs.appearance.label", "Appearance"),
				description: t("tabs.appearance.description", "Frame styling, crop, and composition."),
				icon: SlidersHorizontal,
			},
			{
				id: "cursor",
				label: t("tabs.cursor.label", "Cursor"),
				description: t("tabs.cursor.description", "Cursor visibility and motion effects."),
				icon: MousePointer2,
			},
			{
				id: "camera",
				label: t("tabs.camera.label", "Camera"),
				description: t("tabs.camera.description", "Facecam overlay settings."),
				icon: Camera,
			},
			{
				id: "background",
				label: t("tabs.background.label", "Background"),
				description: t("tabs.background.description", "Wallpaper, colors, and gradients."),
				icon: Palette,
			},
			{
				id: "audio",
				label: t("tabs.audio.label", "Audio"),
				description: t("tabs.audio.description", "Master preview and MP4 export audio."),
				icon: Volume2,
			},
		],
		[t],
	);
	const activeTabDefinition = useMemo(
		() => settingsSidebarTabs.find((tab) => tab.id === activeTab) ?? settingsSidebarTabs[0],
		[activeTab, settingsSidebarTabs],
	);

	const zoomEnabled = Boolean(selectedZoomDepth);
	const trimEnabled = Boolean(selectedTrimId);
	const facecamAvailable = Boolean(facecamVideoPath);

	const updateFacecamSettings = (next: Partial<FacecamSettings>) => {
		onFacecamSettingsChange?.({
			...facecamSettings,
			...next,
		});
	};

	const handleDeleteClick = () => {
		if (selectedZoomId && onZoomDelete) {
			onZoomDelete(selectedZoomId);
		}
	};

	const handleTrimDeleteClick = () => {
		if (selectedTrimId && onTrimDelete) {
			onTrimDelete(selectedTrimId);
		}
	};

	const handleCropToggle = () => {
		if (!showCropModal && cropRegion) {
			cropSnapshotRef.current = { ...cropRegion };
		}
		setShowCropModal(!showCropModal);
	};

	const handleCropCancel = () => {
		if (cropSnapshotRef.current && onCropChange) {
			onCropChange(cropSnapshotRef.current);
		}
		setShowCropModal(false);
	};

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type - only allow JPG/JPEG
		const validTypes = ["image/jpeg", "image/jpg"];
		if (!validTypes.includes(file.type)) {
			toast.error(t("background.invalidFileType", "Invalid file type"), {
				description: t(
					"background.invalidFileDescription",
					"Please upload a JPG or JPEG image file.",
				),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				setCustomImages((prev) => [...prev, dataUrl]);
				onWallpaperChange(dataUrl);
				toast.success(t("background.uploadedSuccessfully", "Custom image uploaded successfully!"));
			}
		};

		reader.onerror = () => {
			toast.error(t("background.uploadFailed", "Failed to upload image"), {
				description: t(
					"background.uploadFailedDescription",
					"There was an error reading the file.",
				),
			});
		};

		reader.readAsDataURL(file);
		// Reset input so the same file can be selected again
		event.target.value = "";
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		setCustomImages((prev) => prev.filter((img) => img !== imageUrl));
		// If the removed image was selected, clear selection
		if (selected === imageUrl) {
			onWallpaperChange(WALLPAPER_PATHS[0]);
		}
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

	// If an annotation is selected, show annotation settings instead
	if (
		selectedAnnotation &&
		onAnnotationContentChange &&
		onAnnotationTypeChange &&
		onAnnotationStyleChange &&
		onAnnotationDelete
	) {
		return (
			<AnnotationSettingsPanel
				annotation={selectedAnnotation}
				onContentChange={(content) => onAnnotationContentChange(selectedAnnotation.id, content)}
				onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
				onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
				onFigureDataChange={
					onAnnotationFigureDataChange
						? (figureData) => onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
						: undefined
				}
				onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
			/>
		);
	}

	const ActiveTabIcon = activeTabDefinition.icon;

	const renderSelectedTabContent = () => {
		switch (activeTab) {
			case "appearance":
				return (
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-2">
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("appearance.shadow", "Shadow")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{Math.round(shadowIntensity * 100)}%
									</span>
								</div>
								<Slider
									value={[shadowIntensity]}
									onValueChange={(values) => onShadowChange?.(values[0])}
									min={0}
									max={1}
									step={0.01}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("appearance.roundness", "Roundness")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">{borderRadius}px</span>
								</div>
								<Slider
									value={[borderRadius]}
									onValueChange={(values) => onBorderRadiusChange?.(values[0])}
									min={0}
									max={25}
									step={0.5}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("appearance.padding", "Padding")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">{padding}%</span>
								</div>
								<Slider
									value={[padding]}
									onValueChange={(values) => onPaddingChange?.(values[0])}
									min={0}
									max={100}
									step={1}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("appearance.backgroundBlur", "Background Blur")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{backgroundBlur.toFixed(1)}px
									</span>
								</div>
								<Slider
									value={[backgroundBlur]}
									onValueChange={(values) => onBackgroundBlurChange?.(values[0])}
									min={0}
									max={8}
									step={0.25}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
						</div>

						<Button
							onClick={handleCropToggle}
							variant="outline"
							className="h-8 w-full gap-1.5 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-[10px] text-slate-200 shadow-none transition-all hover:border-white/20 hover:bg-transparent hover:text-white"
						>
							<Crop className="w-3 h-3" />
							{t("appearance.cropVideo", "Crop Video")}
						</Button>
					</div>
				);
			case "cursor":
				return (
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-2">
							<div className={flatRowControlClass}>
								<div className="text-[10px] font-medium text-slate-300">
									{t("cursor.showCursor", "Show Cursor")}
								</div>
								<Switch
									checked={showCursor}
									onCheckedChange={onShowCursorChange}
									className="data-[state=checked]:bg-[#09cf67] scale-90"
								/>
							</div>
							<div className={flatRowControlClass}>
								<div className="text-[10px] font-medium text-slate-300">
									{t("cursor.loopCursor", "Loop Cursor")}
								</div>
								<Switch
									checked={loopCursor}
									onCheckedChange={onLoopCursorChange}
									className="data-[state=checked]:bg-[#09cf67] scale-90"
								/>
							</div>
						</div>
						<div className={flatControlClass}>
							<div className="mb-2 flex items-center justify-between">
								<div className="text-[10px] font-medium text-slate-300">
									{t("cursor.style", "Style")}
								</div>
								<span className="text-[10px] text-slate-500 font-mono">{cursorStyle}</span>
							</div>
							<div className="grid grid-cols-3 gap-2">
								{CURSOR_STYLE_OPTIONS.map((option) => (
									<Button
										key={option.value}
										type="button"
										variant="outline"
										onClick={() => onCursorStyleChange?.(option.value)}
										title={option.label}
										aria-label={option.label}
										className={cn(
											"flex aspect-square h-auto min-h-0 flex-col items-center justify-between rounded-[10px] border border-white/10 bg-white/[0.03] px-2 py-3 text-center shadow-none hover:border-white/20 hover:bg-white/[0.06]",
											cursorStyle === option.value &&
												"border-[#09cf67]/60 bg-[#09cf67]/10 text-white",
										)}
									>
										<div className="flex min-h-0 flex-1 items-center justify-center">
											<CursorStylePreview
												style={option.value}
												previewUrls={cursorPreviewUrls}
											/>
										</div>
										<span className="mt-2 block text-[10px] font-medium text-slate-200">
											{option.label}
										</span>
									</Button>
								))}
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("cursor.size", "Size")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{cursorSize.toFixed(2)}×
									</span>
								</div>
								<Slider
									value={[cursorSize]}
									onValueChange={(values) => onCursorSizeChange?.(values[0])}
									min={0.5}
									max={10}
									step={0.05}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("cursor.smoothing", "Smoothing")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{cursorSmoothing <= 0 ? t("cursor.off", "Off") : cursorSmoothing.toFixed(2)}
									</span>
								</div>
								<Slider
									value={[cursorSmoothing]}
									onValueChange={(values) => onCursorSmoothingChange?.(values[0])}
									min={0}
									max={2}
									step={0.01}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("cursor.motionBlur", "Motion Blur")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{cursorMotionBlur.toFixed(2)}×
									</span>
								</div>
								<Slider
									value={[cursorMotionBlur]}
									onValueChange={(values) => onCursorMotionBlurChange?.(values[0])}
									min={0}
									max={2}
									step={0.05}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
							<div className={flatControlClass}>
								<div className="flex items-center justify-between mb-1">
									<div className="text-[10px] font-medium text-slate-300">
										{t("cursor.clickBounce", "Click Bounce")}
									</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{cursorClickBounce.toFixed(2)}×
									</span>
								</div>
								<Slider
									value={[cursorClickBounce]}
									onValueChange={(values) => onCursorClickBounceChange?.(values[0])}
									min={0}
									max={5}
									step={0.05}
									className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
								/>
							</div>
						</div>
					</div>
				);
			case "camera":
				return (
					<div className="space-y-3">
						<div className={flatRowControlClass}>
							<div>
								<div className="text-[11px] font-medium text-slate-200">
									{t("camera.facecam", "Facecam")}
								</div>
								<div className="text-[10px] text-slate-500">
									{facecamAvailable
										? t("camera.availableDescription", "Show a Loom-style facecam overlay.")
										: t(
												"camera.unavailableDescription",
												"Record with facecam enabled to customize.",
											)}
								</div>
							</div>
							<Switch
								checked={facecamAvailable && facecamSettings.enabled}
								disabled={!facecamAvailable}
								onCheckedChange={(checked) =>
									updateFacecamSettings({ enabled: checked && facecamAvailable })
								}
							/>
						</div>

						{facecamAvailable && (
							<div className="space-y-3">
								<div className="grid grid-cols-2 gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => updateFacecamSettings({ shape: "circle" })}
										className={cn(
											"h-8 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-[10px] text-slate-300 shadow-none hover:border-white/20 hover:bg-transparent",
											facecamSettings.shape === "circle" && "border-[#09cf67]/60 text-white",
										)}
									>
										{t("camera.circle", "Circle")}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => updateFacecamSettings({ shape: "square" })}
										className={cn(
											"h-8 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-[10px] text-slate-300 shadow-none hover:border-white/20 hover:bg-transparent",
											facecamSettings.shape === "square" && "border-[#09cf67]/60 text-white",
										)}
									>
										{t("camera.square", "Square")}
									</Button>
								</div>

								<div className={flatControlClass}>
									<div className="flex items-center justify-between mb-1">
										<div className="text-[10px] font-medium text-slate-300">
											{t("camera.facecamSize", "Facecam Size")}
										</div>
										<span className="text-[10px] text-slate-500 font-mono">
											{facecamSettings.size.toFixed(0)}%
										</span>
									</div>
									<Slider
										value={[facecamSettings.size]}
										onValueChange={(values) => updateFacecamSettings({ size: values[0] })}
										min={12}
										max={40}
										step={1}
										className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
									/>
								</div>

								{facecamSettings.shape === "square" && (
									<div className={flatControlClass}>
										<div className="flex items-center justify-between mb-1">
											<div className="text-[10px] font-medium text-slate-300">
												{t("camera.squareRoundness", "Square Roundness")}
											</div>
											<span className="text-[10px] text-slate-500 font-mono">
												{facecamSettings.cornerRadius.toFixed(0)}%
											</span>
										</div>
										<Slider
											value={[facecamSettings.cornerRadius]}
											onValueChange={(values) => updateFacecamSettings({ cornerRadius: values[0] })}
											min={0}
											max={50}
											step={1}
											className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
										/>
									</div>
								)}
								<div className={flatControlClass}>
									<div className="flex items-center justify-between mb-1">
										<div className="text-[10px] font-medium text-slate-300">
											{t("camera.borderWidth", "Border Width")}
										</div>
										<span className="text-[10px] text-slate-500 font-mono">
											{facecamSettings.borderWidth.toFixed(0)}px
										</span>
									</div>
									<Slider
										value={[facecamSettings.borderWidth]}
										onValueChange={(values) => updateFacecamSettings({ borderWidth: values[0] })}
										min={0}
										max={16}
										step={1}
										className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
									/>
								</div>

								<div className={flatControlClass}>
									<div className="text-[10px] font-medium text-slate-300 mb-1.5">
										{t("camera.borderColor", "Border Color")}
									</div>
									<Block
										color={facecamSettings.borderColor}
										colors={COLOR_PALETTE}
										onChange={(color) => updateFacecamSettings({ borderColor: color.hex })}
									/>
								</div>

								<div className={flatControlClass}>
									<div className="flex items-center justify-between mb-1">
										<div className="text-[10px] font-medium text-slate-300">
											{t("camera.margin", "Margin")}
										</div>
										<span className="text-[10px] text-slate-500 font-mono">
											{facecamSettings.margin.toFixed(0)}%
										</span>
									</div>
									<Slider
										value={[facecamSettings.margin]}
										onValueChange={(values) => updateFacecamSettings({ margin: values[0] })}
										min={0}
										max={12}
										step={1}
										className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
									/>
								</div>

								<div className={flatControlClass}>
									<div className="text-[10px] font-medium text-slate-300 mb-1.5">
										{t("camera.position", "Position")}
									</div>
									<div className="grid grid-cols-2 gap-1.5">
										{FACECAM_ANCHORS.map((anchorOption) => {
											const labels: Record<string, string> = {
												"top-left": t("camera.positions.topLeft", "Top Left"),
												"top-right": t("camera.positions.topRight", "Top Right"),
												"bottom-left": t("camera.positions.bottomLeft", "Bottom Left"),
												"bottom-right": t("camera.positions.bottomRight", "Bottom Right"),
											};
											const isActive =
												facecamSettings.anchor === anchorOption ||
												(!facecamSettings.anchor && anchorOption === "bottom-right");
											return (
												<Button
													key={anchorOption}
													type="button"
													variant="outline"
													onClick={() =>
														updateFacecamSettings({
															anchor: anchorOption,
															customX: undefined,
															customY: undefined,
														})
													}
													className={cn(
														"h-7 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-[9px] text-slate-300 shadow-none hover:border-white/20 hover:bg-transparent",
														isActive && "border-[#09cf67]/60 text-white",
													)}
												>
													{labels[anchorOption] ?? anchorOption}
												</Button>
											);
										})}
									</div>
									{facecamSettings.anchor === "custom" && (
										<div className="mt-1.5 text-[9px] text-slate-500">
											{t("camera.dragHint", "Drag the bubble in the preview to reposition.")}
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				);
			case "background":
				return (
					<Tabs
						value={backgroundTab}
						onValueChange={(value) => setBackgroundTab(value as typeof backgroundTab)}
						className="w-full"
					>
						<TabsList className={flatTabsListClass}>
							<TabsTrigger value="image" className={flatTabsTriggerClass}>
								{t("background.image", "Image")}
							</TabsTrigger>
							<TabsTrigger value="color" className={flatTabsTriggerClass}>
								{t("background.color", "Color")}
							</TabsTrigger>
							<TabsTrigger value="gradient" className={flatTabsTriggerClass}>
								{t("background.gradient", "Gradient")}
							</TabsTrigger>
						</TabsList>

						<div className="max-h-[min(200px,25vh)] overflow-y-auto custom-scrollbar">
							<TabsContent value="image" className="mt-0 space-y-2">
								<input
									type="file"
									ref={fileInputRef}
									onChange={handleImageUpload}
									accept=".jpg,.jpeg,image/jpeg"
									className="hidden"
								/>
								<Button
									onClick={() => fileInputRef.current?.click()}
									variant="outline"
									className="h-7 w-full gap-2 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-[10px] text-slate-200 shadow-none transition-all hover:border-[#09cf67] hover:bg-transparent hover:text-white"
								>
									<Upload className="w-3 h-3" />
									{t("background.uploadCustom", "Upload Custom")}
								</Button>

								<div className="grid grid-cols-7 gap-1.5">
									{customImages.map((imageUrl, idx) => {
										const isSelected = selected === imageUrl;
										return (
											<WallpaperPreviewTile
												key={`custom-${idx}`}
												label={t("background.customWallpaper", "Custom wallpaper {{index}}", {
													index: idx + 1,
												})}
												previewSrc={imageUrl}
												isSelected={isSelected}
												onSelect={() => onWallpaperChange(imageUrl)}
											>
												<button
													type="button"
													onClick={(e) => handleRemoveCustomImage(imageUrl, e)}
													className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
												>
													<X className="w-2 h-2 text-white" />
												</button>
											</WallpaperPreviewTile>
										);
									})}

									{BUILT_IN_WALLPAPERS.map((wallpaper) => (
										<WallpaperPreviewTile
											key={wallpaper.id}
											label={wallpaper.label}
											previewSrc={wallpaper.thumbnailPublicPath}
											isSelected={
												Boolean(selected) && isBuiltInWallpaperSelected(selected, wallpaper)
											}
											onSelect={() => onWallpaperChange(wallpaper.publicPath)}
										/>
									))}
								</div>
							</TabsContent>

							<TabsContent value="color" className="mt-0">
								<div className="p-1">
									<Block
										color={selectedColor}
										colors={COLOR_PALETTE}
										onChange={(color) => {
											setSelectedColor(color.hex);
											onWallpaperChange(color.hex);
										}}
										style={{
											width: "100%",
											borderRadius: "0px",
										}}
									/>
								</div>
							</TabsContent>

							<TabsContent value="gradient" className="mt-0">
								<div className="grid grid-cols-7 gap-1.5">
									{GRADIENTS.map((currentGradient, idx) => (
										<div
											key={currentGradient}
											className={cn(
												"aspect-square w-9 h-9 rounded-none border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-none",
												gradient === currentGradient
													? "border-[#09cf67] ring-1 ring-[#09cf67]/30"
													: "border-white/10 hover:border-[#09cf67]/40 opacity-80 hover:opacity-100 bg-transparent",
											)}
											style={{ background: currentGradient }}
											aria-label={t("background.gradientItem", "Gradient {{index}}", {
												index: idx + 1,
											})}
											onClick={() => {
												setGradient(currentGradient);
												onWallpaperChange(currentGradient);
											}}
											role="button"
										/>
									))}
								</div>
							</TabsContent>
						</div>
					</Tabs>
				);
			case "audio":
				return (
					<div className="space-y-3">
						<div className={flatRowControlClass}>
							<div>
								<div className="text-[11px] font-medium text-slate-200">
									{t("audio.muteAudio", "Mute Audio")}
								</div>
								<div className="text-[10px] text-slate-500">
									{t("audio.muteDescription", "Silence preview playback and MP4 exports.")}
								</div>
							</div>
							<Switch
								checked={audioMuted}
								onCheckedChange={onAudioMutedChange}
								className="data-[state=checked]:bg-[#09cf67] scale-90"
							/>
						</div>

						<div className={flatControlClass}>
							<div className="flex items-center justify-between mb-1">
								<div className="text-[10px] font-medium text-slate-300">
									{t("audio.masterVolume", "Master Volume")}
								</div>
								<span className="text-[10px] text-slate-500 font-mono">
									{Math.round(audioVolume * 100)}%
								</span>
							</div>
							<Slider
								value={[audioVolume]}
								onValueChange={(values) => onAudioVolumeChange?.(values[0])}
								min={0}
								max={1}
								step={0.01}
								className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
							/>
						</div>

						<div className="pb-2 text-[10px] text-slate-500">
							{t(
								"audio.note",
								"These controls affect editor playback immediately and apply to MP4 exports.",
							)}
						</div>
					</div>
				);
		}
	};

	return (
		<div className="h-full w-full min-w-0 bg-[#09090b] overflow-hidden">
			<div className="flex flex-1 min-h-0 overflow-hidden">
				<div
					className="flex flex-col items-center gap-2 px-3 pt-2 pb-4"
					role="tablist"
					aria-orientation="vertical"
				>
					{settingsSidebarTabs.map((tab) => {
						const TabIcon = tab.icon;
						const isActive = tab.id === activeTab;

						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								id={`settings-tab-${tab.id}`}
								aria-selected={isActive}
								aria-controls={`settings-panel-${tab.id}`}
								aria-label={tab.label}
								title={tab.label}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									"flex h-9 w-9 items-center justify-center transition-colors duration-200",
									isActive ? "text-[#09cf67]" : "text-slate-500 hover:text-slate-200",
								)}
							>
								<TabIcon className="h-4 w-4" />
							</button>
						);
					})}
				</div>

				<div className="flex flex-1 min-h-0 flex-col">
					<div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-3 pb-4">
						{zoomEnabled && (
							<div className="mb-4 pb-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-sm font-medium text-slate-200">
										{t("zoom.title", "Zoom Settings")}
									</span>
									<div className="flex items-center gap-2">
										{selectedZoomDepth && (
											<span className="text-[10px] uppercase tracking-wider font-medium text-[#09cf67] bg-[#09cf67]/10 px-2 py-0.5 rounded-full">
												{ZOOM_DEPTH_OPTIONS.find((o) => o.depth === selectedZoomDepth)?.label}
											</span>
										)}
										<KeyboardShortcutsHelp />
									</div>
								</div>
								<div className="grid grid-cols-6 gap-1.5 mb-3">
									{ZOOM_DEPTH_OPTIONS.map((option) => {
										const isActive = selectedZoomDepth === option.depth;
										return (
											<Button
												key={option.depth}
												type="button"
												onClick={() => onZoomDepthChange?.(option.depth)}
												className={cn(
													flatOptionButtonClass,
													isActive
														? "border-[#09cf67] text-white"
														: "border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200",
												)}
											>
												<span className="text-xs font-semibold">{option.label}</span>
											</Button>
										);
									})}
								</div>
								<div className="grid grid-cols-2 gap-2 mb-3">
									<div className={flatControlClass}>
										<div className="flex items-center justify-between mb-1">
											<div className="text-[10px] font-medium text-slate-300">
												{t("zoom.motionBlur", "Motion Blur")}
											</div>
											<span className="text-[10px] text-slate-500 font-mono">
												{zoomMotionBlur.toFixed(2)}×
											</span>
										</div>
										<Slider
											value={[zoomMotionBlur]}
											onValueChange={(values) => onZoomMotionBlurChange?.(values[0])}
											min={0}
											max={2}
											step={0.05}
											className="w-full [&_[role=slider]]:bg-[#09cf67] [&_[role=slider]]:border-[#09cf67] [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
										/>
									</div>
									<div className={flatRowControlClass}>
										<div className="text-[10px] font-medium text-slate-300">
											{t("zoom.connect", "Connect Zooms")}
										</div>
										<Switch
											checked={connectZooms}
											onCheckedChange={onConnectZoomsChange}
											className="data-[state=checked]:bg-[#09cf67] scale-90"
										/>
									</div>
								</div>
								<Button
									onClick={handleDeleteClick}
									variant="destructive"
									size="sm"
									className="mt-3 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
								>
									<Trash2 className="w-3 h-3" />
									{t("zoom.delete", "Delete Zoom")}
								</Button>
							</div>
						)}

						{trimEnabled && (
							<div className="mb-4 pb-4">
								<Button
									onClick={handleTrimDeleteClick}
									variant="destructive"
									size="sm"
									className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
								>
									<Trash2 className="w-3 h-3" />
									{t("trim.delete", "Delete Trim Region")}
								</Button>
							</div>
						)}

						{selectedSpeedId && (
							<div className="mb-4 pb-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-sm font-medium text-slate-200">
										{t("speed.title", "Speed Settings")}
									</span>
									{selectedSpeedValue && (
										<span className="text-[10px] uppercase tracking-wider font-medium text-[#d97706] bg-[#d97706]/10 px-2 py-0.5 rounded-full">
											{SPEED_OPTIONS.find((o) => o.speed === selectedSpeedValue)?.label ??
												`${selectedSpeedValue}×`}
										</span>
									)}
								</div>
								<div className="grid grid-cols-7 gap-1.5 mb-3">
									{SPEED_OPTIONS.map((option) => {
										const isActive = selectedSpeedValue === option.speed;
										return (
											<Button
												key={option.speed}
												type="button"
												onClick={() => onSpeedChange?.(option.speed)}
												className={cn(
													flatOptionButtonClass,
													isActive
														? "border-[#d97706] text-white"
														: "border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200",
												)}
											>
												<span className="text-xs font-semibold">{option.label}</span>
											</Button>
										);
									})}
								</div>
								<Button
									onClick={() => selectedSpeedId && onSpeedDelete?.(selectedSpeedId)}
									variant="destructive"
									size="sm"
									className="mt-3 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
								>
									<Trash2 className="w-3 h-3" />
									{t("speed.delete", "Delete Speed Region")}
								</Button>
							</div>
						)}

						<div
							role="tabpanel"
							id={`settings-panel-${activeTabDefinition.id}`}
							aria-labelledby={`settings-tab-${activeTabDefinition.id}`}
							className="pt-3"
						>
							<div className="mb-4">
								<div className="flex items-center gap-2">
									<ActiveTabIcon className="h-4 w-4 text-[#09cf67]" />
									<h3 className="text-sm font-medium text-slate-200">
										{activeTabDefinition.label}
									</h3>
								</div>
								<p className="mt-1 text-[10px] text-slate-500">{activeTabDefinition.description}</p>
							</div>
							{renderSelectedTabContent()}
						</div>
					</div>
				</div>
			</div>
			{showCropModal && cropRegion && onCropChange && (
				<>
					<div
						className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
						onClick={handleCropCancel}
					/>
					<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-5xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200">
						<div className="flex items-center justify-between mb-6">
							<div>
								<span className="text-xl font-bold text-slate-200">
									{t("crop.title", "Crop Video")}
								</span>
								<p className="text-sm text-slate-400 mt-2">
									{t("crop.description", "Drag on each side to adjust the crop area")}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCropCancel}
								className="hover:bg-white/10 text-slate-400 hover:text-white"
							>
								<X className="w-5 h-5" />
							</Button>
						</div>
						<CropControl
							videoElement={videoElement || null}
							cropRegion={cropRegion}
							onCropChange={onCropChange}
							aspectRatio={aspectRatio}
						/>
						<div className="mt-6 flex justify-end">
							<Button
								onClick={() => setShowCropModal(false)}
								size="lg"
								className="bg-[#09cf67] hover:bg-[#09cf67]/90 text-white"
							>
								{t("crop.done", "Done")}
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

export const SettingsPanel = memo(SettingsPanelInner);
