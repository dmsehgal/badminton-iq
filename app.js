/* ============================================================
   Badminton IQ — app
   ============================================================ */

const STORE_KEY = 'biq_v1';
const DRILL_SIZE = 10;
const DRILL_SECONDS = 10;

/* Score this much on a level to open the next one. Low enough that a player
   who understands the ideas moves on, high enough that clicking through
   without reading does not. */
const PASS_PCT = 60;

/* Typing this as your name opens every level. It sits in plain sight in a
   public repository, so it is a convenience, not a secret. */
const MASTER_KEY = 'deep mohan sehgal';

/* Which hand the player holds the racket in. Everything they are shown is
   drawn from their side of the racket, so this decides whether each position
   is mirrored. Right is only the fallback for someone who has not said. */
function playerHand() {
  return store.hand === 'L' ? 'L' : 'R';
}

/* Names and explanations that mention a side have to agree with the picture. */
function sided(text) {
  return playerHand() === 'L' ? swapSides(text) : text;
}

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
  freshUnlocks: [],
  podium: [],
  podiumAt: 0,
  podiumTimer: null,
};

const $ = (id) => document.getElementById(id);

/* A level's standing comes from the best score ever recorded on each of its
   positions, so replaying one to fix what you missed moves you forward. */
function levels() {
  let open = true;                      // the first level is always available
  return CHAPTERS.map((c, i) => {
    const list = scenariosOf(c.id);
    const points = list.reduce((n, sc) => n + (store.scenarios[sc.id] || 0), 0);
    const total = list.length * 3;
    const pct = total ? Math.round((points / total) * 100) : 0;
    const passed = pct >= PASS_PCT;
    const unlocked = !!store.master || open;
    if (!passed) open = false;
    return { id: c.id, name: c.name, blurb: c.blurb, n: i + 1,
             count: list.length, points: points, total: total,
             pct: pct, passed: passed, unlocked: unlocked, started: points > 0 };
  });
}

function levelById(id) {
  return levels().find((l) => l.id === id);
}

/* The drill draws from every level, so it only offers what you have opened. */
function drillPool() {
  const open = levels().filter((l) => l.unlocked).map((l) => l.id);
  return SCENARIOS.filter((sc) => open.indexOf(sc.chapter) !== -1).map((sc) => sc.id);
}

function drillReady() {
  return !!store.master || levels().some((l) => l.passed);
}

/* Every run can go on a board, but only against runs of the same kind — a
   six-question untimed chapter and a ten-question timed drill are not the
   same achievement, so they are ranked separately. */
function boards() {
  return [{ id: 'overall', name: 'Overall' }, { id: 'drill', name: 'Decision drill' }]
    .concat(CHAPTERS.map((c) => ({ id: c.id, name: c.name })));
}
function boardName(id) {
  const b = boards().find((x) => x.id === id);
  return b ? sided(b.name) : id;
}

