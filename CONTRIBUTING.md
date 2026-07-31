# Contributing to Dart Room

Thank you for helping improve Dart Room. Bug fixes, accessibility improvements, tests, documentation, and focused gameplay enhancements are all welcome.

## Before you begin

- Search existing issues before opening a new one.
- Use the bug or feature issue form when it fits your proposal.
- Keep security reports private by following [SECURITY.md](SECURITY.md).
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md) in every project space.

For a substantial new game mode, visual rewrite, or architectural change, open a feature request before investing in an implementation. This gives maintainers and contributors a place to agree on scope.

## Set up the project

1. Fork and clone the repository.
2. Use a supported Node.js 22 release.
3. Install the locked dependencies with `npm ci`.
4. Start the application with `npm run dev`.

Install browser test dependencies when your change affects behavior or presentation:

```bash
npx playwright install chromium webkit
```

## Make a focused change

- Create a short-lived branch from `main`.
- Keep rule calculations in `app/game/lib/darts.ts` pure and deterministic.
- Keep Three.js lifecycle work inside `DartboardScene.tsx`.
- Preserve keyboard operation, visible focus, reduced motion, and responsive layout.
- Add or update tests for behavior changes.
- Update `docs/GAME.md` or `docs/ARCHITECTURE.md` when their contracts change.
- Do not commit generated directories such as `.next/`, `out/`, or test reports.

The package remains marked `private` to prevent accidental publication to the npm registry. That setting does not limit use under the repository license.

## Verify your work

Run the source checks:

```bash
npm run verify
```

If your change touches routing, metadata, public assets, or build configuration, also verify the static artifact:

```bash
npm run test:site
```

For gameplay, interaction, styling, or accessibility changes, run:

```bash
npm run test:e2e
```

## Open a pull request

Complete the pull request template and explain what a reviewer should verify. Keep the pull request limited to one coherent outcome. Screenshots or short recordings are helpful for visible changes, and tests should demonstrate fixes for regressions whenever practical.

By contributing, you agree that your contribution is licensed under the MIT License included with this repository.
