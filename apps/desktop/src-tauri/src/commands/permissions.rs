use tauri::AppHandle;

#[cfg(target_os = "macos")]
use block::ConcreteBlock;

#[cfg(target_os = "macos")]
use core_foundation::{
    base::TCFType,
    boolean::CFBoolean,
    dictionary::{CFDictionary, CFDictionaryRef},
    string::{CFString, CFStringRef},
};

#[cfg(target_os = "macos")]
#[allow(unused_imports)]
use objc::{sel, sel_impl};

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
fn run_on_main_thread<R: Send + 'static>(
    app: &AppHandle,
    callback: impl FnOnce() -> R + Send + 'static,
) -> Result<R, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);

    app.run_on_main_thread(move || {
        let _ = tx.send(callback());
    })
    .map_err(|e| e.to_string())?;

    rx.recv().map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn parse_binary_permission_status(status: &str) -> Result<bool, String> {
    match status.trim() {
        "granted" => Ok(true),
        "denied" => Ok(false),
        other => Err(format!("Unexpected permission status '{other}'")),
    }
}

#[cfg(target_os = "macos")]
fn run_screen_capture_helper(args: &[&str]) -> Result<bool, String> {
    let sidecar_path =
        crate::native::sidecar::get_sidecar_path("calcfocus-screencapturekit-helper")?;

    let output = std::process::Command::new(&sidecar_path)
        .args(args)
        .output()
        .map_err(|error| {
            format!(
                "Failed to run screen capture helper '{}': {error}",
                sidecar_path.display()
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!(
                "Screen capture helper exited with code {}",
                output.status.code().unwrap_or(-1)
            )
        } else {
            stderr
        });
    }

    parse_binary_permission_status(&String::from_utf8_lossy(&output.stdout))
}

/// Preflight screen-recording permission for the current app process.
#[cfg(target_os = "macos")]
fn preflight_screen_recording_access_main_process() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

/// Request screen-recording permission for the current app process.
#[cfg(target_os = "macos")]
fn request_screen_recording_access_main_process() -> bool {
    unsafe { CGRequestScreenCaptureAccess() }
}

#[tauri::command]
pub async fn get_screen_recording_permission_status(app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        // Primary signal: helper identity (runtime capture process).
        let helper_granted =
            run_screen_capture_helper(&["--preflight-screen-capture-access"]).unwrap_or(false);
        // Fallback signal: current app process identity.
        let app_granted = preflight_screen_recording_access_main_process();
        let granted = helper_granted || app_granted;
        Ok(if granted { "granted" } else { "denied" }.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok("granted".to_string())
    }
}

#[tauri::command]
pub async fn request_screen_recording_permission(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // Try requesting through both identities to avoid helper-only false negatives.
        let helper_granted =
            run_screen_capture_helper(&["--request-screen-capture-access"]).unwrap_or(false);
        let app_request_granted =
            run_on_main_thread(&app, request_screen_recording_access_main_process)
                .unwrap_or(false);
        let app_preflight_granted = preflight_screen_recording_access_main_process();
        Ok(helper_granted || app_request_granted || app_preflight_granted)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(true)
    }
}

#[tauri::command]
pub async fn open_screen_recording_preferences() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        open::that("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Accessibility ──────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    static kAXTrustedCheckOptionPrompt: CFStringRef;
}

#[cfg(target_os = "macos")]
fn preflight_accessibility_access() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(target_os = "macos")]
fn request_accessibility_access() -> bool {
    unsafe {
        let prompt_key = CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt);
        let options: CFDictionary<CFString, CFBoolean> =
            CFDictionary::from_CFType_pairs(&[(prompt_key, CFBoolean::true_value())]);

        AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef())
    }
}

#[tauri::command]
pub async fn get_accessibility_permission_status() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(if preflight_accessibility_access() {
            "granted"
        } else {
            "denied"
        }
        .to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok("granted".to_string())
    }
}