/* ---------- screens ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
  Analytics.screen(name);
}

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  const lv = levels();

  $('level-list').innerHTML = lv.map((l, i) => {
    const state = !l.unlocked ? 'locked' : l.passed ? 'passed' : l.started ? 'started' : 'open';
    const mark = !l.unlocked ? '&#128274;' : l.passed ? '&#10003;' : '&#9654;';
    const meta = !l.unlocked
      ? 'Score ' + PASS_PCT + '% on level ' + (l.n - 1) + ' to open this'
      : l.started
        ? l.points + ' of ' + l.total + ' points &middot; ' + l.pct + '%' + (l.passed ? ' &middot; passed' : '')
        : l.count + ' positions';
    return '' +
      '<button class="level ' + state + (app.freshUnlocks.indexOf(l.id) !== -1 ? ' just-unlocked' : '') +
        '" data-level="' + l.id + '" style="--i:' + i + '">' +
        '<span class="level-num">' + l.n + '</span>' +
        '<span class="level-body">' +
          '<span class="level-name">' + esc(sided(l.name)) + '</span>' +
          '<span class="level-blurb">' + esc(sided(l.blurb)) + '</span>' +
          '<span class="meter"><i style="width:' + (l.unlocked ? l.pct : 0) + '%"></i></span>' +
          '<span class="level-meta">' + meta + '</span>' +
        '</span>' +
        '<span class="level-state">' + mark + '</span>' +
      '</button>';
  }).join('');

  $('level-list').querySelectorAll('[data-level]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-level');
      if (!levelById(id).unlocked) {
        b.classList.remove('shake');
        void b.offsetWidth;            // restart the animation on a repeat tap
        b.classList.add('shake');
        return;
      }
      startChapter(id);
    });
  });
  app.freshUnlocks = [];

  $('unlock-note').textContent = store.master
    ? 'Every level is open.'
    : lv.some((l) => !l.unlocked)
      ? 'Score ' + PASS_PCT + '% on a level to open the next one.'
      : 'Every level open. Now make them automatic.';

  const ready = drillReady();
  $('drill-card').classList.toggle('locked-card', !ready);
  $('start-drill').disabled = !ready;
  $('drill-blurb').textContent = ready
    ? 'Ten random positions from the levels you have opened, ten seconds each. This is the one that builds speed — in a real rally the decision is made before the shuttle gets to you.'
    : 'Pass your first level to open the drill.';

  $('glossary-list').innerHTML = GLOSSARY.map((row) =>
    '<dt>' + esc(row[0]) + '</dt><dd>' + esc(sided(row[1])) + '</dd>').join('');
  if (!app.howtoHand) app.howtoHand = $('howto-hand').innerHTML;
  $('howto-hand').innerHTML = playerHand() === 'L' ? swapSides(app.howtoHand) : app.howtoHand;

  $('name-card').classList.toggle('hidden', !LB.enabled());
  renderNameCard();
  renderPodium();
}

/* ---------- the rotating top three ---------- */
function stopPodium() {
  if (app.podiumTimer) { clearInterval(app.podiumTimer); app.podiumTimer = null; }
}

async function renderPodium() {
  const box = $('podium');
  if (!LB.enabled()) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  try {
    const rows = await LB.overall(3);
    app.podium = rows;
    stopPodium();
    if (!rows.length) {
      $('podium-stage').innerHTML =
        '<div class="podium-slide in empty">Nobody on the board yet. ' +
        'Finish a level and the top three appear here.</div>';
      $('podium-dots').innerHTML = '';
      return;
    }
    app.podiumAt = 0;
    showPodiumSlide(0);
    if (rows.length > 1) {
      app.podiumTimer = setInterval(() => {
        app.podiumAt = (app.podiumAt + 1) % app.podium.length;
        showPodiumSlide(app.podiumAt);
      }, 4200);
    }
  } catch (err) {
    $('podium-stage').innerHTML = '<div class="podium-slide in empty">' + esc(err.message) + '</div>';
    $('podium-dots').innerHTML = '';
  }
}

const MEDALS = ['&#129351;', '&#129352;', '&#129353;'];

function showPodiumSlide(i) {
  const r = app.podium[i];
  if (!r) return;
  const me = LB.savedName().toLowerCase();
  const mine = me && String(r.name).toLowerCase() === me;
  const stage = $('podium-stage');
  stage.innerHTML =
    '<div class="podium-slide' + (mine ? ' mine' : '') + '">' +
      '<span class="podium-medal">' + MEDALS[i] + '</span>' +
      '<span class="podium-who">' +
        '<b>' + esc(r.name) + (mine ? ' <i class="lb-tag">you</i>' : '') + '</b>' +
        '<small>' + r.chapters + ' of ' + CHAPTERS.length + ' levels played</small>' +
      '</span>' +
      '<span class="podium-score"><b>' + r.points + '</b><small>points</small></span>' +
    '</div>';
  // force a reflow so the entry animation replays on every slide
  const el = stage.firstElementChild;
  void el.offsetWidth;
  el.classList.add('in');

  $('podium-dots').innerHTML = app.podium.map((_, j) =>
    '<button class="podium-dot' + (j === i ? ' on' : '') + '" data-slide="' + j +
    '" aria-label="Show number ' + (j + 1) + '"></button>').join('');
  $('podium-dots').querySelectorAll('[data-slide]').forEach((d) => {
    d.addEventListener('click', (e) => {
      e.stopPropagation();
      stopPodium();
      app.podiumAt = +d.getAttribute('data-slide');
      showPodiumSlide(app.podiumAt);
    });
  });
}

