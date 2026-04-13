# Contribution Guidelines

Thanks for contributing to CalcFocus.

Areas where help is especially valuable:

- Linux capture and cursor pipeline stability
- Webcam overlay work
- Localisation, especially Chinese
- UI/UX refinements
- Export speed and reliability

## Before You Start

- Search existing issues and pull requests before starting work.
- Open an issue first for large refactors, release-flow changes, or changes to security-sensitive behavior.
- Keep pull requests focused. Small, reviewable changes are much easier to merge.

## Local Setup

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm test
pnpm lint
pnpm build
pnpm --filter @calcfocus/desktop tauri info
```

If your change touches recording, editing, export, or desktop packaging, please also do a manual smoke test on the affected flow.

## Pull Requests

- Fork the repository and work on a dedicated branch.
- Use clear commit messages that explain the user-facing effect of the change.
- Include screenshots or short videos for UI changes when possible.
- Update documentation when behavior, setup, or release expectations change.
- Mention any manual testing you performed in the PR description.

## Reporting Issues

Use the issue templates in GitHub when possible:

- Bugs: include reproduction steps, expected behavior, actual behavior, and logs if relevant.
- Features: explain the problem first, then the proposed solution.

Issue tracker:

- <https://github.com/08820048/CalcFocus/issues>

## Style Notes

- Prefer small, readable changes over broad rewrites.
- Add comments only when they clarify intent or non-obvious behavior.
- Avoid unrelated formatting churn in feature or bug-fix PRs.

## License

By contributing to this project, you agree that your contributions will be licensed under the repository license, [GNU Affero General Public License v3.0 only](./LICENSE) (`AGPL-3.0-only`).
