/* ============================================================
   Badminton IQ — app
   ============================================================ */

const STORE_KEY = 'biq_v1';
const DRILL_SIZE = 10;
const DRILL_SECONDS = 10;

const store = { scenarios: {}, drills: [] };

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) Object.assign(store, JSON.parse(raw));
  } catch (e) { /* private mode, first run — defaults are fine */ }
  if (!store.scenarios) store.scenarios = {};
  if (!store.drills) store.drills = [];
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
}

/* ---------- app state ---------- */
const app = {
  mode: null,        // 'chapter' | 'drill'
  chapterId: null,
  queue: [],
  idx: 0,
  scn: null,
  pickedShot: null,
  pickedZone: null,
  result: null,
  hoverZone: null,
  locked: false,
  session: [],       // {id, title, score, key}
  anim: null,
  view: null,
  timerId: null,
  timeLeft: 0,
  useTimer: true,
};

const $ = (id) => document.getElementById(id);

/* ---------- screens ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  const total = SCENARIOS.length;
  const attempted = SCENARIOS.filter((s) => store.scenarios[s.id] !== undefined).length;
  const mastered = SCENARIOS.filter((s) => store.scenarios[s.id] === 3).length;
  const lastDrill = store.drills.length ? store.drills[store.drills.length - 1] : null;
  const bestDrill = store.drills.reduce((m, d) => Math.max(m, d.pct), 0);

  $('home-stats').innerHTML =
    stat(mastered + ' / ' + total, 'Positions nailed') +
    stat(attempted + ' / ' + total, 'Seen') +
    stat(lastDrill ? lastDrill.pct + '%' : '—', 'Last drill') +
    stat(store.drills.length ? bestDrill + '%' : '—', 'Best drill');

  $('chapter-list').innerHTML = CHAPTERS.map((ch) => {
    const list = scenariosOf(ch.id);
    const done = list.filter((s) => store.scenarios[s.id] === 3).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    return '' +
      '<div class="card">' +
        '<div class="card-body">' +
          '<h3>' + esc(ch.name) + '</h3>' +
          '<p>' + esc(ch.blurb) + '</p>' +
          '<div class="meter"><i style="width:' + pct + '%"></i></div>' +
          '<div class="meter-label">' + done + ' of ' + list.length + ' nailed</div>' +
        '</div>' +
        '<button class="btn primary" data-chapter="' + ch.id + '">' + (done ? 'Replay' : 'Start') + '</button>' +
      '</div>';
  }).join('');

  $('chapter-list').querySelectorAll('[data-chapter]').forEach((b) => {
    b.addEventListener('click', () => startChapter(b.getAttribute('data-chapter')));
  });
}
function stat(big, label) {
  return '<div class="stat"><b>' + esc(big) + '</b><span>' + esc(label) + '</span></div>';
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ============================================================
   SESSION SETUP
   ============================================================ */
function startChapter(id) {
  app.mode = 'chapter';
  app.chapterId = id;
  app.useTimer = false;
  app.queue = scenariosOf(id).map((s) => s.id);
  beginSession();
}

