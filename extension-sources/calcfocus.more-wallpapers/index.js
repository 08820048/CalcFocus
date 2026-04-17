const numericCollections = [
	["Energy", "energy", 23],
	["Glassmorphism", "glassmorphism", 10],
	["Iridescent", "iridescent", 17],
	["Midnight", "midnight", 18],
	["Radiant", "radiant", 20],
	["Spring", "spring", 24],
	["Sunset", "sunset", 21],
];

const raycastWallpapers = [
	"autumnal-peach",
	"blob-red",
	"blob",
	"blossom",
	"blue-distortion-1",
	"blue-distortion-2",
	"blushing-fire",
	"bright-rain",
	"chromatic-dark-1",
	"chromatic-dark-2",
	"chromatic-light-1",
	"chromatic-light-2",
	"cube-mono",
	"cube-prod",
	"floss",
	"glass-rainbow",
	"good-vibes",
	"loupe-mono-dark",
	"loupe-mono-light",
	"loupe",
	"mono-dark-distortion-1",
	"mono-dark-distortion-2",
	"mono-light-distortion-1",
	"mono-light-distortion-2",
	"moonrise",
	"ray-of-lights",
	"red-distortion-1",
	"red-distortion-2",
	"red-distortion-3",
	"red-distortion-4",
	"rose-thorn",
];

const macosWallpapers = [
	"ipad-17-dark",
	"ipad-17-light",
	"sequoia-blue-orange",
	"sequoia-blue",
	"sonoma-clouds",
	"sonoma-dark",
	"sonoma-evening",
	"sonoma-from-above",
	"sonoma-horizon",
	"sonoma-light",
	"sonoma-river",
	"tahoe-dark",
	"tahoe-light",
	"ventura-dark",
	"ventura-semi-dark",
	"ventura",
];

const specialTokens = {
	ipad: "iPad",
	macos: "macOS",
	mono: "Mono",
	prod: "Prod",
	17: "17",
	1: "1",
	2: "2",
	3: "3",
	4: "4",
};

function formatToken(token) {
	const normalized = token.toLowerCase();
	if (specialTokens[normalized]) {
		return specialTokens[normalized];
	}

	return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatName(value) {
	return value
		.split(/[-_]+/)
		.filter(Boolean)
		.map(formatToken)
		.join(" ");
}

function buildNumericCollection(collection, prefix, count) {
	return Array.from({ length: count }, (_, index) => {
		const number = index + 1;
		return {
			id: `${prefix}-${number}`,
			label: `${collection} ${number}`,
			file: `wallpapers/${collection}/${prefix}-${number}.jpg`,
		};
	});
}

function buildNamedCollection(collection, prefix, names) {
	return names.map((name) => ({
		id: `${prefix}-${name}`,
		label: `${collection} ${formatName(name)}`,
		file: `wallpapers/${collection}/${name}.jpg`,
	}));
}

const wallpapers = [
	...numericCollections.flatMap(([collection, prefix, count]) =>
		buildNumericCollection(collection, prefix, count),
	),
	...buildNamedCollection("Raycast", "raycast", raycastWallpapers),
	...buildNamedCollection("macOS", "macos", macosWallpapers),
];

export function activate(api) {
	for (const wallpaper of wallpapers) {
		api.registerWallpaper(wallpaper);
	}

	api.log(`Registered ${wallpapers.length} wallpapers`);
}

export function deactivate() {}