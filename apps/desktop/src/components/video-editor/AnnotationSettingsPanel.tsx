import Block from "@uiw/react-color-block";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	ChevronDown,
	Image as ImageIcon,
	Info,
	Italic,
	Trash2,
	Type,
	Underline,
	Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useScopedT } from "@/contexts/I18nContext";
import { type CustomFont, getCustomFonts } from "@/lib/customFonts";
import { cn } from "@/lib/utils";
import { AddCustomFontDialog } from "./AddCustomFontDialog";
import { getArrowComponent } from "./ArrowSvgs";
import type { AnnotationRegion, AnnotationType, ArrowDirection, FigureData } from "./types";

interface AnnotationSettingsPanelProps {
	annotation: AnnotationRegion;
	onContentChange: (content: string) => void;
	onTypeChange: (type: AnnotationType) => void;
	onStyleChange: (style: Partial<AnnotationRegion["style"]>) => void;
	onFigureDataChange?: (figureData: FigureData) => void;
	onDelete: () => void;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];
const flatTabsListClass = "mb-4 w-full grid grid-cols-3 h-auto rounded-none bg-transparent p-0";
const flatTabsTriggerClass =
	"gap-2 rounded-none border-b-2 border-transparent py-2 text-slate-400 transition-colors data-[state=active]:border-[#09cf67] data-[state=active]:bg-transparent data-[state=active]:text-white";
const flatInputClass =
	"w-full rounded-none border-x-0 border-t-0 border-white/10 bg-transparent px-0 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-[#09cf67] resize-none";
const flatSelectTriggerClass =
	"w-full h-9 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent text-xs text-slate-200 shadow-none";
const flatToggleGroupClass = "justify-start rounded-none bg-transparent p-0";
const flatToggleItemClass =
	"h-8 w-8 rounded-none border-b-2 border-transparent text-slate-400 hover:bg-transparent hover:text-slate-200 data-[state=on]:border-[#09cf67] data-[state=on]:bg-transparent data-[state=on]:text-[#09cf67]";
const flatOutlineButtonClass =
	"w-full justify-start gap-2 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent px-2 shadow-none hover:bg-transparent hover:border-white/20";

