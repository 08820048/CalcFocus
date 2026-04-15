import {
	CheckCircle2,
	Download,
	ExternalLink,
	LoaderCircle,
	RefreshCw,
	RotateCcw,
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
import { type UpdateStatus, useAppUpdater } from "@/hooks/useAppUpdater";

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
		<div className="space-y-2">
			<div className="h-1.5 overflow-hidden rounded-[3px] bg-white/10">
				<div
					className="h-full rounded-[3px] bg-[#2563EB] transition-[width] duration-300"
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

function getStatusLabel(status: UpdateStatus) {
	if (status === "checking") return "Checking";
	if (status === "available") return "Available";
	if (status === "downloading") return "Installing";
	if (status === "ready") return "Restart needed";
	if (status === "up-to-date") return "Latest";
	return "Attention";
}

function StatusLabel({ status }: { status: UpdateStatus }) {
	const toneClass =
		status === "ready" || status === "up-to-date"
			? "text-emerald-300"
			: status === "error"
				? "text-rose-300"
				: "text-blue-300";

	return (
		<span className={`text-xs font-medium uppercase tracking-[0.16em] ${toneClass}`}>
			{getStatusLabel(status)}
		</span>
	);
}

function StatusSummary({
	icon,
	status,
	title,
	description,
	version,
}: {
	icon: ReactNode;
	status: UpdateStatus;
	title: string;
	description: string;
	version?: string | null;
}) {
	return (
		<div className="flex items-start justify-between gap-5">
			<div className="flex min-w-0 items-start gap-3">
				<div className="mt-0.5 shrink-0 text-white">{icon}</div>
				<div className="min-w-0">
					<div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
						<StatusLabel status={status} />
						{version ? <span className="text-xs text-slate-400">v{version}</span> : null}
					</div>
					<h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
					<p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
				</div>
			</div>
		</div>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="border-t border-white/10 pt-4">
			<div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
				{label}
			</div>
			<div className="text-sm leading-6 text-slate-200">{children}</div>
		</div>
	);
}

function ReleaseNotes({ releaseNotes }: { releaseNotes: string | null }) {
	if (!releaseNotes) {
		return (
			<Section label="What to expect">
				The update will download in the background and ask for a restart when everything is ready.
			</Section>
		);
	}

	return (
		<Section label="What’s new">
			<div className="max-h-56 overflow-y-auto whitespace-pre-wrap pr-1 text-slate-300">
				{releaseNotes}
			</div>
		</Section>
	);
}

export function AppUpdaterDialog({ enableAutoCheck = true }: AppUpdaterDialogProps) {
	const {
		status,
		isDialogOpen,
		isBlocking,
		version,
		releaseNotes,
		manualDownloadUrl,
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
			window.dispatchEvent(
				new CustomEvent<AppUpdaterStatusEventDetail>(APP_UPDATER_STATUS_EVENT, { detail }),
			);
		};

		const handleManualCheck = (event: Event) => {
			const detail =
				event instanceof CustomEvent
					? (event.detail as AppUpdaterCheckEventDetail | undefined)
					: undefined;
			const showDialog = detail?.showDialog ?? true;

			void (async () => {
				emitStatus({ status: "checking" });
				const result = await checkForUpdate({
					showDialog,
					openDialogOnAvailable: showDialog,
				});
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
				overlayClassName="bg-transparent"
				className="max-w-[560px] overflow-hidden rounded-[6px] border border-white/10 bg-[#08090d] p-0 text-white shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-[6px] [&>button]:p-2 [&>button]:text-slate-400 [&>button]:opacity-100 [&>button]:ring-0 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"
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
				<div className="space-y-4 p-5">
					<DialogHeader className="sr-only">
						<DialogTitle>CalcFocus updater</DialogTitle>
						<DialogDescription>Manage app updates.</DialogDescription>
					</DialogHeader>

					{status === "checking" ? (
						<>
							<StatusSummary
								icon={<LoaderCircle className="h-5 w-5 animate-spin text-[#60a5fa]" />}
								status={status}
								title="Checking for updates"
								description="Looking for the latest stable CalcFocus release and update package."
							/>
							<Section label="Progress">Contacting the release channel.</Section>
						</>
					) : null}

					{status === "up-to-date" ? (
						<>
							<StatusSummary
								icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
								status={status}
								title="You’re up to date"
								description="This build already matches the latest available CalcFocus release."
							/>
							<DialogFooter className="pt-1">
								<Button
									onClick={dismiss}
									className="h-10 rounded-[6px] bg-white/10 px-4 text-white hover:bg-white/15"
								>
									Close
								</Button>
							</DialogFooter>
						</>
					) : null}

					{status === "available" ? (
						<>
							<StatusSummary
								icon={<Download className="h-5 w-5 text-[#7dd3fc]" />}
								status={status}
								title="A new update is ready"
								description={
									manualDownloadUrl
										? "Automatic install could not reach the signed updater manifest, but a newer GitHub release is available."
										: "Install the newest CalcFocus release now, or come back to it later from the app."
								}
								version={version}
							/>
							{manualDownloadUrl && error ? <Section label="Installer">{error}</Section> : null}
							<ReleaseNotes releaseNotes={releaseNotes} />
							<DialogFooter className="gap-2 pt-1 sm:justify-between">
								<Button
									variant="ghost"
									onClick={dismiss}
									className="h-10 rounded-[6px] border border-white/10 bg-transparent px-4 text-slate-200 hover:bg-white/10 hover:text-white"
								>
									Later
								</Button>
								<Button
									onClick={() => {
										void downloadAndInstall();
									}}
									className="h-10 rounded-[6px] bg-[#2563EB] px-4 text-white hover:bg-[#1d4ed8]"
								>
									{manualDownloadUrl ? (
										<>
											<ExternalLink className="h-4 w-4" />
											Open release
										</>
									) : (
										"Install update"
									)}
								</Button>
							</DialogFooter>
						</>
					) : null}

					{status === "downloading" ? (
						<>
							<StatusSummary
								icon={<RefreshCw className="h-5 w-5 animate-spin text-[#7dd3fc]" />}
								status={status}
								title="Updating CalcFocus"
								description={`Downloading and preparing${version ? ` v${version}` : " the latest release"} for install.`}
								version={version}
							/>
							<Section label="Install progress">
								<ProgressBar progress={downloadProgress} />
							</Section>
							<Section label="Heads up">
								Other update actions are disabled until this download finishes.
							</Section>
						</>
					) : null}

					{status === "ready" ? (
						<>
							<StatusSummary
								icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
								status={status}
								title="Restart to finish"
								description="The update has been installed and is ready to be applied."
								version={version}
							/>
							<Section label="Next step">
								Restart CalcFocus to switch over to the updated build.
							</Section>
							<DialogFooter className="gap-2 pt-1 sm:justify-between">
								<Button
									variant="ghost"
									onClick={dismiss}
									className="h-10 rounded-[6px] border border-white/10 bg-transparent px-4 text-slate-200 hover:bg-white/10 hover:text-white"
								>
									Later
								</Button>
								<Button
									onClick={() => {
										void restartApp();
									}}
									className="h-10 rounded-[6px] bg-[#09cf67] px-4 text-[#04110a] hover:bg-[#0bc061]"
								>
									Restart now
								</Button>
							</DialogFooter>
						</>
					) : null}

					{status === "error" ? (
						<>
							<StatusSummary
								icon={<TriangleAlert className="h-5 w-5 text-rose-300" />}
								status={status}
								title="Update check failed"
								description="CalcFocus could not finish the update flow. You can retry from here."
							/>
							<Section label="Error details">
								{error ?? "An unexpected error occurred while updating."}
							</Section>
							<DialogFooter className="gap-2 pt-1 sm:justify-between">
								<Button
									variant="ghost"
									onClick={dismiss}
									className="h-10 rounded-[6px] border border-white/10 bg-transparent px-4 text-slate-200 hover:bg-white/10 hover:text-white"
								>
									Close
								</Button>
								<Button
									onClick={() => {
										void checkForUpdate({ showDialog: true });
									}}
									className="h-10 rounded-[6px] bg-[#2563EB] px-4 text-white hover:bg-[#1d4ed8]"
								>
									<RotateCcw className="h-4 w-4" />
									Try again
								</Button>
							</DialogFooter>
						</>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
