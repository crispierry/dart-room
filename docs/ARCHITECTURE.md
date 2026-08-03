# Architecture

## Overview

Dart Room is a client-side Next.js application. React owns the game interface and match state, Three.js renders the interactive board, and pure TypeScript functions calculate scoring and CPU decisions. There is no application backend, database, account system, or server-owned game state.

When embedded on the Cris website, the game reports menu, playing, and complete transitions to its same-origin parent with `{ type: "dart-room:phase", version: 1, phase }`. The parent may use playing and complete to promote the frame into an immersive mobile viewport. Receivers must validate both the sender window and origin before acting on the message.

```text
Pointer or accessible controls
              |
              v
      DartsGame match state
        |               |
        v               v
DartboardScene      Pure game rules
        |               |
        +------ hit ----+
              |
              v
     score, turn, result UI
```

## Application boundaries

### Next.js shell

- `app/layout.tsx` establishes global fonts and the metadata origin.
- `app/page.tsx` defines route metadata and mounts the game.
- `app/globals.css` provides the small global style foundation.

The route is statically renderable. Gameplay begins after client hydration because browser APIs and WebGL are required.

### Match controller

`app/game/DartsGame.tsx` owns configuration, players, scores, turns, rounds, visits, completion, announcements, result-dialog focus, audio feedback, persistence, and sharing. It passes the active player's color and a hit callback into the scene.

Timed CPU turns and visit transitions are tracked through refs so pending work can be canceled when a player exits or restarts a match. Count Up personal bests are the only persistent game state and use browser local storage.

### Rendering and input

`app/game/DartboardScene.tsx` creates and disposes the Three.js scene. It owns:

- board, dart, light, camera, and reticle construction;
- pointer capture and swipe-quality interpretation;
- coordinate projection from the viewport to the board plane;
- dart-flight animation and hit delivery;
- resize observation and graphics-resource cleanup.

React does not recreate the Three.js scene during a match. Current callbacks, disabled state, and player color are passed into the long-lived effect through refs.

### Game rules

`app/game/lib/darts.ts` contains deterministic scoring geometry, 301 bust behavior, Cricket marks, target selection, and seeded throw dispersion. Keeping these rules independent of React and Three.js makes them quick to exercise with Node's test runner.

## State flow

1. A player chooses a mode and opponent, then starts a match.
2. A pointer gesture or accessible Throw action asks the scene to animate a dart.
3. The scene maps the final board coordinate to a `HitResult` and reports it once.
4. The controller applies the selected mode's rules, updates the visit and score, and announces the result.
5. After three darts, a bust, or a win, the controller advances the turn or opens the result dialog.

CPU turns follow the same scene and hit path as human turns. Only target selection and impact dispersion differ.

## Build variants

| Command | Output | Routing behavior |
| --- | --- | --- |
| `npm run dev` | Next.js development server | Root route, no static export settings. |
| `npm run build` | Standard `.next` production build | Root route and normal Next.js runtime. |
| `npm run build:netlify` | Webpack-based `.next` build | Compatible with the repository's Netlify configuration. |
| `npm run build:site` | Static `out/` artifact | Base path `/project-apps/dart-room` and unoptimized static images. |

`next.config.ts` reads `DART_ROOM_BUILD_TARGET`, which is set only by the site build wrapper. The wrapper also compiles the public share path into the client. `app/page.tsx` uses the same private build target to make the public play route canonical and to mark the raw artifact `noindex, nofollow`.

The host must publish the contents of `out/` at the compiled base path. `tests/site/export.test.ts` checks that emitted assets resolve under that path, the metadata contract is present, and the public share route reaches the client bundle.

## Testing strategy

- `tests/game/` covers scoring and target behavior without a browser.
- `tests/e2e/` covers WebGL startup, full visits, match completion, CPU turns, local multiplayer, focus behavior, responsive overflow, and serious accessibility violations.
- `tests/site/` inspects the generated export rather than configuration alone, protecting the deployment contract.

Continuous integration runs source verification, the site artifact contract, the Netlify build, and the built application in Chromium, WebKit, and a mobile Chromium profile.

## Extension points

- Add scoring behavior as pure functions before wiring it into React state.
- Keep renderer-specific details behind the `DartboardSceneHandle` interface.
- Treat new browser persistence as a documented data decision and provide a safe fallback when storage is unavailable.
- Preserve both build variants when changing URLs, metadata, public assets, or Next.js configuration.
