import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useActor } from "@xstate/react";
import {
	AppWindow,
	BoxSelect,
	Camera,
	CheckCircle2,
	ChevronLeft,
	EyeOff,
	FolderOpen,
	Minus,
	Monitor,
	MoreVertical,
	Pause,
	Play,
	Square,
	Timer,
	Video,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import {
	MdMic,
	MdMicOff,
	MdMonitor,
	MdVideocam,
	MdVideocamOff,
	MdVolumeOff,
	MdVolumeUp,
} from "react-icons/md";
import { RxDragHandleDots2 } from "react-icons/rx";
import { buildEditorWindowQuery } from "@/components/video-editor/editorWindowParams";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import * as backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { useCameraDevices } from "../../hooks/useCameraDevices";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { usePermissions } from "../../hooks/usePermissions";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { microphoneMachine } from "../../machines/microphoneMachine";
import { isOnboardingComplete, PermissionOnboarding } from "../onboarding/PermissionOnboarding";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { Button } from "../ui/button";
import { ContentClamp } from "../ui/content-clamp";
import { Switch } from "../ui/switch";
import styles from "./LaunchWindow.module.css";

const SYSTEM_DEFAULT_MICROPHONE_ID = "__system_default_microphone__";
const COUNTDOWN_OPTIONS = [0, 5, 10, 15] as const;
const HUD_WIDTH = 780;
const HUD_HEIGHT = 155;
const HUD_EXPANDED_HEIGHT = 420;
const HIDE_HUD_FROM_RECORDING_STORAGE_KEY = "calcfocus:hide-hud-from-recording";
const LEGACY_HIDE_HUD_FROM_RECORDING_STORAGE_KEYS = ["fluxlocus:hide-hud-from-recording"];

type View = "onboarding" | "choice" | "screenshot" | "recording";
type ScreenshotMode = "screen" | "window" | "area";
type HudToolbarLayout = "normal" | "expanded";

function getInitialHideHudFromRecording() {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		for (const key of [
			HIDE_HUD_FROM_RECORDING_STORAGE_KEY,
			...LEGACY_HIDE_HUD_FROM_RECORDING_STORAGE_KEYS,
		]) {
			if (window.localStorage.getItem(key) === "true") {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

function LanguageToggle({ className }: { className?: string }) {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");

	return (
		<div
			className={cn(
				"flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] p-0.5",
				className,
			)}
			aria-label={t("language.label", "Language")}
		>
			{(["en", "zh"] as const).map((nextLocale) => {
				const isActive = locale === nextLocale;
				return (
					<button
						key={nextLocale}
						type="button"
						onClick={() => setLocale(nextLocale)}
						className={cn(
							"min-w-[42px] rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
							styles.tauriNoDrag,
							isActive ? "bg-white text-[#101114]" : "text-white/55 hover:text-white/85",
						)}
					>
						{nextLocale === "en" ? t("language.english", "EN") : t("language.chinese", "中文")}
					</button>
				);
			})}
		</div>
	);
}

function MicrophoneDeviceRow({
	device,
	selected,
	enabled,
	onSelect,
}: {
	device: { deviceId: string; label: string };
	selected: boolean;
	enabled: boolean;
	onSelect: () => void;
}) {
	const { level } = useAudioLevelMeter({
		enabled,
		deviceId: device.deviceId === SYSTEM_DEFAULT_MICROPHONE_ID ? undefined : device.deviceId,
	});

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white",
				selected && "bg-[#09cf67]/14 text-[#8cf0ba]",
				styles.tauriNoDrag,
			)}
		>
			{selected ? <MdMic size={15} /> : <MdMicOff size={15} />}
			<span className="min-w-0 flex-1 truncate">{device.label}</span>
			<AudioLevelMeter level={level} className="h-4 w-14 shrink-0 gap-1" />
		</button>
	);
}

function DeviceRow({
	icon,
	label,
	selected,
	onSelect,
}: {
	icon: React.ReactNode;
	label: string;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white",
				selected && "bg-[#09cf67]/14 text-[#8cf0ba]",
				styles.tauriNoDrag,
			)}
		>
			<span className="shrink-0">{icon}</span>
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{selected && <CheckCircle2 size={14} className="shrink-0" />}
		</button>
	);
}

async function resizeHudForToolbarLayout(layout: HudToolbarLayout) {
	const win = getCurrentWindow();
	const height = layout === "expanded" ? HUD_EXPANDED_HEIGHT : HUD_HEIGHT;
	const [position, currentSize, scale] = await Promise.all([
		win.outerPosition(),
		win.innerSize(),
		win.scaleFactor(),
	]);
	const targetPhysicalWidth = Math.round(HUD_WIDTH * scale);
	const targetPhysicalHeight = Math.round(height * scale);
	const widthDelta = targetPhysicalWidth - currentSize.width;
	const heightDelta = targetPhysicalHeight - currentSize.height;

	await win.setSize(new LogicalSize(HUD_WIDTH, height));
	await win.setPosition(
		new PhysicalPosition(Math.round(position.x - widthDelta / 2), position.y - heightDelta),
	);
}

// ─── Mode Button ────────────────────────────────────────────────────────────

