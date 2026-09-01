"""Generate the calculator pages.

Writes calculators.html (the index) and calculators/<slug>.html (one page per
tool). Each tool's interactive markup lives in scripts/calculators/<key>.html;
the copy, worked example, and FAQs live in TOOLS below. Run from the repo root:

    python scripts/build-calculators.py

The output is plain static HTML that gets committed - there is no build step
at deploy time. Re-run after editing this file or a partial.
"""
import json, os, re, sys

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

SITE = 'https://budgetark.app'
CSP_HASH = "sha256-Sy7OSgkv+iC55Dcv4tJ4uLYyKO8HA7nQAcxLUzNqGso="
THEME_SCRIPT = """  <script>
    // Apply the saved theme before first paint to avoid a flash of the default.
    // First-time visitors get Forest Gold (dark) or The Ark (light) to match
    // their system color scheme.
    try {
      var saved = localStorage.getItem("budgetark-site-theme");
      var light = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      document.documentElement.setAttribute("data-theme", saved || (light ? "ark_parchment" : "forest_gold"));
    } catch (e) {}
  </script>
"""

# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------

TOOLS = [
    {
        'key': 'invest', 'slug': 'investment-growth', 'icon': '📈',
        'title': 'Investment Growth Calculator',
        'h1': 'Investment growth calculator',
        'short': 'See what monthly contributions become with compound growth.',
        'meta': 'Free investment growth calculator: enter a monthly contribution, an annual return, and a number of years to see your balance, what you put in, and what compounding added. Runs in your browser.',
        'intro': [
            'Put in a monthly amount, an expected annual return, and how long you will keep it up. The calculator shows the ending balance, how much of it you contributed, and how much compounding added - year by year in the chart.',
        ],
        'how': [
            'Contributions are added at the end of every month and the balance compounds monthly, so the monthly rate is the annual return divided by 12.',
            'The balance after <em>n</em> months is <code>P × ((1 + r)<sup>n</sup> − 1) / r</code>, where <em>P</em> is the monthly contribution and <em>r</em> the monthly rate. At 0% it is simply the contributions added up.',
            'Growth is the ending balance minus everything you put in. The Rule of 72 line divides 72 by the annual return to estimate how many years it takes money to double.',
        ],
        'example': 'Contributing $500 a month at 7% for 20 years puts in $120,000 and ends at about $260,463, so compounding added roughly $140,000 - more than half the final balance.',
        'faqs': [
            ('What return should I use?', 'The US stock market has averaged around 10% a year before inflation over long periods and roughly 7% after it, which is why 7% is the default. A savings account or bonds will be far lower. Pick the number that matches where the money will actually sit, and try a lower one to see how sensitive the result is.'),
            ('Can I include a starting balance?', 'Not in this version - it models regular contributions only, the same as the Charts tab in the app. To approximate a lump sum, run it once for the contributions and add your starting amount multiplied by (1 + return)<sup>years</sup>.'),
            ('Is the result adjusted for inflation?', 'Only if you enter a real return. Using 7% instead of 10% is the usual way to get an answer in today\'s dollars.'),
        ],
        'related': ['what-if-spending', 'emergency-fund', 'sinking-fund'],
    },
    {
        'key': 'loan', 'slug': 'loan-mortgage', 'icon': '🏠',
        'title': 'Loan & Mortgage Calculator with Amortization',
        'h1': 'Loan &amp; mortgage calculator',
        'short': 'Monthly payment, total interest, and a year-by-year amortization table.',
        'meta': 'Free mortgage and loan calculator: monthly payment, total interest, and a full year-by-year amortization schedule for any amount, rate, and term. No sign-up, runs in your browser.',
        'intro': [
            'Enter the amount, interest rate, and term to get the monthly payment, the total you will pay over the life of the loan, and an amortization summary showing how each year splits between principal and interest.',
        ],
        'how': [
            'The payment is the standard amortization formula <code>B × r / (1 − (1 + r)<sup>−n</sup>)</code>: balance <em>B</em>, monthly rate <em>r</em> (APR ÷ 12), and <em>n</em> months.',
            'Each month\'s interest is the remaining balance times the monthly rate; whatever is left of the payment reduces principal. The yearly table adds those months up.',
            'The "first 5 years" tile shows how front-loaded interest is - on a 30-year mortgage, most of the early payments go to interest, not to owning more of the house.',
        ],
        'example': 'A $300,000 loan at 6.5% over 30 years costs $1,896.20 a month. Over the full term that is $682,633, of which $382,633 is interest, and about a quarter of all that interest is paid in the first five years alone.',
        'faqs': [
            ('Why is so much of my early payment interest?', 'Interest is charged on the balance you still owe, and at the start you owe all of it. As principal falls, the interest share of the same payment falls with it, which is why the last years of a mortgage build equity so much faster than the first.'),
            ('Does this include taxes, insurance, or PMI?', 'No - it is principal and interest only. Property tax, homeowner\'s insurance, and mortgage insurance are added on top by your lender and vary too much to estimate here.'),
            ('How do extra payments change it?', 'This page models the scheduled payment only. To test extra payments, add the loan to the <a href="debt-payoff.html">debt payoff planner</a> with its APR and minimum payment and enter the extra amount there.'),
        ],
        'related': ['refinance-break-even', 'debt-payoff', 'take-home-pay'],
    },
    {
        'key': 'refi', 'slug': 'refinance-break-even', 'icon': '🔁',
        'title': 'Refinance Break-Even Calculator',
        'h1': 'Refinance break-even calculator',
        'short': 'Find out how long a refinance takes to pay for its closing costs.',
        'meta': 'Free refinance break-even calculator: compare your current mortgage with a new rate and term, see the monthly savings, total interest difference, and how many months until closing costs are recovered.',
        'intro': [
            'A lower rate is not automatically a win - closing costs have to be earned back first, and a longer term can add interest even while the payment falls. This calculator lays both loans side by side.',
        ],
        'how': [
            'Both payments use the amortization formula on the same remaining balance: the current loan over the years you have left, the new loan over its full term.',
            'Break-even months = closing costs ÷ monthly savings. If the new payment is not lower, there is no break-even.',
            'Total interest is simulated month by month for each loan, and "net over the new term" is the monthly savings times the new term, minus closing costs. A warning appears when the new term is longer than what remains on the current loan.',
        ],
        'example': 'On a $280,000 balance, moving from 7.25% with 28 years left to 5.5% over 30 years with $4,000 in closing costs drops the payment from $1,949.24 to $1,589.81. That $359 a month recovers the closing costs in about a year, and total interest falls by roughly $82,600 even though the term is two years longer.',
        'faqs': [
            ('What counts as closing costs?', 'Origination and application fees, appraisal, title search and insurance, recording fees, and any points you pay to buy down the rate. Your loan estimate lists them; the total is usually 2-5% of the balance.'),
            ('Should I refinance if I might move soon?', 'Only if you will stay past the break-even point. If the calculator says 30 months and you expect to sell in two years, the refinance costs you money.'),
            ('Why the warning about a longer term?', 'Resetting a loan with 20 years left to a fresh 30 years spreads the balance over more payments. The monthly figure drops, but you pay interest for a decade longer, which can erase the savings from the lower rate. Compare the total interest tiles, not just the payment.'),
        ],
        'related': ['loan-mortgage', 'debt-payoff', 'what-if-spending'],
    },
    {
        'key': 'payoff', 'slug': 'debt-payoff', 'icon': '⚓',
        'title': 'Debt Payoff Calculator: Snowball vs. Avalanche',
        'h1': 'Debt payoff planner',
        'short': 'List your debts, pick Snowball or Avalanche, and see your debt-free date.',
        'meta': 'Free debt payoff calculator: enter your balances, rates, and minimums, choose the snowball or avalanche method, add an extra monthly payment, and see your debt-free date and total interest for each strategy.',
        'intro': [
            'List each debt with its balance, APR, and minimum payment. The planner pays every minimum each month, sends anything extra to one target debt at a time, and tells you when the last balance hits zero - and how much interest each method costs.',
        ],
        'how': [
            'Each month: interest is added to every balance, minimums are paid, then the extra amount goes to the target debt. When a debt is cleared, its minimum rolls into the extra for the next one.',
            '<strong>Avalanche</strong> targets the highest APR first (ties go to the smaller balance). <strong>Snowball</strong> targets the smallest balance first, and keeps car and house loans for last so the quick wins come from cards and personal loans - the same rule the app uses.',
            'If minimum payments do not cover the monthly interest, the balance never shrinks and the planner says so instead of showing a misleading date.',
        ],
        'example': 'With a $4,200 card at 24.99%, an $11,500 car loan at 6.9%, and an $18,000 student loan at 5.5%, paying minimums plus $200 extra with Avalanche clears everything in about 6 years and 1 month with $5,840 in interest. The extra $200 alone saves 4 years and 4 months and roughly $4,850 of interest.',
        'faqs': [
            ('Which method is better, snowball or avalanche?', 'Avalanche usually costs less interest because it attacks the most expensive debt first. Snowball gives faster early wins, which many people find easier to stick with. The planner shows both, and the gap is often smaller than expected - sometimes snowball even wins when a high-rate loan already has a large minimum that retires it quickly.'),
            ('What does "not solvable" mean?', 'At least one debt\'s minimum payment is smaller than the interest it accrues each month, so the total balance grows instead of falling. Raise that minimum or add an extra payment.'),
            ('Why are car and house loans last in snowball?', 'They are secured, usually low-rate, and have fixed payoff schedules. The app\'s snowball orders unsecured debts first so the momentum from cleared balances is not spent on a mortgage.'),
        ],
        'related': ['what-if-spending', 'refinance-break-even', 'loan-mortgage'],
        'extra_partials': ['whatif'],
    },
    {
        'key': 'whatif', 'slug': 'what-if-spending', 'icon': '🧭',
        'title': 'What If I Stopped Spending On... Calculator',
        'h1': 'What if I stopped spending on…',
        'short': 'Turn a monthly habit into its 1, 5, and 10-year value, invested or aimed at debt.',
        'meta': 'What would happen if you stopped a monthly expense? Free calculator shows what that money becomes in 1, 5, and 10 years if invested, or how much sooner you would be debt-free if you aimed it at your debts.',
        'intro': [
            'Pick a monthly expense you could drop - a subscription, takeout, the second streaming service - and see what that money turns into. Invest it and watch it compound; or add your debts below and see how many months it shaves off your payoff.',
        ],
        'how': [
            'The invested rows use the same monthly-compounding formula as the <a href="investment-growth.html">investment growth calculator</a> at 1, 5, and 10 years, split into what you put in and what growth added.',
            'The debt rows run the <a href="debt-payoff.html">payoff planner</a> twice - once as-is and once with the amount added as an extra monthly payment - and report the difference in months and interest.',
        ],
        'example': '$150 a month at 7% is $1,859 after one year, $10,739 after five, and $25,963 after ten - with nearly $8,000 of that coming from growth rather than your contributions.',
        'faqs': [
            ('Why compare investing and debt?', 'They are the two things freed-up cash can do. If your debt\'s APR is higher than the return you expect from investing, paying it down is the better guaranteed return; if it is lower, investing usually wins. The two results let you see both numbers before deciding.'),
            ('Does the app do this with my real spending?', 'Yes - in the app the tool lists your actual budget categories with their six-month averages, so you pick a category instead of typing an amount.'),
            ('Is 7% a safe assumption?', 'It is a long-run, after-inflation stock market average, not a promise. Use a lower number for savings accounts or a shorter horizon.'),
        ],
        'related': ['investment-growth', 'debt-payoff', 'sinking-fund'],
        'extra_partials': ['payoff'],
        'extra_note': 'Add your debts here to see the payoff impact above.',
    },
    {
        'key': 'takehome', 'slug': 'take-home-pay', 'icon': '🧾',
        'title': 'US Take-Home Pay Calculator 2026 (Federal, State &amp; FICA)',
        'h1': 'US take-home pay calculator',
        'short': 'Federal, state, and FICA taxes for 2026 - what actually lands in your account.',
        'meta': 'Free 2026 take-home pay calculator for all 50 states and DC: federal brackets, Social Security and Medicare, state income tax, and pre-tax 401(k), HSA, and health premiums. Per-paycheck and annual results, nothing sent to a server.',
        'intro': [
            'Enter your salary, filing status, state, and pre-tax deductions to estimate your paycheck after federal income tax, FICA, and state income tax. The tables are the 2026 IRS and state figures the app ships with, and the math runs entirely on this page.',
        ],
        'how': [
            'A traditional 401(k) contribution lowers the income that federal and state tax apply to, but not Social Security and Medicare wages. HSA contributions and health premiums through payroll (a Section 125 plan) lower both.',
            'Federal tax applies the standard deduction, then the marginal brackets for your filing status. Social Security is 6.2% up to the 2026 wage base of $184,500; Medicare is 1.45%, plus 0.9% above $200,000 ($250,000 married filing jointly).',
            'State tax uses each state\'s flat rate or brackets and its standard deduction. Married-joint doubles the single-filer thresholds; married-separate and head-of-household use the single table. Local and city taxes, credits, and itemized deductions are not modeled, and the note under the result says so for the states where that matters most.',
        ],
        'example': 'A single filer earning $75,000 with 6% into a 401(k) and no state income tax takes home about $58,083 a year, or $2,234 every two weeks - an effective rate of 16.6% while the top federal bracket touched is 22%.',
        'faqs': [
            ('Why doesn\'t this match my paycheck exactly?', 'Employers withhold based on your W-4, which can over- or under-collect relative to your real annual tax; this page estimates the real annual amount. It also leaves out local taxes, tax credits, itemized deductions, state disability or family-leave contributions, and other payroll deductions like dental or life insurance.'),
            ('Which states have no income tax on wages?', 'Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming. Choose one of them, or leave the state blank, to see federal and FICA only.'),
            ('Where does the tax data come from and how current is it?', 'Federal brackets and standard deductions are from IRS Rev. Proc. 2025-32 for tax year 2026, the Social Security wage base from the SSA, and state tables from the Tax Foundation\'s 2026 survey. The app refreshes them each tax year and this page is generated from the same file.'),
        ],
        'related': ['investment-growth', 'emergency-fund', 'debt-payoff'],
        'scripts': ['tax-data-2026.js'],
    },
    {
        'key': 'efund', 'slug': 'emergency-fund', 'icon': '⛵',
        'title': 'Emergency Fund Calculator',
        'h1': 'Emergency fund calculator',
        'short': 'How far you are from three and six months of expenses, and when you get there.',
        'meta': 'Free emergency fund calculator: enter monthly expenses, what you have saved, and what you add each month to see your 3-month and 6-month targets, progress, and how long until each is funded.',
        'intro': [
            'An emergency fund is the cash that keeps a surprise bill from becoming new debt. Enter your monthly expenses, what you have set aside, and what you can add each month to see the gap to a three-month cushion and a full six-month fund.',
        ],
        'how': [
            'The starter target is three months of expenses; the full fund is six. Progress is what you have saved divided by each target.',
            'Time to reach a target is the remaining amount divided by your monthly savings, rounded up to whole months. Interest on the fund is ignored, which keeps the estimate conservative.',
        ],
        'example': 'With $3,200 in monthly expenses, $2,500 saved, and $500 added a month, the three-month cushion of $9,600 is about 15 months away and the six-month fund of $19,200 is just under three years out.',
        'faqs': [
            ('How many months do I really need?', 'Three months covers most single-income households with stable jobs; six is the common recommendation for variable income, a single earner supporting others, or a specialized field where a job search takes longer. The app\'s Build Your Ark path treats a small starter cushion as step one and the full fund as a later milestone.'),
            ('Where should the money live?', 'Somewhere boring and liquid: a high-yield savings or money-market account you can reach in a day or two, separate from the checking account you spend from. Not invested - a market drop and a job loss tend to arrive together.'),
            ('Should I build this before paying off debt?', 'Build a small starter cushion first - often around one month of expenses - so the next surprise does not go on a card. Then attack high-interest debt, and finish the full fund after. The <a href="debt-payoff.html">payoff planner</a> can show what the debt side looks like.'),
        ],
        'related': ['sinking-fund', 'debt-payoff', 'investment-growth'],
    },
    {
        'key': 'purchase', 'slug': 'sinking-fund', 'icon': '🛶',
        'title': 'Sinking Fund Calculator: Plan a Purchase',
        'h1': 'Plan a purchase',
        'short': 'Save up for something on purpose - by monthly amount or by target date.',
        'meta': 'Free sinking fund calculator: enter the price and what you have saved, then either the amount you can set aside monthly (to get a ready date) or the month you need it by (to get the required monthly amount).',
        'intro': [
            'A sinking fund is money set aside every month for a specific purchase so it is paid in cash when the time comes. Enter the price and what you have already, then either what you can save monthly or when you need it.',
        ],
        'how': [
            'Remaining = price minus what is already saved. With a monthly amount, months to ready = remaining ÷ monthly, rounded up, and the ready date is that many months from now.',
            'With a target month, the required monthly amount is remaining ÷ months until that month, rounded up to the next dollar. The app adds a third view - whether that amount fits inside your actual free cash flow - which needs your budget history.',
        ],
        'example': 'A $2,400 purchase with $400 saved and $200 set aside monthly is ready in 10 months. Flip it around: if you need it in six months, you would have to set aside $334 a month instead.',
        'faqs': [
            ('What is a sinking fund?', 'A savings bucket with a name and a purpose - new tires, a trip, next year\'s insurance premium - funded a little each month so the expense never lands on a credit card. The term comes from the way companies set money aside to retire a bond.'),
            ('How is this different from an emergency fund?', 'An emergency fund is for the unknown; a sinking fund is for the known. Tires wearing out is predictable, so it belongs in a sinking fund, which keeps the emergency fund untouched for actual surprises.'),
            ('What if I cannot afford the monthly amount?', 'Push the date out, lower the price, or start with a smaller partial goal. The point is to pay cash when you buy, so a later date beats financing it.'),
        ],
        'related': ['emergency-fund', 'what-if-spending', 'investment-growth'],
    },
    {
        'key': 'fx', 'slug': 'currency-exchange', 'icon': '💱',
        'title': 'Currency Exchange Calculator',
        'h1': 'Currency exchange calculator',
        'short': 'Convert between USD, EUR, GBP, CAD, JPY, and SEK with the day\'s rates.',
        'meta': 'Free currency converter for US dollars, euros, pounds, Canadian dollars, yen, and Swedish krona using the day\'s public exchange-rate table. Rates are fetched only when you ask.',
        'intro': [
            'Convert an amount between the six currencies BudgetArk supports. Rates are pulled from the same public table the app uses, and only when you press the button - the page makes no request until then.',
        ],
        'how': [
            'The rate table is published against the US dollar, so a cross rate is the target currency\'s rate divided by the source currency\'s rate. Converting in the other direction uses the inverse.',
            'Amounts are formatted in each currency\'s own convention - yen without decimals, euros with the comma separator - using your browser\'s locale data.',
        ],
        'example': 'Pick USD to EUR, enter 100, and press "Get today\'s rates" to see the converted amount, the rate both ways, and when the table was fetched.',
        'faqs': [
            ('Where do the rates come from?', 'From open.er-api.com, a free service that publishes a daily table of rates against the US dollar. The request carries no account, amount, or identity - everyone receives the same table - and it is the only network request anything on this site makes.'),
            ('Are these live market rates?', 'They are mid-market reference rates updated about once a day, fine for planning and budgeting. A bank or card will apply its own spread on top, so expect a slightly worse rate when you actually exchange money.'),
            ('Why only six currencies?', 'They are the display currencies the app supports: US dollar, euro, British pound, Canadian dollar, Japanese yen, and Swedish krona. More arrive as the app adds them.'),
        ],
        'related': ['take-home-pay', 'sinking-fund', 'investment-growth'],
    },
]
BY_SLUG = {t['slug']: t for t in TOOLS}

