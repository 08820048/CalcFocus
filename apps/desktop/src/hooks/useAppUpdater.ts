import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import * as backend from "@/lib/backend";

const AUTO_CHECK_DELAY_MS = 10_000;
const GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/08820048/CalcFocus/releases/latest";

export type UpdateStatus =
	| "idle"
	| "checking"
	| "up-to-date"
	| "available"
	| "downloading"
	| "ready"
	| "error";

type CheckForUpdateOptions = {
	showDialog?: boolean;
	openDialogOnAvailable?: boolean;
};

export type CheckForUpdateResult = "busy" | "disabled" | "available" | "up-to-date" | "error";

export type UseAppUpdaterReturn = {
	status: UpdateStatus;
	isDialogOpen: boolean;
	isBlocking: boolean;
	version: string | null;
	releaseNotes: string | null;
	manualDownloadUrl: string | null;
	downloadProgress: number;
	error: string | null;
	checkForUpdate: (options?: CheckForUpdateOptions) => Promise<CheckForUpdateResult>;
	downloadAndInstall: () => Promise<void>;
	restartApp: () => Promise<void>;
	dismiss: () => void;
};

type GitHubLatestRelease = {
	tag_name?: string;
	name?: string;
	body?: string | null;
	html_url?: string;
};

type FallbackUpdateCheck =
	| {
			result: "available";
			version: string;
			releaseNotes: string | null;
			manualDownloadUrl: string | null;
	  }
	| {
			result: "up-to-date";
	  };

type UseAppUpdaterOptions = {
	enableAutoCheck?: boolean;
};

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	if (typeof error === "string" && error.trim()) {
		return error;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string" &&
		error.message.trim()
	) {
		return error.message;
	}

	try {
		const serialized = JSON.stringify(error);
		if (serialized && serialized !== "{}") {
			return serialized;
		}
	} catch {
		// Ignore serialization failures and fall back to the default message.
	}

	return fallback;
}

function normalizeVersion(version: string): string {
	return version.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string): number {
	const leftParts = normalizeVersion(left).split(/[.-]/);
	const rightParts = normalizeVersion(right).split(/[.-]/);
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index += 1) {
		const leftPart = leftParts[index] ?? "0";
		const rightPart = rightParts[index] ?? "0";
		const leftNumber = Number.parseInt(leftPart, 10);
		const rightNumber = Number.parseInt(rightPart, 10);

		if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
			if (leftNumber !== rightNumber) {
				return leftNumber > rightNumber ? 1 : -1;
			}
			continue;
		}

		const textCompare = leftPart.localeCompare(rightPart);
		if (textCompare !== 0) {
			return textCompare > 0 ? 1 : -1;
		}
	}

	return 0;
}

async function checkLatestReleaseFallback(): Promise<FallbackUpdateCheck | null> {
	const [currentVersion, response] = await Promise.all([
		getVersion(),
		fetch(GITHUB_LATEST_RELEASE_API, {
			headers: {
				Accept: "application/vnd.github+json",
			},
		}),
	]);

	if (!response.ok) {
		throw new Error(`GitHub release API returned ${response.status}`);
	}

	const release = (await response.json()) as GitHubLatestRelease;
	const latestVersion = normalizeVersion(release.tag_name ?? "");
	if (!latestVersion) {
		return null;
	}

	if (compareVersions(latestVersion, currentVersion) <= 0) {
		return { result: "up-to-date" };
	}

	return {
		result: "available",
		version: latestVersion,
		releaseNotes: release.body ?? null,
		manualDownloadUrl: release.html_url ?? null,
	};
}

