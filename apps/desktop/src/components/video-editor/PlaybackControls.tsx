import { Pause, Play } from "lucide-react";
import { memo } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { type TimeStore, useTimeValue } from "./useTimeStore";

interface PlaybackControlsProps {
	isPlaying: boolean;
	timeStore: TimeStore;
	duration: number;
	onTogglePlayPause: () => void;
	onSeek: (time: number) => void;
}

function PlaybackControls({
	isPlaying,
	timeStore,
	duration,
	onTogglePlayPause,
	onSeek,
}: PlaybackControlsProps) {
	console.log("render <PlaybackControls>");
	const t = useScopedT("editor");
	const currentTime = useTimeValue(timeStore);

	function formatTime(seconds: number) {
		if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	function handleSeekChange(e: React.ChangeEvent<HTMLInputElement>) {
		onSeek(parseFloat(e.target.value));
	}

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<div className="flex items-center gap-2 px-1 py-0.5 bg-transparent">
			<Button
				onClick={onTogglePlayPause}
				variant="ghost"
				size="icon"
				className={cn(
					"w-8 h-8 rounded-none border-0 bg-transparent p-0 text-white shadow-none transition-all duration-200 hover:bg-transparent hover:text-[#09cf67] focus-visible:ring-[#09cf67]/50",
					!isPlaying && "hover:scale-105",
				)}
				aria-label={isPlaying ? t("playback.pause", "Pause") : t("playback.play", "Play")}
			>
				{isPlaying ? (
					<Pause className="w-3.5 h-3.5 fill-current" />
				) : (
					<Play className="w-3.5 h-3.5 fill-current ml-0.5" />
				)}
			</Button>

			<span className="text-[9px] font-medium text-slate-300 tabular-nums w-[30px] text-right">
				{formatTime(currentTime)}
			</span>

			<div className="flex-1 relative h-6 flex items-center group">
				{/* Custom Track Background */}
				<div className="absolute left-0 right-0 h-0.5 bg-white/10 rounded-full overflow-hidden">
					<div className="h-full bg-[#09cf67] rounded-full" style={{ width: `${progress}%` }} />
				</div>

				{/* Interactive Input */}
				<input
					type="range"
					min="0"
					max={duration || 100}
					value={currentTime}
					onChange={handleSeekChange}
					step="0.01"
					className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
				/>

				{/* Custom Thumb (visual only, follows progress) */}
				<div
					className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-lg pointer-events-none group-hover:scale-125 transition-transform duration-100"
					style={{
						left: `${progress}%`,
						transform: "translateX(-50%)",
					}}
				/>
			</div>

			<span className="text-[9px] font-medium text-slate-500 tabular-nums w-[30px]">
				{formatTime(duration)}
			</span>
		</div>
	);
}

export default memo(PlaybackControls);
