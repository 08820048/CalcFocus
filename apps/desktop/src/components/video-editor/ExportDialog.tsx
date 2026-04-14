import { Download, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";
import { revealInFolder } from "@/lib/backend";
import type { ExportProgress } from "@/lib/exporter";

interface ExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
	progress: ExportProgress | null;
	isExporting: boolean;
	error: string | null;
	onCancel?: () => void;
	onRetrySave?: () => void;
	canRetrySave?: boolean;
	exportFormat?: "mp4" | "gif";
	exportedFilePath?: string;
}

export function ExportDialog({
	isOpen,
	onClose,
	progress,
	isExporting,
	error,
	onCancel,
	onRetrySave,
	canRetrySave = false,
	exportFormat = "mp4",
	exportedFilePath,
}: ExportDialogProps) {
	const t = useScopedT("dialogs");
	const [showSuccess, setShowSuccess] = useState(false);

	// Reset showSuccess when a new export starts or dialog reopens
	useEffect(() => {
		if (isExporting) {
			setShowSuccess(false);
		}
	}, [isExporting]);

	// Reset showSuccess when dialog opens fresh
	useEffect(() => {
		if (isOpen && !isExporting && !progress) {
			setShowSuccess(false);
		}
	}, [isOpen, isExporting, progress]);

	useEffect(() => {
		if (!isExporting && progress && progress.percentage >= 100 && !error) {
			setShowSuccess(true);
			const timer = setTimeout(() => {
				setShowSuccess(false);
				onClose();
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isExporting, progress, error, onClose]);

	if (!isOpen) return null;

	const formatLabel = exportFormat === "gif" ? "GIF" : t("export.videoFormat", "Video");

	const isFinalizing = progress?.phase === "finalizing";
	const phaseProgress = progress?.renderProgress;
	const isGifFinalizing =
		exportFormat === "gif" &&
		Boolean(progress) &&
		(isFinalizing || (isExporting && progress.percentage >= 100));
	const isVideoFinalizing = exportFormat === "mp4" && isFinalizing;
	const isFinalizingExport = isGifFinalizing || isVideoFinalizing;

	// Get status message based on phase
	const getStatusMessage = () => {
		if (error) return t("export.tryAgain", "Please try again");
		if (isGifFinalizing) {
			if (phaseProgress !== undefined && phaseProgress > 0) {
				return t("export.compilingGifProgress", "Compiling GIF... {{progress}}%", {
					progress: phaseProgress,
				});
			}
			return t("export.compilingGifLong", "Compiling GIF... This may take a while");
		}
		if (isVideoFinalizing) {
			if (phaseProgress !== undefined && phaseProgress > 0) {
				return t("export.finalizingVideoProgress", "Finalizing video... {{progress}}%", {
					progress: phaseProgress,
				});
			}
			return t("export.finalizingVideoLong", "Finalizing video... This may take a while");
		}
		return t("export.mayTakeMoment", "This may take a moment...");
	};

	// Get title based on phase
	const getTitle = () => {
		if (error) return t("export.failed", "Export Failed");
		if (isGifFinalizing) return t("export.compilingGif", "Compiling GIF");
		if (isVideoFinalizing) return t("export.finalizingVideo", "Finalizing Video");
		return t("export.exporting", "Exporting {{format}}", { format: formatLabel });
	};

	const handleClickShowInFolder = async () => {
		if (exportedFilePath) {
			try {
				await revealInFolder(exportedFilePath);
			} catch (err) {
				const errorMessage = String(err);
				console.error("Error calling revealInFolder:", errorMessage);
				toast.error(
					t("export.revealError", "Error revealing in folder: {{message}}", {
						message: errorMessage,
					}),
				);
			}
		}
	};

	return (
		<>
			<div
				className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-in fade-in duration-200"
				onClick={isExporting ? undefined : onClose}
			/>
			<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-md animate-in zoom-in-95 duration-200">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-4">
						{showSuccess ? (
							<>
								<div className="w-12 h-12 rounded-full bg-[#09cf67]/20 flex items-center justify-center ring-1 ring-[#09cf67]/50">
									<Download className="w-6 h-6 text-[#09cf67]" />
								</div>
								<div className="flex flex-col gap-2">
									<span className="text-xl font-bold text-slate-200 block">
										{t("export.complete", "Export Complete")}
									</span>
									<span className="text-sm text-slate-400">
										{t("export.ready", "Your {{format}} is ready", {
											format: formatLabel.toLowerCase(),
										})}
									</span>
									{exportedFilePath && (
										<Button
											variant="secondary"
											onClick={handleClickShowInFolder}
											className="mt-2 w-fit px-3 py-1 text-sm rounded-md bg-white/10 hover:bg-white/20 text-slate-200"
										>
											{t("export.showInFolder", "Show in Folder")}
										</Button>
									)}
									{exportedFilePath && (
										<span className="text-xs text-slate-500 break-all max-w-xs mt-1">
											{exportedFilePath.split("/").pop()}
										</span>
									)}
								</div>
							</>
						) : (
							<>
								{isExporting ? (
									<div className="w-12 h-12 rounded-full bg-[#09cf67]/10 flex items-center justify-center">
										<Loader2 className="w-6 h-6 text-[#09cf67] animate-spin" />
									</div>
								) : (
									<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
										<Download className="w-6 h-6 text-slate-200" />
									</div>
								)}
								<div>
									<span className="text-xl font-bold text-slate-200 block">{getTitle()}</span>
									<span className="text-sm text-slate-400">{getStatusMessage()}</span>
								</div>
							</>
						)}
					</div>
					{!isExporting && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
						>
							<X className="w-5 h-5" />
						</Button>
					)}
				</div>

				{error && (
					<div className="mb-6 animate-in slide-in-from-top-2">
						<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
							<div className="p-1 bg-red-500/20 rounded-full">
								<X className="w-3 h-3 text-red-400" />
							</div>
							<p className="text-sm text-red-400 leading-relaxed">{error}</p>
						</div>
						{!isExporting && canRetrySave && onRetrySave && (
							<Button
								onClick={onRetrySave}
								className="w-full mt-3 bg-[#09cf67] text-white hover:bg-[#1D4ED8]"
							>
								{t("export.saveAgain", "Save Again")}
							</Button>
						)}
					</div>
				)}

				{isExporting && progress && (
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
								<span>
									{isGifFinalizing
										? t("export.compiling", "Compiling")
										: isVideoFinalizing
											? t("export.finalizing", "Finalizing")
											: t("export.renderingFrames", "Rendering Frames")}
								</span>
								<span className="font-mono text-slate-200">
									{isFinalizingExport ? (
										phaseProgress !== undefined && phaseProgress > 0 ? (
											`${phaseProgress}%`
										) : (
											<span className="flex items-center gap-2">
												<Loader2 className="w-3 h-3 animate-spin" />
												{t("export.processing", "Processing...")}
											</span>
										)
									) : (
										`${progress.percentage.toFixed(0)}%`
									)}
								</span>
							</div>
							<div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
								{isFinalizingExport ? (
									phaseProgress !== undefined && phaseProgress > 0 ? (
										<div
											className="h-full bg-[#09cf67] shadow-[0_0_10px_rgba(9,207,103,0.3)] transition-all duration-300 ease-out"
											style={{ width: `${phaseProgress}%` }}
										/>
									) : (
										<div className="h-full w-full relative overflow-hidden">
											<div
												className="absolute h-full w-1/3 bg-[#09cf67] shadow-[0_0_10px_rgba(9,207,103,0.3)]"
												style={{
													animation: "indeterminate 1.5s ease-in-out infinite",
												}}
											/>
											<style>{`
                        @keyframes indeterminate {
                          0% { transform: translateX(-100%); }
                          100% { transform: translateX(400%); }
                        }
                      `}</style>
										</div>
									)
								) : (
									<div
										className="h-full bg-[#09cf67] shadow-[0_0_10px_rgba(9,207,103,0.3)] transition-all duration-300 ease-out"
										style={{ width: `${Math.min(progress.percentage, 100)}%` }}
									/>
								)}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white/5 rounded-xl p-3 border border-white/5">
								<div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
									{isFinalizingExport ? t("export.status", "Status") : t("export.format", "Format")}
								</div>
								<div className="text-slate-200 font-medium text-sm">
									{isGifFinalizing
										? t("export.compilingEllipsis", "Compiling...")
										: isVideoFinalizing
											? t("export.finalizingEllipsis", "Finalizing...")
											: formatLabel}
								</div>
							</div>
							<div className="bg-white/5 rounded-xl p-3 border border-white/5">
								<div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
									{t("export.frames", "Frames")}
								</div>
								<div className="text-slate-200 font-medium text-sm">
									{progress.currentFrame} / {progress.totalFrames}
								</div>
							</div>
						</div>

						{onCancel && (
							<div className="pt-2">
								<Button
									onClick={onCancel}
									variant="destructive"
									className="w-full py-6 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all rounded-xl"
								>
									{t("export.cancelExport", "Cancel Export")}
								</Button>
							</div>
						)}
					</div>
				)}

				{showSuccess && (
					<div className="text-center py-4 animate-in zoom-in-95">
						<p className="text-lg text-slate-200 font-medium">
							{t("export.savedSuccessfully", "{{format}} saved successfully!", {
								format: formatLabel,
							})}
						</p>
					</div>
				)}
			</div>
		</>
	);
}
