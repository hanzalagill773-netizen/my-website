# BuildCraft — 3D Home Generator

Static site (HTML/CSS/JS, three.js via CDN, no build step required).

## Files
- `index.html` — page structure, logo, and styling
- `script.js` — 3D house generator, style/furniture data, recommendation logic, background interaction

## What it does
1. Enter a plot width and length (feet) and click **Generate my home**.
2. A 3D house model is built to match your plot's proportions and size.
3. BuildCraft recommends a design style (Modern, Farmhouse, Colonial, Minimalist) based on the plot's shape and area, and explains why.
4. Pick any style card to preview it on the model; the furniture list below updates to match.
5. Click anywhere on the dark background (outside the form/3D panel) to see a small gold block pop up — a decorative touch on the "classy" background.

## Deploy (GitHub + Vercel)
1. Create a GitHub repo and upload `index.html`, `script.js`, and this README.
2. Import the repo into Vercel ("Add New Project").
3. Vercel deploys it as a static site automatically — no build config needed.
