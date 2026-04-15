# CalcFocus

<p>
  <img src="./logo.png" width="144" alt="CalcFocus logo">
</p>

CalcFocus is a desktop screen recorder and editor for polished walkthroughs, demos, and tutorials.

- Website: https://calcfocus.cc
- Repository: https://github.com/08820048/CalcFocus_Pro

## Status

- Product name has been updated from the upstream project to `CalcFocus`
- App metadata, window titles, file extensions, and packaging names now use `CalcFocus`
- Visual app icon assets now use the repository `logo.png`

## Tech Stack

- Electron
- React
- TypeScript
- Vite

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Auto-updates are disabled by default until `CALCFOCUS_ENABLE_AUTO_UPDATES=1` and `CALCFOCUS_UPDATE_FEED_URL` are configured.
- Project files now use the `.calcfocus` extension.
- The app feedback dialog now links to the website, QQ community, and GitHub issues.

## Attribution

CalcFocus is currently based on the open-source Recordly project and remains subject to the repository license terms.
See [NOTICE.md](./NOTICE.md) and [LICENSE.md](./LICENSE.md) for attribution and licensing details.
