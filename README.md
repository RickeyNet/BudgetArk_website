# BudgetArk Website

Static marketing site for the BudgetArk budgeting app. No build tools, no dependencies - just HTML, CSS, and a little JavaScript.

## Structure

```
index.html      Home page (hero, features, about, download)
news.html       News & updates feed
css/style.css   All styles
js/main.js      Mobile nav toggle
```

## Viewing locally

Just open `index.html` in a browser, or run a local server:

```powershell
python -m http.server 8000
# then visit http://localhost:8000
```

## Adding a news post

Open `news.html` and copy one of the `<article class="news-card">` blocks. Paste the copy at the **top** of the `news-list` div (newest first), then edit:

- the `<time datetime="YYYY-MM-DD">` date (both the attribute and the visible text)
- the `news-tag` label (e.g. Announcement, Development, Release)
- the title and paragraph

## Adding a theme

Themes mirror the app's `src/theme/themes.ts` presets. To add one:

1. `index.html` - copy a `<div class="theme-card" data-theme="...">` block into the theme grid and set the `--t-*` preview colors (bg, card, cardBorder, accent, text, textDim, success).
2. `css/style.css` - add a `[data-theme="..."]` block mapping the preset's colors onto the site variables (`--parchment`, `--card`, `--border`, `--ink`, `--wood`, `--green`, `--gold`, ...). Ambient themes also set `--bg: transparent` and get an `.ambient` gradient + glass-card rule.
3. `js/main.js` - only for ambient themes: add a backdrop SVG function and a branch in `renderAmbient()`.

## Deploying

Any static host works:

- **GitHub Pages** - push the repo to GitHub, then Settings → Pages → deploy from branch.
- **Netlify / Vercel / Cloudflare Pages** - drag-and-drop the folder or connect the repo. No build command needed; publish directory is the repo root.