export function AnnotationSettingsPanel({
	annotation,
	onContentChange,
	onTypeChange,
	onStyleChange,
	onFigureDataChange,
	onDelete,
}: AnnotationSettingsPanelProps) {
	console.log("render <AnnotationSettingsPanel>");
	const t = useScopedT("settings");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
	const fontFamilies = [
		{
			value: "system-ui, -apple-system, sans-serif",
			label: t("annotation.fonts.classic", "Classic"),
		},
		{ value: "Georgia, serif", label: t("annotation.fonts.editor", "Editor") },
		{ value: "Impact, Arial Black, sans-serif", label: t("annotation.fonts.strong", "Strong") },
		{
			value: "Courier New, monospace",
			label: t("annotation.fonts.typewriter", "Typewriter"),
		},
		{ value: "Brush Script MT, cursive", label: t("annotation.fonts.deco", "Deco") },
		{ value: "Arial, sans-serif", label: t("annotation.fonts.simple", "Simple") },
		{ value: "Verdana, sans-serif", label: t("annotation.fonts.modern", "Modern") },
		{ value: "Trebuchet MS, sans-serif", label: t("annotation.fonts.clean", "Clean") },
	];

	// Load custom fonts on mount
	useEffect(() => {
		setCustomFonts(getCustomFonts());
	}, []);

	const colorPalette = [
		"#FF0000", // Red
		"#FFD700", // Yellow/Gold
		"#00FF00", // Green
		"#FFFFFF", // White
		"#0000FF", // Blue
		"#FF6B00", // Orange
		"#9B59B6", // Purple
		"#E91E63", // Pink
		"#00BCD4", // Cyan
		"#FF5722", // Deep Orange
		"#8BC34A", // Light Green
		"#FFC107", // Amber
		"#09cf67", // Brand Green
		"#000000", // Black
		"#607D8B", // Blue Grey
		"#795548", // Brown
	];

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type
		const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
		if (!validTypes.includes(file.type)) {
			toast.error(t("annotation.invalidFileType", "Invalid file type"), {
				description: t(
					"annotation.invalidFileDescription",
					"Please upload a JPG, PNG, GIF, or WebP image file.",
				),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				onContentChange(dataUrl);
				toast.success(t("annotation.imageUploaded", "Image uploaded successfully!"));
			}
		};

		reader.onerror = () => {
			toast.error(t("annotation.uploadFailed", "Failed to upload image"), {
				description: t(
					"annotation.uploadFailedDescription",
					"There was an error reading the file.",
				),
			});
		};

		reader.readAsDataURL(file);
		event.target.value = "";
	};

	return (
		<div className="h-full w-full min-w-0 overflow-y-auto bg-[#09090b] p-4 custom-scrollbar">
			<div className="mb-6">
				<div className="flex items-center justify-between mb-4">
					<span className="text-sm font-medium text-slate-200">
						{t("annotation.title", "Annotation Settings")}
					</span>
					<span className="text-[10px] uppercase tracking-wider font-medium text-[#09cf67] bg-[#09cf67]/10 px-2 py-1 rounded-full">
						{t("annotation.active", "Active")}
					</span>
				</div>

				{/* Type Selector */}
				<Tabs
					value={annotation.type}
					onValueChange={(value) => onTypeChange(value as AnnotationType)}
					className="mb-6"
				>
					<TabsList className={flatTabsListClass}>
						<TabsTrigger value="text" className={flatTabsTriggerClass}>
							<Type className="w-4 h-4" />
							{t("annotation.types.text", "Text")}
						</TabsTrigger>
						<TabsTrigger value="image" className={flatTabsTriggerClass}>
							<ImageIcon className="w-4 h-4" />
							{t("annotation.types.image", "Image")}
						</TabsTrigger>
						<TabsTrigger value="figure" className={flatTabsTriggerClass}>
							<svg
								className="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
							{t("annotation.types.arrow", "Arrow")}
						</TabsTrigger>
					</TabsList>

					{/* Text Content */}
					<TabsContent value="text" className="mt-0 space-y-4">
						<div>
							<label className="text-xs font-medium text-slate-200 mb-2 block">
								{t("annotation.textContent", "Text Content")}
							</label>
							<textarea
								value={annotation.textContent || annotation.content}
								onChange={(e) => onContentChange(e.target.value)}
								placeholder={t("annotation.enterText", "Enter your text...")}
								rows={5}
								className={flatInputClass}
							/>
						</div>

						{/* Styling Controls */}
						<div className="space-y-4">
							{/* Font Family & Size */}
							<div className="grid grid-cols-2 gap-2">
								<div>
									<label className="text-xs font-medium text-slate-200 mb-2 block">
										{t("annotation.fontStyle", "Font Style")}
									</label>
									<Select
										value={annotation.style.fontFamily}
										onValueChange={(value) => onStyleChange({ fontFamily: value })}
									>
										<SelectTrigger className={flatSelectTriggerClass}>
											<SelectValue placeholder={t("annotation.selectStyle", "Select style")} />
										</SelectTrigger>
										<SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200 max-h-[300px]">
											{fontFamilies.map((font) => (
												<SelectItem
													key={font.value}
													value={font.value}
													style={{ fontFamily: font.value }}
												>
													{font.label}
												</SelectItem>
											))}
											{customFonts.length > 0 && (
												<>
													<div className="px-2 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
														{t("annotation.customFonts", "Custom Fonts")}
													</div>
													{customFonts.map((font) => (
														<SelectItem
															key={font.id}
															value={font.fontFamily}
															style={{ fontFamily: font.fontFamily }}
														>
															{font.name}
														</SelectItem>
													))}
												</>
											)}
										</SelectContent>
									</Select>
								</div>
								<div>
									<label className="text-xs font-medium text-slate-200 mb-2 block">
										{t("annotation.size", "Size")}
									</label>
									<Select
										value={annotation.style.fontSize.toString()}
										onValueChange={(value) => onStyleChange({ fontSize: parseInt(value) })}
									>
										<SelectTrigger className={flatSelectTriggerClass}>
											<SelectValue placeholder={t("annotation.size", "Size")} />
										</SelectTrigger>
										<SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200 max-h-[200px]">
											{FONT_SIZES.map((size) => (
												<SelectItem key={size} value={size.toString()}>
													{size}px
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Add Custom Font Button */}
							<div>
								<AddCustomFontDialog
									onFontAdded={(font) => {
										setCustomFonts(getCustomFonts());
										onStyleChange({ fontFamily: font.fontFamily });
									}}
								/>
							</div>

							{/* Formatting Toggles */}
							<div className="flex items-center justify-between gap-2">
								<ToggleGroup type="multiple" className={flatToggleGroupClass}>
									<ToggleGroupItem
										value="bold"
										aria-label={t("annotation.toggleBold", "Toggle bold")}
										data-state={annotation.style.fontWeight === "bold" ? "on" : "off"}
										onClick={() =>
											onStyleChange({
												fontWeight: annotation.style.fontWeight === "bold" ? "normal" : "bold",
											})
										}
										className={flatToggleItemClass}
									>
										<Bold className="h-4 w-4" />
									</ToggleGroupItem>
									<ToggleGroupItem
										value="italic"
										aria-label={t("annotation.toggleItalic", "Toggle italic")}
										data-state={annotation.style.fontStyle === "italic" ? "on" : "off"}
										onClick={() =>
											onStyleChange({
												fontStyle: annotation.style.fontStyle === "italic" ? "normal" : "italic",
											})
										}
										className={flatToggleItemClass}
									>
										<Italic className="h-4 w-4" />
									</ToggleGroupItem>
									<ToggleGroupItem
										value="underline"
										aria-label={t("annotation.toggleUnderline", "Toggle underline")}
										data-state={annotation.style.textDecoration === "underline" ? "on" : "off"}
										onClick={() =>
											onStyleChange({
												textDecoration:
													annotation.style.textDecoration === "underline" ? "none" : "underline",
											})
										}
										className={flatToggleItemClass}
									>
										<Underline className="h-4 w-4" />
									</ToggleGroupItem>
								</ToggleGroup>

								<ToggleGroup
									type="single"
									value={annotation.style.textAlign}
									className={flatToggleGroupClass}
								>
									<ToggleGroupItem
										value="left"
										aria-label={t("annotation.alignLeft", "Align left")}
										onClick={() => onStyleChange({ textAlign: "left" })}
										className={flatToggleItemClass}
									>
										<AlignLeft className="h-4 w-4" />
									</ToggleGroupItem>
									<ToggleGroupItem
										value="center"
										aria-label={t("annotation.alignCenter", "Align center")}
										onClick={() => onStyleChange({ textAlign: "center" })}
										className={flatToggleItemClass}
									>
										<AlignCenter className="h-4 w-4" />
									</ToggleGroupItem>
									<ToggleGroupItem
										value="right"
										aria-label={t("annotation.alignRight", "Align right")}
										onClick={() => onStyleChange({ textAlign: "right" })}
										className={flatToggleItemClass}
									>
										<AlignRight className="h-4 w-4" />
									</ToggleGroupItem>
								</ToggleGroup>
							</div>

							{/* Colors */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-medium text-slate-200 mb-2 block">
										{t("annotation.textColor", "Text Color")}
									</label>
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="outline" className={cn(flatOutlineButtonClass, "h-9")}>
												<div
													className="w-4 h-4 rounded-full border border-white/20"
													style={{ backgroundColor: annotation.style.color }}
												/>
												<span className="text-xs text-slate-300 truncate flex-1 text-left">
													{annotation.style.color}
												</span>
												<ChevronDown className="h-3 w-3 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
											<Block
												color={annotation.style.color}
												colors={colorPalette}
												onChange={(color) => {
													onStyleChange({ color: color.hex });
												}}
												style={{
													borderRadius: "0px",
												}}
											/>
										</PopoverContent>
									</Popover>
								</div>
								<div>
									<label className="text-xs font-medium text-slate-200 mb-2 block">
										{t("annotation.background", "Background")}
									</label>
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="outline" className={cn(flatOutlineButtonClass, "h-9")}>
												<div className="w-4 h-4 rounded-full border border-white/20 relative overflow-hidden">
													<div className="absolute inset-0 checkerboard-bg opacity-50" />
													<div
														className="absolute inset-0"
														style={{ backgroundColor: annotation.style.backgroundColor }}
													/>
												</div>
												<span className="text-xs text-slate-300 truncate flex-1 text-left">
													{annotation.style.backgroundColor === "transparent"
														? t("annotation.none", "None")
														: t("annotation.color", "Color")}
												</span>
												<ChevronDown className="h-3 w-3 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
											<Block
												color={
													annotation.style.backgroundColor === "transparent"
														? "#000000"
														: annotation.style.backgroundColor
												}
												colors={colorPalette}
												onChange={(color) => {
													onStyleChange({ backgroundColor: color.hex });
												}}
												style={{
													borderRadius: "0px",
												}}
											/>
											<Button
												variant="ghost"
												size="sm"
												className="mt-2 h-7 w-full rounded-none border-x-0 border-t-0 text-xs text-slate-400 hover:bg-transparent"
												onClick={() => {
													onStyleChange({ backgroundColor: "transparent" });
												}}
											>
												{t("annotation.clearBackground", "Clear Background")}
											</Button>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						</div>
					</TabsContent>

					{/* Image Upload */}
					<TabsContent value="image" className="mt-0 space-y-4">
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleImageUpload}
							accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
							className="hidden"
						/>
						<Button
							onClick={() => fileInputRef.current?.click()}
							variant="outline"
							className="w-full gap-2 rounded-none border-x-0 border-t-0 border-white/10 bg-transparent py-8 text-slate-200 shadow-none transition-all hover:bg-transparent hover:text-white hover:border-[#09cf67]"
						>
							<Upload className="w-5 h-5" />
							{t("annotation.uploadImage", "Upload Image")}
						</Button>

						{annotation.content && annotation.content.startsWith("data:image") && (
							<div className="border-b border-white/10 overflow-hidden pb-2">
								<img src={annotation.content} alt="Uploaded annotation" className="h-auto w-full" />
							</div>
						)}

						<p className="text-xs text-slate-500 text-center leading-relaxed">
							{t("annotation.supportedFormats", "Supported formats: JPG, PNG, GIF, WebP")}
						</p>
					</TabsContent>

					<TabsContent value="figure" className="mt-0 space-y-4">
						<div>
							<label className="text-xs font-medium text-slate-200 mb-3 block">
								{t("annotation.arrowDirection", "Arrow Direction")}
							</label>
							<div className="grid grid-cols-4 gap-2">
								{(
									[
										"up",
										"down",
										"left",
										"right",
										"up-right",
										"up-left",
										"down-right",
										"down-left",
									] as ArrowDirection[]
								).map((direction) => {
									const ArrowComponent = getArrowComponent(direction);
									return (
										<button
											key={direction}
											onClick={() => {
												const newFigureData: FigureData = {
													...annotation.figureData!,
													arrowDirection: direction,
												};
												onFigureDataChange?.(newFigureData);
											}}
											className={cn(
												"h-16 border-x-0 border-t-0 flex items-center justify-center rounded-none border p-2 transition-all",
												annotation.figureData?.arrowDirection === direction
													? "border-[#09cf67]"
													: "border-white/10 bg-transparent hover:border-white/20 hover:bg-transparent",
											)}
										>
											<ArrowComponent
												color={
													annotation.figureData?.arrowDirection === direction
														? "#ffffff"
														: "#94a3b8"
												}
												strokeWidth={3}
											/>
										</button>
									);
								})}
							</div>
						</div>

						<div>
							<label className="text-xs font-medium text-slate-200 mb-2 block">
								{t("annotation.strokeWidth", "Stroke Width")}:{" "}
								{annotation.figureData?.strokeWidth || 4}px
							</label>
							<Slider
								value={[annotation.figureData?.strokeWidth || 4]}
								onValueChange={([value]) => {
									const newFigureData: FigureData = {
										...annotation.figureData!,
										strokeWidth: value,
									};
									onFigureDataChange?.(newFigureData);
								}}
								min={1}
								max={6}
								step={1}
								className="w-full"
							/>
						</div>

						<div>
							<label className="text-xs font-medium text-slate-200 mb-2 block">
								{t("annotation.arrowColor", "Arrow Color")}
							</label>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="outline" className={cn(flatOutlineButtonClass, "h-10")}>
										<div
											className="w-5 h-5 rounded-full border border-white/20"
											style={{ backgroundColor: annotation.figureData?.color || "#09cf67" }}
										/>
										<span className="text-xs text-slate-300 truncate flex-1 text-left">
											{annotation.figureData?.color || "#09cf67"}
										</span>
										<ChevronDown className="h-3 w-3 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
									<Block
										color={annotation.figureData?.color || "#09cf67"}
										colors={colorPalette}
										onChange={(color) => {
											const newFigureData: FigureData = {
												...annotation.figureData!,
												color: color.hex,
											};
											onFigureDataChange?.(newFigureData);
										}}
										style={{
											borderRadius: "0px",
										}}
									/>
								</PopoverContent>
							</Popover>
						</div>
					</TabsContent>
				</Tabs>

				<Button
					onClick={onDelete}
					variant="destructive"
					size="sm"
					className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all mt-4"
				>
					<Trash2 className="w-4 h-4" />
					{t("annotation.delete", "Delete Annotation")}
				</Button>

				<div className="mt-6 pt-3">
					<div className="flex items-center gap-2 mb-2 text-slate-300">
						<Info className="w-3.5 h-3.5" />
						<span className="text-xs font-medium">
							{t("annotation.shortcutsTips", "Shortcuts & Tips")}
						</span>
					</div>
					<ul className="text-[10px] text-slate-400 space-y-1.5 list-disc pl-3 leading-relaxed">
						<li>
							{t(
								"annotation.tip1",
								"Move playhead to overlapping annotation section and select an item.",
							)}
						</li>
						<li>
							{t("annotation.tip2Prefix", "Use")}{" "}
							<kbd className="px-1 py-0.5 bg-white/10 rounded text-slate-300 font-mono">Tab</kbd> to{" "}
							{t("annotation.tip2Suffix", "cycle through overlapping items.")}
						</li>
						<li>
							{t("annotation.tip3Prefix", "Use")}{" "}
							<kbd className="px-1 py-0.5 bg-white/10 rounded text-slate-300 font-mono">
								Shift+Tab
							</kbd>{" "}
							{t("annotation.tip3Suffix", "to cycle backwards.")}
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
