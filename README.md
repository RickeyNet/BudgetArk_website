# BudgetArk Website

Static marketing site for the BudgetArk budgeting app. No build tools, no dependencies — just HTML, CSS, and a little JavaScript.

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

## Deploying

Any static host works:

- **GitHub Pages** — push the repo to GitHub, then Settings → Pages → deploy from branch.
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder or connect the repo. No build command needed; publish directory is the repo root.
