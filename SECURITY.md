# Security Policy

## Supported Versions

Security fixes are generally made against:

- The latest code on `main`
- The latest published release

Older releases may not receive fixes.

## Reporting a Vulnerability

Please do not open public issues for security-sensitive reports.

Preferred process:

1. Use GitHub private vulnerability reporting if it is enabled.
2. If that is unavailable, contact the maintainers privately.
3. Wait for acknowledgement before publishing proof-of-concept details.

## Security Notes

CalcFocus is a desktop application that handles local recordings, screenshots, project files, and export artifacts. Depending on the feature being used, the app may store local configuration, cached assets, and project metadata on the device.

If you are reviewing or redistributing this project, pay special attention to:

- Desktop capture permissions
- Packaged sidecar binaries
- Auto-update signing and release assets
- Third-party assets and bundled upstream code

Forks should verify their own update endpoints, signing keys, distribution channels, and privacy expectations before publishing releases.
