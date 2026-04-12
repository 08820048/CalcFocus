export interface SpringState {
	value: number;
	velocity: number;
	initialized: boolean;
}

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass: number;
	restDelta?: number;
	restSpeed?: number;
}

const CURSOR_SMOOTHING_MIN = 0;
const CURSOR_SMOOTHING_MAX = 2;
const CURSOR_SMOOTHING_LEGACY_MAX = 0.5;

export function createSpringState(initialValue = 0): SpringState {
	return {
		value: initialValue,
		velocity: 0,
		initialized: false,
	};
}

export function resetSpringState(state: SpringState, initialValue?: number) {
	if (typeof initialValue === "number") {
		state.value = initialValue;
	}

	state.velocity = 0;
	state.initialized = false;
}

export function clampDeltaMs(deltaMs: number, fallbackMs = 1000 / 60) {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
		return fallbackMs;
	}

	return Math.min(80, Math.max(1, deltaMs));
}

function resolveSpringPosition(
	t: number,
	target: number,
	initialDelta: number,
	initialVelocity: number,
	dampingRatio: number,
	undampedAngularFreq: number,
): number {
	if (dampingRatio < 1) {
		const dampedFreq = undampedAngularFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
		const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
		return (
			target -
			envelope *
				(((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) / dampedFreq) *
					Math.sin(dampedFreq * t) +
					initialDelta * Math.cos(dampedFreq * t))
		);
	}

	if (dampingRatio === 1) {
		return (
			target -
			Math.exp(-undampedAngularFreq * t) *
				(initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t)
		);
	}

	const dampedFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
	const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
	const freqT = Math.min(dampedFreq * t, 300);
	return (
		target -
		(envelope *
			((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) * Math.sinh(freqT) +
				dampedFreq * initialDelta * Math.cosh(freqT))) /
			dampedFreq
	);
}

export function stepSpringValue(
	state: SpringState,
	target: number,
	deltaMs: number,
	config: SpringConfig,
) {
	const safeDeltaMs = clampDeltaMs(deltaMs);

	if (!state.initialized || !Number.isFinite(state.value)) {
		state.value = target;
		state.velocity = 0;
		state.initialized = true;
		return state.value;
	}

	const restDelta = config.restDelta ?? 0.0005;
	const restSpeed = config.restSpeed ?? 0.02;

	if (Math.abs(target - state.value) <= restDelta && Math.abs(state.velocity) <= restSpeed) {
		state.value = target;
		state.velocity = 0;
		return state.value;
	}

	const { stiffness, damping, mass } = config;
	const undampedAngularFreq = Math.sqrt(stiffness / mass);
	const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
	const initialDelta = target - state.value;
	const initialVelocity = -state.velocity;
	const tSec = safeDeltaMs / 1000;

	const current = resolveSpringPosition(
		tSec,
		target,
		initialDelta,
		initialVelocity,
		dampingRatio,
		undampedAngularFreq,
	);

	if (dampingRatio >= 1) {
		const crossed =
			(state.value <= target && current > target) || (state.value >= target && current < target);
		if (crossed) {
			state.value = target;
			state.velocity = 0;
			return state.value;
		}
	}

	const epsilon = 0.0001;
	const ahead = resolveSpringPosition(
		tSec + epsilon,
		target,
		initialDelta,
		initialVelocity,
		dampingRatio,
		undampedAngularFreq,
	);
	const velocity = (ahead - current) / epsilon;

	if (Math.abs(target - current) <= restDelta && Math.abs(velocity) <= restSpeed) {
		state.value = target;
		state.velocity = 0;
	} else {
		state.value = current;
		state.velocity = velocity;
	}

	return state.value;
}

export function getCursorSpringConfig(smoothingFactor: number): SpringConfig {
	const clamped = Math.min(CURSOR_SMOOTHING_MAX, Math.max(CURSOR_SMOOTHING_MIN, smoothingFactor));

	if (clamped <= 0) {
		return {
			stiffness: 1000,
			damping: 100,
			mass: 1,
			restDelta: 0.0001,
			restSpeed: 0.001,
		};
	}

	if (clamped <= CURSOR_SMOOTHING_LEGACY_MAX) {
		const legacyNormalized = Math.min(
			1,
			Math.max(
				0,
				(clamped - CURSOR_SMOOTHING_MIN) / (CURSOR_SMOOTHING_LEGACY_MAX - CURSOR_SMOOTHING_MIN),
			),
		);

		return {
			stiffness: 760 - legacyNormalized * 420,
			damping: 34 + legacyNormalized * 24,
			mass: 0.55 + legacyNormalized * 0.45,
			restDelta: 0.0002,
			restSpeed: 0.01,
		};
	}

	const extendedNormalized = Math.min(
		1,
		Math.max(
			0,
			(clamped - CURSOR_SMOOTHING_LEGACY_MAX) /
				(CURSOR_SMOOTHING_MAX - CURSOR_SMOOTHING_LEGACY_MAX),
		),
	);

	return {
		stiffness: 340 - extendedNormalized * 180,
		damping: 58 + extendedNormalized * 22,
		mass: 1 + extendedNormalized * 0.35,
		restDelta: 0.0002,
		restSpeed: 0.01,
	};
}

export function getZoomSpringConfig(): SpringConfig {
	return {
		stiffness: 320,
		damping: 40,
		mass: 0.92,
		restDelta: 0.0005,
		restSpeed: 0.015,
	};
}
