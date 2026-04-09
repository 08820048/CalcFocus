use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};

#[derive(Default)]
struct RuntimeState {
    session: Mutex<SessionState>,
}

#[derive(Debug)]
struct SessionState {
    recording_mode: String,
    export_jobs: usize,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            recording_mode: "editing".into(),
            export_jobs: 0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureSource {
    id: String,
    label: String,
    kind: String,
    description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPreset {
    id: String,
    label: String,
    resolution: String,
    bitrate: String,
    format: String,
    fps: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorKeyframe {
    id: String,
    time: f32,
    x: f32,
    y: f32,
    emphasis: f32,
    click: bool,
    zoom: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineSegment {
    id: String,
    label: String,
    start: f32,
    end: f32,
    speed: f32,
    accent: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineMarker {
    id: String,
    label: String,
    time: f32,
    kind: String,
    strength: f32,
    note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecordingSettings {
    source_id: String,
    countdown: u8,
    frame_rate: u32,
    include_system_audio: bool,
    include_mic: bool,
    include_camera: bool,
    resolution: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EffectSettings {
    locus_enabled: bool,
    flux_enabled: bool,
    locus_visualized: bool,
    auto_zoom: bool,
    smoothness: f32,
    motion_blur: f32,
    cursor_scale: f32,
    flux_intensity: f32,
    zoom_strength: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CameraSettings {
    enabled: bool,
    position: String,
    size: f32,
    radius: u32,
    shadow: f32,
    mirrored: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StyleSettings {
    aspect_ratio: String,
    background_preset: String,
    canvas_padding: u32,
    corner_radius: u32,
    shadow: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StudioProject {
    id: String,
    name: String,
    duration: f32,
    recording_settings: RecordingSettings,
    effects: EffectSettings,
    camera: CameraSettings,
    style: StyleSettings,
    cursor_keyframes: Vec<CursorKeyframe>,
    segments: Vec<TimelineSegment>,
    markers: Vec<TimelineMarker>,
    notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentProject {
    path: String,
    name: String,
    updated_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceBootstrap {
    app_version: String,
    capture_sources: Vec<CaptureSource>,
    export_presets: Vec<ExportPreset>,
    project: StudioProject,
    recording_mode: String,
    activity_feed: Vec<String>,
    recent_projects: Vec<RecentProject>,
    last_saved_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectResponse {
    path: String,
    recent_projects: Vec<RecentProject>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingModeResponse {
    mode: String,
    detail: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportRequest {
    preset_id: String,
    format: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportResponse {
    path: String,
    detail: String,
}

#[tauri::command]
fn bootstrap_workspace(
    state: tauri::State<'_, RuntimeState>,
) -> Result<WorkspaceBootstrap, String> {
    let recording_mode = state
        .session
        .lock()
        .map_err(|_| "Failed to access runtime session".to_string())?
        .recording_mode
        .clone();
    let recent_projects = list_recent_projects()?;
    let resumed_project = recent_projects.iter().find_map(|recent_project| {
        read_project_from_path(Path::new(&recent_project.path))
            .ok()
            .map(|project| (project, recent_project.path.clone()))
    });

    let (project, activity_feed, last_saved_path) = match resumed_project {
        Some((project, path)) => (
            project,
            vec![
                format!("Resumed the latest FluxLocus project from {path}."),
                "Recent .fluxlocus sessions were indexed from the workspace directory.".into(),
                "Recording and export commands are still wired as MVP-compatible placeholders."
                    .into(),
            ],
            Some(path),
        ),
        None => (
            build_demo_project(),
            vec![
                "Bootstrapped the FluxLocus workspace from the Rust core.".into(),
                "Project persistence is already serializing to .fluxlocus JSON.".into(),
                "Recording and export commands are wired as MVP-compatible placeholders.".into(),
            ],
            None,
        ),
    };

    Ok(WorkspaceBootstrap {
        app_version: env!("CARGO_PKG_VERSION").into(),
        capture_sources: build_capture_sources(),
        export_presets: build_export_presets(),
        project,
        recording_mode,
        activity_feed,
        recent_projects,
        last_saved_path,
    })
}

#[tauri::command]
fn save_project(project: StudioProject) -> Result<SaveProjectResponse, String> {
    let workspace_dir = projects_dir();
    fs::create_dir_all(&workspace_dir).map_err(|error| error.to_string())?;

    let slug = {
        let slug = slugify(&project.name);
        if slug.is_empty() {
            "fluxlocus-project".to_string()
        } else {
            slug
        }
    };
    let file_name = format!("{slug}.fluxlocus");
    let output_path = workspace_dir.join(file_name);
    let payload = serde_json::to_vec_pretty(&project).map_err(|error| error.to_string())?;

    fs::write(&output_path, payload).map_err(|error| error.to_string())?;
    let recent_projects = list_recent_projects()?;

    Ok(SaveProjectResponse {
        path: output_path.display().to_string(),
        recent_projects,
    })
}

#[tauri::command]
fn open_project(
    path: String,
    state: tauri::State<'_, RuntimeState>,
) -> Result<WorkspaceBootstrap, String> {
    let recording_mode = state
        .session
        .lock()
        .map_err(|_| "Failed to access runtime session".to_string())?
        .recording_mode
        .clone();
    let project = read_project_from_path(Path::new(&path))?;
    let project_name = project.name.clone();
    let recent_projects = list_recent_projects()?;

    Ok(WorkspaceBootstrap {
        app_version: env!("CARGO_PKG_VERSION").into(),
        capture_sources: build_capture_sources(),
        export_presets: build_export_presets(),
        project,
        recording_mode,
        activity_feed: vec![
            format!("Opened {} from {}.", project_name, path),
            "Recent .fluxlocus sessions were indexed from the workspace directory.".into(),
            "Recording and export commands are still wired as MVP-compatible placeholders.".into(),
        ],
        recent_projects,
        last_saved_path: Some(path),
    })
}

#[tauri::command]
fn set_recording_mode(
    mode: String,
    state: tauri::State<'_, RuntimeState>,
) -> Result<RecordingModeResponse, String> {
    let detail = match mode.as_str() {
        "recording" => {
            "Recording started. Native capture plumbing can now attach to this session.".into()
        }
        "paused" => {
            "Recording paused. Keep editing parameters live while the transport is frozen.".into()
        }
        "editing" => "Capture stopped and the workspace returned to edit mode.".into(),
        "exporting" => "Export state is active while the encoder queue is being prepared.".into(),
        "idle" => "Studio returned to idle mode.".into(),
        _ => return Err(format!("Unsupported recording mode: {mode}")),
    };

    let mut session = state
        .session
        .lock()
        .map_err(|_| "Failed to update runtime session".to_string())?;
    session.recording_mode = mode.clone();

    Ok(RecordingModeResponse { mode, detail })
}

#[tauri::command]
fn queue_export(
    request: ExportRequest,
    state: tauri::State<'_, RuntimeState>,
) -> Result<ExportResponse, String> {
    let extension = if request.format == "gif" {
        "gif"
    } else {
        "mp4"
    };
    let export_dir = project_workspace_dir().join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;

    let mut session = state
        .session
        .lock()
        .map_err(|_| "Failed to access runtime export queue".to_string())?;
    session.recording_mode = "exporting".into();
    session.export_jobs += 1;

    let path = export_dir.join(format!(
        "fluxlocus-export-{}.{}",
        session.export_jobs, extension
    ));

    Ok(ExportResponse {
        path: path.display().to_string(),
        detail: format!(
            "Queued preset {} as export job #{}.",
            request.preset_id, session.export_jobs
        ),
    })
}

fn project_workspace_dir() -> PathBuf {
    dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("FluxLocus")
}

fn projects_dir() -> PathBuf {
    project_workspace_dir().join("projects")
}

fn read_project_from_path(path: &Path) -> Result<StudioProject, String> {
    let payload = fs::read(path).map_err(|error| error.to_string())?;
    serde_json::from_slice(&payload).map_err(|error| error.to_string())
}

fn list_recent_projects() -> Result<Vec<RecentProject>, String> {
    let projects_dir = projects_dir();

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut recent_projects = Vec::new();

    for entry in fs::read_dir(projects_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let is_project_file = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("fluxlocus"));

        if !is_project_file {
            continue;
        }

        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let updated_at = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| {
                duration
                    .as_millis()
                    .min(u128::from(u64::MAX))
                    .try_into()
                    .unwrap_or(u64::MAX)
            })
            .unwrap_or(0);
        let name = read_project_from_path(&path)
            .map(|project| project.name)
            .unwrap_or_else(|_| {
                path.file_stem()
                    .and_then(|stem| stem.to_str())
                    .unwrap_or("Untitled FluxLocus Project")
                    .to_string()
            });

        recent_projects.push(RecentProject {
            path: path.display().to_string(),
            name,
            updated_at,
        });
    }

    recent_projects.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.name.cmp(&right.name))
    });

    Ok(recent_projects)
}

fn slugify(input: &str) -> String {
    let mut slug = String::with_capacity(input.len());
    let mut last_was_dash = false;

    for character in input.trim().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

fn build_capture_sources() -> Vec<CaptureSource> {
    vec![
        CaptureSource {
            id: "screen-main".into(),
            label: "Studio Display".into(),
            kind: "screen".into(),
            description: "6K desktop capture with Retina downscale preview.".into(),
        },
        CaptureSource {
            id: "window-docs".into(),
            label: "Product Docs".into(),
            kind: "window".into(),
            description: "Focused document window for tutorial capture.".into(),
        },
        CaptureSource {
            id: "region-demo".into(),
            label: "Demo Crop".into(),
            kind: "region".into(),
            description: "Manual 1440p crop for portrait reels and short clips.".into(),
        },
    ]
}

fn build_export_presets() -> Vec<ExportPreset> {
    vec![
        ExportPreset {
            id: "preset-4k".into(),
            label: "Movie 4K".into(),
            resolution: "3840x2160".into(),
            bitrate: "60 Mbps".into(),
            format: "mp4".into(),
            fps: 60,
        },
        ExportPreset {
            id: "preset-social".into(),
            label: "Social 1080p".into(),
            resolution: "1920x1080".into(),
            bitrate: "18 Mbps".into(),
            format: "mp4".into(),
            fps: 60,
        },
        ExportPreset {
            id: "preset-gif".into(),
            label: "Annotated GIF".into(),
            resolution: "1280x720".into(),
            bitrate: "Adaptive".into(),
            format: "gif".into(),
            fps: 24,
        },
    ]
}

fn build_demo_project() -> StudioProject {
    StudioProject {
        id: "project-fluxlocus-mvp".into(),
        name: "FluxLocus Demo Session".into(),
        duration: 32.0,
        recording_settings: RecordingSettings {
            source_id: "screen-main".into(),
            countdown: 3,
            frame_rate: 60,
            include_system_audio: true,
            include_mic: true,
            include_camera: true,
            resolution: "2560x1440".into(),
        },
        effects: EffectSettings {
            locus_enabled: true,
            flux_enabled: true,
            locus_visualized: true,
            auto_zoom: true,
            smoothness: 0.82,
            motion_blur: 0.68,
            cursor_scale: 1.08,
            flux_intensity: 0.74,
            zoom_strength: 0.70,
        },
        camera: CameraSettings {
            enabled: true,
            position: "bottom-right".into(),
            size: 0.22,
            radius: 28,
            shadow: 0.72,
            mirrored: false,
        },
        style: StyleSettings {
            aspect_ratio: "16:9".into(),
            background_preset: "aurora".into(),
            canvas_padding: 54,
            corner_radius: 32,
            shadow: 0.70,
        },
        cursor_keyframes: vec![
            CursorKeyframe {
                id: "kf-1".into(),
                time: 0.0,
                x: 0.14,
                y: 0.20,
                emphasis: 0.30,
                click: false,
                zoom: 0.12,
            },
            CursorKeyframe {
                id: "kf-2".into(),
                time: 2.8,
                x: 0.22,
                y: 0.28,
                emphasis: 0.42,
                click: false,
                zoom: 0.14,
            },
            CursorKeyframe {
                id: "kf-3".into(),
                time: 5.2,
                x: 0.34,
                y: 0.40,
                emphasis: 0.55,
                click: true,
                zoom: 0.36,
            },
            CursorKeyframe {
                id: "kf-4".into(),
                time: 8.3,
                x: 0.55,
                y: 0.34,
                emphasis: 0.46,
                click: false,
                zoom: 0.28,
            },
            CursorKeyframe {
                id: "kf-5".into(),
                time: 11.5,
                x: 0.72,
                y: 0.18,
                emphasis: 0.35,
                click: false,
                zoom: 0.22,
            },
            CursorKeyframe {
                id: "kf-6".into(),
                time: 14.9,
                x: 0.79,
                y: 0.42,
                emphasis: 0.64,
                click: true,
                zoom: 0.62,
            },
            CursorKeyframe {
                id: "kf-7".into(),
                time: 18.8,
                x: 0.62,
                y: 0.66,
                emphasis: 0.52,
                click: false,
                zoom: 0.38,
            },
            CursorKeyframe {
                id: "kf-8".into(),
                time: 22.7,
                x: 0.38,
                y: 0.70,
                emphasis: 0.41,
                click: false,
                zoom: 0.20,
            },
            CursorKeyframe {
                id: "kf-9".into(),
                time: 27.4,
                x: 0.21,
                y: 0.52,
                emphasis: 0.58,
                click: true,
                zoom: 0.56,
            },
            CursorKeyframe {
                id: "kf-10".into(),
                time: 32.0,
                x: 0.18,
                y: 0.28,
                emphasis: 0.28,
                click: false,
                zoom: 0.18,
            },
        ],
        segments: vec![
            TimelineSegment {
                id: "seg-1".into(),
                label: "Intro setup".into(),
                start: 0.0,
                end: 7.5,
                speed: 1.0,
                accent: "#60A5FA".into(),
            },
            TimelineSegment {
                id: "seg-2".into(),
                label: "Feature walkthrough".into(),
                start: 7.5,
                end: 16.8,
                speed: 1.0,
                accent: "#8B5CF6".into(),
            },
            TimelineSegment {
                id: "seg-3".into(),
                label: "Focused zoom".into(),
                start: 16.8,
                end: 24.6,
                speed: 0.8,
                accent: "#34D399".into(),
            },
            TimelineSegment {
                id: "seg-4".into(),
                label: "Callout finish".into(),
                start: 24.6,
                end: 32.0,
                speed: 1.1,
                accent: "#F59E0B".into(),
            },
        ],
        markers: vec![
            TimelineMarker {
                id: "mk-1".into(),
                label: "Auto zoom suggestion".into(),
                time: 5.2,
                kind: "zoom".into(),
                strength: 0.64,
                note: "Fast acceleration plus click burst indicates a likely focus moment.".into(),
            },
            TimelineMarker {
                id: "mk-2".into(),
                label: "Annotation slot".into(),
                time: 10.4,
                kind: "annotation".into(),
                strength: 0.34,
                note: "Reserve this moment for a short product callout or chapter title.".into(),
            },
            TimelineMarker {
                id: "mk-3".into(),
                label: "Primary click highlight".into(),
                time: 14.9,
                kind: "click".into(),
                strength: 0.82,
                note: "Amplify the cursor click ring and camera reaction for emphasis.".into(),
            },
            TimelineMarker {
                id: "mk-4".into(),
                label: "Trim anchor".into(),
                time: 24.2,
                kind: "trim".into(),
                strength: 0.28,
                note: "Suggested cut point for a shorter social export.".into(),
            },
            TimelineMarker {
                id: "mk-5".into(),
                label: "Outro zoom".into(),
                time: 27.4,
                kind: "zoom".into(),
                strength: 0.73,
                note: "Ease back in toward the final CTA to match the cursor slowdown.".into(),
            },
        ],
        notes: vec![
            "MVP uses a synthetic cursor dataset so the Pixi preview and timeline can be built before native capture is wired in.".into(),
            "Project serialization is already shaped like a .fluxlocus file for future persistence compatibility.".into(),
        ],
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            bootstrap_workspace,
            save_project,
            open_project,
            set_recording_mode,
            queue_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