/* Asking at the end of a run is a surprise. Ask once, up front, and from
   then on just show who is playing. */
function renderNameCard(forceEdit) {
  const name = LB.savedName();
  const hand = playerHand();
  const handWord = hand === 'L' ? 'left-handed' : 'right-handed';
  // the hand is worth asking even with no leaderboard, since it changes the court
  const editing = forceEdit || !name || !store.hand;

  $('name-heading').textContent = editing
    ? (name ? 'Which hand do you play with?' : 'Who is playing?')
    : 'Playing as ' + name;
  $('name-sub').textContent = editing
    ? (LB.enabled()
        ? 'Your name goes on the leaderboard. Your playing hand decides which way round every position is shown.'
        : 'Your playing hand decides which way round every position is shown.')
    : handWord + ' · scores go on the board under this name';

  $('name-edit-row').classList.toggle('hidden', !editing);
  $('name-row').classList.toggle('hidden', !LB.enabled());
  $('home-name-change').classList.toggle('hidden', editing);
  if (editing) $('home-name').value = name;

  document.querySelectorAll('.hand-btn').forEach((b) => {
    b.classList.toggle('on', store.hand === b.getAttribute('data-hand'));
  });
}

function setHand(hand) {
  if (store.hand === hand) return;
  store.hand = hand;
  saveStore();
  Analytics.track('set_hand', { hand: hand });
  renderHome();
}

function saveHomeName() {
  const name = LB.cleanName($('home-name').value);
  if (!name) { $('home-name').focus(); return; }
  LB.rememberName(name);
  applyMasterKey(name);
  renderHome();
}

/* Entering the full name opens every level, for practising a particular one
   without grinding back to it. */
function applyMasterKey(name) {
  if (String(name).trim().toLowerCase() !== MASTER_KEY) return false;
  if (!store.master) {
    store.master = true;
    saveStore();
    Analytics.track('master_unlock');
  }
  return true;
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
  app.lockedBefore = levels().filter((l) => !l.unlocked).map((l) => l.id);
  app.mode = 'chapter';
  app.chapterId = id;
  app.useTimer = false;
  app.queue = scenariosOf(id).map((s) => s.id);
  Analytics.track('chapter_start', { chapter: id });
  beginSession();
}

function startDrill() {
  app.mode = 'drill';
  app.chapterId = null;
  app.useTimer = $('drill-timer-toggle').checked;
  app.lockedBefore = levels().filter((l) => !l.unlocked).map((l) => l.id);
  const pool = drillPool();
  shuffle(pool);
  app.queue = pool.slice(0, Math.min(DRILL_SIZE, pool.length));
  Analytics.track('drill_start', { timed: app.useTimer });
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
  app.scn = viewOf(SCENARIOS.find((s) => s.id === id), playerHand());
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
  $('q-brief').textContent = fmt(app.scn.brief, app.scn);
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
    p.textContent = 'Tap the number where you should be standing.';
  } else if (!app.pickedShot) {
    p.className = 'prompt';
    p.textContent = 'Pick a shot, then tap a number on the court.';
  } else {
    p.className = 'prompt hint';
    p.textContent = SHOTS[app.pickedShot].label + ' — now tap the number you are aiming at.';
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
  p.textContent = 'Pick a shot first, then tap a number.';
}