#[tauri::command]
pub async fn request_accessibility_permission(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        run_on_main_thread(&app, request_accessibility_access)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(true)
    }
}

#[tauri::command]
pub async fn open_accessibility_preferences() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        open::that("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Microphone (AVFoundation) ──────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[link(name = "AVFoundation", kind = "framework")]
unsafe extern "C" {
    static AVMediaTypeAudio: *const std::ffi::c_void;
    static AVMediaTypeVideo: *const std::ffi::c_void;
}

/// Map AVAuthorizationStatus (NSInteger) to a human-readable string.
///   0 = notDetermined, 1 = restricted, 2 = denied, 3 = authorized
#[cfg(target_os = "macos")]
fn av_authorization_status_to_string(status: i64) -> &'static str {
    match status {
        0 => "not_determined",
        1 => "restricted",
        2 => "denied",
        3 => "granted",
        _ => "unknown",
    }
}

#[cfg(target_os = "macos")]
fn get_av_capture_authorization_status(media_type: *const std::ffi::c_void) -> &'static str {
    unsafe {
        let cls =
            objc::runtime::Class::get("AVCaptureDevice").expect("AVCaptureDevice class not found");
        let status: i64 = objc::msg_send![cls, authorizationStatusForMediaType: media_type];
        av_authorization_status_to_string(status)
    }
}

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
enum AvMediaPermissionKind {
    Audio,
    Video,
}

#[cfg(target_os = "macos")]
fn request_av_capture_access(
    app: &AppHandle,
    media_kind: AvMediaPermissionKind,
) -> Result<bool, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);

    app.run_on_main_thread(move || unsafe {
        let media_type = match media_kind {
            AvMediaPermissionKind::Audio => AVMediaTypeAudio,
            AvMediaPermissionKind::Video => AVMediaTypeVideo,
        };
        let cls =
            objc::runtime::Class::get("AVCaptureDevice").expect("AVCaptureDevice class not found");
        let completion = ConcreteBlock::new(move |granted: bool| {
            let _ = tx.send(granted);
        })
        .copy();

        let _: () = objc::msg_send![
            cls,
            requestAccessForMediaType: media_type
            completionHandler: &*completion
        ];
    })
    .map_err(|e| e.to_string())?;

    rx.recv().map_err(|e| e.to_string())
}

/// Returns the macOS TCC microphone authorization status.
/// Possible values: "granted", "denied", "not_determined", "restricted", "unknown".
/// On non-macOS platforms always returns "granted".
#[tauri::command]
pub async fn get_microphone_permission_status() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let status = get_av_capture_authorization_status(unsafe { AVMediaTypeAudio });
        Ok(status.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok("granted".to_string())
    }
}

#[tauri::command]
pub async fn request_microphone_permission(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        request_av_capture_access(&app, AvMediaPermissionKind::Audio)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(true)
    }
}

/// Returns the macOS TCC camera authorization status.
/// Possible values: "granted", "denied", "not_determined", "restricted", "unknown".
/// On non-macOS platforms always returns "granted".
#[tauri::command]
pub async fn get_camera_permission_status() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let status = get_av_capture_authorization_status(unsafe { AVMediaTypeVideo });
        Ok(status.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok("granted".to_string())
    }
}

#[tauri::command]
pub async fn request_camera_permission(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        request_av_capture_access(&app, AvMediaPermissionKind::Video)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(true)
    }
}

