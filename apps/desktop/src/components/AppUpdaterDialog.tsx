import {
	CheckCircle2,
	Download,
	LoaderCircle,
	RefreshCw,
	RotateCcw,
	Sparkles,
	TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAppUpdater, type UpdateStatus } from "@/hooks/useAppUpdater";

type AppUpdaterDialogProps = {
	enableAutoCheck?: boolean;
};

export const APP_UPDATER_CHECK_EVENT = "calcfocus:check-updates";
export const APP_UPDATER_STATUS_EVENT = "calcfocus:update-status";

type AppUpdaterCheckEventDetail = {
	showDialog?: boolean;
};

type AppUpdaterStatusEventDetail = {
	status: "checking" | "up-to-date" | "available" | "error" | "disabled" | "busy";
	error?: string | null;
	version?: string | null;
};

function ProgressBar({ progress }: { progress: number }) {
	return (
		<div className="space-y-2.5">
			<div className="relative h-2 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/[0.08]">
				<div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#2563EB]/0 via-white/10 to-[#2563EB]/0" />
				<div
					className="h-full rounded-full bg-gradient-to-r from-[#2563EB] via-[#2dd4bf] to-[#09cf67] transition-[width] duration-300"
					style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
				/>
			</div>
			<div className="flex items-center justify-between text-[11px] text-slate-400">
				<span>Downloading update package</span>
				<span className="font-medium text-slate-200">{progress}%</span>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	label,
}: {
	status: UpdateStatus;
	label: string;
}) {
	const toneClass =
		status === "ready" || status === "up-to-date"
			? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
			: status === "error"
				? "border-rose-400/20 bg-rose-400/10 text-rose-200"
				: "border-[#2563EB]/25 bg-[#2563EB]/12 text-blue-100";

	return (
		<span
			className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${toneClass}`}
		>
			{label}
		</span>
	);
}

function StatusHero({
	icon,
	status,
	eyebrow,
	title,
	description,
	version,
}: {
	icon: ReactNode;
	status: UpdateStatus;
	eyebrow: string;
	title: string;
	description: string;
	version?: string | null;
}) {
	return (
		<div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(155deg,rgba(17,24,39,0.98),rgba(10,10,16,0.96))] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
			<div className="absolute inset-0 opacity-90">
				<div className="absolute -left-16 top-0 h-36 w-36 rounded-full bg-[#2563EB]/18 blur-3xl" />
				<div className="absolute right-0 top-8 h-28 w-28 rounded-full bg-[#09cf67]/12 blur-3xl" />
				<div className="absolute inset-x-0 top-0 h-px bg-white/10" />
			</div>
			<div className="relative flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-4">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white shadow-inner shadow-white/5">
						{icon}
					</div>
					<div className="min-w-0">
						<div className="mb-1 flex items-center gap-2">
							<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
								{eyebrow}
							</p>
							{version ? (
								<span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-200">
									v{version}
								</span>
							) : null}
						</div>
						<h2 className="text-[22px] font-semibold tracking-tight text-white">{title}</h2>
						<p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
					</div>
				</div>
				<StatusBadge
					status={status}
					label={
						status === "checking"
							? "Checking"
							: status === "available"
								? "Ready"
								: status === "downloading"
									? "Installing"
									: status === "ready"
										? "Restart needed"
										: status === "up-to-date"
											? "Latest"
											: "Attention"
					}
				/>
			</div>
		</div>
	);
}

function InfoPanel({
	label,
	children,
	tone = "neutral",
}: {
	label: string;
	children: ReactNode;
	tone?: "neutral" | "success" | "warning" | "error";
}) {
	const toneClass =
		tone === "success"
			? "border-emerald-400/15 bg-emerald-400/8"
			: tone === "warning"
				? "border-amber-400/15 bg-amber-400/8"
				: tone === "error"
					? "border-rose-400/15 bg-rose-400/8"
					: "border-white/10 bg-white/[0.04]";

	return (
		<div className={`rounded-[18px] border p-4 ${toneClass}`}>
			<div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
				{label}
			</div>
			<div className="text-sm leading-6 text-slate-200">{children}</div>
		</div>
	);
}

function ReleaseNotes({ releaseNotes }: { releaseNotes: string | null }) {
	if (!releaseNotes) {
		return (
			<InfoPanel label="What to expect">
				The update will download in the background and ask for a restart when everything is ready.
			</InfoPanel>
		);
	}

	return (
		<InfoPanel label="What’s new">
			<div className="max-h-56 overflow-y-auto whitespace-pre-wrap pr-1 text-slate-300">
				{releaseNotes}
			</div>
		</InfoPanel>
	);
}

export function AppUpdaterDialog({ enableAutoCheck = true }: AppUpdaterDialogProps) {
	const {
		status,
		isDialogOpen,
		isBlocking,
		version,
		releaseNotes,
		downloadProgress,
		error,
		checkForUpdate,
		downloadAndInstall,
		restartApp,
		dismiss,
	} = useAppUpdater({ enableAutoCheck });
	const contentRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isBlocking) {
			return;
		}

		const handleKeyEvent = (event: KeyboardEvent) => {
			if (
				contentRef.current &&
				event.target instanceof Node &&
				contentRef.current.contains(event.target)
			) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
		};

		window.addEventListener("keydown", handleKeyEvent, { capture: true });
		window.addEventListener("keyup", handleKeyEvent, { capture: true });

		return () => {
			window.removeEventListener("keydown", handleKeyEvent, { capture: true });
			window.removeEventListener("keyup", handleKeyEvent, { capture: true });
		};
	}, [isBlocking]);

	useEffect(() => {
		const emitStatus = (detail: AppUpdaterStatusEventDetail) => {
			window.dispatchEvent(new CustomEvent<AppUpdaterStatusEventDetail>(APP_UPDATER_STATUS_EVENT, { detail }));
		};

		const handleManualCheck = (event: Event) => {
			const detail = event instanceof CustomEvent ? (event.detail as AppUpdaterCheckEventDetail | undefined) : undefined;
			const showDialog = detail?.showDialog ?? true;

			void (async () => {
				emitStatus({ status: "checking" });
				const result = await checkForUpdate({ showDialog });
				emitStatus({
					status: result,
					error: result === "error" || result === "disabled" ? error : null,
					version,
				});
			})();
		};

		window.addEventListener(APP_UPDATER_CHECK_EVENT, handleManualCheck as EventListener);
		return () => {
			window.removeEventListener(APP_UPDATER_CHECK_EVENT, handleManualCheck as EventListener);
		};
	}, [checkForUpdate, error, version]);

	const canDismiss = !isBlocking;

	return (
		<Dialog
			open={isDialogOpen}
			onOpenChange={(open) => {
				if (!open && canDismiss) {
					dismiss();
				}
			}}
		>
			<DialogContent
				ref={contentRef}
				showCloseButton={canDismiss}
				className="max-w-[560px] overflow-hidden border-white/10 bg-[#06070b] p-0 text-white shadow-[0_50px_140px_-50px_rgba(0,0,0,0.95)] [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/5 [&>button]:p-2 [&>button]:text-slate-400 [&>button]:opacity-100 [&>button]:ring-0 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"
				onEscapeKeyDown={(event) => {
					if (!canDismiss) {
						event.preventDefault();
					}
				}}
				onInteractOutside={(event) => {
					if (!canDismiss) {
						event.preventDefault();
					}
				}}
			>
				<div className="relative overflow-hidden rounded-[28px]">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(9,207,103,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
					<div className="relative space-y-4 p-5">
						<DialogHeader className="sr-only">
							<DialogTitle>CalcFocus updater</DialogTitle>
							<DialogDescription>Manage app updates.</DialogDescription>
						</DialogHeader>

						{status === "checking" ? (
							<>
								<StatusHero
									icon={<LoaderCircle className="h-5 w-5 animate-spin text-[#60a5fa]" />}
									status={status}
									eyebrow="Software Update"
									title="Checking for updates"
									description="Looking for the latest stable CalcFocus release and update package."
								/>
								<InfoPanel label="Progress">
									<div className="flex items-center gap-2 text-slate-300">
										<Sparkles className="h-4 w-4 text-[#60a5fa]" />
										Securely contacting the release channel.
									</div>
								</InfoPanel>
							</>
						) : null}

						{status === "up-to-date" ? (
							<>
								<StatusHero
									icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
									status={status}
									eyebrow="Software Update"
									title="You’re up to date"
									description="This build already matches the latest available CalcFocus release."
								/>
								<DialogFooter className="pt-1">
									<Button
										onClick={dismiss}
										className="h-10 rounded-xl bg-white/[0.08] px-4 text-white hover:bg-white/[0.12]"
									>
										Close
									</Button>
								</DialogFooter>
							</>
						) : null}

						{status === "available" ? (
							<>
								<StatusHero
									icon={<Download className="h-5 w-5 text-[#7dd3fc]" />}
									status={status}
									eyebrow="Software Update"
									title="A new update is ready"
									description="Install the newest CalcFocus release now, or come back to it later from the app."
									version={version}
								/>
								<ReleaseNotes releaseNotes={releaseNotes} />
								<DialogFooter className="gap-2 pt-1 sm:justify-between">
									<Button
										variant="ghost"
										onClick={dismiss}
										className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-slate-200 hover:bg-white/10 hover:text-white"
									>
										Later
									</Button>
									<Button
										onClick={() => {
											void downloadAndInstall();
										}}
										className="h-10 rounded-xl bg-[#2563EB] px-4 text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.9)] hover:bg-[#1d4ed8]"
									>
										Install update
									</Button>
								</DialogFooter>
							</>
						) : null}

						{status === "downloading" ? (
							<>
								<StatusHero
									icon={<RefreshCw className="h-5 w-5 animate-spin text-[#7dd3fc]" />}
									status={status}
									eyebrow="Software Update"
									title="Updating CalcFocus"
									description={`Downloading and preparing${version ? ` v${version}` : " the latest release"} for install.`}
									version={version}
								/>
								<InfoPanel label="Install progress">
									<ProgressBar progress={downloadProgress} />
								</InfoPanel>
								<InfoPanel label="Heads up" tone="warning">
									Other update actions are disabled until this download finishes.
								</InfoPanel>
							</>
						) : null}

						{status === "ready" ? (
							<>
								<StatusHero
									icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
									status={status}
									eyebrow="Software Update"
									title="Restart to finish"
									description="The update has been installed and is ready to be applied."
									version={version}
								/>
								<InfoPanel label="Next step" tone="success">
									Restart CalcFocus to switch over to the updated build.
								</InfoPanel>
								<DialogFooter className="gap-2 pt-1 sm:justify-between">
									<Button
										variant="ghost"
										onClick={dismiss}
										className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-slate-200 hover:bg-white/10 hover:text-white"
									>
										Later
									</Button>
									<Button
										onClick={() => {
											void restartApp();
										}}
										className="h-10 rounded-xl bg-[#09cf67] px-4 text-[#04110a] shadow-[0_12px_30px_-12px_rgba(9,207,103,0.9)] hover:bg-[#0bc061]"
									>
										Restart now
									</Button>
								</DialogFooter>
							</>
						) : null}

						{status === "error" ? (
							<>
								<StatusHero
									icon={<TriangleAlert className="h-5 w-5 text-rose-300" />}
									status={status}
									eyebrow="Software Update"
									title="Update check failed"
									description="CalcFocus could not finish the update flow. You can retry from here."
								/>
								<InfoPanel label="Error details" tone="error">
									{error ?? "An unexpected error occurred while updating."}
								</InfoPanel>
								<DialogFooter className="gap-2 pt-1 sm:justify-between">
									<Button
										variant="ghost"
										onClick={dismiss}
										className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-slate-200 hover:bg-white/10 hover:text-white"
									>
										Close
									</Button>
									<Button
										onClick={() => {
											void checkForUpdate({ showDialog: true });
										}}
										className="h-10 rounded-xl bg-[#2563EB] px-4 text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.9)] hover:bg-[#1d4ed8]"
									>
										<RotateCcw className="h-4 w-4" />
										Try again
									</Button>
								</DialogFooter>
							</>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