function recordResult() {
  const prev = store.scenarios[app.scn.id];
  if (prev === undefined || app.result.score > prev) {
    store.scenarios[app.scn.id] = app.result.score;
  }
  app.session.push({
    id: app.scn.id, title: app.scn.title, score: app.result.score,
    key: fmt(app.scn.key, app.scn),
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
    const target = zoneName(app.scn, app.pickedZone);
    $('fb-pick').textContent = app.scn.kind === 'position'
      ? target
      : SHOTS[app.pickedShotFinal].label + ' → ' + target;
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
      ? zoneName(app.scn, b.zoneId)
      : SHOTS[b.shotId].label + ' → ' + zoneName(app.scn, b.zoneId);
    bestBox.classList.remove('hidden');
    $('fb-best-text').textContent = label + '. ' + b.grade.why;
  }

  $('fb-key').textContent = fmt(app.scn.key, app.scn);
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

  Analytics.track(app.mode === 'drill' ? 'drill_complete' : 'chapter_complete', {
    chapter: app.chapterId || 'drill',
    pct: pct,
    timed: app.useTimer,
  });

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

  // every run goes on a board, and each kind is ranked separately
  const board = app.mode === 'drill' ? 'drill' : app.chapterId;
  $('sum-post').classList.toggle('hidden', !LB.enabled());
  if (LB.enabled()) {
    app.pendingScore = { pct: pct, points: got, total: max, mode: board };
    $('post-heading').textContent = boardName(board);
    $('sum-board').classList.add('hidden');
    $('sum-view-board').classList.add('hidden');
    // posting needs a name; if we already have one there is nothing to ask
    if (LB.savedName()) {
      $('post-name-row').classList.add('hidden');
      autoPost();
    } else {
      $('post-name-row').classList.remove('hidden');
      $('post-name').value = '';
      $('post-btn').disabled = false;
      $('post-btn').textContent = 'Save and post';
      setStatus('post-status', 'Enter a name to get on the board.');
    }
  }

  // anything this run opened gets picked out when the home screen redraws
  app.freshUnlocks = (app.lockedBefore || []).filter((id) => levelById(id).unlocked);

  $('sum-again').textContent = app.mode === 'drill' ? 'Another drill' : 'Run it again';
  show('summary');
  renderHome();
}

/* ============================================================
   LEADERBOARD
   ============================================================ */
function setStatus(id, msg, kind) {
  const el = $(id);
  el.textContent = msg || '';
  el.className = 'post-status' + (kind ? ' ' + kind : '');
}

/* Used when the player still has to give a name; otherwise autoPost runs
   on its own as soon as the run ends. */
function postScore() {
  const name = LB.cleanName($('post-name').value);
  if (!name) { setStatus('post-status', 'Enter a name first.', 'bad'); return; }
  LB.rememberName(name);
  applyMasterKey(name);
  $('post-btn').disabled = true;
  $('post-name-row').classList.add('hidden');
  renderNameCard(false);
  autoPost();
}

async function autoPost() {
  const score = app.pendingScore;
  if (!score) return;
  const name = LB.savedName();
  if (!name) return;

  setStatus('post-status', 'Posting your score…');
  try {
    await LB.submit({
      name: name,
      mode: score.mode,
      hand: playerHand(),
      pct: score.pct,
      points: score.points,
      total: score.total,
    });
    Analytics.track('score_posted', { pct: score.pct, board: score.mode });
    app.lbBoard = score.mode;
    app.pendingScore = null;
    await showSummaryBoard(score.mode, name);
  } catch (err) {
    // a failed post must not hide the run's result, so offer a retry in place
    setStatus('post-status', err.message + ' ', 'bad');
    $('post-name-row').classList.remove('hidden');
    $('post-btn').disabled = false;
    $('post-btn').textContent = 'Try again';
  }
}

/* The point of posting is seeing where you landed, so show it here rather
   than telling the player to go and look. */
async function showSummaryBoard(mode, name) {
  const list = $('sum-board');
  try {
    const rows = await LB.top(mode, 50);
    const me = rows.findIndex((r) => String(r.name).toLowerCase() === name.toLowerCase());
    setStatus('post-status', me === -1
      ? 'Posted as ' + name + '.'
      : 'Posted as ' + name + ' — ' + ordinal(me + 1) + ' of ' + rows.length + ' on this board.', 'good');

    // the top few, plus your own row if you finished outside them
    const shown = rows.slice(0, 5);
    if (me >= 5) shown.push(rows[me]);
    list.innerHTML = shown.map((r) => {
      const rank = rows.indexOf(r) + 1;
      const mine = rows.indexOf(r) === me;
      return lbRow(rank, r.name, r.pct + '%', r.points + '/' + r.total, mine);
    }).join('');
    list.classList.remove('hidden');
    $('sum-view-board').classList.remove('hidden');
  } catch (err) {
    setStatus('post-status', 'Posted, but the board would not load: ' + err.message, 'bad');
    $('sum-view-board').classList.remove('hidden');
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function lbRow(rank, name, big, small, mine) {
  return '<li class="lb-row' + (rank <= 3 ? ' lb-top' : '') + (mine ? ' lb-you' : '') + '">' +
    '<span class="lb-rank">' + rank + '</span>' +
    '<span class="lb-name">' + esc(name) + (mine ? ' <i class="lb-tag">you</i>' : '') + '</span>' +
    '<span class="lb-pct">' + esc(big) + '</span>' +
    '<span class="lb-pts">' + esc(small) + '</span>' +
  '</li>';
}

async function openLeaderboard() {
  show('leaderboard');
  renderBoardTabs();
  renderHandFilter();
  await renderLeaderboard();
}

const HAND_FILTERS = [
  { id: 'all', name: 'Everyone' },
  { id: 'R', name: 'Right-handed' },
  { id: 'L', name: 'Left-handed' },
];

function renderHandFilter() {
  if (!app.lbHand) app.lbHand = 'all';
  $('lb-hand').innerHTML = HAND_FILTERS.map((h) =>
    '<button class="lb-chip' + (h.id === app.lbHand ? ' on' : '') + '" data-hand="' +
    h.id + '">' + esc(h.name) + '</button>').join('');
  $('lb-hand').querySelectorAll('[data-hand]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.lbHand = btn.getAttribute('data-hand');
      renderHandFilter();
      renderLeaderboard();
    });
  });
}

