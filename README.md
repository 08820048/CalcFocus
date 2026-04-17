# CalcFocus

<p align="center">
  <img width="256" height="256" alt="CalcFocus icon" src="https://github.com/user-attachments/assets/421b49e2-deeb-4d69-96f0-9a27c80cbd1d" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-111827?style=for-the-badge" alt="macOS Windows Linux" />
  <img src="https://img.shields.io/badge/open%20source-AGPL--3.0-2563eb?style=for-the-badge" alt="AGPL-3.0-only license" />
</p>

https://github.com/user-attachments/assets/549bf88c-74d7-4b23-97c7-17b43204c788

### Create polished screen recordings and screenshots.

[CalcFocus](https://calcfocus.cc) is an open-source desktop recorder, screenshot tool, and editor for walkthroughs, demos, tutorials, and product videos.

## Highlights

- Record a screen or window and jump straight into the editor
- Capture screenshots and continue in the built-in image editor
- Add zoom spans, speed regions, annotations, cursor polish, and frame styling
- Export to MP4 or GIF and reopen saved `.calcfocus` projects later

## Platforms

- **macOS**
- **Windows**
- **Linux**

## Features

### Recording

- Record an entire screen or a single window
- Start editing immediately after recording
- Microphone recording
- System audio recording where the platform supports it
- Native ScreenCaptureKit helpers on macOS
- Native WGC + WASAPI helpers on Windows
- Browser/FFmpeg-based capture paths on Linux

### Editing

- Timeline trimming
- Speed-up / slow-down regions
- Manual zoom regions
- Automatic zoom suggestions
- Cursor smoothing, sizing, motion blur, and click bounce
- Annotations
- Background styling with wallpapers, gradients, solid fills, padding, rounded corners, blur, and shadows
- Project save + reopen with `.calcfocus`

### Screenshots

- Capture a screen or window
- Interactive area screenshot on macOS
- Built-in image editor after capture
- Wallpaper / gradient / solid / transparent backgrounds
- Adjustable padding, border radius, and shadow intensity
- Save as PNG or copy directly to the clipboard

### Export

- MP4 export
- GIF export
- Aspect ratio controls
- Quality settings

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- PixiJS
- WebCodecs

## Build From Source

```bash
git clone https://github.com/08820048/CalcFocus.git
cd CalcFocus
npm install
npm run dev
```

Useful build commands:

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

Build output goes to `release/`.

## Release Flow

- Pushing to `main` triggers the regular CI build workflow
- Pushing a version tag like `v1.0.18` triggers the release workflow
- The release workflow builds installers and updater metadata for GitHub Releases

More detail is documented in [RELEASING.md](./RELEASING.md).

## Auto Updates

- Packaged releases use GitHub Releases as the default update source
- In-app updates are available only in packaged builds
- If needed, you can override the update feed with `CALCFOCUS_UPDATE_FEED_URL`

## Notes

### Linux Cursor Capture

Linux still relies on browser-oriented capture paths in some cases, so hiding the OS cursor is not always possible. Depending on the setup, recordings may show both the system cursor and the rendered cursor layer.

### System Audio

- **Windows**: available out of the box
- **Linux**: typically needs PipeWire-capable environments
- **macOS**: uses the native ScreenCaptureKit helper path

### macOS Local Builds

Local source builds are unsigned by default. If macOS blocks the app after building locally:

```bash
xattr -rd com.apple.quarantine "/Applications/CalcFocus.app"
```

## Contributing

Contributions are welcome.

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

## Community

- Website: https://calcfocus.cc
- Issues: https://github.com/08820048/CalcFocus/issues

## License

CalcFocus is licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`).

Third-party notices for bundled upstream code and assets are documented in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Credits

Thanks to [Recordly](https://github.com/AdrianMPC/recordly) and [OpenScreen](https://github.com/siddharthvaddem/openscreen).
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for bundled-license details.
