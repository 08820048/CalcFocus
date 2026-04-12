use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crate::state::{AppState, CursorTelemetryCapture, CursorTelemetryPoint, SelectedSource};

#[cfg(target_os = "macos")]
use std::ffi::c_void;

#[cfg(target_os = "macos")]
type CGDirectDisplayID = u32;

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct CGPoint {
    x: f64,
    y: f64,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct CGSize {
    width: f64,
    height: f64,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct CGRect {
    origin: CGPoint,
    size: CGSize,
}

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
struct CursorCaptureBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
struct CursorSamplePosition {
    x: f64,
    y: f64,
}

#[cfg(target_os = "macos")]
const MACOS_CURSOR_SAMPLE_INTERVAL_MS: u64 = 33;

#[cfg(target_os = "macos")]
const MACOS_CURSOR_KEEPALIVE_INTERVAL_MS: f64 = 250.0;

#[cfg(target_os = "macos")]
const MACOS_CURSOR_POSITION_EPSILON: f64 = 0.0005;

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGMainDisplayID() -> CGDirectDisplayID;
    fn CGDisplayBounds(display: CGDirectDisplayID) -> CGRect;
    fn CGEventCreate(source: *mut c_void) -> *mut c_void;
    fn CGEventGetLocation(event: *mut c_void) -> CGPoint;
}

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(cf: *const c_void);
}

fn telemetry_path_for_video(video_path: &str) -> String {
    format!(
        "{}.cursor.json",
        video_path
            .trim_end_matches(".mov")
            .trim_end_matches(".mp4")
            .trim_end_matches(".webm")
    )
}

fn cursor_telemetry_payload(samples: Vec<CursorTelemetryPoint>) -> serde_json::Value {
    serde_json::json!({ "samples": samples, "clicks": [] })
}

#[cfg(target_os = "linux")]
fn validate_linux_cursor_sampler() -> Result<(), String> {
    x11rb::connect(None).map(|_| ()).map_err(|error| {
        format!("Failed to connect to the X11 display for cursor telemetry: {error}")
    })
}

#[cfg(target_os = "linux")]
fn spawn_linux_cursor_sampler(
    stop: Arc<AtomicBool>,
    samples: Arc<Mutex<Vec<CursorTelemetryPoint>>>,
) -> Result<JoinHandle<()>, String> {
    validate_linux_cursor_sampler()?;

    Ok(std::thread::spawn(move || {
        use x11rb::connection::Connection;
        use x11rb::protocol::xproto::ConnectionExt;

        let Ok((conn, screen_num)) = x11rb::connect(None) else {
            return;
        };

        let root = conn.setup().roots[screen_num].root;
        let started_at = Instant::now();
        let mut last_position: Option<(i16, i16)> = None;

        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }

            match conn.query_pointer(root) {
                Ok(cookie) => match cookie.reply() {
                    Ok(reply) => {
                        let position = (reply.root_x, reply.root_y);
                        if last_position != Some(position) {
                            let point = CursorTelemetryPoint {
                                x: f64::from(reply.root_x),
                                y: f64::from(reply.root_y),
                                timestamp: started_at.elapsed().as_secs_f64() * 1000.0,
                                cursor_type: Some("arrow".to_string()),
                                click_type: None,
                            };

                            if let Ok(mut guard) = samples.lock() {
                                guard.push(point);
                            }

                            last_position = Some(position);
                        }
                    }
                    Err(_) => {
                        // Ignore transient sampling failures and try again on the next tick.
                    }
                },
                Err(_) => {
                    // Ignore transient sampling failures and try again on the next tick.
                }
            }

            std::thread::sleep(Duration::from_millis(33));
        }
    }))
}

#[cfg(target_os = "macos")]
fn parse_macos_display_id_segment(value: &str) -> Option<CGDirectDisplayID> {
    let segment = value.trim();
    if segment.is_empty() {
        return None;
    }

    segment.parse::<CGDirectDisplayID>().ok()
}

#[cfg(target_os = "macos")]
fn parse_macos_display_id(value: &str) -> Option<CGDirectDisplayID> {
    let value = value.trim();
    if let Some(rest) = value.strip_prefix("screen:") {
        return rest
            .split(':')
            .next()
            .and_then(parse_macos_display_id_segment);
    }

    parse_macos_display_id_segment(value)
}

#[cfg(target_os = "macos")]
fn parse_macos_source_display_id(value: &str) -> Option<CGDirectDisplayID> {
    let rest = value.trim().strip_prefix("screen:")?;
    rest.split(':')
        .next()
        .and_then(parse_macos_display_id_segment)
}

