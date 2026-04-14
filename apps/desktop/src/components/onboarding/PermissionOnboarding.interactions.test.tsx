// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionState, UsePermissionsResult } from "../../hooks/usePermissions";

const tauriMocks = vi.hoisted(() => {
	const setSize = vi.fn(async () => undefined);
	const center = vi.fn(async () => undefined);
	const setAlwaysOnTop = vi.fn(async () => undefined);
	const minimize = vi.fn(async () => undefined);

	return {
		startHudOverlayDrag: vi.fn(async () => undefined),
		getCurrentWindow: vi.fn(() => ({
			setSize,
			center,
			setAlwaysOnTop,
			minimize,
		})),
		primaryMonitor: vi.fn(async () => null),
		setSize,
		center,
		setAlwaysOnTop,
		minimize,
	};
});

vi.mock("../../lib/backend", () => ({
	startHudOverlayDrag: tauriMocks.startHudOverlayDrag,
}));

vi.mock("@tauri-apps/api/window", () => ({
	getCurrentWindow: tauriMocks.getCurrentWindow,
	primaryMonitor: tauriMocks.primaryMonitor,
}));

vi.mock("@tauri-apps/api/dpi", () => ({
	LogicalSize: class LogicalSize {
		constructor(
			public width: number,
			public height: number,
		) {}
	},
	PhysicalPosition: class PhysicalPosition {
		constructor(
			public x: number,
			public y: number,
		) {}
	},
}));