# --------------------------------------------------------------------------
# Shared chrome
# --------------------------------------------------------------------------

def nav_dropdown(prefix, active_slug=None):
    def label(t):
        return re.sub(r' calculator$', '', t['h1']).replace('…', '...')
    items = ''.join(
        f'\n            <li><a href="{prefix}calculators/{t["slug"]}.html"{" aria-current=\"page\"" if t["slug"] == active_slug else ""}>{t["icon"]} {label(t)}</a></li>'
        for t in TOOLS)
    return f'''        <li class="nav-dropdown">
          <button type="button" class="nav-drop-btn{" active" if active_slug or active_slug == "index" else ""}" aria-expanded="false" aria-controls="tools-menu">Tools <span class="caret" aria-hidden="true"></span></button>
          <ul class="dropdown-menu" id="tools-menu">
            <li><a href="{prefix}calculators.html">All calculators</a></li>{items}
          </ul>
        </li>'''

def header(prefix, active_slug=None):
    home = prefix or 'index.html'
    return f'''  <a class="skip-link" href="#main">Skip to content</a>
  <div class="ambient" aria-hidden="true"></div>

  <header class="site-header">
    <nav class="nav container">
      <a href="{home}" class="logo">
        <img src="{prefix}assets/favicon-32.png" alt="" class="logo-img" width="30" height="30">
        Budget<span class="logo-accent">Ark</span>
      </a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="primary-nav">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" id="primary-nav">
        <li><a href="{home}">Home</a></li>
        <li><a href="{home}#features">Features</a></li>
{nav_dropdown(prefix, active_slug)}
        <li><a href="{home}#themes">Themes</a></li>
        <li><a href="{home}#faq">FAQ</a></li>
        <li><a href="{prefix}news.html">News</a></li>
        <li><a href="{home}#download" class="btn btn-small">Get the App</a></li>
      </ul>
    </nav>
  </header>
'''