#[cfg(target_os = "macos")]
fn selected_display_id(source: Option<&SelectedSource>) -> CGDirectDisplayID {
    source
        .and_then(|source| {
            source
                .display_id
                .as_deref()
                .and_then(parse_macos_display_id)
                .or_else(|| parse_macos_source_display_id(&source.id))
        })
        .unwrap_or_else(|| unsafe { CGMainDisplayID() })
}

#[cfg(target_os = "macos")]
fn display_capture_bounds(display_id: CGDirectDisplayID) -> CursorCaptureBounds {
    let rect = unsafe { CGDisplayBounds(display_id) };
    if rect.size.width > 0.0 && rect.size.height > 0.0 {
        return CursorCaptureBounds {
            x: rect.origin.x,
            y: rect.origin.y,
            width: rect.size.width,
            height: rect.size.height,
        };
    }

    let fallback = unsafe { CGDisplayBounds(CGMainDisplayID()) };
    CursorCaptureBounds {
        x: fallback.origin.x,
        y: fallback.origin.y,
        width: fallback.size.width.max(1.0),
        height: fallback.size.height.max(1.0),
    }
}

#[cfg(target_os = "macos")]
fn current_cursor_location() -> Option<CGPoint> {
    let event = unsafe { CGEventCreate(std::ptr::null_mut()) };
    if event.is_null() {
        return None;
    }

    let location = unsafe { CGEventGetLocation(event) };
    unsafe { CFRelease(event.cast_const()) };
    Some(location)
}

#[cfg(target_os = "macos")]
fn clamp_unit(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

#[cfg(target_os = "macos")]
fn should_store_macos_cursor_sample(
    last_position: Option<CursorSamplePosition>,
    last_timestamp_ms: Option<f64>,
    position: CursorSamplePosition,
    timestamp_ms: f64,
) -> bool {
    let Some(last_position) = last_position else {
        return true;
    };

    let has_moved = (position.x - last_position.x).abs() > MACOS_CURSOR_POSITION_EPSILON
        || (position.y - last_position.y).abs() > MACOS_CURSOR_POSITION_EPSILON;
    let keepalive_due = last_timestamp_ms
        .map(|last_timestamp_ms| {
            timestamp_ms - last_timestamp_ms >= MACOS_CURSOR_KEEPALIVE_INTERVAL_MS
        })
        .unwrap_or(true);

    has_moved || keepalive_due
}

#[cfg(target_os = "macos")]
fn spawn_macos_cursor_sampler(
    stop: Arc<AtomicBool>,
    samples: Arc<Mutex<Vec<CursorTelemetryPoint>>>,
    source: Option<SelectedSource>,
) -> Result<JoinHandle<()>, String> {
    let bounds = display_capture_bounds(selected_display_id(source.as_ref()));

    Ok(std::thread::spawn(move || {
        let started_at = Instant::now();
        let mut last_position: Option<CursorSamplePosition> = None;
        let mut last_timestamp_ms: Option<f64> = None;

        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }

            if let Some(location) = current_cursor_location() {
                let timestamp_ms = started_at.elapsed().as_secs_f64() * 1000.0;
                let position = CursorSamplePosition {
                    x: clamp_unit((location.x - bounds.x) / bounds.width),
                    y: clamp_unit((location.y - bounds.y) / bounds.height),
                };
                if !should_store_macos_cursor_sample(
                    last_position,
                    last_timestamp_ms,
                    position,
                    timestamp_ms,
                ) {
                    std::thread::sleep(Duration::from_millis(MACOS_CURSOR_SAMPLE_INTERVAL_MS));
                    continue;
                }

                let point = CursorTelemetryPoint {
                    x: position.x,
                    y: position.y,
                    timestamp: timestamp_ms,
                    cursor_type: Some("arrow".to_string()),
                    click_type: None,
                };

                if let Ok(mut guard) = samples.lock() {
                    guard.push(point);
                    last_position = Some(position);
                    last_timestamp_ms = Some(timestamp_ms);
                }
            }

            std::thread::sleep(Duration::from_millis(MACOS_CURSOR_SAMPLE_INTERVAL_MS));
        }
    }))
}