function startDrill() {
  app.mode = 'drill';
  app.chapterId = null;
  app.useTimer = $('drill-timer-toggle').checked;
  const pool = SCENARIOS.map((s) => s.id);
  shuffle(pool);
  app.queue = pool.slice(0, Math.min(DRILL_SIZE, pool.length));
  beginSession();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

function beginSession() {
  app.idx = 0;
  app.session = [];
  show('train');
  loadQuestion();
}

/* ============================================================
   QUESTION
   ============================================================ */
function loadQuestion() {
  const id = app.queue[app.idx];
  app.scn = SCENARIOS.find((s) => s.id === id);
  app.pickedShot = app.scn.shots.length === 1 ? app.scn.shots[0] : null;
  app.pickedZone = null;
  app.result = null;
  app.hoverZone = null;
  app.locked = false;
  app.anim = null;

  const ch = CHAPTERS.find((c) => c.id === app.scn.chapter);
  $('q-progress').textContent = (app.idx + 1) + ' / ' + app.queue.length;
  $('q-chapter').textContent = app.mode === 'drill' ? 'Drill' : ch.name;
  $('q-title').textContent = app.scn.title;
  $('q-brief').textContent = app.scn.brief;
  $('feedback').classList.add('hidden');

  renderShotButtons();
  updatePrompt();
  sizeCanvas();
  draw();
  startTimer();
}

function renderShotButtons() {
  const row = $('shot-row');
  if (app.scn.shots.length === 1 && app.scn.shots[0] === 'move') {
    row.innerHTML = '';
    return;
  }
  row.innerHTML = app.scn.shots.map((sh) =>
    '<button class="shot-btn' + (app.pickedShot === sh ? ' on' : '') + (app.locked ? ' done' : '') +
    '" data-shot="' + sh + '" title="' + esc(SHOTS[sh].hint) + '">' + esc(SHOTS[sh].label) + '</button>'
  ).join('');
  row.querySelectorAll('[data-shot]').forEach((b) => {
    b.addEventListener('click', () => {
      if (app.locked) return;
      app.pickedShot = b.getAttribute('data-shot');
      renderShotButtons();
      updatePrompt();
      draw();
    });
  });
}

function updatePrompt() {
  const p = $('q-prompt');
  if (app.locked) {
    p.textContent = '';
    // a position question has no shot buttons, so once answered the bar is empty
    $('answer-bar').classList.toggle('hidden', $('shot-row').innerHTML === '');
    return;
  }
  $('answer-bar').classList.remove('hidden');
  if (app.scn.kind === 'position') {
    p.className = 'prompt hint';
    p.textContent = 'Tap the court where you should be standing.';
  } else if (!app.pickedShot) {
    p.className = 'prompt';
    p.textContent = 'Pick a shot, then tap the court to place it.';
  } else {
    p.className = 'prompt hint';
    p.textContent = SHOTS[app.pickedShot].label + ' — now tap where you are putting it.';
  }
}

/* ---------- timer ---------- */
function startTimer() {
  stopTimer();
  const el = $('q-timer');
  if (!app.useTimer) { el.classList.add('hidden'); return; }
  app.timeLeft = DRILL_SECONDS;
  el.classList.remove('hidden', 'low');
  el.textContent = app.timeLeft;
  app.timerId = setInterval(() => {
    app.timeLeft--;
    el.textContent = Math.max(0, app.timeLeft);
    el.classList.toggle('low', app.timeLeft <= 3);
    if (app.timeLeft <= 0) { stopTimer(); timeOut(); }
  }, 1000);
}
function stopTimer() {
  if (app.timerId) { clearInterval(app.timerId); app.timerId = null; }
}

function timeOut() {
  if (app.locked) return;
  app.locked = true;
  app.result = {
    score: 0,
    verdict: VERDICTS[0],
    why: 'No decision. In a real rally the shuttle does not wait — by the time it arrives the choice has to already be made. That is the whole reason to drill this.',
    outcome: 'The shuttle went past you.',
    reply: null,
    timedOut: true,
  };
  recordResult();
  showFeedback();
  draw();
}

/* ---------- answering ---------- */
function answer(zone) {
  if (app.locked) return;
  const shot = app.scn.kind === 'position' ? 'move' : app.pickedShot;
  if (!shot) { flashPrompt(); return; }
  stopTimer();
  app.locked = true;
  app.pickedZone = zone.id;
  app.result = judge(app.scn, shot, zone.id);
  app.pickedShotFinal = shot;
  recordResult();
  playAnimation(zone);
  showFeedback();
}

function flashPrompt() {
  const p = $('q-prompt');
  p.className = 'prompt hint';
  p.textContent = 'Pick a shot first, then tap the court.';
}

function recordResult() {
  const prev = store.scenarios[app.scn.id];
  if (prev === undefined || app.result.score > prev) {
    store.scenarios[app.scn.id] = app.result.score;
  }
  app.session.push({
    id: app.scn.id, title: app.scn.title, score: app.result.score, key: app.scn.key,
  });
  saveStore();
}

function showFeedback() {
  const r = app.result;
  const fb = $('feedback');
  fb.classList.remove('hidden');
  renderShotButtons();
  updatePrompt();

  $('fb-verdict').textContent = r.verdict.name;
  $('fb-verdict').className = 'verdict ' + r.verdict.cls;

  if (r.timedOut) {
    $('fb-pick').textContent = 'Out of time';
  } else {
    const zone = app.scn.zones.find((z2) => z2.id === app.pickedZone);
    const shotLabel = SHOTS[app.pickedShotFinal].label;
    $('fb-pick').textContent = app.scn.kind === 'position'
      ? zone.label
      : shotLabel + ' → ' + zone.label;
  }

  $('fb-why').textContent = r.why;
  $('fb-outcome').textContent = r.outcome || '';
  $('fb-outcome').classList.toggle('hidden', !r.outcome);

  const bestBox = $('fb-best');
  if (r.score === 3) {
    bestBox.classList.add('hidden');
  } else {
    const b = bestAnswer(app.scn);
    const label = app.scn.kind === 'position'
      ? b.zone.label
      : SHOTS[b.shotId].label + ' → ' + b.zone.label;
    bestBox.classList.remove('hidden');
    $('fb-best-text').textContent = label + '. ' + b.grade.why;
  }

  $('fb-key').textContent = app.scn.key;
  $('next-btn').textContent = app.idx + 1 >= app.queue.length ? 'See the summary' : 'Next position';

  // on a narrow screen the verdict sits below the court — take the reader there
  if (window.innerWidth < 880) {
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 420);
  }
}

