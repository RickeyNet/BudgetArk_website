// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

// Close the mobile menu with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && links.classList.contains('open')) {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
});

toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});

// Tools dropdown: click or keyboard toggles, Escape and focus-out close.
// (Hover-open on pointer devices is handled in CSS.)
document.querySelectorAll('.nav-dropdown').forEach((dd) => {
  const btn = dd.querySelector('.nav-drop-btn');
  const setOpen = (open) => {
    dd.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => setOpen(!dd.classList.contains('open')));
  dd.addEventListener('focusout', (e) => {
    if (!dd.contains(e.relatedTarget)) setOpen(false);
  });
  dd.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setOpen(false); btn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target)) setOpen(false);
  });
});

// The calculators used to live on one page with #tool-* anchors; send old
// links to the tool's own page.
if (/calculators\.html$/.test(location.pathname) && location.hash) {
  const old = {
    'tool-invest': 'compound-interest', 'tool-loan': 'loan-mortgage', 'tool-refi': 'refinance-break-even',
    'tool-payoff': 'debt-payoff', 'tool-whatif': 'what-if-spending', 'tool-takehome': 'take-home-pay',
    'tool-efund': 'emergency-fund', 'tool-purchase': 'sinking-fund', 'tool-fx': 'currency-exchange',
  };
  const slug = old[location.hash.slice(1)];
  if (slug) location.replace('calculators/' + slug + '.html');
}

// Close menu when a link is tapped
links.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

// ---------------------------------------------------------------------------
// Ambient backdrops - ported from the app's SpaceBackground, ForestBackground,
// DeepSeaBackground, and SynthwaveGrid components. Same mulberry32 PRNG and
// seeds as the app, so the starfield/firefly/plankton layouts match the real
// thing.
// ---------------------------------------------------------------------------

const ambientHost = document.querySelector('.ambient');

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_TINTS = [
  'rgb(200, 210, 230)',
  'rgb(200, 210, 230)',
  'rgb(200, 210, 230)',
  'rgb(140, 180, 255)',
  'rgb(255, 200, 150)',
];

const FIREFLY_TINTS = [
  'rgb(164, 214, 161)',
  'rgb(120, 196, 178)',
  'rgb(212, 188, 112)',
];

// Bioluminescent plankton tints: cyan, blue, green (DeepSeaBackground)
const MOTE_TINTS = [
  'rgb(110, 232, 216)',
  'rgb(93, 184, 232)',
  'rgb(142, 232, 168)',
];

function starfieldSvg(w, h) {
  const rng = makeRng(0x5bace);
  const count = Math.min(160, Math.round((w * h) / 6500));
  let dots = '';
  for (let i = 0; i < count; i++) {
    const depth = rng();
    const x = (rng() * w).toFixed(1);
    const y = (rng() * h).toFixed(1);
    const r = (0.3 + depth * 1.3).toFixed(2);
    const o = (0.15 + depth * 0.55).toFixed(2);
    const tint = STAR_TINTS[Math.floor(rng() * STAR_TINTS.length)];
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint}" opacity="${o}"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots}</svg>`;
}

function forestSvg(w, h) {
  const rng = makeRng(0xf09e57);
  const count = Math.min(72, Math.round((w * h) / 18000));
  let dots = '';
  for (let i = 0; i < count; i++) {
    const depth = rng();
    const x = (rng() * w).toFixed(1);
    const y = (rng() * h).toFixed(1);
    const r = (0.8 + depth * 2.1).toFixed(2);
    const o = (0.08 + depth * 0.24).toFixed(2);
    const tint = FIREFLY_TINTS[Math.floor(rng() * FIREFLY_TINTS.length)];
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint}" opacity="${o}"/>`;
  }
  // Two soft horizontal mist bands, same placement as the app
  const mist =
    `<defs><linearGradient id="mist" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#9dc8b1" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="#9dc8b1" stop-opacity="0.07"/>` +
    `<stop offset="1" stop-color="#9dc8b1" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<rect x="${w * 0.04}" y="${h * 0.34}" width="${w * 0.92}" height="${h * 0.08}" rx="${h * 0.04}" fill="url(#mist)"/>` +
    `<rect x="${w * 0.08}" y="${h * 0.52}" width="${w * 0.84}" height="${h * 0.06}" rx="${h * 0.03}" fill="url(#mist)" opacity="0.72"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${mist}${dots}</svg>`;
}

