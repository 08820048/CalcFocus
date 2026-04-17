# CalcFocus

<p>
  <img src="./logo.png" width="144" alt="CalcFocus logo">
</p>

CalcFocus 是一款开源的桌面录屏、截图与编辑应用，面向演示、教程、产品讲解和工作流展示。

- 官网：https://calcfocus.cc
- 仓库：https://github.com/08820048/CalcFocus

## 主要功能

### 录屏

- 录制整个屏幕或单个窗口
- 录制结束后直接进入编辑器
- 支持麦克风录音
- 在平台支持的情况下录制系统音频
- macOS 使用原生 ScreenCaptureKit 辅助程序
- Windows 使用原生 WGC + WASAPI 辅助程序
- Linux 使用浏览器 / FFmpeg 路径

### 编辑

- 时间线裁剪
- 变速区间
- 手动缩放区域
- 自动缩放建议
- 鼠标光标平滑、缩放、动效与点击反馈
- 标注
- 背景、圆角、留白、模糊、阴影等画面样式
- `.calcfocus` 工程保存与重新打开

### 截图

- 截取屏幕或窗口
- macOS 支持交互式区域截图
- 截图后自动进入内置图片编辑器
- 支持壁纸、渐变、纯色、透明背景
- 支持调整留白、圆角、阴影
- 支持保存 PNG 或直接复制到剪贴板

### 导出

- 导出 MP4
- 导出 GIF
- 支持画面比例和质量设置

## 技术栈

- Electron
- React
- TypeScript
- Vite
- PixiJS
- WebCodecs

## 本地开发

```bash
git clone https://github.com/08820048/CalcFocus.git
cd CalcFocus
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

构建产物默认输出到 `release/`。

## 发布与更新

- 推送到 `main` 会触发常规构建工作流
- 推送 `vX.Y.Z` 这样的版本标签会触发正式发布工作流
- 正式打包版默认通过 GitHub Releases 检查更新
- 如需改走自定义更新源，可设置 `CALCFOCUS_UPDATE_FEED_URL`

更详细的发版说明见 [RELEASING.md](./RELEASING.md)。

## 平台说明

### Linux 光标捕获

Linux 在部分场景下仍依赖浏览器式采集路径，因此不一定能隐藏系统光标。某些录制结果里可能会同时看到系统光标和渲染光标。

### 系统音频

- Windows：开箱即用
- Linux：通常需要 PipeWire 环境
- macOS：通过 ScreenCaptureKit 辅助程序处理

### macOS 本地构建

本地源码构建默认不带签名。如果 macOS 拦截应用，可以执行：

```bash
xattr -rd com.apple.quarantine "/Applications/CalcFocus.app"
```

## 贡献

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

## 许可与归属

CalcFocus 使用 **GNU Affero General Public License v3.0 only**（`AGPL-3.0-only`）。

第三方代码与资源说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

CalcFocus 当前基于开源项目 Recordly 继续开发，并继续受仓库内许可证约束。
归属与许可信息见 [NOTICE.md](./NOTICE.md) 和 [LICENSE.md](./LICENSE.md)。