def footer(prefix):
    home = prefix or 'index.html'
    return f'''  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <span class="logo"><img src="{prefix}assets/favicon-32.png" alt="" class="logo-img" width="30" height="30"> Budget<span class="logo-accent">Ark</span></span>
        <p>Offline-first budgeting. Built for the storm.</p>
      </div>
      <ul class="footer-links">
        <li><a href="{home}">Home</a></li>
        <li><a href="{home}#features">Features</a></li>
        <li><a href="{prefix}calculators.html">Tools</a></li>
        <li><a href="{prefix}news.html">News</a></li>
        <li><a href="{home}#faq">FAQ</a></li>
        <li><a href="{prefix}privacy.html">Privacy Policy</a></li>
        <li><a href="https://github.com/RickeyNet/BudgetArk" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="https://x.com/budgetark" target="_blank" rel="noopener">X</a></li>
        <li><a href="mailto:budgetark.support@gmail.com">Support</a></li>
      </ul>
      <p class="footer-copy">© 2026 BudgetArk. All rights reserved.</p>
    </div>
  </footer>
'''

def head(prefix, title, meta, path, ld):
    url = f'{SITE}/{path}'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' '{CSP_HASH}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src https://open.er-api.com; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests">
  <meta name="description" content="{meta}">
  <title>{title} - BudgetArk</title>
  <link rel="icon" type="image/png" sizes="32x32" href="{prefix}assets/favicon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="{prefix}assets/icon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="{prefix}assets/apple-touch-icon.png">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7eedd">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111410">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BudgetArk">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{title} - BudgetArk">
  <meta property="og:description" content="{meta}">
  <meta property="og:image" content="{SITE}/assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="BudgetArk - free, private, offline-first budgeting and debt payoff">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@budgetark">
  <meta name="twitter:title" content="{title} - BudgetArk">
  <meta name="twitter:description" content="{meta}">
  <meta name="twitter:image" content="{SITE}/assets/og-image.jpg">
  <script type="application/ld+json">
{ld}
  </script>
  <link rel="preload" href="{prefix}assets/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="{prefix}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="{prefix}css/style.css">
{THEME_SCRIPT}</head>
<body>

