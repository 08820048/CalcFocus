/**
 * First-launch permission onboarding overlay.
 *
 * Guides the user through granting all required (and optional) permissions
 * in a step-by-step flow. Designed to fit within the HUD overlay window after
 * a brief resize so the user gets a clear, focused permission-granting experience.
 */

import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { HiShieldCheck } from "react-icons/hi2";
import {
	MdAccessibilityNew,
	MdCheck,
	MdClose,
	MdMic,
	MdScreenShare,
	MdVideocam,
} from "react-icons/md";
import type {
	PermissionState,
	PermissionStatus,
	UsePermissionsResult,
} from "../../hooks/usePermissions";
import * as backend from "../../lib/backend";
import styles from "./PermissionOnboarding.module.css";

const ONBOARDING_COMPLETE_KEY = "calcfocus-onboarding-v1";
const LEGACY_ONBOARDING_COMPLETE_KEYS = ["fluxlocus-onboarding-v1"];
const ONBOARDING_WINDOW_WIDTH = 480;
const ONBOARDING_WINDOW_HEIGHT = 360;
const HUD_WIDTH = 780;
const HUD_HEIGHT = 155;
const PERMISSION_STATE_REFRESH_DELAY_MS = 500;

type OnboardingStep =
	| "welcome"
	| "screen_recording"
	| "accessibility"
	| "microphone"
	| "camera"
	| "done";

interface PermissionOnboardingProps {
	permissionsHook: UsePermissionsResult;
	onComplete: () => void;
}

function isStorageFlagEnabled(primaryKey: string, legacyKeys: string[]) {
	for (const key of [primaryKey, ...legacyKeys]) {
		if (localStorage.getItem(key) === "true") {
			return true;
		}
	}

	return false;
}

