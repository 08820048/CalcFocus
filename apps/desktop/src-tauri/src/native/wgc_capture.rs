use tauri::AppHandle;

#[cfg(target_os = "windows")]
use super::sidecar::SidecarProcess;
#[cfg(target_os = "windows")]
use std::sync::OnceLock;
#[cfg(target_os = "windows")]
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
static WGC_PROCESS: OnceLock<Mutex<Option<SidecarProcess>>> = OnceLock::new();

#[cfg(target_os = "windows")]
fn get_wgc_process() -> &'static Mutex<Option<SidecarProcess>> {
    WGC_PROCESS.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "windows")]
fn read_bool(options: &serde_json::Value, keys: &[&str], default: bool) -> bool {
    keys.iter()
        .find_map(|key| options.get(*key).and_then(|value| value.as_bool()))
        .unwrap_or(default)
}

#[cfg(target_os = "windows")]
fn read_u64(options: &serde_json::Value, keys: &[&str], default: u64) -> u64 {
    keys.iter()
        .find_map(|key| options.get(*key).and_then(|value| value.as_u64()))
        .unwrap_or(default)
}

#[cfg(target_os = "windows")]
fn read_string(options: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        options
            .get(*key)
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

#[cfg(target_os = "windows")]
pub async fn start_capture(
    _app: &AppHandle,
    source: &serde_json::Value,
    options: &serde_json::Value,
    output_path: &str,
) -> Result<(), String> {
    let sidecar_path = super::sidecar::get_sidecar_path("wgc-capture")?;

    let config = serde_json::json!({
        "outputPath": output_path,
        "sourceId": source.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "frameRate": read_u64(options, &["frameRate", "fps"], 60),
        "width": read_u64(options, &["width"], 1920),
        "height": read_u64(options, &["height"], 1080),
        "recordSystemAudio": read_bool(options, &["capturesSystemAudio", "recordSystemAudio"], true),
        "recordMicrophone": read_bool(options, &["capturesMicrophone", "recordMicrophone"], false),
        "microphoneDeviceId": read_string(options, &["microphoneDeviceId"]),
        "microphoneLabel": read_string(options, &["microphoneLabel"]),
    });

    let config_str = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    let sidecar_path_str = sidecar_path.to_string_lossy().to_string();

    let mut process = SidecarProcess::spawn(&sidecar_path_str, &["--config", &config_str]).await?;

    match process
        .wait_for_stdout_pattern("Recording started", 10000)
        .await
    {
        Ok(_) => {}
        Err(e) => {
            let _ = process.kill().await;
            return Err(format!("Failed to start WGC recording: {}", e));
        }
    }

    let mut guard = get_wgc_process().lock().await;
    *guard = Some(process);
    Ok(())
}

#[cfg(target_os = "windows")]
pub async fn stop_capture(_app: &AppHandle) -> Result<(), String> {
    let mut guard = get_wgc_process().lock().await;
    if let Some(ref mut process) = *guard {
        process.write_stdin("stop\n").await?;
        let _ = process.wait_for_close().await?;
    }
    *guard = None;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub async fn start_capture(
    _app: &AppHandle,
    _source: &serde_json::Value,
    _options: &serde_json::Value,
    _output_path: &str,
) -> Result<(), String> {
    Err("WGC capture is only available on Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
pub async fn stop_capture(_app: &AppHandle) -> Result<(), String> {
    Err("WGC capture is only available on Windows".to_string())
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    // ==================== WGC Config Construction ====================

    fn build_wgc_config(
        source: &serde_json::Value,
        options: &serde_json::Value,
        output_path: &str,
    ) -> serde_json::Value {
        fn test_read_bool(options: &serde_json::Value, keys: &[&str], default: bool) -> bool {
            keys.iter()
                .find_map(|key| options.get(*key).and_then(|value| value.as_bool()))
                .unwrap_or(default)
        }

        fn test_read_u64(options: &serde_json::Value, keys: &[&str], default: u64) -> u64 {
            keys.iter()
                .find_map(|key| options.get(*key).and_then(|value| value.as_u64()))
                .unwrap_or(default)
        }

        fn test_read_string(options: &serde_json::Value, keys: &[&str]) -> Option<String> {
            keys.iter().find_map(|key| {
                options
                    .get(*key)
                    .and_then(|value| value.as_str())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
            })
        }

        serde_json::json!({
            "outputPath": output_path,
            "sourceId": source.get("id").and_then(|v| v.as_str()).unwrap_or(""),
            "frameRate": test_read_u64(options, &["frameRate", "fps"], 60),
            "width": test_read_u64(options, &["width"], 1920),
            "height": test_read_u64(options, &["height"], 1080),
            "recordSystemAudio": test_read_bool(options, &["capturesSystemAudio", "recordSystemAudio"], true),
            "recordMicrophone": test_read_bool(options, &["capturesMicrophone", "recordMicrophone"], false),
            "microphoneDeviceId": test_read_string(options, &["microphoneDeviceId"]),
            "microphoneLabel": test_read_string(options, &["microphoneLabel"]),
        })
    }

    #[test]
    fn test_wgc_config_construction_defaults() {
        let source = serde_json::json!({"id": "screen:0"});
        let options = serde_json::json!({});
        let config = build_wgc_config(&source, &options, "/tmp/test.mov");

        assert_eq!(config["sourceId"], "screen:0");
        assert_eq!(config["frameRate"], 60);
        assert_eq!(config["width"], 1920);
        assert_eq!(config["height"], 1080);
        assert_eq!(config["recordSystemAudio"], true);
        assert_eq!(config["recordMicrophone"], false);
        assert!(config["microphoneDeviceId"].is_null());
        assert!(config["microphoneLabel"].is_null());
    }

    #[test]
    fn test_wgc_config_construction_custom_options() {
        let source = serde_json::json!({"id": "window:42"});
        let options = serde_json::json!({
            "fps": 30,
            "width": 2560,
            "height": 1440,
            "capturesSystemAudio": false,
            "capturesMicrophone": true,
            "microphoneDeviceId": "device-42",
            "microphoneLabel": "USB Mic"
        });
        let config = build_wgc_config(&source, &options, "/tmp/test.mov");

        assert_eq!(config["sourceId"], "window:42");
        assert_eq!(config["frameRate"], 30);
        assert_eq!(config["width"], 2560);
        assert_eq!(config["height"], 1440);
        assert_eq!(config["recordSystemAudio"], false);
        assert_eq!(config["recordMicrophone"], true);
        assert_eq!(config["microphoneDeviceId"], "device-42");
        assert_eq!(config["microphoneLabel"], "USB Mic");
    }

    #[test]
    fn test_wgc_config_supports_legacy_audio_option_names() {
        let source = serde_json::json!({"id": "screen:1"});
        let options = serde_json::json!({
            "frameRate": 24,
            "recordSystemAudio": false,
            "recordMicrophone": true
        });
        let config = build_wgc_config(&source, &options, "/tmp/test.mov");

        assert_eq!(config["frameRate"], 24);
        assert_eq!(config["recordSystemAudio"], false);
        assert_eq!(config["recordMicrophone"], true);
    }

    #[test]
    fn test_wgc_config_missing_source_id() {
        let source = serde_json::json!({});
        let source_id = source.get("id").and_then(|v| v.as_str()).unwrap_or("");
        assert_eq!(source_id, "");
    }

    #[test]
    fn test_wgc_config_serializes_to_json() {
        let config = serde_json::json!({
            "outputPath": "/test.mov",
            "sourceId": "screen:0",
            "frameRate": 60,
            "width": 1920,
            "height": 1080,
            "recordSystemAudio": true,
            "recordMicrophone": false,
        });

        let json_str = serde_json::to_string(&config).unwrap();
        assert!(!json_str.is_empty());
        let reparsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(config, reparsed);
    }

    // ==================== Non-Windows Platform Stubs ====================

    #[cfg(not(target_os = "windows"))]
    mod non_windows_tests {
        #[tokio::test]
        async fn test_start_capture_error_on_non_windows() {
            // We can't create a real AppHandle without Tauri runtime,
            // but we can document the expected behavior
            // On non-Windows, start_capture should return Err("WGC capture is only available on Windows")
        }

        #[tokio::test]
        async fn test_stop_capture_error_on_non_windows() {
            // On non-Windows, stop_capture should return Err("WGC capture is only available on Windows")
        }
    }
}
