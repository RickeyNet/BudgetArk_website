"""Generate the Captain's Course pages.

Writes course.html (the chapter outline) and course/<slug>.html (one page per
lesson) from scripts/course/lessons.json, which scripts/extract-course.js
pulls out of the app repo. Run from anywhere:

    node scripts/extract-course.js ../BudgetArk   # only when the app's lessons change
    python scripts/build-course.py

The page shell (head, nav, footer) is shared with build-calculators.py. The
output is plain static HTML that gets committed. Never edit it by hand.
"""
import html, importlib.util, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_calculators', os.path.join(HERE, 'build-calculators.py'))
bc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bc)  # also chdirs to the repo root

SITE = bc.SITE
DATA = json.load(open('scripts/course/lessons.json', encoding='utf-8'))
CHAPTERS = DATA['chapters']
LESSONS = [dict(l, chapter=ch) for ch in CHAPTERS for l in ch['lessons']]

TOPICS = {
    'budgeting': 'Budgeting', 'debt': 'Debt', 'saving': 'Saving', 'investing': 'Investing',
    'taxes': 'Taxes', 'insurance': 'Insurance', 'real_estate': 'Real Estate',
    'retirement': 'Retirement', 'mindset': 'Mindset',
}
# calculator-embed ids -> (label, site calculator slug)
CALCS = {
    'loan-amortization': ('Loan / Mortgage Calculator', 'loan-mortgage'),
    'compound-interest': ('Compound Interest Calculator', 'compound-interest'),
    'refinance-break-even': ('Refinance Break-Even Calculator', 'refinance-break-even'),
    'emergency-fund': ('Emergency Fund Calculator', 'emergency-fund'),
    'payoff-comparison': ('Debt Payoff Strategy', 'debt-payoff'),
}
# Lesson action routes. Calculator routes have a page on this site; the rest
# are app screens, so the card names the tab and points at the download.
ROUTE_CALCS = {
    'charts/tools/compound': 'compound-interest',
    'charts/tools/loan': 'loan-mortgage',
    'charts/tools/refinance': 'refinance-break-even',
    'charts/tools/emergency-fund': 'emergency-fund',
}
ROUTE_TABS = {'budget': 'Budget', 'debts': 'Debts', 'bridge': 'Bridge', 'profile': 'Profile'}


def esc(s):
    return html.escape(s, quote=False)

def attr(s):
    return html.escape(s, quote=True)

def slug(lesson):
    return re.sub(r'^ch\d+-l\d+-', '', lesson['id'])

def topic_pills(lesson):
    return ''.join(f'<li>{TOPICS.get(t, t)}</li>' for t in lesson['topics'])

# --------------------------------------------------------------------------
# Lesson body
# --------------------------------------------------------------------------

def section_html(s):
    kind = s['type']
    if kind == 'paragraph':
        return f'        <p>{esc(s["text"])}</p>'
    if kind == 'bullet-list':
        title = f'          <h2>{esc(s["title"])}</h2>\n' if s.get('title') else ''
        items = '\n'.join(f'            <li>{esc(i)}</li>' for i in s['items'])
        return f'        <div class="lesson-list">\n{title}          <ul>\n{items}\n          </ul>\n        </div>'
    if kind == 'callout':
        title = f'          <p class="lesson-callout-title">{esc(s["title"])}</p>\n' if s.get('title') else ''
        return (f'        <aside class="lesson-callout tone-{attr(s.get("tone", "info"))}">\n{title}'
                f'          <p>{esc(s["text"])}</p>\n        </aside>')
    if kind == 'calculator-embed':
        if s['calc'] not in CALCS:
            return ''
        label, calc_slug = CALCS[s['calc']]
        return (f'        <a class="lesson-try" href="../calculators/{calc_slug}.html">\n'
                f'          <span class="lesson-eyebrow">TRY IT</span>\n'
                f'          <strong>{esc(label)}</strong>\n'
                f'          <span class="lesson-try-hint">Runs right here in your browser. Nothing you enter is stored or sent.</span>\n'
                f'        </a>')
    return ''  # unknown section types render as nothing, like the app

def action_html(action):
    if not action:
        return ''
    route, label = action['route'], esc(action['label'])
    if route in ROUTE_CALCS:
        return (f'        <p class="lesson-action"><a class="btn btn-primary" href="../calculators/{ROUTE_CALCS[route]}.html">{label}</a></p>\n')
    tab = ROUTE_TABS.get(route)
    if not tab:
        return ''
    return (f'        <aside class="lesson-app">\n'
            f'          <p class="lesson-eyebrow">NEXT STEP IN THE APP</p>\n'
            f'          <p><strong>{label}</strong> - on the {tab} tab in BudgetArk. <a href="../index.html#download">Get the app</a></p>\n'
            f'        </aside>\n')