/* ---------- animation ---------- */
function playAnimation(zone) {
  if (app.scn.kind === 'position') { draw(); return; }
  const color = SCORE_COLOR[app.result.score];
  const phases = [{
    from: app.scn.contact,
    to: { x: zone.x, y: zone.y },
    flight: SHOTS[app.pickedShotFinal].flight,
    color: color,
    dur: 620,
  }];
  if (app.result.reply) {
    phases.push({
      from: { x: zone.x, y: zone.y },
      to: app.result.reply,
      flight: 'soft',
      color: 'rgba(255,255,255,0.55)',
      dur: 700,
      delay: 220,
    });
  }
  app.anim = { phases: phases, t0: performance.now() };
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!app.anim) return;
  const a = app.anim;
  let elapsed = now - a.t0;
  let running = false;
  let acc = 0;
  a.phases.forEach((ph) => {
    const start = acc + (ph.delay || 0);
    const end = start + ph.dur;
    ph.t = elapsed <= start ? 0 : elapsed >= end ? 1 : (elapsed - start) / ph.dur;
    if (ph.t < 1) running = true;
    acc = end;
  });
  draw();
  if (running) requestAnimationFrame(tick);
  else app.anim.finished = true;
}

/* ---------- canvas ---------- */
function sizeCanvas() {
  const canvas = $('court');
  const wrap = canvas.parentElement;
  const availW = Math.max(220, wrap.clientWidth - 20);
  const vh = window.innerHeight;
  const cap = window.innerWidth < 880 ? vh * 0.50 : vh * 0.78;
  const maxH = Math.max(330, Math.min(cap, 780));
  let w = availW;
  let h = w * COURT_RATIO;
  if (h > maxH) { h = maxH; w = h / COURT_RATIO; }
  app.view = makeView(canvas, Math.round(w), Math.round(h));
}

function draw() {
  if (!app.view || !app.scn) return;
  const v = app.view;
  const scn = app.scn;

  drawCourt(v);

  if (scn.incoming) {
    const fromYourSide = scn.incoming.from.y > COURT.NET;
    drawPath(v, scn.incoming.from, scn.incoming.to,
      fromYourSide ? 'lob' : 'steep',
      fromYourSide ? 'rgba(126,232,195,0.50)' : 'rgba(255,143,107,0.55)',
      1, { shuttle: false, alpha: 0.85 });
  }

  // players first, then the reticles on top — otherwise the body targets,
  // which sit right beside a defender, disappear underneath them
  drawPlayers(v, scn);
  drawZones(v, scn, app);

  if (scn.kind !== 'position') drawContactMarker(v, scn.contact);

  if (app.anim) {
    app.anim.phases.forEach((ph) => {
      if (ph.t > 0) drawPath(v, ph.from, ph.to, ph.flight, ph.color, ph.t);
    });
  }

  // for a positioning question, mark the chosen spot on top of everything
  if (scn.kind === 'position' && app.pickedZone) {
    const zn = scn.zones.find((z2) => z2.id === app.pickedZone);
    drawPlayer(v, zn, { color: SCORE_COLOR[app.result ? app.result.score : 2], label: '✓' });
  }
}

function canvasPoint(ev) {
  const canvas = $('court');
  const rect = canvas.getBoundingClientRect();
  const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
  return { px: src.clientX - rect.left, py: src.clientY - rect.top };
}

function onCanvasMove(ev) {
  if (app.locked || !app.view) return;
  const { px, py } = canvasPoint(ev);
  const zn = nearestZone(app.scn, app.view.wx(px), app.view.wy(py));
  const id = zn ? zn.id : null;
  if (id !== app.hoverZone) { app.hoverZone = id; draw(); }
}