function renderBoardTabs() {
  if (!app.lbBoard) app.lbBoard = 'drill';
  $('lb-tabs').innerHTML = boards().map((b) =>
    '<button class="lb-tab' + (b.id === app.lbBoard ? ' on' : '') + '" data-board="' +
    b.id + '">' + esc(b.name) + '</button>').join('');
  $('lb-tabs').querySelectorAll('[data-board]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.lbBoard = btn.getAttribute('data-board');
      renderBoardTabs();
      renderLeaderboard();
    });
  });
}

async function renderLeaderboard() {
  const list = $('lb-list');
  const board = app.lbBoard || 'overall';
  const me = LB.savedName().toLowerCase();

  $('lb-caption').textContent =
    board === 'overall' ? 'Every chapter added together: each player’s best run of each chapter. Playing more chapters counts for more. The decision drill is not included, because it draws from all of them.'
    : board === 'drill' ? 'Best decision drill per player. Ten positions, ten seconds each, three points for the best answer.'
    : 'Best run of “' + boardName(board) + '” per player.';

  setStatus('lb-status', 'Loading…');
  try {
    const hand = app.lbHand === 'all' ? null : app.lbHand;
    const rows = board === 'overall' ? await LB.overall(20, hand) : await LB.top(board, 20, hand);
    if (!rows.length) {
      list.innerHTML = '';
      setStatus('lb-status', hand
        ? 'No ' + (hand === 'L' ? 'left' : 'right') + '-handed player has posted on this board yet.'
        : 'Nobody has posted a score on this board yet. Be the first.');
      return;
    }
    list.innerHTML = rows.map((r, i) => {
      const mine = me && String(r.name).toLowerCase() === me;
      return board === 'overall'
        ? lbRow(i + 1, r.name, r.points + ' pts', r.chapters + '/' + CHAPTERS.length + ' ch', mine)
        : lbRow(i + 1, r.name, r.pct + '%', r.points + '/' + r.total, mine);
    }).join('');
    setStatus('lb-status', '');
  } catch (err) {
    list.innerHTML = '';
    setStatus('lb-status', err.message, 'bad');
  }
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
  Analytics.init();
  loadStore();
  renderHome();

  $('start-drill').addEventListener('click', startDrill);
  $('lb-back').addEventListener('click', () => show('home'));
  $('lb-refresh').addEventListener('click', renderLeaderboard);
  $('post-btn').addEventListener('click', postScore);
  $('podium-all').addEventListener('click', openLeaderboard);
  $('podium-stage').addEventListener('click', openLeaderboard);
  $('sum-view-board').addEventListener('click', openLeaderboard);
  $('home-name-save').addEventListener('click', saveHomeName);
  $('home-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveHomeName(); });
  $('home-name-change').addEventListener('click', () => renderNameCard(true));
  $('post-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') postScore(); });
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
    store.master = false;
    store.hand = null;
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

  document.querySelectorAll('.hand-btn').forEach((b) => {
    b.addEventListener('click', () => setHand(b.getAttribute('data-hand')));
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
