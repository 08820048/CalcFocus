# CalcFocus


<p align="center">
<img  width="256" height="256" alt="icon" src="https://github.com/user-attachments/assets/421b49e2-deeb-4d69-96f0-9a27c80cbd1d" />  
</p>


<p align="center">
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-111827?style=for-the-badge" alt="macOS Windows Linux" />
  <img src="https://img.shields.io/badge/open%20source-AGPL--3.0-2563eb?style=for-the-badge" alt="AGPL-3.0-only license" />
</p>



https://github.com/user-attachments/assets/549bf88c-74d7-4b23-97c7-17b43204c788



### Create polished, pro-grade screen recordings and screenshots.
[CalcFocus](https://calcfocus.cc) is an **open-source screen recorder, screenshot tool, and editor** for creating **polished walkthroughs, demos, tutorials, and product videos**. Contribution encouraged.

Highlights:

- Record screen, window, or area and jump straight into editing
- Generate zoom suggestions from cursor movement and polish cursor playback
- Edit with trims, speed regions, annotations, zoom spans, and styled backgrounds
- Export to MP4 or GIF and reopen saved `.calcfocus` projects later

---
## What is CalcFocus?

CalcFocus lets you record your screen and capture screenshots, automatically transforming recordings into polished videos. It handles the heavy lifting of zooming into important actions and smoothing out jittery cursor movement so your demos look professional by default. Screenshots can be styled with custom backgrounds, padding, rounded corners, and shadows before saving or copying to clipboard.

CalcFocus runs on:

- **macOS**
- **Windows**
- **Linux**

Linux currently uses the browser capture path, which means the OS cursor cannot always be hidden during recording.



---

# Features

### Recording

- Record an entire screen or a single window
- Jump straight from recording into the editor
- Microphone or system audio recording
- Chromium capture APIs on Windows/Linux
- Native **ScreenCaptureKit** capture on macOS
- native WGC recording helper for display and app-window capture on Windows, native WASAPI for system/mic audio, and more

### Smart Motion

- Apple-style zoom animations
- Automatic zoom suggestions based on cursor activity
- Manual zoom regions
- Smooth pan transitions between zoom regions

### Cursor Controls

- Adjustable cursor size
- Cursor smoothing
- Motion blur
- Click bounce animation
- macOS-style cursor assets

### Cursor Loops
- Cursor returns to original position in a freeze-frame at end of video/GIF (off by default)

### Editing Tools

- Timeline trimming
- Speed-up / slow-down regions
- Annotations
- Zoom spans
- Project save + reopen (`.calcfocus` files, with legacy project-file compatibility)

### Frame Styling

- Wallpapers
- Gradients
- Solid fills
- Padding
- Rounded corners
- Blur
- Drop shadows

### Screenshots

- Capture entire screen, a specific window, or a custom selected area
- Built-in image editor opens automatically after capture
- Background styling: wallpapers, gradients, solid colors, or transparent
- Adjustable padding, border radius, and shadow intensity
- Save as PNG or copy directly to clipboard
- Uses native `screencapture` on macOS for high-quality, silent captures

### Export

- MP4 video export
- GIF export
- Aspect ratio controls
- Quality settings

---

# Installation

## Download a build

Prebuilt releases are available here:

https://github.com/08820048/CalcFocus/releases

## Homebrew (Cask)

CalcFocus is distributed as a GUI app, so Homebrew support is done via cask.

For users:

```bash
brew tap 08820048/homebrew-tap
brew install --cask calcfocus
```

---

## Build from source

```bash
git clone https://github.com/08820048/CalcFocus.git
cd CalcFocus
pnpm install
pnpm dev
```

`pnpm dev` launches the desktop workspace app from `apps/desktop` using the root compatibility alias, and still uses the separate `CalcFocus Dev` app identity so it can coexist with the production app.

If you want to run the production identity from source instead, use:

```bash
pnpm dev:prod
```

---

## Desktop releases in GitHub Actions

The repository release flow uses two GitHub Actions workflows:

- `.github/workflows/release-pr.yml` computes the next version and opens or updates a release PR.
- `.github/workflows/release.yml` runs after that PR is merged to `main`, then builds and publishes the signed release artifacts.

The release workflows always need the Tauri updater signing secrets, and they optionally use Apple signing secrets when you want fully signed and notarized macOS releases:

- `TAURI_SIGNING_PRIVATE_KEY`: Tauri updater signing private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password for the signing key (optional)

Add the Apple secrets below only after you have a paid Apple Developer account and a `Developer ID Application` certificate:

- `APPLE_CERTIFICATE`: base64-encoded `Developer ID Application` `.p12` certificate export
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
- `APPLE_SIGNING_IDENTITY`: signing identity name
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for notarization
- `APPLE_TEAM_ID`: your Apple Developer team ID

This repo now includes two helper scripts:

```bash
pnpm release:setup-macos-signing
pnpm release:dispatch
pnpm release:patch
pnpm release:minor
pnpm release:major
```

`release:setup-macos-signing` detects the local `Developer ID Application` identity, exports a `.p12`, and uploads the GitHub Apple signing secrets.

`release:dispatch` uses an interactive selector to choose patch, minor, or major, then dispatches `.github/workflows/release-pr.yml`.

Use the explicit helpers when you already know the release type:

```bash
pnpm release:patch
pnpm release:minor
pnpm release:major
```

All three scripts call the same dispatcher under the hood and still support extra flags after `--`, for example:

```bash
pnpm release:patch -- --notes "Bug fixes and stability improvements"
pnpm release:minor -- --name "CalcFocus v1.4.0" --yes
pnpm release:major -- --latest false
```

Internally, the dispatcher:

1. Verifies `gh auth status` works.
2. Resolves the GitHub repo and target branch.
3. Dispatches `.github/workflows/release-pr.yml` with the chosen release type and optional release metadata.
4. Leaves the local worktree untouched.

Inside GitHub Actions, `.github/workflows/release-pr.yml` then:

1. Fetches tags from `origin`.
2. Reads `apps/desktop/package.json` and the latest local `v*` tag.
3. Uses whichever version is newer as the base version.
4. Computes the next patch, minor, or major version.
5. Syncs `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`, and the `calcfocus` entry inside `apps/desktop/src-tauri/Cargo.lock`.
6. Writes `.github/release-plan.json` with the release title, notes, and latest flag.
7. Opens or updates the release PR.

After that PR is merged, `.github/workflows/release.yml` automatically:

1. Detects the version bump on `main`.
2. Reads `.github/release-plan.json` for release metadata.
3. Builds macOS arm64, macOS x64, Windows x64, and Linux x64 artifacts.
4. Generates `latest.json` for the updater.
5. Creates or updates the GitHub release.

Without Apple signing secrets, the workflow can still produce updater-signed artifacts for development and internal testing. The extra Apple secrets are only what upgrades the macOS build into a notarized public release.

There is also a project skill at `skills/publish-github-release/` that captures this release flow for compatible agents.

Make sure `gh auth login` succeeds before running the release dispatch flow.

---

## macOS: "App cannot be opened"

Local source builds are not signed or notarized by default. macOS may quarantine apps built on your machine.

Remove the quarantine flag with:

```bash
xattr -rd com.apple.quarantine "/Applications/CalcFocus.app"
```

---

# Usage

## Screenshot

1. Launch CalcFocus
2. Choose **Screenshot** from the HUD overlay
3. Select a capture mode: **Screen**, **Window**, or **Area**
4. Click **Take Screenshot**
5. The image editor opens automatically with your capture
6. Customize the background (wallpaper, gradient, solid color, or transparent)
7. Adjust padding, border radius, and shadow intensity
8. **Save as PNG** or **Copy to clipboard**

---

## Record

1. Launch CalcFocus
2. Select a screen or window
3. Choose audio recording options
4. Start recording
5. Stop recording to open the editor

---

## Edit

Inside the editor you can:

- Add zoom regions manually
- Use automatic zoom suggestions
- Adjust cursor behavior
- Trim the video
- Add speed changes
- Add annotations
- Style the frame

Save your work anytime as an `.calcfocus` project.

---

## Export

Export options include:

- **MP4** for full-quality video
- **GIF** for lightweight sharing

Adjust:

- Aspect ratio
- Output resolution
- Quality settings

---

# Limitations

### Linux Cursor Capture

The browser capture API used on Linux does not allow hiding the system cursor during recording.

If you enable the animated cursor layer, recordings may contain **two cursors**.

Improving cross-platform cursor capture is an area where contributions are welcome.

---

### System Audio

System audio capture depends on platform support.

**Windows**
- Works out of the box

**Linux**
- Requires PipeWire (Ubuntu 22.04+, Fedora 34+)
- Older PulseAudio setups may not support system audio

**macOS**
- Requires macOS 12.3+
- Uses ScreenCaptureKit helper

---

# How It Works

CalcFocus is a **desktop video editor with a renderer-driven motion pipeline and platform-specific capture layer**.

**Capture**
- Tauri orchestrates recording
- macOS uses native ScreenCaptureKit helpers for capture and cursor telemetry
- Windows uses native WGC for screen capture
- Linux uses FFmpeg-based capture with browser fallback and cursor telemetry sampling

**Motion**
- Zoom regions
- Cursor tracking
- Speed changes
- Timeline edits

**Rendering**
- Scene composition handled by **PixiJS**

**Export**
- Frames rendered through the same scene pipeline
- Encoded to MP4 or GIF

**Projects**
- `.calcfocus` files store the source video path and editor state

---

# Performance

CalcFocus is an opensource, blazing fast ScreenStudio alternative. Built with **Tauri and Rust**, it is highly performant but very small in size compared to its competitors. It adds auto-zoom, cursor animations, and more to your screen recordings — all without the overhead of traditional Electron-based tools.

### Lightweight Native Architecture

Unlike Electron apps that bundle an entire Chromium browser, CalcFocus uses **Tauri** — a Rust-based framework that leverages the operating system's native webview. This means:

- **Dramatically smaller binary size** — the app ships without a bundled browser engine, keeping the installer compact compared to Electron alternatives
- **Lower baseline memory usage** — no separate Chromium process tree consuming hundreds of megabytes at idle
- **Rust-powered backend** — the core orchestration layer is written in Rust with async I/O via Tokio, providing near-zero overhead for system-level operations like file handling, process management, and native API bridging

### Native Platform Capture — No Browser Bottleneck

CalcFocus bypasses slow browser-based capture APIs wherever possible by using **platform-specific native capture**:

- **macOS**: Uses Apple's **ScreenCaptureKit** framework directly via a native Swift sidecar, delivering hardware-optimized screen capture with cursor telemetry at minimal CPU cost
- **Windows**: Uses the native **Windows.Graphics.Capture (WGC)** API through a dedicated sidecar for display and app-window capture, plus native **WASAPI** for system and microphone audio
- **Linux**: FFmpeg-based capture pipeline with browser fallback and cursor telemetry sampling

These native capture paths run outside the main application process as lightweight sidecar binaries, keeping the UI thread responsive during recording.

### Streaming Decoder — Single-Pass Frame Processing

The export pipeline uses a **streaming forward-pass decoder** built on the WebCodecs `VideoDecoder` API and `web-demuxer`. Instead of seeking to each frame individually (which is extremely slow with compressed video), CalcFocus decodes frames in a single continuous pass:

- Frames flow through the decoder in order — no costly random seeks into the compressed bitstream
- Trimmed regions are decoded (necessary for P-frame and B-frame reference chains) but their output is discarded immediately, avoiding unnecessary rendering work
- Frames are resampled to the target frame rate during the same streaming pass, eliminating a separate processing step

This architecture is **significantly faster than seek-per-frame approaches**, especially for longer recordings.

### Hardware-Accelerated Video Encoding

Export uses the **WebCodecs API** with `hardwareAcceleration: 'prefer-hardware'`, offloading H.264 encoding to the GPU when available:

- Encodes to `avc1.640033` (H.264 High Profile) for broad compatibility
- **Variable bitrate** mode adapts quality dynamically — 30 Mbps at 1080p, scaling up to 80 Mbps at 5K+ resolutions
- A deep encode queue of **120 frames** keeps the hardware encoder saturated for maximum throughput
- Falls back gracefully to software encoding when GPU encoding is unavailable

### Efficient Rendering with PixiJS

All frame composition — video, cursor, annotations, zoom transforms — is handled by **PixiJS**, a GPU-accelerated 2D rendering engine:

- Separate canvas layers for background, scene content, and shadow compositing avoid redundant GPU draw calls
- Textures are destroyed immediately after replacement, preventing GPU memory leaks during long exports
- Drop shadows use lightweight CSS `drop-shadow()` filters composited on a separate canvas, rather than expensive per-frame GPU shader passes

### Math-Driven Smooth Animations

Cursor smoothing, zoom transitions, and pan animations all use **spring physics** (via the `motion` library) rather than simple linear interpolation:

- Custom stiffness and damping parameters produce natural, Apple-style motion curves
- Stationary detection with configurable snap behavior (52ms delay, sub-pixel epsilon) eliminates visual jitter when the cursor pauses
- Deadzone filtering on zoom scale and translation prevents micro-jitters from triggering unnecessary re-renders
- Motion blur intensity is computed directly from cursor velocity, applied only when meaningful

### Optimized Build Pipeline

The production build is tuned for minimal bundle size:

- **Terser minification** with `drop_console` and `drop_debugger` strips all debug logging from production builds
- **Manual code splitting** isolates heavy dependencies — PixiJS, React, and video processing libraries each load in their own chunk, enabling parallel downloads and better caching
- **Tree-shaking** eliminates unused code paths from icon libraries and utility packages
- **Strict TypeScript** (`noUnusedLocals`, `noUnusedParameters`) catches dead code at compile time before it reaches the bundle

### Resource Management

CalcFocus is designed for long recording and editing sessions without degradation:

- Explicit cleanup of PixiJS textures, decoder instances, and audio processors prevents memory leaks
- Streaming decoder reuses a single `VideoDecoder` instance across the export rather than creating and destroying decoders per segment
- Facecam frame syncing uses queue management to bound memory usage during multi-stream exports
- All native sidecar processes are lifecycle-managed by Tauri and terminated cleanly on app exit

---

# Contribution

All contributors welcomed!

Areas where help is especially valuable:

- Smooth cursor pipeline for **Linux**
- **Webcam** overlay bubble
- **Localisation** support, especially Chinese
- UI/UX **design** **improvements**
- **Export speed** improvements

Please:
- Keep pull requests **focused and modular**
- Test playback, editing, and export flows
- Avoid large unrelated refactors

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

---

# Community

Bug reports and feature requests:

https://github.com/08820048/CalcFocus/issues

Pull requests are welcome.

---

# License

CalcFocus is licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`).

Third-party notices for bundled upstream code and assets are documented in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

# Credits

## Acknowledgements

Thanks to [Recordly](https://github.com/AdrianMPC/recordly) and [OpenScreen](https://github.com/siddharthvaddem/openscreen).
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for bundled-license details.

---