const { PermissionOnboarding } = await import("./PermissionOnboarding");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flushEffects() {
	await act(async () => {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

async function click(element: Element | null) {
	if (!element) {
		throw new Error("Expected element to exist");
	}

	await act(async () => {
		element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
		element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
		element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

async function pointerDown(element: Element | null) {
	if (!element) {
		throw new Error("Expected element to exist");
	}

	await act(async () => {
		element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
	});
}

function createPermissionsHook(
	overrides: Partial<Omit<UsePermissionsResult, "permissions">> & {
		permissions?: Partial<PermissionState>;
	} = {},
): UsePermissionsResult {
	const permissions: PermissionState = {
		screenRecording: "not_determined",
		microphone: "not_determined",
		camera: "not_determined",
		accessibility: "granted",
		...overrides.permissions,
	};

	return {
		isMacOS: false,
		isChecking: false,
		refreshPermissions: vi.fn(async () => permissions),
		requestAccessibilityAccess: vi.fn(async () => false),
		requestMicrophoneAccess: vi.fn(async () => false),
		requestCameraAccess: vi.fn(async () => false),
		requestScreenRecordingAccess: vi.fn(async () => false),
		openPermissionSettings: vi.fn(async () => undefined),
		allRequiredPermissionsGranted: false,
		allPermissionsGranted: false,
		...overrides,
		permissions,
	};
}

async function renderOnboarding(permissionsHook: UsePermissionsResult = createPermissionsHook()) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root: Root = createRoot(container);

	await act(async () => {
		root.render(<PermissionOnboarding permissionsHook={permissionsHook} onComplete={vi.fn()} />);
	});
	await flushEffects();

	return {
		container,
		unmount: async () => {
			await act(async () => {
				root.unmount();
			});
			container.remove();
		},
	};
}

function getButtonByText(container: HTMLElement, text: string) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === text,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
	Object.defineProperty(globalThis, "PointerEvent", {
		configurable: true,
		value: MouseEvent,
	});
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("PermissionOnboarding interactions", () => {
	it("refreshes permission state when the app regains focus", async () => {
		const refreshPermissions = vi.fn(async () => ({
			screenRecording: "denied" as const,
			microphone: "not_determined" as const,
			camera: "not_determined" as const,
			accessibility: "granted" as const,
		}));

		const harness = await renderOnboarding(
			createPermissionsHook({
				isMacOS: true,
				permissions: { screenRecording: "denied" },
				refreshPermissions,
			}),
		);

		refreshPermissions.mockClear();

		await act(async () => {
			window.dispatchEvent(new Event("focus"));
		});

		expect(refreshPermissions).toHaveBeenCalledTimes(1);

		await harness.unmount();
	});

	it("starts a real window drag when the card background is pressed", async () => {
		const harness = await renderOnboarding();
		tauriMocks.startHudOverlayDrag.mockClear();

		await pointerDown(harness.container.querySelector("[data-window-drag-surface='true']"));

		expect(tauriMocks.startHudOverlayDrag).toHaveBeenCalledTimes(1);

		await harness.unmount();
	});

	it("does not start a window drag when pressing an interactive button", async () => {
		const harness = await renderOnboarding();
		tauriMocks.startHudOverlayDrag.mockClear();

		await pointerDown(getButtonByText(harness.container, "Get Started") ?? null);

		expect(tauriMocks.startHudOverlayDrag).not.toHaveBeenCalled();

		await harness.unmount();
	});

	it("minimizes the onboarding window before opening macOS System Settings", async () => {
		const requestScreenRecordingAccess = vi.fn(async () => false);
		const openPermissionSettings = vi.fn(async () => undefined);
		const refreshPermissions = vi.fn(async () => ({
			screenRecording: "denied" as const,
			microphone: "not_determined" as const,
			camera: "not_determined" as const,
			accessibility: "granted" as const,
		}));

		const harness = await renderOnboarding(
			createPermissionsHook({
				isMacOS: true,
				permissions: { screenRecording: "denied" },
				requestScreenRecordingAccess,
				openPermissionSettings,
				refreshPermissions,
			}),
		);
		vi.useFakeTimers();

		tauriMocks.setAlwaysOnTop.mockClear();
		tauriMocks.minimize.mockClear();

		await click(getButtonByText(harness.container, "Get Started") ?? null);
		await click(getButtonByText(harness.container, "Open Settings") ?? null);

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(requestScreenRecordingAccess).toHaveBeenCalledTimes(1);
		expect(tauriMocks.setAlwaysOnTop).toHaveBeenCalledWith(false);
		expect(tauriMocks.minimize).toHaveBeenCalledTimes(1);
		expect(openPermissionSettings).toHaveBeenCalledWith("screenRecording");
		expect(refreshPermissions).toHaveBeenCalled();

		await harness.unmount();
	});

	it("shows return guidance after opening Screen Recording settings on macOS", async () => {
		const requestScreenRecordingAccess = vi.fn(async () => false);
		const openPermissionSettings = vi.fn(async () => undefined);
		const refreshPermissions = vi.fn(async () => ({
			screenRecording: "denied" as const,
			microphone: "not_determined" as const,
			camera: "not_determined" as const,
			accessibility: "granted" as const,
		}));

		const harness = await renderOnboarding(
			createPermissionsHook({
				isMacOS: true,
				permissions: { screenRecording: "denied" },
				requestScreenRecordingAccess,
				openPermissionSettings,
				refreshPermissions,
			}),
		);
		vi.useFakeTimers();

		await click(getButtonByText(harness.container, "Get Started") ?? null);
		await click(getButtonByText(harness.container, "Open Settings") ?? null);

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(harness.container.textContent).toContain(
			"Enable Screen Recording in System Settings, then return to CalcFocus. We'll detect the change automatically.",
		);
		expect(harness.container.textContent).toContain("Denied");
		expect(getButtonByText(harness.container, "Open Settings")).not.toBeNull();

		await harness.unmount();
	});

	it("includes an accessibility step for required macOS permission flow", async () => {
		const requestAccessibilityAccess = vi.fn(async () => false);
		const openPermissionSettings = vi.fn(async () => undefined);
		const refreshPermissions = vi.fn(async () => ({
			screenRecording: "granted" as const,
			microphone: "not_determined" as const,
			camera: "not_determined" as const,
			accessibility: "denied" as const,
		}));

		const harness = await renderOnboarding(
			createPermissionsHook({
				isMacOS: true,
				permissions: {
					screenRecording: "granted",
					accessibility: "denied",
				},
				requestAccessibilityAccess,
				openPermissionSettings,
				refreshPermissions,
			}),
		);
		vi.useFakeTimers();

		await click(getButtonByText(harness.container, "Get Started") ?? null);
		await click(getButtonByText(harness.container, "Continue") ?? null);

		expect(harness.container.textContent).toContain("Accessibility");
		expect(harness.container.textContent).toContain("Required");

		await click(getButtonByText(harness.container, "Open Settings") ?? null);

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(requestAccessibilityAccess).toHaveBeenCalledTimes(1);
		expect(openPermissionSettings).toHaveBeenCalledWith("accessibility");
		expect(harness.container.textContent).toContain(
			"Enable Accessibility in System Settings, then return to CalcFocus. We'll detect the change automatically.",
		);

		await harness.unmount();
	});
});
