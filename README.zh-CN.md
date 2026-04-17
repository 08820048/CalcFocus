# CalcFocus

<p>
  <img src="./logo.png" width="144" alt="CalcFocus logo">
</p>

CalcFocus 是一款面向演示、讲解和教程内容的桌面录屏与编辑应用。

- 官网：https://calcfocus.cc
- 仓库：https://github.com/08820048/CalcFocus

## 当前状态

- 产品名已从上游项目替换为 `CalcFocus`
- 应用元信息、窗口标题、项目文件后缀、打包名称都已切换到 `CalcFocus`
- 视觉图标资源现已接入仓库里的 `logo.png`

## 技术栈

- Electron
- React
- TypeScript
- Vite

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 说明

- 打包后的正式版本默认通过 GitHub Releases 检查更新；如需改走自定义更新源，可额外设置 `CALCFOCUS_UPDATE_FEED_URL`。
- 项目文件后缀现为 `.calcfocus`。
- 应用内反馈弹窗现在已接入官网、QQ 社区和 GitHub issue。

## 归属说明

CalcFocus 当前基于开源项目 Recordly 继续开发，并继续受仓库内许可证约束。
归属与许可信息见 [NOTICE.md](./NOTICE.md) 和 [LICENSE.md](./LICENSE.md)。
