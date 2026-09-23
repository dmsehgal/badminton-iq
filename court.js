/* ============================================================
   Badminton IQ — court renderer
   Top-down court. You are always at the bottom, looking at the net.
   ============================================================ */

const WORLD_W = COURT.W + COURT.MARGIN * 2;
const WORLD_L = COURT.L + COURT.MARGIN * 2;
const COURT_RATIO = WORLD_L / WORLD_W;

const C = {
  out:      '#0f1720',
  surface:  '#12442f',
  surfaceO: '#0f3a29',
  line:     'rgba(255,255,255,0.72)',
  lineSoft: 'rgba(255,255,255,0.34)',
  net:      'rgba(255,255,255,0.85)',
  you:      '#4cc9f0',
  partner:  '#7ee8c3',
  opp:      '#ff8f6b',
  zone:     'rgba(255,255,255,0.16)',
  zoneEdge: 'rgba(255,255,255,0.34)',
  zoneHot:  'rgba(76,201,240,0.30)',
  shuttle:  '#ffffff',
  good:     '#5fd68a',
  ok:       '#6fb7ff',
  risky:    '#ffc457',
  bad:      '#ff6b6b',
};
const SCORE_COLOR = [C.bad, C.risky, C.ok, C.good];

/* ---------- view transform ---------- */
function makeView(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.min(cssW / WORLD_W, cssH / WORLD_L);
  const ox = (cssW - WORLD_W * scale) / 2 + COURT.MARGIN * scale;
  const oy = (cssH - WORLD_L * scale) / 2 + COURT.MARGIN * scale;
  return {
    ctx, scale, cssW, cssH,
    sx: (x) => ox + x * scale,
    sy: (y) => oy + y * scale,
    wx: (px) => (px - ox) / scale,
    wy: (py) => (py - oy) / scale,
    m: (metres) => metres * scale,
  };
}

/* ---------- court ---------- */
function drawCourt(v) {
  const { ctx } = v;
  ctx.clearRect(0, 0, v.cssW, v.cssH);
  ctx.fillStyle = C.out;
  ctx.fillRect(0, 0, v.cssW, v.cssH);

  // playing surface, opponents' half a touch darker so the halves read apart
  ctx.fillStyle = C.surfaceO;
  rect(v, -COURT.MARGIN, -COURT.MARGIN, COURT.W + COURT.MARGIN * 2, COURT.NET + COURT.MARGIN, true);
  ctx.fillStyle = C.surface;
  rect(v, -COURT.MARGIN, COURT.NET, COURT.W + COURT.MARGIN * 2, COURT.L - COURT.NET + COURT.MARGIN, true);

  ctx.lineWidth = Math.max(1, v.m(0.04));
  ctx.strokeStyle = C.line;

  // outer boundary
  strokeRect(v, 0, 0, COURT.W, COURT.L);
  // singles sidelines
  ctx.strokeStyle = C.lineSoft;
  line(v, COURT.SINGLES_IN, 0, COURT.SINGLES_IN, COURT.L);
  line(v, COURT.W - COURT.SINGLES_IN, 0, COURT.W - COURT.SINGLES_IN, COURT.L);
  // doubles long service lines
  line(v, 0, COURT.LONG_SVC, COURT.W, COURT.LONG_SVC);
  line(v, 0, COURT.L - COURT.LONG_SVC, COURT.W, COURT.L - COURT.LONG_SVC);
  ctx.strokeStyle = C.line;
  // short service lines
  line(v, 0, COURT.NET - COURT.SHORT_SVC, COURT.W, COURT.NET - COURT.SHORT_SVC);
  line(v, 0, COURT.NET + COURT.SHORT_SVC, COURT.W, COURT.NET + COURT.SHORT_SVC);
  // centre lines (service courts only)
  ctx.strokeStyle = C.lineSoft;
  line(v, COURT.W / 2, 0, COURT.W / 2, COURT.NET - COURT.SHORT_SVC);
  line(v, COURT.W / 2, COURT.NET + COURT.SHORT_SVC, COURT.W / 2, COURT.L);

  // net
  ctx.save();
  ctx.strokeStyle = C.net;
  ctx.lineWidth = Math.max(2, v.m(0.07));
  line(v, -COURT.MARGIN * 0.8, COURT.NET, COURT.W + COURT.MARGIN * 0.8, COURT.NET);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COURT.W; x += 0.3) {
    line(v, x, COURT.NET - 0.16, x, COURT.NET + 0.16);
  }
  ctx.restore();
}

function rect(v, x, y, w, h, fill) {
  const { ctx } = v;
  const px = v.sx(x), py = v.sy(y), pw = v.m(w), ph = v.m(h);
  if (fill) ctx.fillRect(px, py, pw, ph); else ctx.strokeRect(px, py, pw, ph);
}
function strokeRect(v, x, y, w, h) { rect(v, x, y, w, h, false); }
function line(v, x1, y1, x2, y2) {
  const { ctx } = v;
  ctx.beginPath();
  ctx.moveTo(v.sx(x1), v.sy(y1));
  ctx.lineTo(v.sx(x2), v.sy(y2));
  ctx.stroke();
}