function onCanvasTap(ev) {
  if (app.locked || !app.view) return;
  ev.preventDefault();
  const { px, py } = canvasPoint(ev);
  const zn = nearestZone(app.scn, app.view.wx(px), app.view.wy(py));
  if (!zn) return;
  if (app.scn.kind !== 'position' && !app.pickedShot) { flashPrompt(); return; }
  app.hoverZone = zn.id;
  answer(zn);
  draw();
}

/* ============================================================
   SUMMARY
   ============================================================ */
function finishSession() {
  stopTimer();
  const got = app.session.reduce((n, r) => n + r.score, 0);
  const max = app.session.length * 3;
  const pct = max ? Math.round((got / max) * 100) : 0;

  if (app.mode === 'drill') {
    store.drills.push({ d: Date.now(), pct: pct, n: app.session.length });
    if (store.drills.length > 40) store.drills = store.drills.slice(-40);
    saveStore();
  }

  $('sum-label').textContent = app.mode === 'drill'
    ? 'Decision drill'
    : CHAPTERS.find((c) => c.id === app.chapterId).name;
  $('sum-score').innerHTML = pct + '%<small> &nbsp;· ' + got + ' of ' + max + ' points</small>';
  $('sum-line').textContent = verdictLine(pct);

  $('sum-list').innerHTML = app.session.map((r) =>
    '<li><span class="pip" style="background:' + SCORE_COLOR[r.score] + '"></span>' +
    esc(r.title) + '<span class="sc">' + VERDICTS[r.score].name + '</span></li>'
  ).join('');

  const missed = app.session.filter((r) => r.score < 3);
  $('sum-lessons').innerHTML = missed.length
    ? '<h3>Worth re-reading</h3>' + missed.map((r) =>
        '<div class="lesson"><b>' + esc(r.title) + '</b>' + esc(r.key) + '</div>').join('')
    : '<h3>Worth re-reading</h3><div class="lesson"><b>Clean sweep</b>' +
      'Every position nailed. Run the decision drill with the clock on — knowing the answer and finding it in under ten seconds are different skills.</div>';

  $('sum-again').textContent = app.mode === 'drill' ? 'Another drill' : 'Run it again';
  show('summary');
  renderHome();
}

function verdictLine(pct) {
  if (pct >= 90) return 'You are reading these positions the way the shot is meant to be chosen.';
  if (pct >= 70) return 'Solid. The reads are mostly there — the misses are where the tactical detail lives.';
  if (pct >= 45) return 'The shapes are landing, the targets are not yet. Re-read the principles for the ones you missed.';
  return 'Plenty here to gain. Work one chapter at a time rather than drilling at random.';
}

/* ============================================================
   WIRING
   ============================================================ */
function next() {
  app.idx++;
  if (app.idx >= app.queue.length) finishSession();
  else loadQuestion();
}

function init() {
  loadStore();
  renderHome();

  $('start-drill').addEventListener('click', startDrill);
  $('open-principles').addEventListener('click', () => show('principles'));
  $('prin-back').addEventListener('click', () => show('home'));
  $('train-back').addEventListener('click', () => { stopTimer(); show('home'); renderHome(); });
  $('sum-back').addEventListener('click', () => show('home'));
  $('sum-home').addEventListener('click', () => show('home'));
  $('sum-again').addEventListener('click', () => {
    if (app.mode === 'drill') startDrill(); else startChapter(app.chapterId);
  });
  $('next-btn').addEventListener('click', next);

  $('reset-progress').addEventListener('click', () => {
    if (!confirm('Clear all progress and drill history?')) return;
    store.scenarios = {};
    store.drills = [];
    saveStore();
    renderHome();
  });

  const canvas = $('court');
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseleave', () => { app.hoverZone = null; draw(); });
  canvas.addEventListener('click', onCanvasTap);
  canvas.addEventListener('touchstart', onCanvasTap, { passive: false });

  window.addEventListener('resize', () => {
    if ($('screen-train').classList.contains('active')) { sizeCanvas(); draw(); }
  });

  document.addEventListener('keydown', (e) => {
    if (!$('screen-train').classList.contains('active')) return;
    if (e.key === 'Enter' && app.locked) next();
    const n = parseInt(e.key, 10);
    if (!app.locked && n >= 1 && n <= app.scn.shots.length && app.scn.shots[0] !== 'move') {
      app.pickedShot = app.scn.shots[n - 1];
      renderShotButtons();
      updatePrompt();
      draw();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
