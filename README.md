# Dart Room

Dart Room is a polished 3D browser darts game built with Next.js, React, and Three.js. It runs entirely in the browser: no account, download, backend, or saved server state is required.

Dart Room was created as a playable companion to The Blind Dart Thrower neural-network lesson plan.

![Dart Room game preview](public/game-og.png)

## What you can play

- **Count Up:** score as many points as possible over eight rounds.
- **301:** race from 301 to exactly zero, with optional double-out rules.
- **Cricket:** close 15–20 and bull, then finish with at least as many points as every opponent.
- **Opponent choices:** practice solo, share one device with a second player, or face three CPU difficulty levels.
- **Flexible controls:** throw with a pointer gesture or use the keyboard-friendly aim selector and Throw button.

The game includes responsive layouts, reduced-motion support, focus management, live scoring announcements, optional synthesized sound, and a local Count Up personal best.

## Requirements

- Node.js 22.13 or later in the Node 22 release line
- npm 10 or later
- A browser with WebGL support

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Changes to the application update through the Next.js development server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run typecheck` | Check TypeScript without emitting files. |
| `npm run lint` | Run the Next.js ESLint rules. |
| `npm test` | Run the deterministic game-rule tests. |
| `npm run build` | Create the standard production Next.js build. |
| `npm run build:netlify` | Create the webpack-based build used by Netlify. |
| `npm run build:site` | Export the embeddable static artifact to `out/`. |
| `npm run test:site` | Build and validate the static subpath artifact. |
| `npm run test:e2e` | Build the standard app and run the browser test suite. |
| `npm run verify` | Run type checks, lint, game tests, and the standard build. |

Install the Playwright browsers before the first end-to-end run:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

## Production builds

The ordinary development, production, and Netlify commands keep their standard Next.js behavior. The static embedding configuration is conditional and only activates for `npm run build:site`.

The site build:

- exports static files to `out/`;
- prefixes application and asset URLs with `/project-apps/dart-room`;
- points canonical and share behavior to `/projects/dart-room/play`;
- marks the raw embedded artifact `noindex, nofollow` so the public play page remains canonical.

Set the public origin at build time when generating an artifact for deployment:

```bash
NEXT_PUBLIC_SITE_URL=https://example.com npm run build:site
```

Deploy the contents of `out/` at `/project-apps/dart-room/`, then embed that URL from the public play page. The base path is compiled into the artifact and should not be removed by the host.

## Project structure

```text
app/
  game/
    DartboardScene.tsx   Three.js scene, gestures, and dart animation
    DartsGame.tsx        Match state, controls, scoring flow, and presentation
    lib/darts.ts         Pure scoring, target, and CPU behavior
docs/
  ARCHITECTURE.md        System boundaries and build variants
  GAME.md                Controls and rules
tests/
  e2e/                   Browser and accessibility coverage
  game/                  Pure game-rule coverage
  site/                  Static artifact contract coverage
```

See [Architecture](docs/ARCHITECTURE.md) for the component and deployment model, and [Game rules](docs/GAME.md) for player-facing behavior.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License

Dart Room is available under the [MIT License](LICENSE).