'''

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s).replace('&amp;', '&')

def ld_json(obj):
    text = json.dumps(obj, indent=2, ensure_ascii=False)
    return '\n'.join('  ' + line for line in text.splitlines())

def partial(key):
    return open(f'scripts/calculators/{key}.html', encoding='utf-8').read().rstrip('\n')

def indent(text, n):
    pad = ' ' * n
    return '\n'.join(pad + line if line else line for line in text.split('\n'))

# --------------------------------------------------------------------------
# Tool pages
# --------------------------------------------------------------------------

def tool_page(t):
    prefix = '../'
    path = f'calculators/{t["slug"]}.html'
    title_plain = strip_tags(t['title'])
    ld = ld_json({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebApplication',
                '@id': f'{SITE}/{path}#app',
                'name': title_plain,
                'url': f'{SITE}/{path}',
                'applicationCategory': 'FinanceApplication',
                'operatingSystem': 'Any',
                'browserRequirements': 'Requires JavaScript',
                'isAccessibleForFree': True,
                'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
                'publisher': {'@id': f'{SITE}/#org'},
                'description': t['meta'],
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'Calculators', 'item': f'{SITE}/calculators.html'},
                    {'@type': 'ListItem', 'position': 3, 'name': strip_tags(t['h1']), 'item': f'{SITE}/{path}'},
                ],
            },
            {
                '@type': 'FAQPage',
                'mainEntity': [
                    {'@type': 'Question', 'name': strip_tags(q), 'acceptedAnswer': {'@type': 'Answer', 'text': strip_tags(a)}}
                    for q, a in t['faqs']
                ],
            },
        ],
    })
    faqs = '\n'.join(f'''          <details>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>''' for q, a in t['faqs'])
    how = '\n'.join(f'          <li>{p}</li>' for p in t['how'])
    intro = '\n'.join(f'        <p class="page-hero-sub">{p}</p>' for p in t['intro'])
    related = '\n'.join(
        f'          <li><a href="{BY_SLUG[s]["slug"]}.html"><span aria-hidden="true">{BY_SLUG[s]["icon"]}</span> {BY_SLUG[s]["h1"]}</a></li>'
        for s in t['related'])
    extras = ''
    for key in t.get('extra_partials', []):
        note = f'\n        <p class="section-sub tool-extra-note">{t["extra_note"]}</p>' if t.get('extra_note') else ''
        extras += note + '\n' + indent(partial(key), 8) + '\n'
    scripts = ''.join(f'  <script src="{prefix}js/{s}"></script>\n' for s in t.get('scripts', []))
    return (head(prefix, t['title'], t['meta'], path, ld) + header(prefix, t['slug']) + f'''
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="{prefix}index.html">Home</a> › <a href="{prefix}calculators.html">Calculators</a> › <span aria-current="page">{t['h1']}</span></nav>
        <p class="eyebrow">SHIP'S INSTRUMENTS</p>
        <h1>{t['h1']}</h1>
{intro}
      </div>
    </section>

    <section class="section tools">
      <div class="container tools-list">
{indent(partial(t['key']), 8)}
{extras}      </div>
    </section>

    <section class="section tool-copy">
      <div class="container tool-copy-inner">
        <h2>How it's calculated</h2>
        <ol class="how-list">
{how}
        </ol>
        <h2>Worked example</h2>
        <p>{t['example']}</p>
        <h2>Frequently asked</h2>
        <div class="faq-list faq-list-left">
{faqs}
        </div>
        <h2>Related calculators</h2>
        <ul class="related-list">
{related}
        </ul>
        <p class="tool-note">Every calculator here runs in your browser and matches the math in the BudgetArk app's Charts tab. Nothing you enter is stored or sent anywhere.</p>
      </div>
    </section>

    <section class="cta section">
      <div class="container cta-inner">
        <h2>Want it with your real numbers?</h2>
        <p>In the app, this tool pulls from your actual debts, budget, and accounts - and everything stays on your phone.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="{prefix}index.html#download" class="btn btn-primary">Get BudgetArk</a>
          <a href="{prefix}calculators.html" class="btn btn-ghost">All calculators</a>
        </div>
      </div>
    </section>
  </main>

