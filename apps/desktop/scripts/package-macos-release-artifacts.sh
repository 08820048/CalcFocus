#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <target-triple> <dmg-suffix> <release-tag>" >&2
  exit 1
fi

TARGET_TRIPLE="$1"
DMG_SUFFIX="$2"
RELEASE_TAG="$3"
VERSION="${RELEASE_TAG#v}"

APP_PATH="apps/desktop/src-tauri/target/${TARGET_TRIPLE}/release/bundle/macos/CalcFocus.app"
MACOS_DIR="apps/desktop/src-tauri/target/${TARGET_TRIPLE}/release/bundle/macos"
DMG_DIR="apps/desktop/src-tauri/target/${TARGET_TRIPLE}/release/bundle/dmg"
APP_TARBALL="${MACOS_DIR}/CalcFocus.app.tar.gz"
APP_TARBALL_SIG="${APP_TARBALL}.sig"
DMG_PATH="${DMG_DIR}/CalcFocus_${VERSION}_${DMG_SUFFIX}.dmg"
STAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH" >&2
  exit 1
fi

mkdir -p "$DMG_DIR" "$MACOS_DIR"

# Re-sign the bundle so macOS TCC sees a stable bundle identity instead of
# Tauri's linker-signed placeholder executable.
codesign --force --deep --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

rm -f "$DMG_PATH" "$APP_TARBALL" "$APP_TARBALL_SIG"

ditto "$APP_PATH" "$STAGE_DIR/CalcFocus.app"
ln -s /Applications "$STAGE_DIR/Applications"

hdiutil create \
  -volname "CalcFocus" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

tar -C "$MACOS_DIR" -czf "$APP_TARBALL" "CalcFocus.app"

if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  pnpm --filter @calcfocus/desktop tauri signer sign "$APP_TARBALL"
fi

ls -lh "$DMG_PATH" "$APP_TARBALL" "${APP_TARBALL_SIG}" 2>/dev/null || true
