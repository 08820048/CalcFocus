import Block from "@uiw/react-color-block";
import { ArrowLeft, Check, ClipboardCopy, Download, Palette } from "lucide-react";
import type { CSSProperties, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScopedT } from "@/contexts/I18nContext";
import { getSuggestedExportFileName } from "@/lib/exportFileName";
import {
	type BuiltInWallpaper,
	getAvailableWallpapers,
	isVideoWallpaperSource,
} from "@/lib/wallpapers";
import { getAssetPath, getWallpaperThumbnailUrl } from "../../lib/assetPath";

const GRADIENTS = [
	"linear-gradient(135deg, #4bbd7e 0%, #2ecdb2 100%)",
	"linear-gradient(135deg, #101114 0%, #1f2937 100%)",
	"linear-gradient(135deg, #fb7185 0%, #f97316 100%)",
	"linear-gradient(135deg, #38bdf8 0%, #14b8a6 100%)",
	"linear-gradient(135deg, #facc15 0%, #4bbd7e 100%)",
	"linear-gradient(135deg, #0f172a 0%, #334155 100%)",
	"linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
	"linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
];

const COLOR_PALETTE = [
	"#09090b",
	"#101114",
	"#4bbd7e",
	"#2ecdb2",
	"#2563eb",
	"#f97316",
	"#ef4444",
	"#facc15",
	"#ffffff",
	"#d4d4d8",
	"#52525b",
	"#000000",
];

type BackgroundType = "wallpaper" | "gradient" | "color" | "transparent";
type WallpaperOption = BuiltInWallpaper & { assetUrl: string; previewUrl: string };

function toArrayBuffer(bytes: Uint8Array | ArrayBuffer) {
	if (bytes instanceof ArrayBuffer) {
		return bytes;
	}

	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function loadImageElement(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		image.src = src;
	});
}

function createCheckerboardBackground() {
	return {
		backgroundImage:
			"linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.08) 75%)",
		backgroundSize: "20px 20px",
		backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
		backgroundColor: "#09090b",
	} satisfies CSSProperties;
}