async fn write_cursor_telemetry_sidecar(
    video_path: &str,
    samples: &[CursorTelemetryPoint],
) -> Result<(), String> {
    let telemetry_path = telemetry_path_for_video(video_path);
    let payload = cursor_telemetry_payload(samples.to_vec());
    let serialized = serde_json::to_vec_pretty(&payload).map_err(|error| error.to_string())?;
    tokio::fs::write(&telemetry_path, serialized)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_cursor_telemetry(video_path: String) -> Result<serde_json::Value, String> {
    let telemetry_path = telemetry_path_for_video(&video_path);

    if let Ok(data) = std::fs::read_to_string(&telemetry_path) {
        serde_json::from_str(&data).map_err(|error| error.to_string())
    } else {
        Ok(cursor_telemetry_payload(Vec::new()))
    }
}

#[tauri::command]
pub fn start_cursor_telemetry_capture(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|error| error.to_string())?;

    if app_state.cursor_telemetry_capture.is_some() {
        return Err("Cursor telemetry capture is already running".to_string());
    }

    app_state.cursor_telemetry.clear();
    let selected_source = app_state.selected_source.clone();

    let stop = Arc::new(AtomicBool::new(false));
    let samples = Arc::new(Mutex::new(Vec::new()));

    #[cfg(target_os = "linux")]
    let handle = spawn_linux_cursor_sampler(stop.clone(), samples.clone())?;
    #[cfg(target_os = "macos")]
    let handle = spawn_macos_cursor_sampler(stop.clone(), samples.clone(), selected_source)?;

    app_state.cursor_telemetry_capture = Some(CursorTelemetryCapture {
        stop,
        samples,
        handle: {
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            {
                Some(handle)
            }

            #[cfg(not(any(target_os = "linux", target_os = "macos")))]
            {
                None
            }
        },
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_cursor_telemetry_capture(
    state: tauri::State<'_, Mutex<AppState>>,
    video_path: Option<String>,
) -> Result<(), String> {
    let capture = {
        let mut app_state = state.lock().map_err(|error| error.to_string())?;
        app_state.cursor_telemetry_capture.take()
    };

    let Some(capture) = capture else {
        if let Some(video_path) = video_path.filter(|path| !path.trim().is_empty()) {
            write_cursor_telemetry_sidecar(&video_path, &Vec::<CursorTelemetryPoint>::new())
                .await?;
        }
        return Ok(());
    };

    let CursorTelemetryCapture {
        stop,
        samples,
        handle,
    } = capture;

    stop.store(true, Ordering::SeqCst);
    if let Some(handle) = handle {
        handle
            .join()
            .map_err(|_| "Cursor telemetry capture thread panicked".to_string())?;
    }

    let samples = samples.lock().map_err(|error| error.to_string())?.clone();

    if let Some(video_path) = video_path.filter(|path| !path.trim().is_empty()) {
        {
            let mut app_state = state.lock().map_err(|error| error.to_string())?;
            app_state.cursor_telemetry = samples.clone();
        }

        write_cursor_telemetry_sidecar(&video_path, &samples).await?;
    } else {
        let mut app_state = state.lock().map_err(|error| error.to_string())?;
        app_state.cursor_telemetry.clear();
    }

    Ok(())
}

#[tauri::command]
pub fn set_cursor_scale(
    state: tauri::State<'_, Mutex<AppState>>,
    scale: f64,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|error| error.to_string())?;
    s.cursor_scale = scale;
    Ok(())
}

#[tauri::command]
pub async fn get_system_cursor_assets(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<serde_json::Value, String> {
    {
        let s = state.lock().map_err(|error| error.to_string())?;
        if let Some(ref cached) = s.cached_system_cursor_assets {
            return Ok(cached.clone());
        }
    }

    #[cfg(target_os = "macos")]
    {
        let exe_path = std::env::current_exe().map_err(|error| error.to_string())?;
        let bin_dir = exe_path.parent().ok_or("Cannot find binary directory")?;

        let triple = if cfg!(target_arch = "aarch64") {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        };

        let sidecar_name = format!("openscreen-system-cursors-{}", triple);
        let sidecar_path = bin_dir.join(&sidecar_name);

        if sidecar_path.exists() {
            let output = tokio::process::Command::new(&sidecar_path)
                .output()
                .await
                .map_err(|error| error.to_string())?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let assets: serde_json::Value =
                    serde_json::from_str(&stdout).map_err(|error| error.to_string())?;

                let mut s = state.lock().map_err(|error| error.to_string())?;
                s.cached_system_cursor_assets = Some(assets.clone());

                return Ok(assets);
            }
        }
    }

    Ok(serde_json::json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_telemetry_path_from_mov() {
        let path = telemetry_path_for_video("/path/to/recording.mov");
        assert_eq!(path, "/path/to/recording.cursor.json");
    }

    #[test]
    fn test_telemetry_path_from_mp4() {
        let path = telemetry_path_for_video("/path/to/recording.mp4");
        assert_eq!(path, "/path/to/recording.cursor.json");
    }

    #[test]
    fn test_telemetry_path_from_webm() {
        let path = telemetry_path_for_video("/path/to/recording.webm");
        assert_eq!(path, "/path/to/recording.cursor.json");
    }

    #[test]
    fn test_telemetry_path_chain_strips_extensions_in_order() {
        let path = telemetry_path_for_video("/path/to/file.webm.mp4.mov");
        assert_eq!(path, "/path/to/file.cursor.json");
    }

    #[test]
    fn test_telemetry_path_without_known_extension() {
        let path = telemetry_path_for_video("/path/to/recording.avi");
        assert_eq!(path, "/path/to/recording.avi.cursor.json");
    }

    #[test]
    fn test_cursor_telemetry_payload_structure() {
        let payload = cursor_telemetry_payload(vec![CursorTelemetryPoint {
            x: 12.5,
            y: 24.0,
            timestamp: 33.0,
            cursor_type: Some("arrow".to_string()),
            click_type: None,
        }]);

        assert_eq!(
            payload["samples"].as_array().map(|samples| samples.len()),
            Some(1)
        );
        assert_eq!(payload["clicks"], serde_json::json!([]));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_parse_macos_display_id_accepts_plain_or_screen_id() {
        assert_eq!(parse_macos_display_id("42"), Some(42));
        assert_eq!(parse_macos_display_id("screen:42:0"), Some(42));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_parse_macos_source_display_id_ignores_window_id() {
        assert_eq!(parse_macos_source_display_id("screen:42:0"), Some(42));
        assert_eq!(parse_macos_source_display_id("window:123:0"), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_should_store_macos_cursor_sample_skips_static_samples_until_keepalive() {
        let position = CursorSamplePosition { x: 0.4, y: 0.5 };
        assert!(should_store_macos_cursor_sample(None, None, position, 0.0));
        assert!(!should_store_macos_cursor_sample(
            Some(position),
            Some(100.0),
            position,
            120.0,
        ));
        assert!(should_store_macos_cursor_sample(
            Some(position),
            Some(100.0),
            position,
            360.0,
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_should_store_macos_cursor_sample_keeps_movement() {
        let last_position = CursorSamplePosition { x: 0.4, y: 0.5 };
        let next_position = CursorSamplePosition { x: 0.41, y: 0.5 };
        assert!(should_store_macos_cursor_sample(
            Some(last_position),
            Some(100.0),
            next_position,
            120.0,
        ));
    }

    #[tokio::test]
    async fn test_get_cursor_telemetry_missing_file_returns_fallback() {
        let result = get_cursor_telemetry("/nonexistent/path/video.mov".to_string());
        assert!(result.is_ok());
        let value = result.unwrap();
        assert_eq!(value["samples"], serde_json::json!([]));
        assert_eq!(value["clicks"], serde_json::json!([]));
    }

    #[tokio::test]
    async fn test_get_cursor_telemetry_valid_json_file() {
        let dir = std::env::temp_dir();
        let video_path = dir.join("open_recorder_test_cursor.mov");
        let telemetry_path = dir.join("open_recorder_test_cursor.cursor.json");

        let telemetry_data = serde_json::json!({
            "samples": [{"x": 100, "y": 200, "timestamp": 0}],
            "clicks": [{"x": 100, "y": 200, "timestamp": 0, "type": "left"}]
        });
        tokio::fs::write(
            &telemetry_path,
            serde_json::to_string(&telemetry_data).unwrap(),
        )
        .await
        .unwrap();

        let result = get_cursor_telemetry(video_path.to_string_lossy().to_string());
        let _ = tokio::fs::remove_file(&telemetry_path).await;

        assert!(result.is_ok());
        let value = result.unwrap();
        assert!(value["samples"].is_array());
        assert_eq!(value["samples"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_get_cursor_telemetry_invalid_json_returns_error() {
        let dir = std::env::temp_dir();
        let video_path = dir.join("open_recorder_test_bad_cursor.mov");
        let telemetry_path = dir.join("open_recorder_test_bad_cursor.cursor.json");

        tokio::fs::write(&telemetry_path, "not valid json {{{")
            .await
            .unwrap();

        let result = get_cursor_telemetry(video_path.to_string_lossy().to_string());
        let _ = tokio::fs::remove_file(&telemetry_path).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_write_cursor_telemetry_sidecar_persists_samples() {
        let dir = std::env::temp_dir();
        let video_path = dir.join("open_recorder_test_write_cursor.mov");
        let telemetry_path = dir.join("open_recorder_test_write_cursor.cursor.json");

        let samples = vec![CursorTelemetryPoint {
            x: 320.0,
            y: 200.0,
            timestamp: 16.7,
            cursor_type: Some("arrow".to_string()),
            click_type: None,
        }];

        let result =
            write_cursor_telemetry_sidecar(video_path.to_string_lossy().as_ref(), &samples).await;
        assert!(result.is_ok());

        let written = tokio::fs::read_to_string(&telemetry_path).await.unwrap();
        let payload: serde_json::Value = serde_json::from_str(&written).unwrap();
        assert_eq!(
            payload["samples"].as_array().map(|entries| entries.len()),
            Some(1)
        );
        assert_eq!(payload["clicks"], serde_json::json!([]));

        let _ = tokio::fs::remove_file(&telemetry_path).await;
    }
}