function ModeButton({
	icon,
	active,
	onClick,
	title,
	disabled,
}: {
	icon: React.ReactNode;
	active: boolean;
	onClick: () => void;
	title: string;
	disabled?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			title={title}
			disabled={disabled}
			className={`flex items-center justify-center w-[30px] h-[30px] rounded-md transition-all ${styles.tauriNoDrag} ${
				active
					? "bg-white/15 text-white shadow-sm"
					: "text-white/40 hover:text-white/70 hover:bg-white/5"
			} ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
		>
			{icon}
		</button>
	);
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
	borderRadius: 9999,
	background: "linear-gradient(135deg, rgba(28,28,36,0.97) 0%, rgba(18,18,26,0.96) 100%)",
	backdropFilter: "blur(16px) saturate(140%)",
	WebkitBackdropFilter: "blur(16px) saturate(140%)",
	border: "1px solid rgba(80,80,120,0.25)",
	minHeight: 48,
};

const dialogStyle: React.CSSProperties = {
	borderRadius: 18,
	background: "linear-gradient(135deg, rgba(28,28,36,0.97) 0%, rgba(18,18,26,0.96) 100%)",
	backdropFilter: "blur(16px) saturate(140%)",
	WebkitBackdropFilter: "blur(16px) saturate(140%)",
	border: "1px solid rgba(80,80,120,0.25)",
	minHeight: 48,
};

// ─── LaunchWindow ───────────────────────────────────────────────────────────

export function LaunchWindow() {
	const t = useScopedT("launch");
	const [view, setView] = useState<View>(() => (isOnboardingComplete() ? "choice" : "onboarding"));
	const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const defaultSourceLabel = t("source.default", "Main Display");

	const permissionsHook = usePermissions();

	const {
		recording,
		paused,
		canPauseRecording,
		microphoneMuted,
		canToggleMicrophoneDuringRecording,
		countdownActive,
		countdownRemaining,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		setRecordingMicrophoneMuted,
		preparePermissions,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		cameraEnabled,
		setCameraEnabled,
		cameraDeviceId,
		setCameraDeviceId,
		countdownDelay,
		setCountdownDelay,
	} = useScreenRecorder();

	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [pausedAt, setPausedAt] = useState<number | null>(null);
	const [pausedTotal, setPausedTotal] = useState(0);
	const showCameraPreview = cameraEnabled && !recording && view === "recording";
	const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false);
	const [countdownPopoverOpen, setCountdownPopoverOpen] = useState(false);
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const [hideHudFromRecording, setHideHudFromRecording] = useState(getInitialHideHudFromRecording);

	const setMicEnabledRef = useRef(setMicrophoneEnabled);
	setMicEnabledRef.current = setMicrophoneEnabled;

	useEffect(() => {
		try {
			window.localStorage.setItem(
				HIDE_HUD_FROM_RECORDING_STORAGE_KEY,
				String(hideHudFromRecording),
			);
			for (const key of LEGACY_HIDE_HUD_FROM_RECORDING_STORAGE_KEYS) {
				window.localStorage.removeItem(key);
			}
		} catch {
			// Preference persistence is best-effort.
		}
		void backend.hudOverlaySetCaptureProtection(hideHudFromRecording).catch((error) => {
			console.error("Failed to update HUD capture protection:", error);
		});
	}, [hideHudFromRecording]);

	const providedMachine = useMemo(
		() =>
			microphoneMachine.provide({
				actions: {
					enableMic: () => setMicEnabledRef.current(true),
					disableMic: () => setMicEnabledRef.current(false),
				},
			}),
		[],
	);

	const [micState, micSend] = useActor(providedMachine);

	const isMicEnabled =
		micState.matches("on") || micState.matches("selecting") || micState.matches("lockedOn");
	const isPopoverOpen = micState.matches("selecting");

	// Only enumerate microphone devices when popover is open AND permission is granted
	const micPermissionGranted = permissionsHook.permissions.microphone === "granted";
	const {
		devices,
		selectedDeviceId,
		setSelectedDeviceId,
		isLoading: isLoadingMicrophoneDevices,
		isRequestingAccess: isRequestingMicrophoneAccess,
		permissionDenied: microphonePermissionDenied,
		error: microphoneDevicesError,
	} = useMicrophoneDevices(isPopoverOpen && micPermissionGranted);
	const camPermissionGranted = permissionsHook.permissions.camera === "granted";
	const {
		devices: cameraDevices,
		selectedDeviceId: selectedCameraDeviceId,
		setSelectedDeviceId: setSelectedCameraDeviceId,
		isLoading: isLoadingCameraDevices,
		isRequestingAccess: isRequestingCameraAccess,
		permissionDenied: cameraPermissionDenied,
		error: cameraDevicesError,
	} = useCameraDevices((cameraEnabled || cameraPopoverOpen) && camPermissionGranted);
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		setMicrophoneDeviceId(selectedDeviceId !== "default" ? selectedDeviceId : undefined);
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		setCameraDeviceId(selectedCameraDeviceId !== "default" ? selectedCameraDeviceId : undefined);
	}, [selectedCameraDeviceId, setCameraDeviceId]);

	// Sync recording state into the microphone machine
	const prevRecording = useRef(recording);
	useEffect(() => {
		if (recording && !prevRecording.current) {
			micSend({ type: "RECORDING_START" });
			setCameraPopoverOpen(false);
			setCountdownPopoverOpen(false);
			setMoreMenuOpen(false);
		} else if (!recording && prevRecording.current) {
			micSend({ type: "RECORDING_STOP" });
			setPausedAt(null);
			setPausedTotal(0);
			// When recording stops, return to choice view
			setView("choice");
			setScreenshotMode(null);
		}
		prevRecording.current = recording;
	}, [recording, micSend]);

	const expandHudForPopover =
		view !== "onboarding" &&
		(isPopoverOpen || cameraPopoverOpen || countdownPopoverOpen || moreMenuOpen);
	const hudToolbarLayout: HudToolbarLayout = expandHudForPopover ? "expanded" : "normal";
	useEffect(() => {
		if (view === "onboarding") {
			return;
		}

		void resizeHudForToolbarLayout(hudToolbarLayout).catch((error) => {
			console.error("Failed to resize HUD toolbar layout:", error);
		});
	}, [hudToolbarLayout, view]);

	// Facecam preview
	useEffect(() => {
		if (!showCameraPreview) {
			if (cameraPreviewRef.current) {
				cameraPreviewRef.current.srcObject = null;
			}
			return;
		}

		let mounted = true;
		let previewStream: MediaStream | null = null;
		const mediaDevices = navigator.mediaDevices;

		const loadPreview = async () => {
			if (!mediaDevices?.getUserMedia) return;
			try {
				previewStream = await mediaDevices.getUserMedia({
					video: cameraDeviceId
						? {
								deviceId: { exact: cameraDeviceId },
								width: { ideal: 640, max: 640 },
								height: { ideal: 360, max: 360 },
								frameRate: { ideal: 30, max: 30 },
							}
						: {
								width: { ideal: 640, max: 640 },
								height: { ideal: 360, max: 360 },
								frameRate: { ideal: 30, max: 30 },
							},
					audio: false,
				});

				if (!mounted || !cameraPreviewRef.current) {
					previewStream?.getTracks().forEach((track) => track.stop());
					return;
				}

				cameraPreviewRef.current.srcObject = previewStream;
				await cameraPreviewRef.current.play().catch(() => {
					// Ignore autoplay races for the preview element.
				});
			} catch (error) {
				console.error("Failed to load facecam preview:", error);
			}
		};

		void loadPreview();

		return () => {
			mounted = false;
			if (cameraPreviewRef.current) {
				cameraPreviewRef.current.srcObject = null;
			}
			previewStream?.getTracks().forEach((track) => track.stop());
		};
	}, [cameraDeviceId, showCameraPreview]);

	// Elapsed timer
	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) setRecordingStart(Date.now());
			if (paused) {
				if (!pausedAt) setPausedAt(Date.now());
			} else {
				if (pausedAt) {
					setPausedTotal((prev) => prev + (Date.now() - pausedAt));
					setPausedAt(null);
				}
				timer = setInterval(() => {
					if (recordingStart) {
						setElapsed(Math.floor((Date.now() - recordingStart - pausedTotal) / 1000));
					}
				}, 1000);
			}
		} else {
			setRecordingStart(null);
			setElapsed(0);
			setPausedAt(null);
			setPausedTotal(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart, paused, pausedAt, pausedTotal]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	// Source tracking
	const [selectedSource, setSelectedSource] = useState(defaultSourceLabel);
	const [hasSelectedSource, setHasSelectedSource] = useState(true);
	useEffect(() => {
		const checkSelectedSource = async () => {
			try {
				const source = await backend.getSelectedSource();
				if (source) {
					setSelectedSource(source.name);
					setHasSelectedSource(true);
				} else {
					setSelectedSource(defaultSourceLabel);
					setHasSelectedSource(true);
				}
			} catch {
				// ignore
			}
		};

		void checkSelectedSource();
		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, [defaultSourceLabel]);

	const openSourceSelector = useCallback(
		async (tab?: "screens" | "windows") => {
			const screenStatus = await backend
				.getScreenRecordingPermissionStatus()
				.catch(() => "unknown");
			if (screenStatus !== "granted") {
				const granted = await backend.requestScreenRecordingPermission().catch(() => false);
				if (!granted) {
					await backend.openScreenRecordingPreferences().catch(() => {
						// Ignore preference-opening failures and keep showing the permission alert.
					});
					alert(
						t(
							"screenshot.permissionAlert",
							"CalcFocus needs Screen Recording permission to show live screen and window previews. System Settings has been opened. After enabling it, quit and reopen CalcFocus.",
						),
					);
					return;
				}
			}

			const permissionsReady = await preparePermissions();
			if (!permissionsReady) return;

			backend.openSourceSelector(tab).catch(() => {
				// Ignore selector launch failures because the permissions flow already handled the user-facing error.
			});
		},
		[preparePermissions, t],
	);

	const runPickerFromHud = useCallback(
		async <T,>(picker: () => Promise<T | null | undefined>) => {
			micSend({ type: "CLOSE_POPOVER" });
			setCameraPopoverOpen(false);
			setCountdownPopoverOpen(false);
			setMoreMenuOpen(false);

			await backend.hudOverlayHide();
			await new Promise((resolve) => setTimeout(resolve, 350));

			try {
				const result = await picker();
				if (result == null) {
					await backend.hudOverlayShow();
				}
				return result;
			} catch (error) {
				await backend.hudOverlayShow().catch(() => {
					// Ignore show-window races after a failed picker attempt.
				});
				throw error;
			}
		},
		[micSend],
	);

	const openVideoFile = useCallback(async () => {
		const path = await runPickerFromHud(() => backend.openVideoFilePicker());
		if (!path) return;
		await backend.setCurrentVideoPath(path);
		await backend.switchToEditor(
			buildEditorWindowQuery({
				mode: "video",
				videoPath: path,
			}),
		);
	}, [runPickerFromHud]);

	const openProjectFile = useCallback(async () => {
		const result = await runPickerFromHud(() => backend.loadProjectFile());
		if (!result?.filePath) return;
		await backend.switchToEditor(
			buildEditorWindowQuery({
				mode: "project",
				projectPath: result.filePath,
			}),
		);
	}, [runPickerFromHud]);

	useEffect(() => {
		const unlistenVideo = backend.onMenuOpenVideoFile(() => {
			void openVideoFile();
		});
		const unlistenProject = backend.onMenuLoadProject(() => {
			void openProjectFile();
		});
		const unlistenNewRecording = backend.onNewRecordingFromTray(() => {
			void openSourceSelector();
		});
		return () => {
			void unlistenVideo.then((fn) => fn());
			void unlistenProject.then((fn) => fn());
			void unlistenNewRecording.then((fn) => fn());
		};
	}, [openProjectFile, openSourceSelector, openVideoFile]);

	const dividerClass = "mx-1 h-5 w-px shrink-0 bg-white/20";

	const selectedMicrophoneDeviceId = devices.some(
		(device) => device.deviceId === (microphoneDeviceId || selectedDeviceId),
	)
		? microphoneDeviceId || selectedDeviceId
		: SYSTEM_DEFAULT_MICROPHONE_ID;
	const microphoneDeviceOptions =
		devices.length > 0
			? devices
			: [
					{
						deviceId: SYSTEM_DEFAULT_MICROPHONE_ID,
						groupId: "",
						label: t("microphone.systemDefault", "System Default Microphone"),
					},
				];
	const selectedCameraDeviceIdForUi = cameraDevices.some(
		(device) => device.deviceId === (cameraDeviceId || selectedCameraDeviceId),
	)
		? cameraDeviceId || selectedCameraDeviceId
		: cameraDevices[0]?.deviceId;
	const micPermissionDeniedOrRestricted =
		permissionsHook.permissions.microphone === "denied" ||
		permissionsHook.permissions.microphone === "restricted";
	const micPermissionNotDetermined = permissionsHook.permissions.microphone === "not_determined";

	const microphoneHelperText = micPermissionDeniedOrRestricted
		? t(
				"microphone.helper.denied",
				"Microphone access was denied. Open System Settings to grant permission.",
			)
		: micPermissionNotDetermined
			? t(
					"microphone.helper.notDetermined",
					"Microphone permission is required. Click 'Grant Access' below.",
				)
			: isRequestingMicrophoneAccess
				? t("microphone.helper.requesting", "Requesting microphone access to show all inputs...")
				: microphonePermissionDenied
					? t(
							"microphone.helper.permissionDenied",
							"Microphone access was denied. Using the system default microphone.",
						)
					: microphoneDevicesError
						? t("microphone.helper.fallback", "Using the system default microphone in this window.")
						: isLoadingMicrophoneDevices
							? t("microphone.helper.loading", "Loading microphone devices...")
							: t("microphone.helper.ready", "Choose which microphone to record.");

	const camPermissionDeniedOrRestricted =
		permissionsHook.permissions.camera === "denied" ||
		permissionsHook.permissions.camera === "restricted";

	const cameraHelperText = camPermissionDeniedOrRestricted
		? t(
				"camera.helper.denied",
				"Camera access was denied. Open System Settings to grant permission.",
			)
		: isRequestingCameraAccess
			? t("camera.helper.requesting", "Requesting camera access to show all cameras...")
			: cameraPermissionDenied
				? t(
						"camera.helper.permissionDenied",
						"Camera access was denied. Using the default camera when available.",
					)
				: cameraDevicesError
					? t("camera.helper.fallback", "Camera device listing is unavailable in this window.")
					: isLoadingCameraDevices
						? t("camera.helper.loading", "Loading camera devices...")
						: t("camera.helper.ready", "Choose which facecam to preview and record.");

	const expandHudBeforeOpeningMenu = (openMenu: () => void) => {
		if (expandHudForPopover) {
			openMenu();
			return;
		}

		void resizeHudForToolbarLayout("expanded")
			.catch((error) => {
				console.error("Failed to expand HUD toolbar layout:", error);
			})
			.finally(openMenu);
	};

	const toggleMicMenu = () => {
		if (recording) return;
		if (isPopoverOpen) {
			micSend({ type: "CLICK" });
			return;
		}

		expandHudBeforeOpeningMenu(() => {
			setCameraPopoverOpen(false);
			setCountdownPopoverOpen(false);
			setMoreMenuOpen(false);
			micSend({ type: "CLICK" });
		});
	};

	const toggleCameraMenu = () => {
		if (recording) return;
		if (cameraPopoverOpen) {
			setCameraPopoverOpen(false);
			return;
		}

		expandHudBeforeOpeningMenu(() => {
			if (isPopoverOpen) micSend({ type: "CLOSE_POPOVER" });
			setCountdownPopoverOpen(false);
			setMoreMenuOpen(false);
			setCameraPopoverOpen(true);
		});
	};

	const toggleCountdownMenu = () => {
		if (recording || countdownActive) return;
		if (countdownPopoverOpen) {
			setCountdownPopoverOpen(false);
			return;
		}

		expandHudBeforeOpeningMenu(() => {
			if (isPopoverOpen) micSend({ type: "CLOSE_POPOVER" });
			setCameraPopoverOpen(false);
			setMoreMenuOpen(false);
			setCountdownPopoverOpen(true);
		});
	};

	const toggleMoreMenu = () => {
		if (recording) return;
		if (moreMenuOpen) {
			setMoreMenuOpen(false);
			return;
		}

		expandHudBeforeOpeningMenu(() => {
			if (isPopoverOpen) micSend({ type: "CLOSE_POPOVER" });
			setCameraPopoverOpen(false);
			setCountdownPopoverOpen(false);
			setMoreMenuOpen(true);
		});
	};

	const openRecordingsFolderFromMenu = () => {
		setMoreMenuOpen(false);
		void backend.openRecordingsFolder();
	};

	const toggleHideHudFromRecordingFromMenu = () => {
		setHideHudFromRecording((current) => !current);
	};

	const handleToolbarMinimize = () => {
		micSend({ type: "CLOSE_POPOVER" });
		setCameraPopoverOpen(false);
		setCountdownPopoverOpen(false);
		setMoreMenuOpen(false);
		void backend.hudOverlayMinimize();
	};

	const canToggleActiveMicrophone =
		recording && microphoneEnabled && canToggleMicrophoneDuringRecording;

	const toolbarDeviceMenu = (isPopoverOpen ||
		cameraPopoverOpen ||
		countdownPopoverOpen ||
		moreMenuOpen) && (
		<div
			className={`w-[280px] rounded-2xl border border-white/15 bg-[rgba(18,18,26,0.96)] p-3 text-slate-100 shadow-xl backdrop-blur-xl ${styles.tauriNoDrag}`}
		>
			{isPopoverOpen && (
				<>
					<div className="mb-2 flex items-center justify-between">
						<span className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/50">
							{t("microphone.label", "Microphone")}
						</span>
						<Switch
							checked={isMicEnabled}
							onCheckedChange={(checked) => {
								if (!checked) micSend({ type: "DISABLE" });
							}}
						/>
					</div>
					<div className="mb-3 text-xs text-white/65">
						<div className="flex items-center gap-2">
							{(isLoadingMicrophoneDevices || isRequestingMicrophoneAccess) && (
								<div className="h-3 w-3 rounded-full border-2 border-white/25 border-t-white animate-spin" />
							)}
							<span>{microphoneHelperText}</span>
						</div>
					</div>

					{!micPermissionGranted && permissionsHook.isMacOS ? (
						<button
							type="button"
							onClick={() => {
								if (micPermissionDeniedOrRestricted) {
									void permissionsHook.openPermissionSettings("microphone");
								} else {
									void permissionsHook.requestMicrophoneAccess();
								}
							}}
							className={`h-8 w-full rounded-full border border-[#09cf67]/25 bg-[#09cf67]/18 px-3 py-1 text-xs font-medium text-[#8cf0ba] transition-colors hover:bg-[#09cf67]/28 ${styles.tauriNoDrag}`}
						>
							{micPermissionDeniedOrRestricted
								? t("microphone.openSystemSettings", "Open System Settings")
								: t("microphone.grantAccess", "Grant Microphone Access")}
						</button>
					) : (
						<div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto pr-0.5">
							{microphoneDeviceOptions.map((device) => {
								const isSystemDefaultDevice = device.deviceId === SYSTEM_DEFAULT_MICROPHONE_ID;
								const isSelected = isSystemDefaultDevice
									? selectedMicrophoneDeviceId === SYSTEM_DEFAULT_MICROPHONE_ID
									: selectedMicrophoneDeviceId === device.deviceId;

								return (
									<MicrophoneDeviceRow
										key={device.deviceId}
										device={device}
										selected={isMicEnabled && isSelected}
										enabled={isPopoverOpen}
										onSelect={() => {
											if (isSystemDefaultDevice) {
												setSelectedDeviceId("default");
												setMicrophoneDeviceId(undefined);
											} else {
												setSelectedDeviceId(device.deviceId);
												setMicrophoneDeviceId(device.deviceId);
											}
										}}
									/>
								);
							})}
						</div>
					)}
				</>
			)}

			{cameraPopoverOpen && (
				<>
					<div className="mb-2 flex items-center justify-between">
						<span className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/50">
							{t("camera.label", "Facecam")}
						</span>
						<Switch
							checked={cameraEnabled}
							onCheckedChange={(checked) => setCameraEnabled(checked)}
						/>
					</div>
					<div className="mb-3 flex items-center gap-2 text-xs text-white/65">
						{(isLoadingCameraDevices || isRequestingCameraAccess) && (
							<div className="h-3 w-3 rounded-full border-2 border-white/25 border-t-white animate-spin" />
						)}
						<span>{cameraHelperText}</span>
					</div>

					{!camPermissionGranted && permissionsHook.isMacOS ? (
						<button
							type="button"
							onClick={() => {
								if (camPermissionDeniedOrRestricted) {
									void permissionsHook.openPermissionSettings("camera");
								} else {
									void permissionsHook.requestCameraAccess();
								}
							}}
							className={`h-8 w-full rounded-full border border-[#09cf67]/25 bg-[#09cf67]/18 px-3 py-1 text-xs font-medium text-[#8cf0ba] transition-colors hover:bg-[#09cf67]/28 ${styles.tauriNoDrag}`}
						>
							{camPermissionDeniedOrRestricted
								? t("camera.openSystemSettings", "Open System Settings")
								: t("camera.grantAccess", "Grant Camera Access")}
						</button>
					) : (
						<div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto pr-0.5">
							{cameraEnabled && (
								<DeviceRow
									icon={<MdVideocamOff size={15} />}
									label={t("camera.turnOff", "Turn off facecam")}
									selected={false}
									onSelect={() => {
										setCameraEnabled(false);
										setCameraPopoverOpen(false);
									}}
								/>
							)}
							{!cameraEnabled && (
								<div className="px-2.5 py-1 text-[11px] text-white/45">
									{t("camera.selectToEnable", "Select a camera to enable facecam.")}
								</div>
							)}
							{cameraDevices.map((device) => (
								<DeviceRow
									key={device.deviceId}
									icon={
										selectedCameraDeviceIdForUi === device.deviceId && cameraEnabled ? (
											<MdVideocam size={15} />
										) : (
											<MdVideocamOff size={15} />
										)
									}
									label={device.label}
									selected={cameraEnabled && selectedCameraDeviceIdForUi === device.deviceId}
									onSelect={() => {
										setCameraEnabled(true);
										setSelectedCameraDeviceId(device.deviceId);
										setCameraDeviceId(device.deviceId === "default" ? undefined : device.deviceId);
									}}
								/>
							))}
							{cameraDevices.length === 0 && (
								<div className="py-4 text-center text-xs text-white/45">
									{t("camera.noDevices", "No cameras found")}
								</div>
							)}
						</div>
					)}
				</>
			)}

			{countdownPopoverOpen && (
				<>
					<div className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
						{t("recording.countdownDelay", "Countdown delay")}
					</div>
					<div className="flex flex-col gap-1">
						{COUNTDOWN_OPTIONS.map((delay) => (
							<DeviceRow
								key={delay}
								icon={<Timer size={15} />}
								label={delay === 0 ? t("recording.noDelay", "No delay") : `${delay}s`}
								selected={countdownDelay === delay}
								onSelect={() => {
									setCountdownDelay(delay);
									setCountdownPopoverOpen(false);
								}}
							/>
						))}
					</div>
				</>
			)}

			{moreMenuOpen && (
				<>
					<div className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
						{t("recording.more", "More")}
					</div>
					<div className="flex flex-col gap-1">
						<DeviceRow
							icon={<FolderOpen size={15} />}
							label={t("recording.openRecordingsFolder", "Open recordings folder")}
							selected={false}
							onSelect={openRecordingsFolderFromMenu}
						/>
						<DeviceRow
							icon={<Video size={15} />}
							label={t("recording.openVideoFile", "Open video file")}
							selected={false}
							onSelect={() => {
								void openVideoFile();
							}}
						/>
						<DeviceRow
							icon={<EyeOff size={15} />}
							label={t("recording.hideHudFromRecording", "Hide HUD from recording")}
							selected={hideHudFromRecording}
							onSelect={toggleHideHudFromRecordingFromMenu}
						/>
					</div>
				</>
			)}
		</div>
	);

	const toolbarWindowActions = (
		<div className={`flex items-center gap-0.5 ${styles.tauriNoDrag}`}>
			<Button
				variant="link"
				size="icon"
				onClick={handleToolbarMinimize}
				title={t("recording.minimize", "Minimize")}
				className={`text-white/45 hover:bg-transparent hover:text-white/80 ${styles.tauriNoDrag}`}
			>
				<Minus size={14} />
			</Button>
			<Button
				variant="link"
				size="icon"
				onClick={() => void backend.hudOverlayClose()}
				title={t("recording.close", "Close")}
				className={`text-white/45 hover:bg-transparent hover:text-red-300 ${styles.tauriNoDrag}`}
			>
				<X size={14} />
			</Button>
		</div>
	);

	const toolbarMoreButton = !recording && (
		<Button
			variant="link"
			size="icon"
			onClick={toggleMoreMenu}
			title={t("recording.more", "More")}
			className={`text-white/55 hover:bg-transparent hover:text-white/85 ${styles.tauriNoDrag}`}
		>
			<MoreVertical size={16} />
		</Button>
	);

	const handleStartRecordingFromToolbar = () => {
		setMoreMenuOpen(false);
		toggleRecording();
	};

	// ─── Screenshot capture ───────────────────────────────────────────────────

	const handleScreenshotModeSelect = async (mode: ScreenshotMode) => {
		setScreenshotMode(mode);
		if (mode === "area") {
			backend.closeSourceSelector().catch(() => {
				// Ignore close races before the area capture flow takes over.
			});
			await handleAreaCapture();
		} else {
			await openSourceSelector(mode === "window" ? "windows" : "screens");
		}
	};

	const handleScreenshotCapture = async () => {
		if (isCapturing || !screenshotMode) return;
		setIsCapturing(true);

		try {
			if (screenshotMode === "screen") {
				// Hide HUD so it doesn't appear in the screenshot
				await backend.hudOverlayHide();
				await new Promise((resolve) => setTimeout(resolve, 350));

				const path = await backend.takeScreenshot("screen", undefined);
				if (path) {
					await backend.switchToImageEditor();
				} else {
					await backend.hudOverlayShow();
				}
			} else if (screenshotMode === "window") {
				const source = await backend.getSelectedSource();
				const windowId = source?.windowId;

				if (!windowId) {
					await openSourceSelector();
					setIsCapturing(false);
					return;
				}

				const path = await backend.takeScreenshot("window", windowId);
				if (path) {
					await backend.switchToImageEditor();
				}
			}
		} catch (error) {
			console.error("Screenshot capture failed:", error);
			await backend.hudOverlayShow().catch(() => {
				// Ignore show-window races after a failed capture attempt.
			});
		} finally {
			setIsCapturing(false);
		}
	};

	const handleAreaCapture = async () => {
		if (isCapturing) return;
		setIsCapturing(true);

		try {
			await backend.hudOverlayHide();
			await new Promise((resolve) => setTimeout(resolve, 350));

			const path = await backend.takeScreenshot("area", undefined);
			if (path) {
				await backend.switchToImageEditor();
			} else {
				// User cancelled area selection
				await backend.hudOverlayShow();
			}
		} catch (error) {
			console.error("Area capture failed:", error);
			await backend.hudOverlayShow().catch(() => {
				// Ignore show-window races after a failed area capture attempt.
			});
		} finally {
			setIsCapturing(false);
		}
	};

	// ─── Render helpers ───────────────────────────────────────────────────────

	const handleDragHandlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();

		void backend.startHudOverlayDrag().catch((error) => {
			console.error("Failed to start HUD overlay drag:", error);
		});
	}, []);

	const dragHandle = (
		<div
			className={`flex items-center px-1 cursor-grab active:cursor-grabbing ${styles.dragHandle}`}
			onPointerDown={handleDragHandlePointerDown}
		>
			<RxDragHandleDots2 size={16} className="text-white/35" />
		</div>
	);

	// ─── Render ───────────────────────────────────────────────────────────────

	// Show the onboarding overlay on first launch
	if (view === "onboarding") {
		return (
			<PermissionOnboarding
				permissionsHook={permissionsHook}
				onComplete={() => setView("choice")}
			/>
		);
	}

	return (
		<div className="w-full h-full flex items-end justify-center bg-transparent overflow-visible">
			<div className={`flex flex-col items-center gap-2 mx-auto ${styles.tauriDrag}`}>
				{/* ── Facecam preview (only in recording view, before recording starts) ── */}
				{showCameraPreview && (
					<div
						className={`flex items-center gap-3 rounded-[22px] border border-white/15 bg-[rgba(18,18,26,0.92)] px-3 py-2 shadow-xl backdrop-blur-xl ${styles.tauriNoDrag}`}
					>
						<div className="h-14 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
							<video
								ref={cameraPreviewRef}
								className="h-full w-full object-cover"
								muted
								playsInline
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/50">
								{t("camera.label", "Facecam")}
							</div>
							<div className="max-w-[230px] text-[11px] text-white/55">{cameraHelperText}</div>
							<div className="max-w-[230px] text-[10px] text-white/35">
								{t("camera.openDeviceMenu", "Click the camera icon to choose a device.")}
							</div>
						</div>
					</div>
				)}

				{toolbarDeviceMenu}

				{/* ================================================================
            VIEW 1 — Choice Dialog
            [drag]  [ Screenshot ]  [ Record Video ]
           ================================================================ */}
				{view === "choice" && !recording && (
					<div
						className={`flex items-center gap-3 px-4 py-3 ${styles.tauriDrag} ${styles.hudBar}`}
						style={dialogStyle}
					>
						{dragHandle}

						<button
							onClick={() => {
								setMoreMenuOpen(false);
								setView("screenshot");
								setScreenshotMode(null);
							}}
							className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.15] transition-all cursor-pointer ${styles.tauriNoDrag}`}
						>
							<Camera size={16} className="text-white/70" />
							<span className="text-[13px] font-medium text-white/80">
								{t("choice.screenshot", "Screenshot")}
							</span>
						</button>

						<button
							onClick={() => {
								setMoreMenuOpen(false);
								setView("recording");
							}}
							className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.15] transition-all cursor-pointer ${styles.tauriNoDrag}`}
						>
							<Video size={16} className="text-white/70" />
							<span className="text-[13px] font-medium text-white/80">
								{t("choice.recordVideo", "Record Video")}
							</span>
						</button>

						<div className={dividerClass} />
						<LanguageToggle />
						<div className={dividerClass} />
						{toolbarMoreButton}
						<div className={dividerClass} />
						{toolbarWindowActions}
					</div>
				)}

				{/* ================================================================
            VIEW 2 — Screenshot Bar
            [drag] [← back] [Screen] [Window] [Area] | [source] | [Take Screenshot]
           ================================================================ */}
				{view === "screenshot" && !recording && (
					<div
						className={`w-full mx-auto flex items-center gap-1.5 px-3 py-2 ${styles.tauriDrag} ${styles.hudBar}`}
						style={barStyle}
					>
						{dragHandle}

						{/* Back button */}
						<Button
							variant="link"
							size="icon"
							onClick={() => {
								setMoreMenuOpen(false);
								setView("choice");
								setScreenshotMode(null);
							}}
							title={t("back", "Back")}
							className={`text-white/60 hover:text-white hover:bg-transparent ${styles.tauriNoDrag}`}
						>
							<ChevronLeft size={16} />
						</Button>

						<div className={dividerClass} />

						{/* Screenshot mode buttons */}
						<div className="flex items-center gap-0.5 bg-white/[0.06] rounded-lg p-[3px]">
							<ModeButton
								icon={<Monitor size={15} />}
								active={screenshotMode === "screen"}
								onClick={() => handleScreenshotModeSelect("screen")}
								title={t("screenshot.captureEntireScreen", "Capture Entire Screen")}
							/>
							<ModeButton
								icon={<AppWindow size={15} />}
								active={screenshotMode === "window"}
								onClick={() => handleScreenshotModeSelect("window")}
								title={t("screenshot.captureWindow", "Capture Window")}
							/>
							<ModeButton
								icon={<BoxSelect size={15} />}
								active={screenshotMode === "area"}
								onClick={() => handleScreenshotModeSelect("area")}
								title={t("screenshot.captureArea", "Capture Area")}
							/>
						</div>

						{/* Source display + Take Screenshot CTA — shown after source is selected */}
						{screenshotMode && screenshotMode !== "area" && hasSelectedSource && (
							<>
								<div className={dividerClass} />

								{/* Selected source indicator (clickable to re-open source selector) */}
								<Button
									variant="link"
									size="sm"
									className={`gap-1 text-white/60 bg-transparent hover:bg-transparent px-0 text-xs ${styles.tauriNoDrag}`}
									onClick={() => openSourceSelector()}
									title={selectedSource}
								>
									<MdMonitor size={14} className="text-white/60" />
									<ContentClamp truncateLength={10}>{selectedSource}</ContentClamp>
								</Button>

								<div className={dividerClass} />

								{/* Take Screenshot CTA */}
								<Button
									variant="link"
									size="sm"
									onClick={handleScreenshotCapture}
									disabled={isCapturing}
									className={`gap-1.5 text-white bg-transparent hover:bg-transparent px-1 text-xs font-medium ${styles.tauriNoDrag}`}
								>
									{isCapturing ? (
										<>
											<div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
											<span className="text-white/70">
												{t("screenshot.capturing", "Capturing...")}
											</span>
										</>
									) : (
										<>
											<Camera size={14} className="text-white/85" />
											<span className="text-white/80">
												{t("screenshot.take", "Take Screenshot")}
											</span>
										</>
									)}
								</Button>
							</>
						)}

						<div className="ml-auto" />
						<LanguageToggle />
						<div className={dividerClass} />
						{toolbarMoreButton}
						<div className={dividerClass} />
						{toolbarWindowActions}
					</div>
				)}

				{/* ================================================================
            VIEW 3 — Recording Controls
            [drag] [← back] [source] | [volume] [mic] [camera] | [record/stop]
           ================================================================ */}
				{(view === "recording" || recording) && (
					<>
						<div
							className={`w-full mx-auto flex items-center gap-1.5 px-3 py-2 ${styles.tauriDrag} ${styles.hudBar}`}
							style={barStyle}
						>
							{dragHandle}

							{recording ? (
								<>
									<div className={`flex items-center gap-2 ${styles.tauriNoDrag}`}>
										<div
											className={cn(
												"h-2 w-2 rounded-full",
												paused ? "bg-amber-400" : "bg-red-400 animate-pulse",
											)}
										/>
										<span
											className={cn(
												"text-[11px] font-semibold tracking-[0.12em] uppercase",
												paused ? "text-amber-300" : "text-red-300",
											)}
										>
											{paused
												? t("recording.paused", "Paused")
												: t("recording.recordingInProgress", "Recording")}
										</span>
										<span
											className={cn(
												"min-w-[54px] text-center font-mono text-xs font-semibold tabular-nums",
												paused ? "text-amber-200" : "text-white/90",
											)}
										>
											{formatTime(elapsed)}
										</span>
									</div>

									<div className={dividerClass} />

									<div className={`flex items-center gap-1 ${styles.tauriNoDrag}`}>
										<Button
											variant="link"
											size="icon"
											onClick={() => setRecordingMicrophoneMuted(!microphoneMuted)}
											disabled={!canToggleActiveMicrophone}
											title={
												canToggleActiveMicrophone
													? microphoneMuted
														? t("recording.enableMicrophone", "Enable microphone")
														: t("recording.disableMicrophone", "Disable microphone")
													: t(
															"recording.microphoneUnavailableDuringRecording",
															"Microphone cannot be changed during this recording.",
														)
											}
											className={`text-white/80 hover:bg-transparent disabled:opacity-35 ${styles.tauriNoDrag}`}
										>
											{microphoneEnabled && !microphoneMuted ? (
												<MdMic size={18} className="text-[#09cf67]" />
											) : (
												<MdMicOff size={18} className="text-white/35" />
											)}
										</Button>

										<Button
											variant="link"
											size="icon"
											onClick={paused ? resumeRecording : pauseRecording}
											disabled={!canPauseRecording}
											title={
												paused ? t("recording.resume", "Resume") : t("recording.pause", "Pause")
											}
											className={cn(
												`text-white/80 hover:bg-transparent disabled:opacity-35 ${styles.tauriNoDrag}`,
												paused && "text-[#09cf67]",
											)}
										>
											{paused ? (
												<Play size={18} fill="currentColor" strokeWidth={0} />
											) : (
												<Pause size={18} />
											)}
										</Button>

										<Button
											variant="link"
											size="icon"
											onClick={() => toggleRecording()}
											title={t("recording.stop", "Stop")}
											className={`text-red-400 hover:bg-transparent hover:text-red-300 ${styles.tauriNoDrag}`}
										>
											<Square size={16} fill="currentColor" strokeWidth={0} />
										</Button>
									</div>

									<div className="ml-auto" />
									{toolbarWindowActions}
								</>
							) : (
								<>
									<Button
										variant="link"
										size="icon"
										onClick={() => {
											setMoreMenuOpen(false);
											setView("choice");
										}}
										title={t("back", "Back")}
										className={`text-white/60 hover:text-white hover:bg-transparent ${styles.tauriNoDrag}`}
									>
										<ChevronLeft size={16} />
									</Button>
									<div className={dividerClass} />

									<Button
										variant="link"
										size="sm"
										className={`gap-1 text-white/80 bg-transparent hover:bg-transparent px-0 text-xs ${styles.tauriNoDrag}`}
										onClick={() => openSourceSelector()}
										title={selectedSource}
									>
										<MdMonitor size={14} className="text-white/80" />
										<ContentClamp truncateLength={6}>{selectedSource}</ContentClamp>
									</Button>

									<div className={dividerClass} />

									<div className={`flex items-center gap-1 ${styles.tauriNoDrag}`}>
										<Button
											variant="link"
											size="icon"
											onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
											title={
												systemAudioEnabled
													? t("recording.disableSystemAudio", "Disable system audio")
													: t("recording.enableSystemAudio", "Enable system audio")
											}
											className={`text-white/80 hover:bg-transparent ${styles.tauriNoDrag}`}
										>
											{systemAudioEnabled ? (
												<MdVolumeUp size={16} className="text-[#09cf67]" />
											) : (
												<MdVolumeOff size={16} className="text-white/35" />
											)}
										</Button>

										<Button
											variant="link"
											size="icon"
											onClick={toggleMicMenu}
											title={
												isMicEnabled
													? t("microphone.settings", "Microphone settings")
													: t("microphone.enable", "Enable microphone")
											}
											className={`text-white/80 hover:bg-transparent ${styles.tauriNoDrag}`}
										>
											{isMicEnabled ? (
												<MdMic size={16} className="text-[#09cf67]" />
											) : (
												<MdMicOff size={16} className="text-white/35" />
											)}
										</Button>

										<Button
											variant="link"
											size="icon"
											onClick={toggleCameraMenu}
											title={
												cameraEnabled
													? t("recording.disableFacecam", "Disable facecam")
													: t("recording.enableFacecam", "Enable facecam")
											}
											className={`text-white/80 hover:bg-transparent ${styles.tauriNoDrag}`}
										>
											{cameraEnabled ? (
												<MdVideocam size={16} className="text-[#09cf67]" />
											) : (
												<MdVideocamOff size={16} className="text-white/35" />
											)}
										</Button>

										<Button
											variant="link"
											size="icon"
											onClick={toggleCountdownMenu}
											disabled={countdownActive}
											title={t("recording.countdownDelay", "Countdown delay")}
											className={`gap-1 text-white/80 hover:bg-transparent ${styles.tauriNoDrag}`}
										>
											<Timer
												size={16}
												className={countdownDelay > 0 ? "text-[#09cf67]" : "text-white/35"}
											/>
											{countdownDelay > 0 && (
												<span className="text-[10px] text-[#8cf0ba]">{countdownDelay}s</span>
											)}
										</Button>
									</div>

									<div className={dividerClass} />

									<Button
										variant="link"
										size="icon"
										onClick={
											hasSelectedSource
												? handleStartRecordingFromToolbar
												: () => openSourceSelector()
										}
										disabled={countdownActive || !hasSelectedSource}
										title={t("recording.record", "Record")}
										className={`h-9 w-9 text-white bg-transparent hover:bg-transparent disabled:opacity-35 ${styles.tauriNoDrag}`}
									>
										{countdownActive ? (
											<span className="font-mono text-xs font-semibold tabular-nums text-[#8cf0ba]">
												{countdownRemaining}s
											</span>
										) : (
											<BsRecordCircle size={22} className="text-red-400" />
										)}
									</Button>

									<div className="ml-auto" />
									<LanguageToggle />
									<div className={dividerClass} />
									{toolbarMoreButton}
									<div className={dividerClass} />
									{toolbarWindowActions}
								</>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