export default function ImageEditor() {
	const t = useScopedT("image");
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [imageNaturalWidth, setImageNaturalWidth] = useState(0);
	const [imageNaturalHeight, setImageNaturalHeight] = useState(0);
	const [backgroundType, setBackgroundType] = useState<BackgroundType>("wallpaper");
	const [wallpaperOptions, setWallpaperOptions] = useState<WallpaperOption[]>([]);
	const [wallpaper, setWallpaper] = useState<string>("");
	const [gradient, setGradient] = useState(GRADIENTS[0]);
	const [solidColor, setSolidColor] = useState("#101114");
	const [padding, setPadding] = useState(48);
	const [borderRadius, setBorderRadius] = useState(16);
	const [shadowIntensity, setShadowIntensity] = useState(0.6);
	const [exporting, setExporting] = useState(false);
	const imageRef = useRef<HTMLImageElement | null>(null);
	const screenshotObjectUrlRef = useRef<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadScreenshot = async () => {
			try {
				const screenshotResult = await window.electronAPI.getCurrentScreenshotPath();
				if (!screenshotResult.success || !screenshotResult.path) {
					return;
				}

				const fileResult = await window.electronAPI.readLocalFile(screenshotResult.path);
				if (!fileResult.success || !fileResult.data || cancelled) {
					return;
				}

				const nextObjectUrl = URL.createObjectURL(
					new Blob([toArrayBuffer(fileResult.data)], { type: "image/png" }),
				);

				if (screenshotObjectUrlRef.current) {
					URL.revokeObjectURL(screenshotObjectUrlRef.current);
				}

				screenshotObjectUrlRef.current = nextObjectUrl;
				setImageSrc(nextObjectUrl);
			} catch (error) {
				console.error("Failed to load screenshot:", error);
			}
		};

		void loadScreenshot();

		return () => {
			cancelled = true;
			if (screenshotObjectUrlRef.current) {
				URL.revokeObjectURL(screenshotObjectUrlRef.current);
				screenshotObjectUrlRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadWallpapers = async () => {
			try {
				const availableWallpapers = (await getAvailableWallpapers()).filter(
					(entry) => !isVideoWallpaperSource(entry.publicPath),
				);
				const resolvedOptions = await Promise.all(
					availableWallpapers.map(async (entry) => ({
						...entry,
						assetUrl: await getAssetPath(entry.relativePath),
						previewUrl: await getWallpaperThumbnailUrl(entry.publicPath),
					})),
				);

				if (cancelled) {
					return;
				}

				setWallpaperOptions(resolvedOptions);
				setWallpaper((currentWallpaper) => {
					if (currentWallpaper && resolvedOptions.some((entry) => entry.assetUrl === currentWallpaper)) {
						return currentWallpaper;
					}

					return resolvedOptions[0]?.assetUrl ?? "";
				});
			} catch (error) {
				console.error("Failed to load wallpapers:", error);
			}
		};

		void loadWallpapers();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
		const image = event.currentTarget;
		imageRef.current = image;
		setImageNaturalWidth(image.naturalWidth);
		setImageNaturalHeight(image.naturalHeight);
	}, []);

	const previewBackgroundStyle = useMemo((): CSSProperties => {
		switch (backgroundType) {
			case "wallpaper":
				return wallpaper
					? {
							backgroundImage: `url(${wallpaper})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
						}
					: createCheckerboardBackground();
			case "gradient":
				return { background: gradient };
			case "color":
				return { backgroundColor: solidColor };
			case "transparent":
				return createCheckerboardBackground();
		}
	}, [backgroundType, gradient, solidColor, wallpaper]);

	const renderToCanvas = useCallback(async () => {
		const image = imageRef.current;
		if (!image || !imageNaturalWidth || !imageNaturalHeight) {
			return null;
		}

		const totalWidth = imageNaturalWidth + padding * 2;
		const totalHeight = imageNaturalHeight + padding * 2;
		const canvas = document.createElement("canvas");
		canvas.width = totalWidth;
		canvas.height = totalHeight;
		const context = canvas.getContext("2d");
		if (!context) {
			return null;
		}

		if (backgroundType === "wallpaper" && wallpaper) {
			const backgroundImage = await loadImageElement(wallpaper);
			const backgroundAspect = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
			const canvasAspect = totalWidth / totalHeight;
			let sx = 0;
			let sy = 0;
			let sw = backgroundImage.naturalWidth;
			let sh = backgroundImage.naturalHeight;

			if (backgroundAspect > canvasAspect) {
				sw = backgroundImage.naturalHeight * canvasAspect;
				sx = (backgroundImage.naturalWidth - sw) / 2;
			} else {
				sh = backgroundImage.naturalWidth / canvasAspect;
				sy = (backgroundImage.naturalHeight - sh) / 2;
			}

			context.drawImage(backgroundImage, sx, sy, sw, sh, 0, 0, totalWidth, totalHeight);
		} else if (backgroundType === "gradient") {
			const colors =
				gradient.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g) ?? ["#4bbd7e", "#2ecdb2"];
			const gradientFill = context.createLinearGradient(0, 0, totalWidth, totalHeight);
			colors.forEach((color, index) => {
				gradientFill.addColorStop(index / Math.max(colors.length - 1, 1), color);
			});
			context.fillStyle = gradientFill;
			context.fillRect(0, 0, totalWidth, totalHeight);
		} else if (backgroundType === "color") {
			context.fillStyle = solidColor;
			context.fillRect(0, 0, totalWidth, totalHeight);
		}

		if (shadowIntensity > 0) {
			context.save();
			context.shadowColor = `rgba(0, 0, 0, ${(0.45 * shadowIntensity).toFixed(2)})`;
			context.shadowBlur = 40 * shadowIntensity;
			context.shadowOffsetX = 0;
			context.shadowOffsetY = 12 * shadowIntensity;

			const x = padding;
			const y = padding;
			const width = imageNaturalWidth;
			const height = imageNaturalHeight;
			const radius = borderRadius;

			context.beginPath();
			context.moveTo(x + radius, y);
			context.lineTo(x + width - radius, y);
			context.quadraticCurveTo(x + width, y, x + width, y + radius);
			context.lineTo(x + width, y + height - radius);
			context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
			context.lineTo(x + radius, y + height);
			context.quadraticCurveTo(x, y + height, x, y + height - radius);
			context.lineTo(x, y + radius);
			context.quadraticCurveTo(x, y, x + radius, y);
			context.closePath();
			context.fillStyle = "rgba(0, 0, 0, 0.01)";
			context.fill();
			context.restore();
		}

		context.save();
		const x = padding;
		const y = padding;
		const width = imageNaturalWidth;
		const height = imageNaturalHeight;
		const radius = borderRadius;

		context.beginPath();
		context.moveTo(x + radius, y);
		context.lineTo(x + width - radius, y);
		context.quadraticCurveTo(x + width, y, x + width, y + radius);
		context.lineTo(x + width, y + height - radius);
		context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		context.lineTo(x + radius, y + height);
		context.quadraticCurveTo(x, y + height, x, y + height - radius);
		context.lineTo(x, y + radius);
		context.quadraticCurveTo(x, y, x + radius, y);
		context.closePath();
		context.clip();
		context.drawImage(image, x, y, width, height);
		context.restore();

		return canvas;
	}, [
		backgroundType,
		borderRadius,
		gradient,
		imageNaturalHeight,
		imageNaturalWidth,
		padding,
		shadowIntensity,
		solidColor,
		wallpaper,
	]);

	const handleSave = useCallback(async () => {
		setExporting(true);

		try {
			const canvas = await renderToCanvas();
			const blob = await new Promise<Blob | null>((resolve) => canvas?.toBlob(resolve, "image/png"));
			if (!blob) {
				toast.error(t("toasts.renderFailed", "Failed to render image"));
				return;
			}

			const result = await window.electronAPI.saveScreenshotFile(
				await blob.arrayBuffer(),
				getSuggestedExportFileName("screenshot", "png"),
			);

			if (result.success && result.path) {
				toast.success(t("toasts.saved", "Screenshot saved!"), { description: result.path });
				return;
			}

			if (!result.canceled) {
				toast.error(t("toasts.saveFailed", "Failed to save screenshot"));
			}
		} catch (error) {
			console.error("Save screenshot failed:", error);
			toast.error(t("toasts.saveFailed", "Failed to save screenshot"));
		} finally {
			setExporting(false);
		}
	}, [renderToCanvas, t]);

	const handleCopy = useCallback(async () => {
		try {
			const canvas = await renderToCanvas();
			if (!canvas) {
				toast.error(t("toasts.renderFailed", "Failed to render image"));
				return;
			}

			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
			if (!blob) {
				toast.error(t("toasts.renderFailed", "Failed to render image"));
				return;
			}

			const nativeCopyResult = await window.electronAPI.copyImageToClipboard(await blob.arrayBuffer());
			if (!nativeCopyResult.success) {
				if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
					throw new Error(nativeCopyResult.error ?? "Clipboard write failed");
				}

				await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
			}

			toast.success(t("toasts.copied", "Copied to clipboard!"));
		} catch (error) {
			console.error("Copy screenshot failed:", error);
			toast.error(t("toasts.copyFailed", "Failed to copy to clipboard"));
		}
	}, [renderToCanvas, t]);

	const handleBackToCapture = useCallback(async () => {
		await window.electronAPI.switchToHudOverlay();
	}, []);

	const shadowStyle =
		shadowIntensity > 0
			? `0 ${Math.round(12 * shadowIntensity)}px ${Math.round(36 * shadowIntensity)}px rgba(0, 0, 0, ${(0.45 * shadowIntensity).toFixed(2)})`
			: "none";

	return (
		<div className="flex h-screen overflow-hidden bg-[#09090b] text-white">
			<Toaster />

			<div className="flex flex-1 items-center justify-center overflow-auto p-8">
				{imageSrc ? (
					<div
						className="relative flex max-h-[88vh] max-w-[92%] items-center justify-center overflow-hidden rounded-[16px]"
						style={{
							...previewBackgroundStyle,
							padding: `${padding}px`,
						}}
					>
						<img
							src={imageSrc}
							alt={t("preview.alt", "Screenshot")}
							onLoad={handleImageLoad}
							className="block max-h-[72vh] max-w-full object-contain"
							style={{
								borderRadius: `${borderRadius}px`,
								boxShadow: shadowStyle,
							}}
						/>
					</div>
				) : (
					<div className="flex flex-col items-center gap-4 text-white/45">
						<Palette size={44} strokeWidth={1.5} />
						<p className="text-sm">{t("empty.title", "No screenshot loaded")}</p>
						<Button
							type="button"
							variant="outline"
							onClick={() => void handleBackToCapture()}
							className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
						>
							<ArrowLeft size={14} />
							{t("actions.backToCapture", "Back to Capture")}
						</Button>
					</div>
				)}
			</div>

			<div className="flex w-[320px] flex-col border-l border-white/10 bg-[#09090b]">
				<div className="flex-1 space-y-5 overflow-y-auto p-4 pt-8">
					<div>
						<h2 className="text-sm font-semibold text-white/95">
							{t("header.title", "Screenshot Settings")}
						</h2>
						<p className="mt-1 text-[11px] text-white/45">
							{t("header.description", "Customize background, padding, radius, and shadow.")}
						</p>
					</div>

					<div>
						<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
							{t("background.label", "Background")}
						</div>
						<Tabs
							value={backgroundType}
							onValueChange={(value) => setBackgroundType(value as BackgroundType)}
						>
							<TabsList className="grid h-8 grid-cols-4 rounded-lg bg-white/5 p-1">
								<TabsTrigger
									value="wallpaper"
									className="rounded-md py-1 text-[10px] text-white/65 data-[state=active]:bg-[#4bbd7e] data-[state=active]:text-[#09090b]"
								>
									{t("background.image", "Image")}
								</TabsTrigger>
								<TabsTrigger
									value="gradient"
									className="rounded-md py-1 text-[10px] text-white/65 data-[state=active]:bg-[#4bbd7e] data-[state=active]:text-[#09090b]"
								>
									{t("background.gradient", "Gradient")}
								</TabsTrigger>
								<TabsTrigger
									value="color"
									className="rounded-md py-1 text-[10px] text-white/65 data-[state=active]:bg-[#4bbd7e] data-[state=active]:text-[#09090b]"
								>
									{t("background.color", "Color")}
								</TabsTrigger>
								<TabsTrigger
									value="transparent"
									className="rounded-md py-1 text-[10px] text-white/65 data-[state=active]:bg-[#4bbd7e] data-[state=active]:text-[#09090b]"
								>
									{t("background.none", "None")}
								</TabsTrigger>
							</TabsList>

							<TabsContent value="wallpaper" className="mt-3">
								<div className="grid max-h-[220px] grid-cols-4 gap-1.5 overflow-y-auto pr-1">
									{wallpaperOptions.map((option, index) => {
										const isSelected = wallpaper === option.assetUrl;
										return (
											<button
												key={option.id}
												type="button"
												aria-label={t("background.wallpaperOption", "Wallpaper {{index}}", {
													index: index + 1,
												})}
												onClick={() => {
													setWallpaper(option.assetUrl);
													setBackgroundType("wallpaper");
												}}
												className={`relative aspect-video overflow-hidden rounded-md border transition-all ${
													isSelected
														? "border-[#4bbd7e] ring-1 ring-[#4bbd7e]/40"
														: "border-white/10 hover:border-white/25"
												}`}
											>
												<img
													src={option.previewUrl}
													alt=""
													className="h-full w-full object-cover"
												/>
												{isSelected ? (
													<div className="absolute inset-0 flex items-center justify-center bg-black/25">
														<Check size={14} className="text-white" />
													</div>
												) : null}
											</button>
										);
									})}
								</div>
							</TabsContent>

							<TabsContent value="gradient" className="mt-3">
								<div className="grid grid-cols-4 gap-1.5">
									{GRADIENTS.map((gradientValue, index) => {
										const isSelected = backgroundType === "gradient" && gradient === gradientValue;
										return (
											<button
												key={gradientValue}
												type="button"
												aria-label={t("background.gradientOption", "Gradient {{index}}", {
													index: index + 1,
												})}
												onClick={() => {
													setGradient(gradientValue);
													setBackgroundType("gradient");
												}}
												className={`aspect-video rounded-md border transition-all ${
													isSelected
														? "border-[#4bbd7e] ring-1 ring-[#4bbd7e]/40"
														: "border-white/10 hover:border-white/25"
												}`}
												style={{ background: gradientValue }}
											/>
										);
									})}
								</div>
							</TabsContent>

							<TabsContent value="color" className="mt-3">
								<Block
									color={solidColor}
									colors={COLOR_PALETTE}
									onChange={(color) => {
										setSolidColor(color.hex);
										setBackgroundType("color");
									}}
								/>
							</TabsContent>

							<TabsContent value="transparent" className="mt-3">
								<p className="text-[11px] leading-5 text-white/45">
									{t(
										"background.transparentDescription",
										"No background will be applied. Export as PNG to preserve transparency.",
									)}
								</p>
							</TabsContent>
						</Tabs>
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
								{t("controls.padding", "Padding")}
							</span>
							<span className="text-[10px] font-mono text-white/45">{padding}px</span>
						</div>
						<Slider value={[padding]} min={0} max={160} step={1} onValueChange={([value]) => setPadding(value)} />
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
								{t("controls.borderRadius", "Border Radius")}
							</span>
							<span className="text-[10px] font-mono text-white/45">{borderRadius}px</span>
						</div>
						<Slider
							value={[borderRadius]}
							min={0}
							max={64}
							step={1}
							onValueChange={([value]) => setBorderRadius(value)}
						/>
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
								{t("controls.shadow", "Shadow")}
							</span>
							<span className="text-[10px] font-mono text-white/45">
								{Math.round(shadowIntensity * 100)}%
							</span>
						</div>
						<Slider
							value={[shadowIntensity]}
							min={0}
							max={1}
							step={0.01}
							onValueChange={([value]) => setShadowIntensity(value)}
						/>
					</div>
				</div>

				<div className="space-y-2 border-t border-white/10 p-4">
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							onClick={() => void handleSave()}
							disabled={!imageSrc || exporting}
							className="gap-1.5 bg-[#4bbd7e] text-[#09090b] hover:bg-[#63d892]"
						>
							<Download size={14} />
							{exporting ? t("actions.saving", "Saving...") : t("actions.savePng", "Save PNG")}
						</Button>
						<Button
							type="button"
							onClick={() => void handleCopy()}
							disabled={!imageSrc}
							variant="outline"
							className="gap-1.5 border-white/10 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white"
						>
							<ClipboardCopy size={14} />
							{t("actions.copy", "Copy")}
						</Button>
					</div>
					<Button
						type="button"
						variant="ghost"
						onClick={() => void handleBackToCapture()}
						className="w-full gap-2 text-white/55 hover:bg-white/5 hover:text-white"
					>
						<ArrowLeft size={14} />
						{t("actions.backToCapture", "Back to Capture")}
					</Button>
				</div>
			</div>
		</div>
	);
}