function deepSeaSvg(w, h) {
  const rng = makeRng(0x0cea11);
  const count = Math.min(80, Math.round((w * h) / 16000));
  let dots = '';
  for (let i = 0; i < count; i++) {
    const depth = rng();
    const x = (rng() * w).toFixed(1);
    // Slight bias toward the upper two-thirds, where the light reaches
    const y = (Math.pow(rng(), 1.25) * h).toFixed(1);
    const r = (0.7 + depth * 2.2).toFixed(2);
    const o = (0.06 + depth * 0.26).toFixed(2);
    const tint = MOTE_TINTS[Math.floor(rng() * MOTE_TINTS.length)];
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint}" opacity="${o}"/>`;
  }
  // Light rays angling down from the surface, same placement as the app
  const shaft =
    `<defs><linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#7fd8d0" stop-opacity="0.13"/>` +
    `<stop offset="0.6" stop-color="#5db8b8" stop-opacity="0.045"/>` +
    `<stop offset="1" stop-color="#5db8b8" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<polygon points="${w * 0.16},0 ${w * 0.27},0 ${w * 0.14},${h * 0.62} ${w * 0.02},${h * 0.62}" fill="url(#shaft)"/>` +
    `<polygon points="${w * 0.44},0 ${w * 0.52},0 ${w * 0.4},${h * 0.5} ${w * 0.31},${h * 0.5}" fill="url(#shaft)" opacity="0.8"/>` +
    `<polygon points="${w * 0.72},0 ${w * 0.86},0 ${w * 0.76},${h * 0.56} ${w * 0.6},${h * 0.56}" fill="url(#shaft)" opacity="0.6"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${shaft}${dots}</svg>`;
}

function synthwaveGridSvg() {
  const W = 600;
  const H = 350;
  const vanishX = W / 2;
  const opacity = 0.2;
  const color = '#c44a90';
  let lines = '';
  // Vertical lines converging toward the vanishing point
  const vCount = 20;
  const spacing = W / vCount;
  for (let i = 0; i <= vCount; i++) {
    const bottomX = i * spacing;
    const topX = vanishX + (bottomX - vanishX) * 0.05;
    lines += `<line x1="${topX.toFixed(1)}" y1="0" x2="${bottomX}" y2="${H}" stroke="${color}" stroke-width="0.8" opacity="${(opacity * 0.7).toFixed(2)}"/>`;
  }
  // Horizontal lines with quadratic perspective spacing
  const rows = 14;
  for (let i = 1; i <= rows; i++) {
    const t = i / rows;
    const y = (t * t * H).toFixed(1);
    const rowOpacity = (opacity * (0.2 + 0.8 * t)).toFixed(2);
    lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="0.8" opacity="${rowOpacity}"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">${lines}</svg>`;
}

// The app mounts SynthwaveGrid AFTER the navigator, so the grid sits above
// the screens. Mirror that with a separate fixed overlay above page content.
const gridOverlay = document.createElement('div');
gridOverlay.className = 'grid-overlay';
gridOverlay.setAttribute('aria-hidden', 'true');
document.body.appendChild(gridOverlay);

function renderAmbient(themeId) {
  if (!ambientHost) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (themeId === 'deep_space') {
    ambientHost.innerHTML = starfieldSvg(w, h);
  } else if (themeId === 'deepforest') {
    ambientHost.innerHTML = forestSvg(w, h);
  } else if (themeId === 'deep_sea') {
    ambientHost.innerHTML = deepSeaSvg(w, h);
  } else {
    ambientHost.innerHTML = '';
  }
  gridOverlay.innerHTML = themeId === 'synthwave' ? synthwaveGridSvg() : '';
}

// ---------------------------------------------------------------------------
// Theme switcher - clicking a theme card re-skins the whole site.
// The <head> inline script already applied the saved theme before paint.
// ---------------------------------------------------------------------------

const THEME_KEY = 'budgetark-site-theme';
const DEFAULT_THEME = 'forest_gold';
const themeCards = document.querySelectorAll('.theme-card[data-theme]');

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch (e) {}
  themeCards.forEach((card) => {
    card.setAttribute('aria-pressed', String(card.dataset.theme === id));
  });
  renderAmbient(id);
}

// Theme cards are real <button>s, so Enter/Space already fire click.
themeCards.forEach((card) => {
  card.addEventListener('click', () => applyTheme(card.dataset.theme));
});

// On load: mark the saved theme's card and draw its backdrop
themeCards.forEach((card) => {
  card.setAttribute('aria-pressed', String(card.dataset.theme === currentTheme()));
});
renderAmbient(currentTheme());

// Regenerate star/firefly/plankton fields when the window is resized
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderAmbient(currentTheme()), 200);
});
