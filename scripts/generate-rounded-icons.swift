import AppKit
import Foundation

enum IconGenerationError: Error, LocalizedError {
	case missingSourceImage(String)
	case invalidBitmapContext(Int)
	case failedToEncodePng(String)
	case commandFailed(String)

	var errorDescription: String? {
		switch self {
		case .missingSourceImage(let path):
			return "Unable to load source image at \(path)."
		case .invalidBitmapContext(let size):
			return "Unable to create bitmap context for \(size)x\(size) icon."
		case .failedToEncodePng(let path):
			return "Unable to encode PNG for \(path)."
		case .commandFailed(let message):
			return message
		}
	}
}

let fileManager = FileManager.default
let projectRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let sourcePath = CommandLine.arguments.dropFirst().first ?? "logo.png"
let sourceUrl = projectRoot.appendingPathComponent(sourcePath)

guard let sourceImage = NSImage(contentsOf: sourceUrl) else {
	throw IconGenerationError.missingSourceImage(sourceUrl.path)
}

let pngIconSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
let publicIconSizes = [16, 32, 64, 128, 256, 512, 1024]
let macIconsetSizes: [(name: String, size: Int)] = [
	("icon_16x16.png", 16),
	("icon_16x16@2x.png", 32),
	("icon_32x32.png", 32),
	("icon_32x32@2x.png", 64),
	("icon_128x128.png", 128),
	("icon_128x128@2x.png", 256),
	("icon_256x256.png", 256),
	("icon_256x256@2x.png", 512),
	("icon_512x512.png", 512),
	("icon_512x512@2x.png", 1024),
]

let pngIconsDir = projectRoot.appendingPathComponent("icons/icons/png", isDirectory: true)
let publicIconsDir = projectRoot.appendingPathComponent("public/app-icons", isDirectory: true)
let macIconsDir = projectRoot.appendingPathComponent("icons/icons/mac", isDirectory: true)
let iconsetDir = projectRoot.appendingPathComponent(".tmp/calcfocus.iconset", isDirectory: true)

func writeRoundedIcon(source: NSImage, size: Int, to url: URL) throws {
	guard let bitmap = NSBitmapImageRep(
		bitmapDataPlanes: nil,
		pixelsWide: size,
		pixelsHigh: size,
		bitsPerSample: 8,
		samplesPerPixel: 4,
		hasAlpha: true,
		isPlanar: false,
		colorSpaceName: .deviceRGB,
		bitmapFormat: [],
		bytesPerRow: 0,
		bitsPerPixel: 0
	) else {
		throw IconGenerationError.invalidBitmapContext(size)
	}

	bitmap.size = NSSize(width: size, height: size)

	NSGraphicsContext.saveGraphicsState()
	guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
		throw IconGenerationError.invalidBitmapContext(size)
	}

	NSGraphicsContext.current = graphicsContext
	graphicsContext.cgContext.setFillColor(NSColor.clear.cgColor)
	graphicsContext.cgContext.fill(CGRect(x: 0, y: 0, width: size, height: size))
	graphicsContext.cgContext.interpolationQuality = .high

	let rect = CGRect(x: 0, y: 0, width: size, height: size)
	let radius = CGFloat(size) * 0.23
	let clipPath = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
	clipPath.addClip()

	source.draw(
		in: rect,
		from: .zero,
		operation: .copy,
		fraction: 1.0,
		respectFlipped: false,
		hints: [.interpolation: NSImageInterpolation.high]
	)

	graphicsContext.flushGraphics()
	NSGraphicsContext.restoreGraphicsState()

	guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
		throw IconGenerationError.failedToEncodePng(url.path)
	}

	try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
	try pngData.write(to: url)
}

func runCommand(_ launchPath: String, arguments: [String]) throws {
	let process = Process()
	process.executableURL = URL(fileURLWithPath: launchPath)
	process.arguments = arguments

	let stdoutPipe = Pipe()
	let stderrPipe = Pipe()
	process.standardOutput = stdoutPipe
	process.standardError = stderrPipe

	try process.run()
	process.waitUntilExit()

	if process.terminationStatus == 0 {
		return
	}

	let output = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)
		?? String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)
		?? "Unknown error"
	throw IconGenerationError.commandFailed(output.trimmingCharacters(in: .whitespacesAndNewlines))
}

try fileManager.createDirectory(at: pngIconsDir, withIntermediateDirectories: true)
try fileManager.createDirectory(at: publicIconsDir, withIntermediateDirectories: true)
try fileManager.createDirectory(at: macIconsDir, withIntermediateDirectories: true)
try? fileManager.removeItem(at: iconsetDir)
try fileManager.createDirectory(at: iconsetDir, withIntermediateDirectories: true)

for size in pngIconSizes {
	let outputUrl = pngIconsDir.appendingPathComponent("\(size)x\(size).png")
	try writeRoundedIcon(source: sourceImage, size: size, to: outputUrl)
}

for size in publicIconSizes {
	let outputUrl = publicIconsDir.appendingPathComponent("calcfocus-\(size).png")
	try writeRoundedIcon(source: sourceImage, size: size, to: outputUrl)
}

for entry in macIconsetSizes {
	let outputUrl = iconsetDir.appendingPathComponent(entry.name)
	try writeRoundedIcon(source: sourceImage, size: entry.size, to: outputUrl)
}

let icnsOutputUrl = macIconsDir.appendingPathComponent("icon.icns")
try? fileManager.removeItem(at: icnsOutputUrl)
try runCommand("/usr/bin/iconutil", arguments: ["-c", "icns", iconsetDir.path, "-o", icnsOutputUrl.path])

print("Rounded icon assets generated from \(sourceUrl.path)")
