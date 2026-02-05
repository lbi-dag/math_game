# Math Games

Small, no-ads math games built for quick practice sessions and classroom-friendly play.

## What's here
- Landing page: `index.html`
- About page: `about.html`
- Shared styles: `styles.css`
- Number Sense Sprint game: `number-sense-sprint.html` + `game.ts` (compiled to `dist/game.js`)

## Run locally
1. `npm install`
2. `npm run build` (outputs `dist/game.js`)
3. Open `index.html` in your browser.

## Tests
- `npm test`

## Notes
- Main branch is hosted at `https://mathgames.win/` via CloudFlare.
- Build step required for TypeScript (`npm run build`).
- Designed to be lightweight and easy to host on any static site or Cloudflare Workers.
