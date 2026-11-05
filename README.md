# Strike Arena

A 2D browser fighting game. Pure HTML/CSS/JS, no dependencies, no assets, no build step.

## Files
- `index.html` – menus and styling
- `game.js` – engine, fighters, AI, stages, audio (all drawn/synthesized in code)

## Run locally
```bash
cd "BROWSER GAME" && python3 -m http.server 8000   # open http://localhost:8000
```

## Host it (free options)
Upload the folder (both files) to any static host:
- **Netlify Drop**: drag the folder onto app.netlify.com/drop
- **GitHub Pages**: push to a repo → Settings → Pages
- **Cloudflare Pages / Vercel**: connect the folder/repo, no build command, output dir `/`

## Controls
P1: A/D move, W jump, S block, F punch, G kick, H special, R super
P2: arrows, J punch, K kick, L special, I super
Mobile: on-screen buttons appear on touch devices. P / Esc pauses.

## Customize
Characters live in the `CHARS` array at the top of `game.js`; stages in `buildStage()`.
Rename the game by editing the `<title>` and `.logo` in `index.html`.