/* ---------- players ---------- */
function drawPlayer(v, p, opts) {
  const { ctx } = v;
  const r = v.m(0.34);
  const px = v.sx(p.x), py = v.sy(p.y);

  ctx.save();
  // soft halo so players read against the court
  ctx.beginPath();
  ctx.arc(px, py, r * 1.75, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = opts.color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, v.m(0.035));
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();

  // racket side marker — a right-hander facing you has their racket on YOUR left
  if (opts.hand) {
    const dx = opts.hand === 'R' ? -1 : 1;
    ctx.beginPath();
    ctx.arc(px + dx * r * 1.15, py + r * 0.15, r * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
  }

  if (opts.label) {
    ctx.font = '600 ' + Math.max(9, Math.round(v.m(0.30))) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#04121a';
    ctx.fillText(opts.label, px, py + 0.5);
  }
  ctx.restore();
}

function drawPlayers(v, scn) {
  scn.opps.forEach((o, i) => drawPlayer(v, o, {
    color: C.opp, hand: o.hand, label: o.hand,
  }));
  drawPlayer(v, scn.partner, { color: C.partner, label: 'P' });
  drawPlayer(v, scn.you, { color: C.you, label: 'YOU' });
}

/* ---------- zones ---------- */
function drawZones(v, scn, state) {
  const { ctx } = v;
  scn.zones.forEach((zn) => {
    const px = v.sx(zn.x), py = v.sy(zn.y);
    const r = v.m(zn.isBody ? 0.36 : 0.46);
    const hot = state.hoverZone === zn.id;
    const pick = state.pickedZone === zn.id;
    const col = pick
      ? (state.result ? SCORE_COLOR[state.result.score] : C.you)
      : (hot ? C.you : C.zoneEdge);

    ctx.save();
    // a target reticle, deliberately nothing like a player marker
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = pick
      ? hexA(state.result ? SCORE_COLOR[state.result.score] : C.you, 0.30)
      : (hot ? hexA(C.you, 0.20) : 'rgba(255,255,255,0.045)');
    ctx.fill();

    ctx.lineWidth = pick || hot ? Math.max(1.6, v.m(0.045)) : 1.1;
    ctx.strokeStyle = col;
    ctx.globalAlpha = pick || hot ? 1 : 0.55;
    ctx.setLineDash(zn.isBody ? [v.m(0.10), v.m(0.09)] : [v.m(0.22), v.m(0.16)]);
    ctx.stroke();

    // crosshair
    ctx.setLineDash([]);
    ctx.globalAlpha = pick || hot ? 0.95 : 0.5;
    ctx.lineWidth = 1.2;
    const t = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(px - t, py); ctx.lineTo(px + t, py);
    ctx.moveTo(px, py - t); ctx.lineTo(px, py + t);
    ctx.stroke();
    ctx.restore();

    if (hot || pick) drawZoneLabel(v, zn, px, py, r);
  });
}

function drawZoneLabel(v, zn, px, py, r) {
  const { ctx } = v;
  ctx.save();
  ctx.font = '600 ' + Math.max(10, Math.round(v.m(0.30))) + 'px ui-sans-serif, system-ui, sans-serif';
  const w = ctx.measureText(zn.label).width + 12;
  const h = Math.max(16, v.m(0.44));
  let lx = px - w / 2;
  const ly = py - r - h - 4;
  lx = Math.max(4, Math.min(lx, v.cssW - w - 4));
  ctx.fillStyle = 'rgba(8,16,22,0.92)';
  roundRect(ctx, lx, ly, w, h, 5);
  ctx.fill();
  ctx.fillStyle = '#e9f4f8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(zn.label, lx + w / 2, ly + h / 2 + 0.5);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* ---------- shuttle paths ---------- */
/* A top-down court cannot show height, so flight is expressed as
   curvature plus line style: steep = straight and solid, lob = bowed
   and dotted, soft = gently bowed and dashed, flat = straight and thin. */
const FLIGHT = {
  steep: { bow: 0.015, width: 0.075, dash: null },
  flat:  { bow: 0.01, width: 0.050, dash: null },
  soft:  { bow: 0.16, width: 0.050, dash: [0.30, 0.22] },
  lob:   { bow: 0.30, width: 0.050, dash: [0.10, 0.28] },
  none:  { bow: 0.00, width: 0.040, dash: [0.10, 0.20] },
};

function pathPoints(from, to, flight) {
  const f = FLIGHT[flight] || FLIGHT.flat;
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // bow perpendicular to the line of flight
  const cx = mx + (-dy / len) * len * f.bow;
  const cy = my + (dx / len) * len * f.bow;
  return { c: { x: cx, y: cy }, f };
}

function bezier(from, c, to, t) {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
  };
}

function drawPath(v, from, to, flight, color, progress, opts) {
  const { ctx } = v;
  const { c, f } = pathPoints(from, to, flight);
  const t = progress === undefined ? 1 : progress;
  opts = opts || {};

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, v.m(f.width));
  ctx.strokeStyle = color;
  ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
  if (f.dash) ctx.setLineDash(f.dash.map((d) => v.m(d)));

  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const tt = (i / steps) * t;
    const p = bezier(from, c, to, tt);
    const px = v.sx(p.x), py = v.sy(p.y);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  if (opts.shuttle !== false && t > 0 && t < 1.0001) {
    const p = bezier(from, c, to, t);
    ctx.save();
    ctx.beginPath();
    ctx.arc(v.sx(p.x), v.sy(p.y), v.m(0.16), 0, Math.PI * 2);
    ctx.fillStyle = C.shuttle;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }
}

function drawContactMarker(v, p) {
  const { ctx } = v;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(v.sx(p.x), v.sy(p.y), v.m(0.22), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------- nearest zone to a tap ---------- */
function nearestZone(scn, wx, wy) {
  let best = null, bestD = Infinity;
  scn.zones.forEach((zn) => {
    const d = Math.hypot(zn.x - wx, zn.y - wy);
    if (d < bestD) { bestD = d; best = zn; }
  });
  // a tap miles away from every zone should not snap
  return bestD <= 2.6 ? best : null;
}