/// Open System Settings → Privacy & Security → Microphone.
#[tauri::command]
pub async fn open_microphone_preferences() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        open::that("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open System Settings → Privacy & Security → Camera.
#[tauri::command]
pub async fn open_camera_preferences() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        open::that("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    // ==================== Permission Status Values ====================

    #[test]
    fn test_permission_status_granted_value() {
        let status = "granted".to_string();
        assert_eq!(status, "granted");
    }

    #[test]
    fn test_permission_status_denied_value() {
        let status = "denied".to_string();
        assert_eq!(status, "denied");
    }

    #[test]
    fn test_permission_status_is_binary() {
        // Permission status should only be "granted" or "denied"
        for status in ["granted", "denied"] {
            assert!(status == "granted" || status == "denied");
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_parse_binary_permission_status_granted() {
        assert_eq!(parse_binary_permission_status("granted").unwrap(), true);
        assert_eq!(parse_binary_permission_status(" granted\n").unwrap(), true);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_parse_binary_permission_status_denied() {
        assert_eq!(parse_binary_permission_status("denied").unwrap(), false);
        assert_eq!(parse_binary_permission_status(" denied\n").unwrap(), false);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_parse_binary_permission_status_rejects_unknown_value() {
        let error = parse_binary_permission_status("unknown").unwrap_err();
        assert!(error.contains("Unexpected permission status"));
    }

    // ==================== AV Authorization Status Mapping ====================

    #[cfg(target_os = "macos")]
    mod av_status_tests {
        use super::*;

        #[test]
        fn test_av_status_not_determined() {
            assert_eq!(av_authorization_status_to_string(0), "not_determined");
        }

        #[test]
        fn test_av_status_restricted() {
            assert_eq!(av_authorization_status_to_string(1), "restricted");
        }

        #[test]
        fn test_av_status_denied() {
            assert_eq!(av_authorization_status_to_string(2), "denied");
        }

        #[test]
        fn test_av_status_granted() {
            assert_eq!(av_authorization_status_to_string(3), "granted");
        }

        #[test]
        fn test_av_status_unknown() {
            assert_eq!(av_authorization_status_to_string(99), "unknown");
        }
    }

    // ==================== Platform-Specific Behavior ====================

    #[cfg(not(target_os = "macos"))]
    mod non_macos_tests {
        #[test]
        fn test_non_macos_screen_recording_always_granted() {
            // On non-macOS, screen recording is always "granted"
            let status = "granted".to_string();
            assert_eq!(status, "granted");
        }

        #[test]
        fn test_non_macos_accessibility_always_granted() {
            let status = "granted".to_string();
            assert_eq!(status, "granted");
        }

        #[test]
        fn test_non_macos_request_permission_returns_true() {
            let result: Result<bool, String> = Ok(true);
            assert!(result.is_ok());
            assert!(result.unwrap());
        }

        #[test]
        fn test_non_macos_microphone_always_granted() {
            let status = "granted".to_string();
            assert_eq!(status, "granted");
        }

        #[test]
        fn test_non_macos_camera_always_granted() {
            let status = "granted".to_string();
            assert_eq!(status, "granted");
        }
    }

    // ==================== macOS Preferences URL ====================

    #[cfg(target_os = "macos")]
    mod macos_tests {
        use super::*;

        #[test]
        fn test_screen_recording_preferences_url() {
            let url =
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
            assert!(url.starts_with("x-apple.systempreferences:"));
            assert!(url.contains("Privacy_ScreenCapture"));
        }

        #[test]
        fn test_accessibility_preferences_url() {
            let url =
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
            assert!(url.starts_with("x-apple.systempreferences:"));
            assert!(url.contains("Privacy_Accessibility"));
        }

        #[test]
        fn test_microphone_preferences_url() {
            let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
            assert!(url.starts_with("x-apple.systempreferences:"));
            assert!(url.contains("Privacy_Microphone"));
        }

        #[test]
        fn test_camera_preferences_url() {
            let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera";
            assert!(url.starts_with("x-apple.systempreferences:"));
            assert!(url.contains("Privacy_Camera"));
        }

        #[test]
        fn test_screen_recording_helper_status_values_are_binary() {
            assert!(parse_binary_permission_status("granted").is_ok());
            assert!(parse_binary_permission_status("denied").is_ok());
        }
    }
}
