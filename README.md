# BudgetArk Website

Static marketing site for the BudgetArk budgeting app. No build tools, no dependencies - just HTML, CSS, and a little JavaScript.

## Structure

```
index.html      Home page (hero, features, about, download)
news.html       News & updates feed
privacy.html    Privacy policy
calculators.html Calculator index (generated)
calculators/    One page per calculator (generated)
404.html        Custom not-found page (GitHub Pages serves it automatically)
css/style.css   All styles
js/main.js      Mobile nav toggle, theme switcher, ambient backdrops
js/calculators.js  Calculator math (ported from the app's utils) and UI
js/tax-data-2026.js  Generated from the app's tax tables - do not hand-edit
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

1. `index.html` - copy a `<button class="theme-card" data-theme="...">` block into the theme grid and set the `--t-*` preview colors (bg, card, cardBorder, accent, text, textDim, success).
2. `css/style.css` - add a `[data-theme="..."]` block mapping the preset's colors onto the site variables (`--parchment`, `--card`, `--border`, `--ink`, `--wood`, `--green`, `--gold`, ...). Ambient themes also set `--bg: transparent` and get an `.ambient` gradient + glass-card rule. Check text contrast (`--ink-soft`, `--wood`, `--gold` on `--parchment`; `--accent-text` on `--wood`; `--parchment` on `--green`) stays at or above 4.5:1 - the site palettes are allowed to drift slightly from the app's for that reason.
3. `js/main.js` - only for ambient themes: add a backdrop SVG function and a branch in `renderAmbient()`.

## Calculators

`calculators/` holds one page per tool and `calculators.html` is the index. Both
are generated: run `python scripts/build-calculators.py` after editing the copy
and FAQs in that script or the interactive markup in `scripts/calculators/*.html`
(never edit the generated pages directly). The nav's Tools dropdown on the other
pages is hand-copied from the same script's `nav_dropdown()`. The
math in `js/calculators.js` is a direct port of the app's `src/utils`
(`calculations.ts`, `chartCalculators.ts`, `taxCalc.ts`, `purchasePlanner.ts`,
`whatIfSpending.ts`, `exchangeCalculator.ts`) - keep them in step when the app
changes a formula. `js/tax-data-2026.js` is generated from the app's
`taxData2026.ts` and `stateTaxData2026.ts` by stripping the TypeScript types;
regenerate it when the app ships a new tax year. `scripts/parity-check.js` compares the site's
functions with the app's compiled utils over a few thousand inputs; the header
of that file has the two commands to run it. The currency tool is the only
thing on the site that makes a network request (to open.er-api.com, and only
when the user presses the button), which is why every page's CSP allows that
one host in `connect-src`.

## Rating, review, and share image

The App Store rating in the home page schema (`aggregateRating`) and the "5.0 on
the App Store" line in the download section are copied by hand. Refresh them
now and then from
`https://itunes.apple.com/lookup?id=6760246006&country=us` (`averageUserRating`,
`userRatingCount`). Written reviews come from
`https://itunes.apple.com/us/rss/customerreviews/id=6760246006/json`.

`assets/og-image.jpg` (1200x630) is the link-preview image for every page. It was
rendered from a small HTML mock using the site's own CSS and a phone
screenshot, so regenerate it the same way if the branding or screenshots change.

## Default theme and Content Security Policy

First-time visitors get Forest Gold or The Ark depending on their system
color scheme; a theme picked on the site is remembered in localStorage and wins
after that. Every page carries a `Content-Security-Policy` meta tag. The inline
theme script is allowed by its SHA-256 hash, so if you edit that script, the
hash in every page's CSP tag must be recomputed (same script on all pages).

## Fonts and screenshots

Fraunces and Inter are self-hosted variable fonts (SIL Open Font License) in
`assets/fonts/`, so visitors never contact Google Fonts. The `@font-face` rules
are at the top of `css/style.css`.

The screenshot strip on the home page uses the App Store screenshots from the
app repo (`../budgetark/screenshots/app-store/iphone-6.9/`), resized to 600px
wide WebP files in `assets/`. When the store screenshots are refreshed, re-export
them the same way and update the captions in `index.html`.

## Deploying

Any static host works:

- **GitHub Pages** - push the repo to GitHub, then Settings → Pages → deploy from branch.
- **Netlify / Vercel / Cloudflare Pages** - drag-and-drop the folder or connect the repo. No build command needed; publish directory is the repo root.
