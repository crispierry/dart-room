# Dart Room

A standalone 3D browser darts game built with Next.js and Three.js.

## Game modes

- Count Up: eight rounds, highest total wins
- 301: race from 301 to exactly zero, with optional double-out
- Cricket: close 15–20 and bull, then outscore your rival
- Solo, local two-player, and three CPU difficulty levels

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run verify
npx playwright install chromium webkit
npm run test:e2e
```
