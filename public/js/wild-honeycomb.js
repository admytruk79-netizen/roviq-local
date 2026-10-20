// Generates the WILD-discovery honeycomb burst: a real flat-top hexagon
// grid (axial coordinates), brightest at mid-radius, a dark gap at the
// very center holding a small glowing spark — matching the approved WILD
// reference art. Built once lazily and reused; only className is toggled
// to replay the brief reveal/fade each time WILD triggers.
const SIZE = 300;
const CX = SIZE / 2, CY = SIZE / 2;
const CELL = 19;
const RINGS = 5;

function hexPoints(cx, cy, r) {
  // Flat-top hexagon: vertices at 0,60,120... degrees from horizontal.
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

function axialToPixel(q, r) {
  const x = CELL * 1.5 * q;
  const y = CELL * Math.sqrt(3) * (r + q / 2);
  return [CX + x, CY + y];
}

function buildCells() {
  const cells = [];
  for (let q = -RINGS; q <= RINGS; q++) {
    for (let r = -RINGS; r <= RINGS; r++) {
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist > RINGS) continue;
      cells.push({ q, r, dist });
    }
  }
  return cells;
}

function brightnessFor(dist) {
  // Dark gap only right at the center (dist 0, where the glow/star sits);
  // ring 1 stays lit so the core reads as a bright nucleus rather than a
  // hole, closer to the reference art, with peak brightness mid-radius
  // fading softly outward.
  if (dist === 0) return 0;
  const peak = RINGS * 0.6;
  const t = 1 - Math.min(1, Math.abs(dist - peak) / (RINGS - peak + 0.001));
  return Math.max(0.12, t);
}

let svgEl = null;
export function ensureHoneycomb() {
  if (svgEl) return svgEl;
  const wrap = document.createElement('div');
  wrap.id = 'rq-wild-honeycomb';
  wrap.className = 'rq-wild-honeycomb';
  wrap.setAttribute('aria-hidden', 'true');
  const cells = buildCells();
  const hexes = cells.map(({ q, r, dist }) => {
    const [x, y] = axialToPixel(q, r);
    const b = brightnessFor(dist);
    if (b <= 0) return '';
    const isGold = (q + r) % 7 === 0 && dist > 1 && dist < RINGS;
    const stroke = isGold ? 'var(--gold2)' : 'var(--teal)';
    return `<polygon points="${hexPoints(x, y, CELL * 0.56)}" fill="none" stroke="${stroke}" stroke-width="${0.8 + b * 0.9}" opacity="${(0.15 + b * 0.75).toFixed(2)}"/>`;
  }).join('');
  wrap.innerHTML = `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="100%" height="100%">
    <defs>
      <radialGradient id="rq-wh-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd98a" stop-opacity=".95"/>
        <stop offset="45%" stop-color="#e5b563" stop-opacity=".5"/>
        <stop offset="100%" stop-color="#e5b563" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g>${hexes}</g>
    <circle cx="${CX}" cy="${CY}" r="34" fill="url(#rq-wh-core)"/>
    <text x="${CX}" y="${CY + 7}" text-anchor="middle" font-size="20" fill="#fff6e0">&#10022;</text>
  </svg>`;
  document.body.appendChild(wrap);
  svgEl = wrap;
  return wrap;
}

export function playHoneycomb() {
  const el = ensureHoneycomb();
  el.classList.remove('reveal');
  void el.offsetWidth;
  el.classList.add('reveal');
}
