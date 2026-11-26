"""Generate release-notes.html.

One page listing every app release, newest first, from
scripts/release-notes/notes.json, which scripts/extract-release-notes.js pulls
out of the app repo (the same notes the app shows under Profile -> Release
Notes). Run from anywhere:

    node scripts/extract-release-notes.js ../BudgetArk   # after each app release
    python scripts/build-release-notes.py

The page shell (head, nav, footer) is shared with build-calculators.py. The
output is plain static HTML that gets committed. Never edit it by hand.
Each release has an anchor (#v1-11-2), the same id scheme news.html uses.
"""
import datetime, html, importlib.util, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_calculators', os.path.join(HERE, 'build-calculators.py'))
bc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bc)  # also chdirs to the repo root

SITE = bc.SITE
RELEASES = json.load(open('scripts/release-notes/notes.json', encoding='utf-8'))['releases']

def esc(s):
    return html.escape(s, quote=False)

def anchor(r):
    return 'v' + r['version'].replace('.', '-')

def nice_date(iso):
    d = datetime.date.fromisoformat(iso)
    return f'{d.strftime("%B")} {d.day}, {d.year}'

def highlight(text):
    # Newer notes are written headline-first; bold a short opening sentence.
    m = re.match(r'(.{15,110}?[.!?])\s+(?=[A-Z"\'(\d])(.+)$', text, re.S)
    if m:
        return f'<strong>{esc(m.group(1))}</strong> {esc(m.group(2))}'
    return esc(text)

def headline(text):
    """The short title of a release note, for the news page.

    Newer notes open with a one-sentence headline. Older ones are a single long
    sentence, so cut those at the first natural break instead.
    """
    m = re.match(r'(.+?[.!?])(?:\s+(?=[A-Z"\'(\d])|$)', text, re.S)
    s = m.group(1) if m else text
    if len(s) > 110:
        cut = re.match(r'(.{30,110}?)(?::\s| - | \(|;\s|, so |, with |, and )', s)
        if cut:
            s = cut.group(1)
    return s.rstrip('.').strip()

NEWS_BLOCK = re.compile(r'([ \t]*)<!-- release:([\d.]+) -->.*?<!-- /release -->', re.S)

def news_block(m):
    pad, version = m.group(1), m.group(2)
    r = next((x for x in RELEASES if x['version'] == version), None)
    if r is None:
        raise SystemExit(f'news.html has a block for v{version}, which is not in notes.json')
    items = '\n'.join(f'{pad}  <li>{esc(headline(h))}</li>' for h in r['highlights'])
    return f'''{pad}<!-- release:{version} -->
{pad}<ul class="release-list news-release-list">
{items}
{pad}</ul>
{pad}<p class="news-more"><a href="release-notes.html#{anchor(r)}">Full release notes for v{version}</a></p>
{pad}<!-- /release -->'''

def sync_news():
    """Refill the generated lists in the hand-written news.html."""
    src = open('news.html', encoding='utf-8').read()
    out, n = NEWS_BLOCK.subn(news_block, src)
    if out != src:
        with open('news.html', 'w', encoding='utf-8', newline='\n') as f:
            f.write(out)
    return n

def release_html(r):
    items = '\n'.join(f'            <li>{highlight(h)}</li>' for h in r['highlights'])
    return f'''        <article class="news-card release" id="{anchor(r)}">
          <div class="news-meta">
            <time datetime="{r['releasedAt']}">{nice_date(r['releasedAt'])}</time>
            <span class="news-tag">v{r['version']}</span>
          </div>
          <h2>{esc(r['title'])}</h2>
          <ul class="release-list">
{items}
          </ul>
        </article>
'''

def page():
    path = 'release-notes.html'
    latest = RELEASES[0]
    meta = (f'Every BudgetArk release and what changed in it, from v{RELEASES[-1]["version"]} to '
            f'v{latest["version"]}: new features, fixes, and improvements to the free, private, offline-first budgeting app.')
    ld = bc.ld_json({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebPage',
                '@id': f'{SITE}/{path}',
                'name': 'BudgetArk Release Notes',
                'url': f'{SITE}/{path}',
                'description': meta,
                'dateModified': latest['releasedAt'],
                'publisher': {'@id': f'{SITE}/#org'},
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'Release Notes', 'item': f'{SITE}/{path}'},
                ],
            },
        ],
    })
    jump = ' '.join(f'<a href="#{anchor(r)}">v{r["version"]}</a>' for r in RELEASES)
    body = '\n'.join(release_html(r) for r in RELEASES)
    return (bc.head('', 'Release Notes', html.escape(meta), path, ld) + bc.header('', notes_active=True) + f'''
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">SHIP'S MANIFEST</p>
        <h1>Release Notes</h1>
        <p class="page-hero-sub">Every change in every version, newest first - the same notes the app shows under Profile → Release Notes. The latest is v{latest['version']}, released {nice_date(latest['releasedAt'])}. For the story behind the bigger releases, see <a href="news.html">News</a>.</p>
        <nav class="news-index" aria-label="Jump to a version">{jump}</nav>
      </div>
    </section>

    <section class="section">
      <div class="container news-list">

{body}
      </div>
    </section>

    <section class="cta section">
      <div class="container cta-inner">
        <h2>Get the latest version</h2>
        <p>BudgetArk is free on the App Store and Google Play, with no subscription and no account.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="index.html#download" class="btn btn-primary">Get BudgetArk</a>
          <a href="news.html" class="btn btn-ghost">Read the news</a>
        </div>
      </div>
    </section>
  </main>

''' + bc.footer('') + '''
  <script src="js/main.js"></script>
</body>
</html>
''')

if __name__ == '__main__':
    bc.write('release-notes.html', page())
    print('wrote release-notes.html -', len(RELEASES), 'releases')
    print('news.html -', sync_news(), 'release posts refreshed')