def resources_html(resources):
    items = []
    for r in resources or []:
        if r['type'] == 'book':
            items.append(f'          <li>📖 <cite>{esc(r["title"])}</cite> by {esc(r["author"])}</li>')
        elif r['type'] in ('youtube', 'article') and r.get('url', '').startswith('https://'):
            by = r.get('channel') or r.get('source') or ''
            items.append(f'          <li><a href="{attr(r["url"])}" target="_blank" rel="noopener">{esc(r["title"])}</a>{" - " + esc(by) if by else ""}</li>')
    if not items:
        return ''
    return '        <h2 class="lesson-h2">Go deeper</h2>\n        <ul class="lesson-resources">\n' + '\n'.join(items) + '\n        </ul>\n'

def pager_html(i):
    prev = LESSONS[i - 1] if i > 0 else None
    nxt = LESSONS[i + 1] if i + 1 < len(LESSONS) else None
    def link(l, cls, word):
        if not l:
            return f'          <span class="lesson-pager-{cls}"></span>'
        return (f'          <a class="lesson-pager-{cls}" href="{slug(l)}.html" rel="{"prev" if cls == "prev" else "next"}">\n'
                f'            <span class="lesson-eyebrow">{word}</span>\n'
                f'            <strong>{esc(l["title"])}</strong>\n'
                f'          </a>')
    return ('        <nav class="lesson-pager" aria-label="Lessons">\n'
            + link(prev, 'prev', '← PREVIOUS') + '\n' + link(nxt, 'next', 'NEXT →') + '\n        </nav>\n')

# --------------------------------------------------------------------------
# Lesson pages
# --------------------------------------------------------------------------

def lesson_page(i):
    l = LESSONS[i]
    ch = l['chapter']
    prefix = '../'
    path = f'course/{slug(l)}.html'
    title = f'{l["title"]} - Captain\'s Course'
    meta = attr(f'{l["summary"]} A free {l["readMin"]}-minute lesson from the BudgetArk Captain\'s Course.')
    ld = bc.ld_json({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': ['Article', 'LearningResource'],
                '@id': f'{SITE}/{path}#lesson',
                'headline': l['title'],
                'description': l['summary'],
                'url': f'{SITE}/{path}',
                'inLanguage': 'en',
                'isAccessibleForFree': True,
                'learningResourceType': 'Lesson',
                'timeRequired': f'PT{l["readMin"]}M',
                'about': [TOPICS.get(t, t) for t in l['topics']],
                'isPartOf': {'@id': f'{SITE}/course.html#course'},
                'author': {'@id': f'{SITE}/#org'},
                'publisher': {'@id': f'{SITE}/#org'},
                'image': f'{SITE}/assets/og-image.jpg',
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
                    {'@type': 'ListItem', 'position': 2, 'name': "Captain's Course", 'item': f'{SITE}/course.html'},
                    {'@type': 'ListItem', 'position': 3, 'name': l['title'], 'item': f'{SITE}/{path}'},
                ],
            },
        ],
    })
    body = '\n'.join(filter(None, (section_html(s) for s in l['body'])))
    why = (f'        <blockquote class="lesson-why">\n          <p class="lesson-eyebrow">WHY THIS MATTERS</p>\n'
           f'          <p>{esc(l["whyItMatters"])}</p>\n        </blockquote>\n') if l.get('whyItMatters') else ''
    takeaway = (f'        <aside class="lesson-takeaway">\n          <p class="lesson-eyebrow">KEY TAKEAWAY</p>\n'
                f'          <p>{esc(l["keyTakeaway"])}</p>\n        </aside>\n') if l.get('keyTakeaway') else ''
    return (bc.head(prefix, attr(title), meta, path, ld) + bc.header(prefix, course_active=True) + f'''
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="{prefix}index.html">Home</a> › <a href="{prefix}course.html">Captain's Course</a> › <span aria-current="page">{esc(l['title'])}</span></nav>
        <p class="eyebrow">CH {ch['number']} · {esc(ch['title']).upper()} · LESSON {l['number']}</p>
        <h1><span class="lesson-glyph" aria-hidden="true">{l['glyph']}</span> {esc(l['title'])}</h1>
        <p class="page-hero-sub">{esc(l['summary'])}</p>
        <ul class="lesson-meta"><li>{l['readMin']} min read</li>{topic_pills(l)}</ul>
      </div>
    </section>

    <section class="section lesson">
      <article class="container lesson-inner">
{why}{body}
{takeaway}{action_html(l.get('action'))}{resources_html(l.get('resources'))}{pager_html(i)}        <p class="tool-note lesson-disclaimer">{esc(DATA['disclaimer'])}</p>
      </article>
    </section>

    <section class="cta section">
      <div class="container cta-inner">
        <h2>Take the course with you</h2>
        <p>In the app, the Captain's Course tracks what you've read and sits next to your real budget, debts, and accounts - and everything stays on your phone.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="{prefix}index.html#download" class="btn btn-primary">Get BudgetArk</a>
          <a href="{prefix}course.html" class="btn btn-ghost">All lessons</a>
        </div>
      </div>
    </section>
  </main>

''' + bc.footer(prefix) + f'''
  <script src="{prefix}js/main.js"></script>
</body>
</html>
''')

