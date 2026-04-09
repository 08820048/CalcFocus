import { useEffect, useEffectEvent, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { aspectRatioValue, buildCursorTrail, sampleCursorKeyframe } from "../lib/locus";
import type { RecordingMode, StudioProject } from "../types/studio";

interface PreviewCanvasProps {
  project: StudioProject;
  playhead: number;
  recordingMode: RecordingMode;
}

interface SceneHandles {
  ambient: Graphics;
  world: Container;
  screen: Graphics;
  trail: Graphics;
  focus: Graphics;
  cursor: Graphics;
  anchors: Graphics;
}

function fitAspect(
  width: number,
  height: number,
  aspectRatio: number,
  padding: number,
) {
  const maxWidth = Math.max(120, width - padding * 2);
  const maxHeight = Math.max(120, height - padding * 2);

  if (maxWidth / maxHeight > aspectRatio) {
    const fittedWidth = maxHeight * aspectRatio;
    return {
      x: (width - fittedWidth) / 2,
      y: (height - maxHeight) / 2,
      width: fittedWidth,
      height: maxHeight,
    };
  }

  const fittedHeight = maxWidth / aspectRatio;
  return {
    x: (width - maxWidth) / 2,
    y: (height - fittedHeight) / 2,
    width: maxWidth,
    height: fittedHeight,
  };
}

function backgroundPalette(preset: StudioProject["style"]["backgroundPreset"]) {
  switch (preset) {
    case "obsidian":
      return {
        ambientA: 0x0f172a,
        ambientB: 0x3b82f6,
        ambientC: 0x10b981,
        frame: 0x050816,
        chrome: 0x101a2d,
        grid: 0x1e293b,
      };
    case "studio":
      return {
        ambientA: 0x1f2937,
        ambientB: 0xf59e0b,
        ambientC: 0x14b8a6,
        frame: 0x0f172a,
        chrome: 0x172033,
        grid: 0x334155,
      };
    case "aurora":
    default:
      return {
        ambientA: 0x111827,
        ambientB: 0x8b5cf6,
        ambientC: 0x60a5fa,
        frame: 0x060b17,
        chrome: 0x0f172a,
        grid: 0x293548,
      };
  }
}

function strokePath(
  graphics: Graphics,
  points: Array<{ x: number; y: number }>,
  width: number,
  color: number,
  alpha: number,
) {
  if (points.length === 0) {
    return;
  }

  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.stroke({ width, color, alpha, cap: "round", join: "round" });
}

export function PreviewCanvas({
  project,
  playhead,
  recordingMode,
}: PreviewCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<SceneHandles | null>(null);

  const drawScene = useEffectEvent((elapsedMs: number) => {
    const app = appRef.current;
    const scene = sceneRef.current;

    if (!app || !scene) {
      return;
    }

    const width = app.renderer.width;
    const height = app.renderer.height;
    const palette = backgroundPalette(project.style.backgroundPreset);
    const frame = fitAspect(
      width,
      height,
      aspectRatioValue(project.style.aspectRatio),
      project.style.canvasPadding,
    );
    const cursor = sampleCursorKeyframe(project.cursorKeyframes, playhead);
    const trail = buildCursorTrail(
      project.cursorKeyframes,
      playhead,
      6 * Math.max(0.65, project.effects.smoothness),
      54,
    );
    const localCursorX = frame.width * cursor.x;
    const localCursorY = frame.height * cursor.y;
    const zoom =
      project.effects.autoZoom && project.effects.fluxEnabled
        ? 1 + cursor.zoom * project.effects.zoomStrength * 0.16
        : 1;
    const pulse = 1 + Math.sin(elapsedMs / 420) * 0.08;

    scene.ambient.clear();
    for (let column = 0; column < 9; column += 1) {
      const x = (width / 8) * column;
      scene.ambient
        .moveTo(x, 0)
        .lineTo(x - 44, height)
        .stroke({ width: 1, color: palette.grid, alpha: 0.12 });
    }
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = Math.max(width, height) * (0.22 + ring * 0.16);
      scene.ambient
        .circle(
          width * (0.22 + ring * 0.24),
          height * (0.18 + ring * 0.17),
          radius * pulse,
        )
        .fill({
          color: ring === 1 ? palette.ambientB : palette.ambientC,
          alpha: 0.08 - ring * 0.018,
        });
    }

    scene.world.position.set(frame.x + localCursorX, frame.y + localCursorY);
    scene.world.pivot.set(localCursorX, localCursorY);
    scene.world.scale.set(zoom);

    scene.screen.clear();
    scene.screen
      .roundRect(0, 0, frame.width, frame.height, project.style.cornerRadius)
      .fill({ color: palette.frame, alpha: 0.96 })
      .stroke({ width: 1.2, color: 0xffffff, alpha: 0.12 });
    scene.screen
      .roundRect(22, 22, frame.width - 44, 58, 24)
      .fill({ color: palette.chrome, alpha: 0.98 });

    const chromeY = 48;
    for (let button = 0; button < 3; button += 1) {
      scene.screen
        .circle(42 + button * 18, chromeY, 4.5)
        .fill({
          color: button === 0 ? 0xf97316 : button === 1 ? 0xfacc15 : 0x34d399,
          alpha: 0.9,
        });
    }

    scene.screen
      .roundRect(30, 110, frame.width * 0.55, frame.height * 0.44, 28)
      .fill({ color: 0x0d1728, alpha: 1 });
    scene.screen
      .roundRect(frame.width * 0.61, 110, frame.width * 0.29, frame.height * 0.18, 24)
      .fill({ color: 0x111d32, alpha: 1 });
    scene.screen
      .roundRect(frame.width * 0.61, frame.height * 0.35, frame.width * 0.29, frame.height * 0.19, 24)
      .fill({ color: 0x101a2b, alpha: 0.96 });
    scene.screen
      .roundRect(30, frame.height * 0.63, frame.width - 60, frame.height * 0.2, 26)
      .fill({ color: 0x0b1220, alpha: 0.9 });

    for (let card = 0; card < 4; card += 1) {
      const widthUnit = frame.width * 0.11;
      scene.screen
        .roundRect(
          56 + card * (widthUnit + 20),
          frame.height * 0.68,
          widthUnit,
          frame.height * 0.11,
          20,
        )
        .fill({
          color: card % 2 === 0 ? palette.ambientC : palette.ambientB,
          alpha: 0.12 + card * 0.04,
        });
    }

    const cameraSize = frame.width * project.camera.size;
    const cameraX = project.camera.position === "bottom-left" ? 28 : frame.width - cameraSize - 28;
    const cameraY = project.camera.position === "top-right" ? 102 : frame.height - cameraSize - 28;

    if (project.camera.enabled) {
      scene.screen
        .roundRect(cameraX, cameraY, cameraSize, cameraSize, project.camera.radius)
        .fill({ color: 0x0f172a, alpha: 0.92 })
        .stroke({ width: 1.2, color: palette.ambientC, alpha: 0.35 });
      scene.screen
        .circle(cameraX + cameraSize * 0.5, cameraY + cameraSize * 0.38, cameraSize * 0.22)
        .fill({ color: 0x1e293b, alpha: 1 });
      scene.screen
        .roundRect(
          cameraX + cameraSize * 0.22,
          cameraY + cameraSize * 0.58,
          cameraSize * 0.56,
          cameraSize * 0.17,
          cameraSize * 0.09,
        )
        .fill({ color: 0x1e293b, alpha: 0.96 });
    }

    scene.trail.clear();
    if (project.effects.locusEnabled) {
      const mapped = trail.map((point) => ({
        x: frame.width * point.x,
        y: frame.height * point.y,
      }));
      strokePath(scene.trail, mapped, 22 * project.effects.motionBlur, palette.ambientB, 0.1);
      strokePath(scene.trail, mapped, 10 * project.effects.motionBlur, palette.ambientC, 0.18);
      strokePath(scene.trail, mapped, 3.4, 0xffffff, 0.62);
    }

    scene.anchors.clear();
    if (project.effects.locusVisualized) {
      for (const keyframe of project.cursorKeyframes) {
        scene.anchors
          .circle(frame.width * keyframe.x, frame.height * keyframe.y, keyframe.click ? 5 : 3.5)
          .fill({
            color: keyframe.click ? 0x34d399 : 0xe2e8f0,
            alpha: keyframe.click ? 0.9 : 0.45,
          });
      }
    }

    scene.focus.clear();
    if (project.effects.fluxEnabled) {
      const focusRadius =
        48 + cursor.emphasis * 46 + project.effects.fluxIntensity * 24;

      scene.focus
        .circle(localCursorX, localCursorY, focusRadius * pulse)
        .fill({ color: palette.ambientB, alpha: 0.12 + cursor.zoom * 0.1 });
      scene.focus
        .circle(localCursorX, localCursorY, focusRadius * 0.58 * pulse)
        .fill({ color: palette.ambientC, alpha: 0.14 + cursor.emphasis * 0.08 });

      if (cursor.click) {
        scene.focus
          .circle(localCursorX, localCursorY, focusRadius * 1.2 * pulse)
          .stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
      }
    }

    scene.cursor.clear();
    scene.cursor
      .circle(localCursorX, localCursorY, 10 * project.effects.cursorScale)
      .fill({ color: 0xffffff, alpha: 0.96 })
      .stroke({ width: 2, color: palette.ambientA, alpha: 0.7 });
    scene.cursor
      .circle(localCursorX, localCursorY, 16 * project.effects.cursorScale)
      .stroke({
        width: 2,
        color: cursor.click ? 0x34d399 : palette.ambientC,
        alpha: 0.72,
      });

    if (recordingMode === "recording") {
      scene.cursor
        .circle(frame.width - 32, 32, 8)
        .fill({ color: 0xf43f5e, alpha: 0.95 });
    }
  });

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let cancelled = false;
    let app: Application | null = null;
    let destroyed = false;
    let initialized = false;

    const destroyApp = () => {
      if (!app || destroyed || !initialized) {
        return;
      }

      destroyed = true;
      app.destroy(
        { removeView: true },
        {
          children: true,
          texture: true,
          textureSource: true,
          context: true,
        },
      );
      app = null;
    };

    const setup = async () => {
      app = new Application();
      await app.init({
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
      });
      initialized = true;

      if (cancelled || !app) {
        destroyApp();
        return;
      }

      host.innerHTML = "";
      host.appendChild(app.canvas);

      const ambient = new Graphics();
      const world = new Container();
      const screen = new Graphics();
      const trail = new Graphics();
      const focus = new Graphics();
      const cursor = new Graphics();
      const anchors = new Graphics();

      world.addChild(screen, trail, focus, anchors, cursor);
      app.stage.addChild(ambient, world);

      sceneRef.current = {
        ambient,
        world,
        screen,
        trail,
        focus,
        cursor,
        anchors,
      };

      app.ticker.add((ticker) => {
        drawScene(ticker.lastTime);
      });

      appRef.current = app;
      drawScene(performance.now());
    };

    void setup();

    return () => {
      cancelled = true;
      sceneRef.current = null;
      destroyApp();
      appRef.current = null;
      host.innerHTML = "";
    };
  }, [drawScene]);

  useEffect(() => {
    drawScene(performance.now());
  }, [drawScene, playhead, project, recordingMode]);

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(167,139,250,0.2),_transparent_40%),linear-gradient(180deg,rgba(2,6,23,0.88),rgba(2,6,23,0.66))] shadow-[0_50px_120px_rgba(15,23,42,0.55)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,0.06),transparent_35%,rgba(96,165,250,0.08)_100%)]" />
      <div className="absolute left-5 top-5 z-10 rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-slate-200 uppercase backdrop-blur-xl">
        Realtime Flux Engine
      </div>
      <div className="absolute right-5 top-5 z-10 flex gap-2">
        <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-slate-200 backdrop-blur-xl">
          {project.style.aspectRatio}
        </span>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100 backdrop-blur-xl">
          Locus {Math.round(project.effects.smoothness * 100)}%
        </span>
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-100 backdrop-blur-xl">
          Flux {Math.round(project.effects.fluxIntensity * 100)}%
        </span>
      </div>
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
