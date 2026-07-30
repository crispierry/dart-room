# Dart Room game

Dart Room is a standalone WebGL darts game. It does not require an account, server state, or a download.

## Mechanics

- Drag or swipe upward over the board to throw.
- Keyboard and button controls provide an accessible alternative.
- The Three.js scene calculates the impact point against regulation-style scoring rings.
- Count Up, 301, and Cricket each use independent scoring rules.
- Matches support solo play, local two-player play, and CPU opponents.
- Count Up personal bests are stored locally in the browser.

## Source

- `app/game/DartboardScene.tsx` owns the Three.js board, lighting, gestures, dart flight, and hit callbacks.
- `app/game/DartsGame.tsx` owns match state, turns, scoring, CPU timing, sharing, and presentation.
- `app/game/lib/darts.ts` contains pure scoring, geometry, and CPU rules.
- `tests/game/darts.test.ts` covers the pure game rules.
- `tests/e2e/game.spec.ts` covers WebGL, full visits, accessibility, multiplayer, and CPU play.
