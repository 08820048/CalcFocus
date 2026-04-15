import type {
	AnnotationRegion,
	CropRegion,
	CursorStyle,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { FacecamSettings } from "@/lib/recordingSession";
import { AudioProcessor } from "./audioEncoder";
import { FrameRenderer } from "./frameRenderer";
import { VideoMuxer } from "./muxer";
import { StreamingVideoDecoder } from "./streamingDecoder";
import { SyncedVideoProvider } from "./syncedVideoProvider";
import type { ExportConfig, ExportProgress, ExportResult } from "./types";

const ENCODER_STALL_TIMEOUT_MS = 15_000;
const ENCODER_FLUSH_TIMEOUT_MS = 20_000;
const EXPORT_FINALIZATION_TIMEOUT_MS = 60_000;

interface VideoExporterConfig extends ExportConfig {
	videoUrl: string;
	facecamVideoUrl?: string;
	facecamOffsetMs?: number;
	wallpaper: string;
	audioMuted?: boolean;
	audioVolume?: number;
	zoomRegions: ZoomRegion[];
	trimRegions?: TrimRegion[];
	speedRegions?: SpeedRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	backgroundBlur: number;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	borderRadius?: number;
	padding?: number;
	videoPadding?: number;
	cropRegion: CropRegion;
	facecamSettings?: FacecamSettings;
	annotationRegions?: AnnotationRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	showCursor?: boolean;
	cursorStyle?: CursorStyle;
	cursorSize?: number;
	cursorSmoothing?: number;
	cursorMotionBlur?: number;
	cursorClickBounce?: number;
	previewWidth?: number;
	previewHeight?: number;
	onProgress?: (progress: ExportProgress) => void;
}

export class VideoExporter {
	private config: VideoExporterConfig;
	private streamingDecoder: StreamingVideoDecoder | null = null;
	private renderer: FrameRenderer | null = null;
	private facecamProvider: SyncedVideoProvider | null = null;
	private encoder: VideoEncoder | null = null;
	private muxer: VideoMuxer | null = null;
	private audioProcessor: AudioProcessor | null = null;
	private cancelled = false;
	private encodeQueue = 0;
	// Increased queue size for better throughput with hardware encoding
	private readonly MAX_ENCODE_QUEUE = 120;
	private videoDescription: Uint8Array | undefined;
	private videoColorSpace: VideoColorSpaceInit | undefined;
	private pendingMuxing: Promise<void> = Promise.resolve();
	private chunkCount = 0;
	private lastEncoderOutputAt = 0;
	private fatalEncoderError: Error | null = null;
	private readonly UI_YIELD_INTERVAL_MS = 100;
	private lastUiYieldAt = 0;

	constructor(config: VideoExporterConfig) {
		this.config = config;
	}

	async export(): Promise<ExportResult> {
		const encoderPreferences = this.getEncoderPreferences();
		let lastError: Error | null = null;

		for (const encoderPreference of encoderPreferences) {
			const result = await this.exportWithEncoderPreference(encoderPreference);
			if (result.success || this.cancelled) {
				return result;
			}

			lastError = new Error(result.error || "Export failed");
			if (!this.shouldRetryWithNextEncoderPreference(lastError, encoderPreference)) {
				return result;
			}

			console.warn(
				`[VideoExporter] Export failed with ${encoderPreference}; retrying with next encoder preference:`,
				lastError,
			);
		}

		return {
			success: false,
			error: lastError?.message || "Export failed",
		};
	}

	private async exportWithEncoderPreference(
		encoderPreference: HardwareAcceleration,
	): Promise<ExportResult> {
		try {
			this.cleanup();
			this.cancelled = false;
			this.lastUiYieldAt = 0;

			// Initialize streaming decoder and load video metadata
			this.streamingDecoder = new StreamingVideoDecoder();
			const videoInfo = await this.streamingDecoder.loadMetadata(this.config.videoUrl);

			// Calculate effective duration and frame count as soon as metadata is available so the
			// export dialog can show progress while renderer/encoder setup is still warming up.
			const effectiveDuration = this.streamingDecoder.getEffectiveDuration(
				this.config.trimRegions,
				this.config.speedRegions,
			);
			const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);
			this.reportProgress(0, totalFrames);
			await this.yieldToUi(true);

			// Initialize frame renderer
			this.renderer = new FrameRenderer({
				width: this.config.width,
				height: this.config.height,
				wallpaper: this.config.wallpaper,
				zoomRegions: this.config.zoomRegions,
				showShadow: this.config.showShadow,
				shadowIntensity: this.config.shadowIntensity,
				backgroundBlur: this.config.backgroundBlur,
				zoomMotionBlur: this.config.zoomMotionBlur,
				connectZooms: this.config.connectZooms,
				borderRadius: this.config.borderRadius,
				padding: this.config.padding,
				cropRegion: this.config.cropRegion,
				facecamSettings: this.config.facecamSettings,
				videoWidth: videoInfo.width,
				videoHeight: videoInfo.height,
				annotationRegions: this.config.annotationRegions,
				speedRegions: this.config.speedRegions,
				previewWidth: this.config.previewWidth,
				previewHeight: this.config.previewHeight,
				cursorTelemetry: this.config.cursorTelemetry,
				showCursor: this.config.showCursor,
				cursorStyle: this.config.cursorStyle,
				cursorSize: this.config.cursorSize,
				cursorSmoothing: this.config.cursorSmoothing,
				cursorMotionBlur: this.config.cursorMotionBlur,
				cursorClickBounce: this.config.cursorClickBounce,
			});
			await this.renderer.initialize();

			if (this.config.facecamVideoUrl && this.config.facecamSettings?.enabled) {
				this.facecamProvider = new SyncedVideoProvider();
				await this.facecamProvider.initialize(this.config.facecamVideoUrl, this.config.frameRate);
			}

			// Initialize video encoder
			await this.initializeEncoder(encoderPreference);

			const hasAudio =
				videoInfo.hasAudio && !this.config.audioMuted && (this.config.audioVolume ?? 1) > 0;

			// Initialize muxer
			this.muxer = new VideoMuxer(this.config, hasAudio);
			await this.muxer.initialize();

			console.log("[VideoExporter] Original duration:", videoInfo.duration, "s");
			console.log("[VideoExporter] Effective duration:", effectiveDuration, "s");
			console.log("[VideoExporter] Total frames to export:", totalFrames);
			console.log("[VideoExporter] Using streaming decode (web-demuxer + VideoDecoder)");

			const frameDuration = 1_000_000 / this.config.frameRate; // in microseconds
			let frameIndex = 0;

			// Stream decode and process frames — no seeking!
			await this.streamingDecoder.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const timestamp = frameIndex * frameDuration;
					const sourceTimestampUs = sourceTimestampMs * 1000;
					const facecamFrame = this.facecamProvider
						? await this.facecamProvider.getFrameAt(
								sourceTimestampMs - (this.config.facecamOffsetMs ?? 0),
							)
						: null;
					await this.renderer!.renderFrame(videoFrame, sourceTimestampUs, facecamFrame);
					videoFrame.close();
					facecamFrame?.close();

					await this.encodeRenderedFrame(timestamp, frameDuration, frameIndex, encoderPreference);
					frameIndex++;
					this.reportProgress(frameIndex, totalFrames);
					await this.yieldToUi();
				},
			);

			if (this.cancelled) {
				return { success: false, error: "Export cancelled" };
			}

			// Finalize encoding
			this.reportFinalizingProgress(totalFrames, 10);
			if (this.encoder && this.encoder.state === "configured") {
				await this.withTimeout(
					this.encoder.flush(),
					ENCODER_FLUSH_TIMEOUT_MS,
					encoderPreference === "prefer-hardware"
						? "The hardware video encoder stopped responding while finalizing the export."
						: "The video encoder stopped responding while finalizing the export.",
				);
			}

			// Wait for queued muxing operations to complete
			this.reportFinalizingProgress(totalFrames, 35);
			await this.withTimeout(
				this.pendingMuxing,
				EXPORT_FINALIZATION_TIMEOUT_MS,
				"Export timed out while muxing queued video chunks.",
			);

			this.reportFinalizingProgress(totalFrames, hasAudio ? 60 : 85);
			if (hasAudio && !this.cancelled) {
				const demuxer = this.streamingDecoder.getDemuxer();
				if (demuxer) {
					this.audioProcessor = new AudioProcessor();
					await this.withTimeout(
						this.audioProcessor.process(
							demuxer,
							this.muxer!,
							this.config.videoUrl,
							this.config.trimRegions,
							this.config.speedRegions,
							undefined,
							{
								audioMuted: this.config.audioMuted,
								audioVolume: this.config.audioVolume,
							},
						),
						EXPORT_FINALIZATION_TIMEOUT_MS,
						"Export timed out while processing audio.",
					);
				}
			}

			// Finalize muxer and get output blob
			this.reportFinalizingProgress(totalFrames, 90);
			const blob = await this.withTimeout(
				this.muxer!.finalize(),
				EXPORT_FINALIZATION_TIMEOUT_MS,
				"Export timed out while finalizing the video file.",
			);
			this.reportFinalizingProgress(totalFrames, 100);

			return { success: true, blob };
		} catch (error) {
			console.error("Export error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.cleanup();
		}
	}

	private isWindowsPlatform(): boolean {
		if (typeof navigator === "undefined") {
			return false;
		}
		return /Win/i.test(navigator.platform) || /\bWindows\b/i.test(navigator.userAgent);
	}

	private getEncoderPreferences(): HardwareAcceleration[] {
		if (this.isWindowsPlatform()) {
			return ["prefer-software", "prefer-hardware"];
		}

		return ["prefer-hardware", "prefer-software"];
	}

	private shouldRetryWithNextEncoderPreference(
		error: Error,
		encoderPreference: HardwareAcceleration,
	): boolean {
		if (encoderPreference !== "prefer-hardware") {
			return false;
		}

		const message = error.message.toLowerCase();
		return (
			message.includes("hardware") ||
			message.includes("encoder") ||
			message.includes("encoding") ||
			message.includes("stopped responding") ||
			message.includes("not supported")
		);
	}

	private async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number,
		message: string,
	): Promise<T> {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		try {
			return await Promise.race([
				promise,
				new Promise<T>((_, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error(message));
					}, timeoutMs);
				}),
			]);
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		}
	}

	private async encodeRenderedFrame(
		timestamp: number,
		frameDuration: number,
		frameIndex: number,
		encoderPreference: HardwareAcceleration,
	) {
		if (this.fatalEncoderError) {
			throw this.fatalEncoderError;
		}

		const canvas = this.renderer!.getCanvas();
		const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
		if (!canvasCtx) {
			throw new Error("Failed to read rendered frame for export.");
		}

		const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);

		const exportFrame = new VideoFrame(imageData.data, {
			format: "RGBA",
			codedWidth: canvas.width,
			codedHeight: canvas.height,
			timestamp,
			duration: frameDuration,
			colorSpace: {
				primaries: "bt709",
				transfer: "iec61966-2-1",
				matrix: "rgb",
				fullRange: true,
			},
		});

		try {
			while (
				this.encoder &&
				this.encoder.encodeQueueSize >= this.MAX_ENCODE_QUEUE &&
				!this.cancelled
			) {
				if (this.fatalEncoderError) {
					throw this.fatalEncoderError;
				}
				if (Date.now() - this.lastEncoderOutputAt > ENCODER_STALL_TIMEOUT_MS) {
					throw new Error(
						encoderPreference === "prefer-hardware"
							? "The hardware video encoder stopped responding during export."
							: "The video encoder stopped responding during export.",
					);
				}
				await new Promise((resolve) => setTimeout(resolve, 5));
			}

			if (this.fatalEncoderError) {
				throw this.fatalEncoderError;
			}

			if (this.encoder && this.encoder.state === "configured") {
				this.encodeQueue++;
				this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
			} else {
				throw new Error(`[Frame ${frameIndex}] Encoder not ready. State: ${this.encoder?.state}`);
			}
		} finally {
			exportFrame.close();
		}
	}

	private reportProgress(currentFrame: number, totalFrames: number) {
		if (this.config.onProgress) {
			this.config.onProgress({
				currentFrame,
				totalFrames,
				percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 100,
				estimatedTimeRemaining: 0,
			});
		}
	}

	private reportFinalizingProgress(totalFrames: number, renderProgress: number) {
		if (this.config.onProgress) {
			this.config.onProgress({
				currentFrame: totalFrames,
				totalFrames,
				percentage: 100,
				estimatedTimeRemaining: 0,
				phase: "finalizing",
				renderProgress: Math.max(0, Math.min(Math.round(renderProgress), 100)),
			});
		}
	}

	private async yieldToUi(force = false): Promise<void> {
		const now = Date.now();
		if (!force && now - this.lastUiYieldAt < this.UI_YIELD_INTERVAL_MS) {
			return;
		}

		this.lastUiYieldAt = now;
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}

	private async initializeEncoder(hardwareAcceleration: HardwareAcceleration): Promise<void> {
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		this.videoDescription = undefined;
		this.videoColorSpace = undefined;
		this.lastEncoderOutputAt = Date.now();
		this.fatalEncoderError = null;
		let videoDescription: Uint8Array | undefined;

		this.encoder = new VideoEncoder({
			output: (chunk, meta) => {
				this.lastEncoderOutputAt = Date.now();

				// Capture decoder config metadata from encoder output
				if (meta?.decoderConfig?.description && !videoDescription) {
					const desc = meta.decoderConfig.description;
					videoDescription = ArrayBuffer.isView(desc)
						? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
						: new Uint8Array(desc);
					this.videoDescription = videoDescription;
				}
				// Capture colorSpace from encoder metadata if provided
				if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
					this.videoColorSpace = meta.decoderConfig.colorSpace;
				}

				// Stream chunks to muxer in order without retaining an ever-growing promise array
				const isFirstChunk = this.chunkCount === 0;
				this.chunkCount++;

				this.pendingMuxing = this.pendingMuxing.then(async () => {
					try {
						if (isFirstChunk && this.videoDescription) {
							// Add decoder config for the first chunk
							const colorSpace = this.videoColorSpace || {
								primaries: "bt709",
								transfer: "iec61966-2-1",
								matrix: "rgb",
								fullRange: true,
							};

							const metadata: EncodedVideoChunkMetadata = {
								decoderConfig: {
									codec: this.config.codec || "avc1.640033",
									codedWidth: this.config.width,
									codedHeight: this.config.height,
									description: this.videoDescription,
									colorSpace,
								},
							};

							await this.muxer!.addVideoChunk(chunk, metadata);
						} else {
							await this.muxer!.addVideoChunk(chunk, meta);
						}
					} catch (error) {
						const muxingError = error instanceof Error ? error : new Error(String(error));
						this.fatalEncoderError = muxingError;
						this.streamingDecoder?.cancel();
						console.error("Muxing error:", muxingError);
						throw muxingError;
					}
				});
				this.encodeQueue--;
			},
			error: (error) => {
				const encoderError = error instanceof Error ? error : new Error(String(error));
				this.fatalEncoderError = encoderError;
				this.streamingDecoder?.cancel();
				console.error("[VideoExporter] Encoder error:", encoderError);
			},
		});

		const codec = this.config.codec || "avc1.640033";

		const encoderConfig: VideoEncoderConfig = {
			codec,
			width: this.config.width,
			height: this.config.height,
			bitrate: this.config.bitrate,
			framerate: this.config.frameRate,
			latencyMode: "quality", // Changed from 'realtime' to 'quality' for better throughput
			bitrateMode: "variable",
			hardwareAcceleration,
		};

		const support = await VideoEncoder.isConfigSupported(encoderConfig);
		if (!support.supported) {
			throw new Error(
				hardwareAcceleration === "prefer-hardware"
					? "Hardware video encoding is not supported on this system."
					: "Software video encoding is not supported on this system.",
			);
		}

		console.log(`[VideoExporter] Using ${hardwareAcceleration} video encoding`);
		this.encoder.configure(support.config ?? encoderConfig);
	}

	cancel(): void {
		this.cancelled = true;
		if (this.streamingDecoder) {
			this.streamingDecoder.cancel();
		}
		if (this.audioProcessor) {
			this.audioProcessor.cancel();
		}
		this.cleanup();
	}

	private cleanup(): void {
		if (this.encoder) {
			try {
				if (this.encoder.state === "configured") {
					this.encoder.close();
				}
			} catch (e) {
				console.warn("Error closing encoder:", e);
			}
			this.encoder = null;
		}

		if (this.streamingDecoder) {
			try {
				this.streamingDecoder.destroy();
			} catch (e) {
				console.warn("Error destroying streaming decoder:", e);
			}
			this.streamingDecoder = null;
		}

		if (this.renderer) {
			try {
				this.renderer.destroy();
			} catch (e) {
				console.warn("Error destroying renderer:", e);
			}
			this.renderer = null;
		}

		if (this.facecamProvider) {
			try {
				this.facecamProvider.destroy();
			} catch (e) {
				console.warn("Error destroying facecam provider:", e);
			}
			this.facecamProvider = null;
		}

		this.muxer = null;
		this.audioProcessor = null;
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		this.videoDescription = undefined;
		this.videoColorSpace = undefined;
		this.lastEncoderOutputAt = 0;
		this.fatalEncoderError = null;
	}
}
