// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});

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
// and SynthwaveGrid components. Same mulberry32 PRNG and seeds as the app, so
// the starfield/firefly layouts match the real thing.
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
const DEFAULT_THEME = 'ark_parchment';
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
    card.classList.toggle('selected', card.dataset.theme === id);
  });
  renderAmbient(id);
}

themeCards.forEach((card) => {
  card.addEventListener('click', () => applyTheme(card.dataset.theme));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      applyTheme(card.dataset.theme);
    }
  });
});

// On load: mark the saved theme's card and draw its backdrop
themeCards.forEach((card) => {
  card.classList.toggle('selected', card.dataset.theme === currentTheme());
});
renderAmbient(currentTheme());

// Regenerate star/firefly fields when the window is resized
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderAmbient(currentTheme()), 200);
});