''' + footer(prefix) + f'''
  <script src="{prefix}js/main.js"></script>
{scripts}  <script src="{prefix}js/calculators.js"></script>
</body>
</html>
''')

# --------------------------------------------------------------------------
# Index page
# --------------------------------------------------------------------------

def index_page():
    prefix = ''
    path = 'calculators.html'
    ld = ld_json({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                '@id': f'{SITE}/{path}',
                'name': 'BudgetArk Financial Calculators',
                'url': f'{SITE}/{path}',
                'description': 'Free financial calculators that run in your browser: investment growth, loan and mortgage amortization, refinance break-even, debt payoff, US take-home pay, emergency fund, sinking fund, and currency exchange.',
                'publisher': {'@id': f'{SITE}/#org'},
            },
            {
                '@type': 'ItemList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': i + 1, 'name': strip_tags(t['h1']), 'url': f'{SITE}/calculators/{t["slug"]}.html'}
                    for i, t in enumerate(TOOLS)
                ],
            },
        ],
    })
    cards = '\n'.join(f'''          <li class="feature-card tool-card">
            <a href="calculators/{t['slug']}.html">
              <div class="feature-icon" aria-hidden="true">{t['icon']}</div>
              <h2>{t['h1']}</h2>
              <p>{t['short']}</p>
            </a>
          </li>''' for t in TOOLS)
    meta = 'Free financial calculators from BudgetArk: investment growth, loan and mortgage amortization, refinance break-even, debt payoff (snowball vs. avalanche), US take-home pay, emergency fund, sinking fund, and currency exchange. Runs in your browser, nothing is sent anywhere.'
    return (head(prefix, 'Free Financial Calculators', meta, path, ld) + header(prefix, 'index') + '''
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">SHIP'S INSTRUMENTS</p>
        <h1>Financial calculators</h1>
        <p class="page-hero-sub">The same math that runs the app's Charts tab, right here in your browser. Nothing you type is stored or sent anywhere.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <ul class="feature-grid tool-cards">
''' + cards + '''
        </ul>
      </div>
    </section>

    <section class="cta section">
      <div class="container cta-inner">
        <h2>Want these with your real numbers?</h2>
        <p>In the app, the same tools pull from your actual debts, budget, and accounts - and everything stays on your phone.</p>
        <div class="hero-actions" style="justify-content: center;">
          <a href="index.html#download" class="btn btn-primary">Get BudgetArk</a>
          <a href="index.html#features" class="btn btn-ghost">See all features</a>
        </div>
      </div>
    </section>
  </main>

''' + footer(prefix) + '''
  <script src="js/main.js"></script>
</body>
</html>
''')

# --------------------------------------------------------------------------

def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

if __name__ == '__main__':
    os.makedirs('calculators', exist_ok=True)
    for t in TOOLS:
        write(f'calculators/{t["slug"]}.html', tool_page(t))
    write('calculators.html', index_page())
    print('wrote', len(TOOLS), 'tool pages + calculators.html')
    # Emit the nav dropdown markup for the other pages (used by the patch script)
    if '--nav' in sys.argv:
        prefix = sys.argv[sys.argv.index('--nav') + 1]
        print(nav_dropdown(prefix if prefix != 'root' else ''))