# --------------------------------------------------------------------------
# Index page
# --------------------------------------------------------------------------

def index_page():
    prefix = ''
    path = 'course.html'
    total_min = sum(l['readMin'] for l in LESSONS)
    desc = (f"A free personal finance course from BudgetArk: {len(LESSONS)} short lessons in {len(CHAPTERS)} chapters "
            "covering budgeting basics, debt payoff, saving, investing, and long-term planning. Read it all here, no signup.")
    ld = bc.ld_json({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Course',
                '@id': f'{SITE}/{path}#course',
                'name': "Captain's Course",
                'description': desc,
                'url': f'{SITE}/{path}',
                'inLanguage': 'en',
                'isAccessibleForFree': True,
                'provider': {'@id': f'{SITE}/#org'},
                'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD', 'category': 'Free'},
                'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online', 'courseWorkload': f'PT{total_min}M'},
            },
            {
                '@type': 'ItemList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': n + 1, 'name': l['title'], 'url': f'{SITE}/course/{slug(l)}.html'}
                    for n, l in enumerate(LESSONS)
                ],
            },
        ],
    })
    jump = '\n'.join(
        f'          <li><a href="#{ch["id"]}"><span aria-hidden="true">{ch["glyph"]}</span> {esc(ch["title"])}</a></li>'
        for ch in CHAPTERS)
    chapters = ''
    for ch in CHAPTERS:
        mins = sum(l['readMin'] for l in ch['lessons'])
        rows = '\n'.join(f'''          <li>
            <a href="course/{slug(l)}.html">
              <span class="course-glyph" aria-hidden="true">{l['glyph']}</span>
              <span class="course-text">
                <strong>{esc(l['title'])}</strong>
                <span>{esc(l['summary'])}</span>
              </span>
              <span class="course-min">{l['readMin']} min</span>
            </a>
          </li>''' for l in ch['lessons'])
        chapters += f'''        <section class="course-chapter" id="{ch['id']}">
          <p class="lesson-eyebrow">CHAPTER {ch['number']} · {esc(ch['subtitle']).upper()}</p>
          <h2><span aria-hidden="true">{ch['glyph']}</span> {esc(ch['title'])}</h2>
          <p class="course-chapter-meta">{len(ch['lessons'])} lessons · {mins} min</p>
          <ol class="course-lessons">
{rows}
          </ol>
        </section>
'''
    first = LESSONS[0]
    return (bc.head(prefix, "Captain's Course: Free Personal Finance Lessons", attr(desc), path, ld)
            + bc.header(prefix, course_active=True) + f'''
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">CAPTAIN'S COURSE</p>
        <h1>Learn the seas. Plot your course.</h1>
        <p class="page-hero-sub">The full money course from the app's Charts tab: {len(LESSONS)} short lessons in {len(CHAPTERS)} chapters, about {round(total_min / 60 * 2) / 2:g} hours in all. Free to read, no signup, nothing tracked.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="course/{slug(first)}.html" class="btn btn-primary">Start with lesson 1</a>
        </div>
      </div>
    </section>

    <section class="section course">
      <div class="container course-inner">
        <ul class="related-list course-jump" aria-label="Chapters">
{jump}
        </ul>
{chapters}        <p class="tool-note lesson-disclaimer">{esc(DATA['disclaimer'])}</p>
      </div>
    </section>

    <section class="cta section">
      <div class="container cta-inner">
        <h2>Take the course with you</h2>
        <p>In the app, the Captain's Course tracks what you've read and sits next to your real budget, debts, and accounts - and everything stays on your phone.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="index.html#download" class="btn btn-primary">Get BudgetArk</a>
          <a href="calculators.html" class="btn btn-ghost">Try the calculators</a>
        </div>
      </div>
    </section>
  </main>

''' + bc.footer(prefix) + '''
  <script src="js/main.js"></script>
</body>
</html>
''')

# --------------------------------------------------------------------------

if __name__ == '__main__':
    slugs = [slug(l) for l in LESSONS]
    assert len(set(slugs)) == len(slugs), 'duplicate lesson slugs'
    os.makedirs('course', exist_ok=True)
    keep = {s + '.html' for s in slugs}
    for name in os.listdir('course'):
        if name.endswith('.html') and name not in keep:
            os.remove(os.path.join('course', name))  # lesson renamed or removed in the app
    for i, l in enumerate(LESSONS):
        bc.write(f'course/{slug(l)}.html', lesson_page(i))
    bc.write('course.html', index_page())
    print('wrote', len(LESSONS), 'lesson pages + course.html')