function clearStorageFlags(primaryKey: string, legacyKeys: string[]) {
	for (const key of [primaryKey, ...legacyKeys]) {
		localStorage.removeItem(key);
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusIcon(status: PermissionStatus) {
	if (status === "granted") {
		return <MdCheck size={16} className="text-emerald-400" />;
	}
	if (status === "denied" || status === "restricted") {
		return <MdClose size={16} className="text-red-400" />;
	}
	return <div className="h-3 w-3 rounded-full border-2 border-white/20" />;
}

function statusLabel(status: PermissionStatus): string {
	switch (status) {
		case "granted":
			return "Granted";
		case "denied":
			return "Denied";
		case "restricted":
			return "Restricted";
		case "not_determined":
			return "Not set";
		case "checking":
			return "Checking...";
		default:
			return "Unknown";
	}
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepDots({ steps, currentIndex }: { steps: OnboardingStep[]; currentIndex: number }) {
	return (
		<div className="flex items-center gap-1.5">
			{steps.map((_, i) => (
				<div
					key={i}
					className={`h-1.5 rounded-full transition-all duration-300 ${
						i === currentIndex
							? "w-5 bg-blue-400"
							: i < currentIndex
								? "w-1.5 bg-blue-400/50"
								: "w-1.5 bg-white/20"
					}`}
				/>
			))}
		</div>
	);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PermissionOnboarding({ permissionsHook, onComplete }: PermissionOnboardingProps) {
	const {
		permissions,
		isMacOS,
		refreshPermissions,
		requestAccessibilityAccess,
		requestMicrophoneAccess,
		requestCameraAccess,
		requestScreenRecordingAccess,
		openPermissionSettings,
	} = permissionsHook;

	const [step, setStep] = useState<OnboardingStep>("welcome");
	const [isRequesting, setIsRequesting] = useState(false);
	const [screenRecordingSettingsOpened, setScreenRecordingSettingsOpened] = useState(false);
	const [accessibilitySettingsOpened, setAccessibilitySettingsOpened] = useState(false);
	const resizedRef = useRef(false);

	// Build the step list — skip macOS-only steps on other platforms
	const steps: OnboardingStep[] = isMacOS
		? ["welcome", "screen_recording", "accessibility", "microphone", "camera", "done"]
		: ["welcome", "microphone", "camera", "done"];
	const currentIndex = steps.indexOf(step);

	// Resize the HUD window when onboarding appears
	useEffect(() => {
		if (resizedRef.current) return;
		resizedRef.current = true;

		const win = getCurrentWindow();
		void (async () => {
			await win.setSize(new LogicalSize(ONBOARDING_WINDOW_WIDTH, ONBOARDING_WINDOW_HEIGHT));
			await win.center();
			if (isMacOS) {
				// Let system permission prompts and System Settings stay accessible while onboarding is active.
				await win.setAlwaysOnTop(false);
			}
		})();
		return () => {
			if (!isMacOS) return;
			void win.setAlwaysOnTop(true).catch(() => {
				// Ignore teardown races when the window is already closing.
			});
		};
	}, [isMacOS]);

	useEffect(() => {
		const refreshPermissionState = () => {
			void refreshPermissions().catch((error) => {
				console.error("Failed to refresh permissions after window activation:", error);
			});
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				refreshPermissionState();
			}
		};

		window.addEventListener("focus", refreshPermissionState);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("focus", refreshPermissionState);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [refreshPermissions]);

	useEffect(() => {
		if (permissions.screenRecording === "granted" && screenRecordingSettingsOpened) {
			setScreenRecordingSettingsOpened(false);
		}
	}, [permissions.screenRecording, screenRecordingSettingsOpened]);

	useEffect(() => {
		if (permissions.accessibility === "granted" && accessibilitySettingsOpened) {
			setAccessibilitySettingsOpened(false);
		}
	}, [accessibilitySettingsOpened, permissions.accessibility]);

	// Restore the HUD window to its normal size and re-position to bottom-center
	const restoreWindowSize = useCallback(async () => {
		const win = getCurrentWindow();
		if (isMacOS) {
			await win.setAlwaysOnTop(true);
		}
		await win.setSize(new LogicalSize(HUD_WIDTH, HUD_HEIGHT));

		try {
			const monitor = await primaryMonitor();
			if (monitor) {
				const scale = monitor.scaleFactor;
				const logicalW = monitor.size.width / scale;
				const logicalH = monitor.size.height / scale;
				const x = (logicalW - HUD_WIDTH) / 2;
				const y = logicalH - HUD_HEIGHT - 5;
				await win.setPosition(new PhysicalPosition(Math.round(x * scale), Math.round(y * scale)));
			}
		} catch {
			await win.center();
		}
	}, [isMacOS]);

	const moveWindowOutOfTheWayForSystemSettings = useCallback(async () => {
		if (!isMacOS) return;

		const win = getCurrentWindow();
		await win.setAlwaysOnTop(false).catch(() => {
			// Ignore best-effort window layering changes.
		});
		await win.minimize().catch((error) => {
			console.error("Failed to minimize onboarding window before opening System Settings:", error);
		});
	}, [isMacOS]);

	const handleCardPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest("[data-no-window-drag='true']")) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		void backend.startHudOverlayDrag().catch((error) => {
			console.error("Failed to start onboarding window drag:", error);
		});
	}, []);

	const handleComplete = useCallback(async () => {
		try {
			localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
			for (const key of LEGACY_ONBOARDING_COMPLETE_KEYS) {
				localStorage.removeItem(key);
			}
		} catch {
			// localStorage may be unavailable in some contexts
		}
		await restoreWindowSize();
		onComplete();
	}, [onComplete, restoreWindowSize]);

	const advanceStep = useCallback(() => {
		const nextIndex = currentIndex + 1;
		if (nextIndex < steps.length) {
			setStep(steps[nextIndex]);
		}
	}, [currentIndex, steps]);

	const handleGrantPermission = useCallback(async () => {
		setIsRequesting(true);
		try {
			switch (step) {
				case "screen_recording": {
					const granted = await requestScreenRecordingAccess();
					if (!granted) {
						setScreenRecordingSettingsOpened(true);
						await moveWindowOutOfTheWayForSystemSettings();
						await openPermissionSettings("screenRecording");
					}
					break;
				}
				case "accessibility": {
					const granted = await requestAccessibilityAccess();
					if (!granted) {
						setAccessibilitySettingsOpened(true);
						await moveWindowOutOfTheWayForSystemSettings();
						await openPermissionSettings("accessibility");
					}
					break;
				}
				case "microphone": {
					const granted = await requestMicrophoneAccess();
					if (!granted) {
						await moveWindowOutOfTheWayForSystemSettings();
						await openPermissionSettings("microphone");
					}
					break;
				}
				case "camera": {
					const granted = await requestCameraAccess();
					if (!granted) {
						await moveWindowOutOfTheWayForSystemSettings();
						await openPermissionSettings("camera");
					}
					break;
				}
			}
			// Small delay to let the OS update TCC state
			await new Promise((r) => setTimeout(r, PERMISSION_STATE_REFRESH_DELAY_MS));
			await refreshPermissions();
		} finally {
			setIsRequesting(false);
		}
	}, [
		step,
		moveWindowOutOfTheWayForSystemSettings,
		requestAccessibilityAccess,
		requestScreenRecordingAccess,
		requestMicrophoneAccess,
		requestCameraAccess,
		openPermissionSettings,
		refreshPermissions,
	]);

	// ─── Step Content ────────────────────────────────────────────────────────

	const renderStepContent = () => {
		switch (step) {
			case "welcome":
				return (
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-400/20">
							<HiShieldCheck size={28} className="text-blue-400" />
						</div>
						<div>
							<h2 className="text-base font-semibold text-white">Welcome to CalcFocus</h2>
							<p className="mt-1.5 text-xs text-white/55 leading-relaxed max-w-[320px]">
								We need a few permissions to capture your screen, track your cursor, and use your
								microphone and camera.
								{isMacOS
									? " macOS will ask you to approve each one."
									: " Your system may prompt you when using these features."}
							</p>
						</div>
						<button
							onClick={advanceStep}
							data-no-window-drag="true"
							className={`mt-1 px-6 py-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors cursor-pointer ${styles.tauriNoDrag}`}
						>
							Get Started
						</button>
					</div>
				);

			case "screen_recording":
				return renderPermissionStep(
					<MdScreenShare size={24} className="text-blue-400" />,
					"Screen Recording",
					"Required to capture your screen during recordings.",
					permissions.screenRecording,
					"screenRecording",
					true,
				);

			case "accessibility":
				return renderPermissionStep(
					<MdAccessibilityNew size={24} className="text-blue-400" />,
					"Accessibility",
					"Required for cursor tracking and interaction effects during recordings.",
					permissions.accessibility,
					"accessibility",
					true,
				);

			case "microphone":
				return renderPermissionStep(
					<MdMic size={24} className="text-blue-400" />,
					"Microphone",
					"Record audio commentary during screen recordings.",
					permissions.microphone,
					"microphone",
					false,
				);

			case "camera":
				return renderPermissionStep(
					<MdVideocam size={24} className="text-blue-400" />,
					"Camera",
					"Show your facecam overlay during recordings.",
					permissions.camera,
					"camera",
					false,
				);

			case "done":
				return (
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
							<MdCheck size={28} className="text-emerald-400" />
						</div>
						<div>
							<h2 className="text-base font-semibold text-white">You're All Set!</h2>
							<p className="mt-1.5 text-xs text-white/55 leading-relaxed max-w-[320px]">
								CalcFocus is ready to go. You can change permissions anytime in System Settings.
							</p>
						</div>
						<PermissionSummary permissions={permissions} />
						<button
							onClick={() => void handleComplete()}
							data-no-window-drag="true"
							className={`mt-1 px-6 py-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors cursor-pointer ${styles.tauriNoDrag}`}
						>
							Start Recording
						</button>
					</div>
				);
		}
	};

	const renderPermissionStep = (
		icon: React.ReactNode,
		title: string,
		description: string,
		status: PermissionStatus,
		permKey: keyof PermissionState,
		required: boolean,
	) => {
		const isGranted = status === "granted";
		const isDenied = status === "denied" || status === "restricted";
		const showSettingsReturnHint =
			isMacOS &&
			required &&
			!isGranted &&
			((permKey === "screenRecording" && screenRecordingSettingsOpened) ||
				(permKey === "accessibility" && accessibilitySettingsOpened));
		const helperText =
			showSettingsReturnHint && isMacOS
				? `Enable ${title} in System Settings, then quit and reopen CalcFocus.`
				: null;

		return (
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
					{icon}
				</div>
				<div>
					<div className="flex items-center justify-center gap-2">
						<h2 className="text-base font-semibold text-white">{title}</h2>
						{required && (
							<span className="text-[9px] uppercase tracking-wider font-semibold text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
								Required
							</span>
						)}
					</div>
					<p className="mt-1.5 text-xs text-white/55 leading-relaxed max-w-[320px]">
						{description}
					</p>
					{helperText && (
						<p className="mt-2 text-[11px] leading-relaxed max-w-[320px] text-amber-300/80">
							{helperText}
						</p>
					)}
				</div>

				<div className="flex items-center gap-2 text-xs">
					{statusIcon(status)}
					<span
						className={isGranted ? "text-emerald-400" : isDenied ? "text-red-400" : "text-white/50"}
					>
						{statusLabel(status)}
					</span>
				</div>

				<div className="flex items-center gap-3">
					{isGranted ? (
						<button
							onClick={advanceStep}
							data-no-window-drag="true"
							className={`px-5 py-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors cursor-pointer ${styles.tauriNoDrag}`}
						>
							Continue
						</button>
					) : (
						<>
							<button
								onClick={() => void handleGrantPermission()}
								disabled={isRequesting}
								data-no-window-drag="true"
								className={`px-5 py-2 rounded-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${styles.tauriNoDrag}`}
							>
								{isRequesting ? (
									<span className="flex items-center gap-2">
										<div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
										Requesting...
									</span>
								) : isDenied ? (
									"Open Settings"
								) : (
									"Grant Permission"
								)}
							</button>
							{!required && (
								<button
									onClick={advanceStep}
									data-no-window-drag="true"
									className={`px-4 py-2 rounded-full text-white/50 hover:text-white/80 text-sm transition-colors cursor-pointer ${styles.tauriNoDrag}`}
								>
									Skip
								</button>
							)}
						</>
					)}
				</div>
			</div>
		);
	};

	return (
		<div className="w-full h-full flex items-center justify-center">
			<div
				data-window-drag-surface="true"
				onPointerDown={handleCardPointerDown}
				className={`flex flex-col items-center gap-5 w-full max-w-[440px] px-6 py-6 rounded-[22px] ${styles.tauriDrag}`}
				style={{
					background: "linear-gradient(135deg, rgba(28,28,36,0.97) 0%, rgba(18,18,26,0.96) 100%)",
					backdropFilter: "blur(16px) saturate(140%)",
					WebkitBackdropFilter: "blur(16px) saturate(140%)",
					border: "1px solid rgba(80,80,120,0.25)",
				}}
			>
				{renderStepContent()}
				<StepDots steps={steps} currentIndex={currentIndex} />
			</div>
		</div>
	);
}

// ─── Permission Summary (shown on final step) ───────────────────────────────

function PermissionSummary({ permissions }: { permissions: PermissionState }) {
	const items: { label: string; status: PermissionStatus }[] = [
		{ label: "Screen", status: permissions.screenRecording },
		{ label: "Mic", status: permissions.microphone },
		{ label: "Camera", status: permissions.camera },
		{ label: "Accessibility", status: permissions.accessibility },
	];

	return (
		<div className="flex items-center gap-3 text-[10px]">
			{items.map((item) => (
				<div key={item.label} className="flex items-center gap-1">
					{statusIcon(item.status)}
					<span className="text-white/50">{item.label}</span>
				</div>
			))}
		</div>
	);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function isOnboardingComplete(): boolean {
	try {
		return isStorageFlagEnabled(ONBOARDING_COMPLETE_KEY, LEGACY_ONBOARDING_COMPLETE_KEYS);
	} catch {
		return false;
	}
}

export function resetOnboarding(): void {
	try {
		clearStorageFlags(ONBOARDING_COMPLETE_KEY, LEGACY_ONBOARDING_COMPLETE_KEYS);
	} catch {
		// ignore
	}
}