export function useAppUpdater({
	enableAutoCheck = true,
}: UseAppUpdaterOptions = {}): UseAppUpdaterReturn {
	const [updatesEnabled, setUpdatesEnabled] = useState(!import.meta.env.DEV);
	const [status, setStatus] = useState<UpdateStatus>("idle");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [version, setVersion] = useState<string | null>(null);
	const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
	const [manualDownloadUrl, setManualDownloadUrl] = useState<string | null>(null);
	const [downloadProgress, setDownloadProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const updateRef = useRef<Update | null>(null);

	const checkForUpdate = useCallback(
		async ({ showDialog = false, openDialogOnAvailable = true }: CheckForUpdateOptions = {}) => {
			if (status === "checking" || status === "downloading") {
				if (showDialog) {
					setIsDialogOpen(true);
				}
				return "busy" as const;
			}

			if (!updatesEnabled) {
				updateRef.current = null;
				setVersion(null);
				setReleaseNotes(null);
				setManualDownloadUrl(null);
				setDownloadProgress(0);

				try {
					const fallback = await checkLatestReleaseFallback();
					if (fallback?.result === "available") {
						setVersion(fallback.version);
						setReleaseNotes(fallback.releaseNotes);
						setManualDownloadUrl(fallback.manualDownloadUrl);
						setError(
							"Automatic install is unavailable in development builds. You can open the latest GitHub release and install it manually.",
						);
						setStatus("available");
						setIsDialogOpen(showDialog || openDialogOnAvailable);
						return "available" as const;
					}

					if (fallback?.result === "up-to-date") {
						setError(null);
						setStatus(showDialog ? "up-to-date" : "idle");
						setIsDialogOpen(showDialog);
						return "up-to-date" as const;
					}
				} catch (fallbackError) {
					console.error("Development update fallback check failed:", fallbackError);
				}

				setError(showDialog ? "Updates are unavailable in development builds." : null);
				setStatus(showDialog ? "error" : "idle");
				setIsDialogOpen(showDialog);
				return "disabled" as const;
			}

			try {
				if (showDialog) {
					setIsDialogOpen(true);
				}

				setStatus("checking");
				setVersion(null);
				setReleaseNotes(null);
				setManualDownloadUrl(null);
				setDownloadProgress(0);
				setError(null);

				const update = await check();

				if (update) {
					updateRef.current = update;
					setVersion(update.version);
					setReleaseNotes(update.body ?? null);
					setManualDownloadUrl(null);
					setStatus("available");
					setIsDialogOpen(showDialog || openDialogOnAvailable);
					return "available" as const;
				} else {
					updateRef.current = null;
					setVersion(null);
					setReleaseNotes(null);
					setManualDownloadUrl(null);
					setStatus(showDialog ? "up-to-date" : "idle");
					setIsDialogOpen(showDialog);
					return "up-to-date" as const;
				}
			} catch (err) {
				console.error("Update check failed:", err);

				try {
					const fallback = await checkLatestReleaseFallback();
					if (fallback?.result === "available") {
						updateRef.current = null;
						setVersion(fallback.version);
						setReleaseNotes(fallback.releaseNotes);
						setManualDownloadUrl(fallback.manualDownloadUrl);
						setError(
							"Automatic install is unavailable because the signed updater manifest could not be reached. You can open the latest GitHub release and install it manually.",
						);
						setStatus("available");
						setIsDialogOpen(showDialog || openDialogOnAvailable);
						return "available" as const;
					}

					if (fallback?.result === "up-to-date") {
						updateRef.current = null;
						setVersion(null);
						setReleaseNotes(null);
						setManualDownloadUrl(null);
						setStatus(showDialog ? "up-to-date" : "idle");
						setIsDialogOpen(showDialog);
						return "up-to-date" as const;
					}
				} catch (fallbackError) {
					console.error("Fallback update check failed:", fallbackError);
				}

				setError(getErrorMessage(err, "Failed to check for updates"));
				setStatus("error");
				setIsDialogOpen(showDialog);
				return "error" as const;
			}
		},
		[status, updatesEnabled],
	);

	const downloadAndInstall = useCallback(async () => {
		const update = updateRef.current;
		if (status === "downloading") return;

		if (!update) {
			if (manualDownloadUrl) {
				await backend.openExternalUrl(manualDownloadUrl);
			}
			return;
		}

		try {
			setIsDialogOpen(true);
			setStatus("downloading");
			setDownloadProgress(0);
			setError(null);

			let totalLength = 0;
			let downloaded = 0;

			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						totalLength = event.data.contentLength ?? 0;
						break;
					case "Progress":
						downloaded += event.data.chunkLength;
						if (totalLength > 0) {
							setDownloadProgress(Math.round((downloaded / totalLength) * 100));
						}
						break;
					case "Finished":
						setDownloadProgress(100);
						break;
				}
			});

			setStatus("ready");
		} catch (err) {
			console.error("Update download failed:", err);
			setError(getErrorMessage(err, "Failed to download update"));
			setStatus("error");
		}
	}, [manualDownloadUrl, status]);

	const restartApp = useCallback(async () => {
		await relaunch();
	}, []);

	const dismiss = useCallback(() => {
		setIsDialogOpen(false);
		setStatus("idle");
		setVersion(null);
		setReleaseNotes(null);
		setManualDownloadUrl(null);
		setDownloadProgress(0);
		setError(null);
		updateRef.current = null;
	}, []);

	useEffect(() => {
		// Only disable updater in Vite dev runtime. Release-like bundles with
		// custom identifiers (including ".dev" suffixes) should still be able
		// to check and install updates.
		setUpdatesEnabled(!import.meta.env.DEV);
	}, []);

	// Auto-check for updates on mount (after a delay)
	useEffect(() => {
		if (!updatesEnabled || !enableAutoCheck) {
			return;
		}

		const timer = setTimeout(() => {
			checkForUpdate();
		}, AUTO_CHECK_DELAY_MS);

		return () => clearTimeout(timer);
	}, [checkForUpdate, enableAutoCheck, updatesEnabled]);

	// Listen for manual "Check for Updates" from the menu
	useEffect(() => {
		let unlisten: backend.UnlistenFn | undefined;

		backend
			.onMenuCheckUpdates(() => {
				void checkForUpdate({ showDialog: true });
			})
			.then((fn) => {
				unlisten = fn;
			});

		return () => unlisten?.();
	}, [checkForUpdate]);

	return {
		status,
		isDialogOpen,
		isBlocking: status === "checking" || status === "downloading",
		version,
		releaseNotes,
		manualDownloadUrl,
		downloadProgress,
		error,
		checkForUpdate,
		downloadAndInstall,
		restartApp,
		dismiss,
	};
}
