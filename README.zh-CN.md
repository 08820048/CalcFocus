# CalcFocus

<p>
  <img src="./logo.png" width="144" alt="CalcFocus logo">
</p>

CalcFocus 是一款面向演示、讲解和教程内容的桌面录屏与编辑应用。

- 官网：https://calcfocus.cc
- 仓库：https://github.com/08820048/CalcFocus_Pro

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

- 自动更新默认关闭；后续配置 `CALCFOCUS_ENABLE_AUTO_UPDATES=1` 和 `CALCFOCUS_UPDATE_FEED_URL` 后再开启。
- 项目文件后缀现为 `.calcfocus`。
- 应用内反馈弹窗现在已接入官网、QQ 社区和 GitHub issue。

## 归属说明

CalcFocus 当前基于开源项目 Recordly 继续开发，并继续受仓库内许可证约束。
归属与许可信息见 [NOTICE.md](./NOTICE.md) 和 [LICENSE.md](./LICENSE.md)。
