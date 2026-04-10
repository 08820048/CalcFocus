import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	addCustomFont,
	type CustomFont,
	generateFontId,
	isValidGoogleFontsUrl,
	parseFontFamilyFromImport,
} from "@/lib/customFonts";

interface AddCustomFontDialogProps {
	onFontAdded?: (font: CustomFont) => void;
}

export function AddCustomFontDialog({ onFontAdded }: AddCustomFontDialogProps) {
	const t = useScopedT("dialogs");
	const [open, setOpen] = useState(false);
	const [importUrl, setImportUrl] = useState("");
	const [fontName, setFontName] = useState("");
	const [loading, setLoading] = useState(false);

	const handleImportUrlChange = (url: string) => {
		setImportUrl(url);

		// Auto-extract font name if valid Google Fonts URL
		if (isValidGoogleFontsUrl(url)) {
			const extracted = parseFontFamilyFromImport(url);
			if (extracted && !fontName) {
				setFontName(extracted);
			}
		}
	};

	const handleAdd = async () => {
		// Validate inputs
		if (!importUrl.trim()) {
			toast.error(t("font.enterImportUrl", "Please enter a Google Fonts import URL"));
			return;
		}

		if (!isValidGoogleFontsUrl(importUrl)) {
			toast.error(t("font.validGoogleUrl", "Please enter a valid Google Fonts URL"));
			return;
		}

		if (!fontName.trim()) {
			toast.error(t("font.enterName", "Please enter a font name"));
			return;
		}

		setLoading(true);

		try {
			// Extract font family from URL
			const fontFamily = parseFontFamilyFromImport(importUrl);
			if (!fontFamily) {
				toast.error(t("font.extractFailed", "Could not extract font family from URL"));
				setLoading(false);
				return;
			}

			// Create custom font object
			const newFont: CustomFont = {
				id: generateFontId(fontName),
				name: fontName.trim(),
				fontFamily: fontFamily,
				importUrl: importUrl.trim(),
			};

			// Add font (this will load and verify it) - throws if it fails
			await addCustomFont(newFont);

			// Notify parent
			if (onFontAdded) {
				onFontAdded(newFont);
			}

			toast.success(
				t('font.added', 'Font "{{name}}" added successfully', { name: fontName }),
			);

			// Reset and close
			setImportUrl("");
			setFontName("");
			setOpen(false);
		} catch (error) {
			console.error("Failed to add custom font:", error);
			const errorMessage = error instanceof Error ? error.message : t("font.loadFailed", "Failed to load font");
			toast.error(t("font.addFailed", "Failed to add font"), {
				description: errorMessage.includes("timeout")
					? t(
							"font.timeout",
							"Font took too long to load. Please check the URL and try again.",
						)
					: t(
							"font.verifyUrl",
							"The font could not be loaded. Please verify the Google Fonts URL is correct.",
						),
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="w-full bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 h-9 text-xs"
				>
					<Plus className="w-3 h-3 mr-1" />
					{t("font.addGoogle", "Add Google Font")}
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-[#1a1a1c] border-white/10 text-slate-200">
				<DialogHeader>
					<DialogTitle>{t("font.addGoogle", "Add Google Font")}</DialogTitle>
					<DialogDescription className="text-slate-400">
						{t(
							"font.description",
							"Add a custom font from Google Fonts to use in your annotations.",
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 mt-4">
					<div className="space-y-2">
						<Label htmlFor="import-url" className="text-slate-200">
							{t("font.importUrlLabel", "Google Fonts Import URL")}
						</Label>
						<Input
							id="import-url"
							placeholder="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
							value={importUrl}
							onChange={(e) => handleImportUrlChange(e.target.value)}
							className="bg-white/5 border-white/10 text-slate-200"
						/>
						<p className="text-xs text-slate-400">
							{t(
								"font.importUrlHelp",
								'Get this from Google Fonts: Select a font -> Click "Get font" -> Copy the @import URL',
							)}
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="font-name" className="text-slate-200">
							{t("font.displayNameLabel", "Display Name")}
						</Label>
						<Input
							id="font-name"
							placeholder={t("font.displayNamePlaceholder", "My Custom Font")}
							value={fontName}
							onChange={(e) => setFontName(e.target.value)}
							className="bg-white/5 border-white/10 text-slate-200"
						/>
						<p className="text-xs text-slate-400">
							{t(
								"font.displayNameHelp",
								"This is how the font will appear in the font selector",
							)}
						</p>
					</div>

					<div className="flex justify-end gap-2 mt-6">
						<Button
							variant="outline"
							onClick={() => setOpen(false)}
							className="bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
						>
							{t("common.cancel", "Cancel")}
						</Button>
						<Button
							onClick={handleAdd}
							disabled={loading}
							className="bg-[#09cf67] hover:bg-[#08b85c] text-white"
						>
							{loading
								? t("font.adding", "Adding...")
								: t("font.addButton", "Add Font")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
