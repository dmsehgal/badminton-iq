/* ============================================================
   Badminton IQ — tactics model
   Court geometry, shot vocabulary, scenarios and the grader.

   All coordinates are in metres on a real doubles court.
     x: 0 .. 6.10   (0 = your left sideline, 6.10 = your right)
     y: 0 .. 13.40  (0 = opponents' baseline, 13.40 = your baseline)
     net at y = 6.70

   Everything is described from YOUR point of view, standing at the bottom
   of the picture looking at the net. "Your left" always means the left of
   the picture.

   Targets are numbered automatically, in reading order across the picture,
   and the coaching text refers to them with {zoneId} placeholders that are
   replaced with those numbers when it is displayed. That way the words can
   never disagree with the diagram.
   ============================================================ */

const COURT = {
  W: 6.10,          // doubles width
  L: 13.40,         // full length
  NET: 6.70,        // net line
  SHORT_SVC: 1.98,  // front service line, measured from the net
  LONG_SVC: 0.76,   // doubles back service line, measured from the back
  SINGLES_IN: 0.46, // singles sideline inset
  MARGIN: 0.80,     // drawing margin outside the lines
};

/* ---------- shot vocabulary ---------- */
/* flight: 'steep' | 'flat' | 'soft' | 'lob' — drives the drawn arc */
const SHOTS = {
  smash:     { label: 'Smash',      flight: 'steep', hint: 'Full power, hit downwards.' },
  halfSmash: { label: 'Half smash', flight: 'steep', hint: 'About three-quarter power. Steeper, and you stay balanced for the next shot.' },
  slice:     { label: 'Slice',      flight: 'soft',  hint: 'Cut across the shuttle. Looks like a smash, lands short.' },
  drop:      { label: 'Drop',       flight: 'soft',  hint: 'Soft, lands just over the net on their side.' },
  drive:     { label: 'Drive',      flight: 'flat',  hint: 'Flat and fast, passing just over the top of the net.' },
  push:      { label: 'Push',       flight: 'flat',  hint: 'Firm and flat, into the middle of their court.' },
  block:     { label: 'Block',      flight: 'soft',  hint: 'Take the pace off their smash and drop it just over the net.' },
  netShot:   { label: 'Net shot',   flight: 'soft',  hint: 'Tight over the net, dropping straight down the other side.' },
  netKill:   { label: 'Kill',       flight: 'steep', hint: 'Punch it down from above the top of the net.' },
  lift:      { label: 'Lift',       flight: 'lob',   hint: 'High to the back of their court. Safe, but it gives them the attack.' },
  clear:     { label: 'Clear',      flight: 'lob',   hint: 'High and deep, played from the back of your own court.' },
  move:      { label: 'Move here',  flight: 'none',  hint: 'Choose a position, not a shot.' },
};

const VERDICTS = [
  { name: 'Punished', cls: 'v0' },
  { name: 'Risky',    cls: 'v1' },
  { name: 'Solid',    cls: 'v2' },
  { name: 'Best',     cls: 'v3' },
];

/* ---------- plain-language glossary, shown on the home screen ---------- */
const GLOSSARY = [
  ['Side-by-side', 'Both players level with each other, splitting the court down the middle. The shape you defend in, because between you, you cover the full width.'],
  ['Front-and-back', 'One player at the net, one behind. The shape you attack in — the back player hits down, the front player finishes the weak reply.'],
  ['Lift', 'A high shot to the back of their court. Safe, but it hands them the attack, because now they are the ones hitting down.'],
  ['Block', 'Absorbing a smash and dropping it just over the net, instead of hitting back hard.'],
  ['Drive', 'A flat, fast shot that passes just over the top of the net.'],
  ['Push', 'A firm, flat shot into the middle of their court — over the head of their net player.'],
  ['Straight vs across', '"Straight" means back down the same side of the court. "Across" means diagonally, to the other side. Straight is nearly always faster and safer.'],
  ['Racket hand', 'The side a player holds their racket on. Facing you, a right-hander’s racket is on YOUR left, a left-hander’s on your right. The trainer marks it with a white pip.'],
  ['Jamming', 'Aiming at the hip on a player’s racket side, so they have no room to swing. It is a target on the person, not a place on the court.'],
];

/* ---------- shared targets on the OPPONENTS' half ----------
   Labels are written for someone who has never heard the jargon.
   "Your left" and "your right" always mean the left and right of the
   picture, which is the view from behind your own baseline.             */
const Z = {
  rearL:   { id: 'rearL',   label: 'Deep, your left',        x: 1.05, y: 0.95 },
  rearR:   { id: 'rearR',   label: 'Deep, your right',       x: 5.05, y: 0.95 },
  rearMid: { id: 'rearMid', label: 'Deep, down the middle',  x: 3.05, y: 0.95 },
  midL:    { id: 'midL',    label: 'Sideline, your left',    x: 0.65, y: 3.30 },
  midR:    { id: 'midR',    label: 'Sideline, your right',   x: 5.45, y: 3.30 },
  seam:    { id: 'seam',    label: 'The gap between them',   x: 3.05, y: 3.30 },
  netL:    { id: 'netL',    label: 'At the net, your left',  x: 0.95, y: 5.95 },
  netR:    { id: 'netR',    label: 'At the net, your right', x: 5.15, y: 5.95 },
  netMid:  { id: 'netMid',  label: 'At the net, middle',     x: 3.05, y: 5.85 },
};
const z = (k, over) => Object.assign({}, Z[k], over || {});

/* grade helper: score 0-3, why it is that, what happens next, where the reply lands */
const g = (score, why, outcome, reply) => ({ score, why, outcome, reply });

/* ============================================================
   CHAPTERS
   ============================================================ */
const CHAPTERS = [
  { id: 'set-defence', name: 'Breaking their defence',
    blurb: 'They lifted, they split, they are waiting. Where does the shuttle go?' },
  { id: 'keep-attack', name: 'Keeping the attack',
    blurb: 'The net player’s job, and what to do when the first smash does not win it.' },
  { id: 'defence',     name: 'Defending the smash',
    blurb: 'Block, drive, push. One shot that stops them hitting down at you.' },
  { id: 'shape',       name: 'Where to stand',
    blurb: 'Positioning. The half of doubles that decides the other half.' },
  { id: 'hands',       name: 'Left-handers',
    blurb: 'A left-hander moves every target on the court. Learn to check first.' },
];

/* ============================================================
   SCENARIOS
   ============================================================ */
const SCENARIOS = [

/* ---------- Chapter 1: breaking their defence ---------- */
{
  id: 'a1', chapter: 'set-defence',
  title: 'They lifted and split',
  brief: 'They have lifted the shuttle high into the back of your court, on your right. You are balanced behind it and your partner is at the net. They have spread out side-by-side across the middle of their court, each covering their own half of the width. Both are right-handed.',
  you: { x: 4.30, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.85, y: 3.35, hand: 'R' }, { x: 4.30, y: 3.35, hand: 'R' } ],
  contact: { x: 4.35, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearMid'),
           { id: 'bodyR', label: 'Jam the near player’s racket hand', bodyOf: 1 },
           { id: 'bodyL', label: 'Jam the far player’s racket hand', bodyOf: 0 } ],
  best: 'smash|bodyR',
  key: 'When both of them are spread wide, the middle is open. And because a right-hander’s racket hand is on the inside of their body, target {bodyR} and target {seam} are almost the same ball.',
  grades: {
    'smash|bodyR': g(3, 'Target {bodyR} is the hip on his racket side. Because he is right-handed and facing you, that hip is on the inside of his body — towards the middle. Hit there and he has no room to swing, he has to decide forehand or backhand with no time, and whatever comes back is weak.', 'He fends it off short. Your partner puts it away at the net.', { x: 3.60, y: 8.10 }),
    'smash|seam':  g(3, 'Target {seam} is the classic answer. They are each covering their own side, so the middle is the biggest space — and a shuttle down the middle takes away their angles and creates a moment where neither is sure whose ball it is.', 'They hesitate. The reply floats up and you smash again, better placed.', { x: 3.20, y: 9.80 }),
    'smash|midR':  g(2, 'Target {midR} is a real option, and much better than going across. But he is already standing over on that side — you are hitting to the part of the court he is best placed to reach, and giving him the easiest reply there is.', 'He blocks it back short and tight. Your partner has to lift.', { x: 4.90, y: 7.60 }),
    'smash|midL':  g(1, 'Target {midL} means smashing diagonally across the court. That is the longest shot available, so it gives the defender the most time and you the least — and it drags your partner away from the net just when you need her there.', 'He has time. He drives it flat into the space she left, and now you are defending.', { x: 5.30, y: 9.60 }),
    'smash|*':     g(1, 'A smash has to land in the back two-thirds of their court to be worth anything. Aimed near the net it is just a slow high shot that they step in and kill.', 'Killed at the net.', { x: 3.05, y: 8.60 }),
    'halfSmash|midR': g(2, 'Nothing wrong with it — steeper, safer, and you stay balanced. But they are fresh and set, and taking the pace off gives them time to hit it back flat at you.', 'Blocked back tight. Rally is level again.', { x: 4.80, y: 7.70 }),
    'halfSmash|seam': g(2, 'Good target, slightly soft choice. You were balanced and behind the shuttle, so you could afford full power into that gap.', 'Weak reply — but they had time to reach it.', { x: 3.05, y: 8.90 }),
    'halfSmash|*': g(2, 'Reasonable. The half smash is what you play when you are not quite set. Here you were set.', 'Rally continues, still roughly yours.', { x: 3.60, y: 8.80 }),
    'drop|netR':  g(2, 'A good shot at the wrong moment. A drop works once you have pulled them backwards — right now they have not moved at all, so they simply walk onto it.', 'She meets it early and pushes it past your partner.', { x: 4.60, y: 9.40 }),
    'drop|*':     g(1, 'Too early. You had a free attack from a balanced position and gave up the power before making them move even once.', 'They take it early at the net. You are defending now.', { x: 3.05, y: 9.40 }),
    'clear|*':    g(0, 'You were handed the attack and gave it straight back. From here, a high shot to their back court means they are the ones hitting down for the rest of the rally.', 'They do not lift — they smash. You are the ones split and defending.', { x: 4.20, y: 9.50 }),
  },
},
{
  id: 'a2', chapter: 'set-defence',
  title: 'Stuck in the back corner',
  brief: 'The lift went over your backhand shoulder into the back corner on your left. You are reaching up for it while still moving backwards, not properly behind the shuttle. They are spread out and balanced.',
  you: { x: 1.60, y: 12.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.90, y: 3.35, hand: 'R' }, { x: 4.25, y: 3.35, hand: 'R' } ],
  contact: { x: 1.45, y: 12.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'), z('rearL'), z('rearMid') ],
  best: 'halfSmash|midL',
  key: 'Your feet decide your shot. Stuck in a back corner and off balance, the half smash keeps you attacking — the full smash gives the attack away.',
  grades: {
    'halfSmash|midL': g(3, 'Target {midL} is straight down the same side you are standing on, at about three-quarter power. It is the shortest distance from where you are, it costs you the least time to recover, and it keeps the shuttle travelling downwards. You keep the attack instead of gambling it.', 'Blocked back. You are already moving in — attack kept.', { x: 1.30, y: 8.20 }),
    'halfSmash|seam': g(2, 'Fine target, but from a corner the middle is a longer, flatter shot than the straight one. It arrives slower, which is exactly what you cannot afford when you are off balance.', 'He reads it and drives it flat past you.', { x: 4.60, y: 10.20 }),
    'halfSmash|*':   g(2, 'The right kind of shot from a back corner. Aim it tighter and it becomes the best one.', 'Rally continues, roughly even.', { x: 2.60, y: 9.00 }),
    'smash|*':       g(1, 'From this far back and still moving, a full smash arrives slow and flat. It is exactly the ball a set defence is hoping for — and you have no time left to recover for the reply.', 'Driven back through the middle. You never got back into position.', { x: 3.40, y: 10.60 }),
    'drop|netL':     g(2, 'A drop straight down your own side is playable and keeps the shuttle low — but it travels slowly, and their front-court player is already looking for it.', 'She takes it early and plays it tight. Level at best.', { x: 1.40, y: 8.00 }),
    'drop|*':        g(1, 'Slow shot, long distance, plenty of time for them to step in. A drop played diagonally from a corner gets intercepted.', 'Intercepted early and pushed into your open court.', { x: 4.80, y: 9.60 }),
    'clear|rearL':   g(2, 'Not glamorous, but honest. When your feet have lost the rally, a high shot deep into target {rearL} buys you the seconds to get balanced again.', 'They attack — but you are set and properly spread out for it.', { x: 1.20, y: 10.40 }),
    'clear|*':       g(1, 'You survive, but a short or central high shot just invites a better smash than the one you were trying to avoid.', 'They step under it and smash steeply into your middle.', { x: 3.05, y: 10.00 }),
  },
},
{
  id: 'a3', chapter: 'set-defence',
  title: 'They have closed the middle',
  brief: 'The same attacking position, but these two have played you before. They have moved closer together and are both guarding the middle, daring you to hit the gap.',
  you: { x: 4.20, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 2.35, y: 3.30, hand: 'R' }, { x: 3.80, y: 3.30, hand: 'R' } ],
  contact: { x: 4.25, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearR'),
           { id: 'bodyR', label: 'Jam the near player’s racket hand', bodyOf: 1 } ],
  best: 'smash|midR',
  key: 'Hit where they are not. The middle is not a magic target — it is just usually the biggest space. When they close it, the sidelines open up.',
  grades: {
    'smash|midR': g(3, 'They have bought the middle by giving up the sides. Target {midR} is the sideline nearest you: the shortest shot from where you are standing, it beats him on the outside, and your partner is already covering the straight reply.', 'He is stretched wide. The reply floats up and your partner finishes it.', { x: 4.20, y: 8.40 }),
    'halfSmash|midR': g(3, 'Same read, safer execution. Into the open sideline, steep, and you stay balanced for whatever comes back. Against two players standing close together this is the percentage shot.', 'Stretched reply, floated back. Attack kept.', { x: 4.10, y: 8.60 }),
    'smash|midL': g(2, 'Target {midL} really is open, so the read is right. But it is the longest shot on the court and it pulls your partner across the net. Play it as a surprise, not as your first choice.', 'He reaches it and blocks it back diagonally. Your partner is late.', { x: 0.90, y: 8.20 }),
    'smash|seam': g(1, 'Target {seam} is the one ball they have set themselves up to take. Two rackets are already pointing at it — you are hitting into the only place they have over-covered.', 'Intercepted and driven flat back through your middle.', { x: 3.05, y: 10.20 }),
    'smash|bodyR': g(2, 'Jamming still works, but when a defender shifts towards the middle their racket hip shifts with them — target {bodyR} has drifted into the area they are guarding.', 'Cramped, but he handles it. Neutral reply.', { x: 3.90, y: 8.00 }),
    'smash|*':   g(1, 'Wrong length for a smash. Short and central is the one place two players standing close together are perfectly placed.', 'Easy interception.', { x: 3.05, y: 9.00 }),
    'halfSmash|*': g(2, 'Sound choice of shot. Keep pushing it wider — their weakness today is the sidelines.', 'Rally continues, still yours.', { x: 3.60, y: 8.80 }),
    'drop|netR': g(2, 'Two players standing close together and deep are vulnerable near the net. Good idea — just make sure you have pushed them backwards first.', 'She scrambles it back tight. Even rally.', { x: 4.70, y: 8.00 }),
    'drop|*':   g(1, 'Slow and central, against two players already guarding the middle.', 'Taken early and pushed past your partner.', { x: 3.05, y: 9.20 }),
    'clear|*':  g(0, 'A free attack, given away.', 'Now you are the ones spread out and defending.', { x: 3.60, y: 9.80 }),
  },
},
{
  id: 'a4', chapter: 'set-defence',
  title: 'The third smash in a row',
  brief: 'You have smashed twice. Both came back — deep, controlled, under control. They are handling the pace well and have settled a step further back, used to the rhythm of your smash.',
  you: { x: 3.60, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 2.90, hand: 'R' }, { x: 4.20, y: 2.90, hand: 'R' } ],
  contact: { x: 3.65, y: 10.90 },
  shots: ['smash', 'halfSmash', 'slice', 'drop'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('netMid') ],
  best: 'slice|netL',
  key: 'The third smash is the one they are expecting. Change the speed, not the power — after two smashes, a drop is worth more than another smash.',
  grades: {
    'slice|netL': g(3, 'Same arm swing, completely different shuttle. They are standing deep and leaning back for power — a sliced drop into target {netL} is the shot their feet cannot answer.', 'She lunges and lifts it short. Your partner kills it.', { x: 2.20, y: 8.10 }),
    'slice|netR': g(3, 'Same idea into the other front corner. Players who have settled into a rhythm are beaten by the change of speed, not by more power.', 'Scrambled reply, short. Free attack for you.', { x: 4.10, y: 8.30 }),
    'slice|*': g(2, 'Changing the speed is the right idea. Aim it into one of the front corners rather than the middle and it becomes the best shot available.', 'Reached, but the reply is short. Attack kept.', { x: 3.05, y: 8.30 }),
    'drop|netL': g(2, 'Right instinct, less disguise. A plain drop shows itself earlier than a slice, so they get a step on it — but against players standing this deep it is still a good shot.', 'Reached, but the reply floats. Attack kept.', { x: 2.40, y: 8.40 }),
    'drop|*':   g(2, 'Correct kind of shot. Aim for the corners — a drop down the middle lets either of them take it comfortably.', 'Returned tight. Level.', { x: 3.05, y: 8.20 }),
    'smash|*':  g(1, 'The same ball a third time, from a position they have already solved twice. They are deeper and ready for it now — repetition is what makes a defence comfortable.', 'Blocked back calmly again. You run out of legs before they run out of defence.', { x: 3.05, y: 8.60 }),
    'halfSmash|*': g(2, 'Better than another full smash, because the angle is steeper and you stay fresh — but it is still power, against two players who have got used to power.', 'Controlled block. Even rally.', { x: 3.05, y: 8.50 }),
  },
},
{
  id: 'a5', chapter: 'set-defence',
  title: 'One of them moved',
  brief: 'They blocked, your partner played it tight, and the player on your left came forward to cover the exchange at the net. Her partner is still back. Then they lifted again — and she has not got back to her position.',
  you: { x: 3.90, y: 11.00 }, partner: { x: 3.30, y: 7.80 },
  opps: [ { x: 2.05, y: 5.00, hand: 'R' }, { x: 4.30, y: 3.30, hand: 'R' } ],
  contact: { x: 3.95, y: 10.80 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ { id: 'behindL', label: 'The space she left behind', x: 1.45, y: 2.10 },
           z('seam'), z('midR'), z('netR'), z('rearR'), z('rearL'),
           { id: 'bodyR', label: 'Jam the near player’s racket hand', bodyOf: 1 } ],
  best: 'smash|behindL',
  key: 'Hit where the player just left. The space is always behind whoever moved — and it stays open for exactly one shot.',
  grades: {
    'smash|behindL': g(3, 'Target {behindL} is the ground she has just vacated. She is committed forwards with her weight going the wrong way, and her partner cannot help — he is busy covering his own half.', 'Neither of them moves. Clean winner.', null),
    'smash|rearL': g(3, 'Same read — behind the player who came forward. Target {rearL} is a bit deeper than the space itself, so she gets a fraction more time, but she is still running backwards to reach it.', 'She scrambles it up short. Put away at the net.', { x: 2.40, y: 8.60 }),
    'smash|seam': g(2, 'Usually a good default. Today it is the one ball her partner is perfectly placed to take — he is the only one still in a proper defensive position, and target {seam} is on his side of the problem.', 'He covers it. Blocked back, rally continues.', { x: 3.30, y: 8.30 }),
    'smash|midR': g(1, 'You have smashed at the one player who is actually ready, and left the open space untouched. The opening was there and you did not take it.', 'Comfortable block from a balanced player.', { x: 4.40, y: 8.10 }),
    'smash|bodyR': g(1, 'Jamming works on a set defender, but you have chosen the set defender over the stranded one.', 'He handles it. Chance missed.', { x: 3.90, y: 8.40 }),
    'smash|*':  g(1, 'Off the open space. When a defence is broken the target picks itself — do not overthink it.', 'They get their shape back.', { x: 3.05, y: 8.80 }),
    'halfSmash|*': g(2, 'Any downward shot into the space she left is fine. Full power is better — she is short of time and you want to take the rest of it away.', 'Reached late, weak reply.', { x: 2.20, y: 8.70 }),
    'drop|*':   g(0, 'She is already at the front of the court. A drop plays the shuttle straight to where she is standing.', 'Killed at the net.', { x: 3.05, y: 9.60 }),
    'clear|*':  g(0, 'A broken defence, repaired for free.', 'They reset and you have lost the attack.', { x: 3.30, y: 9.80 }),
  },
},
{
  id: 'a6', chapter: 'set-defence',
  title: 'The lift that came up short',
  brief: 'Under pressure at the net they have lifted flat and short — it is only just past the front service line on your side. You can get above it and hit it early, from high up. They are still getting back into position.',
  you: { x: 3.40, y: 9.40 }, partner: { x: 3.05, y: 8.00 },
  opps: [ { x: 2.20, y: 4.20, hand: 'R' }, { x: 4.00, y: 3.80, hand: 'R' } ],
  contact: { x: 3.45, y: 9.20 },
  shots: ['smash', 'halfSmash', 'drop', 'drive'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearMid'),
           { id: 'bodyL', label: 'Jam the far player’s racket hand', bodyOf: 0 } ],
  best: 'smash|seam',
  key: 'A short lift is the free point in doubles. Take it early — how high you hit it from is what makes a smash steep, and the steeper it is, the less time anyone has.',
  grades: {
    'smash|seam': g(3, 'Early contact, high above the net, straight into target {seam} — and into two players who are still arriving. The angle does all the work: this is the steepest shot available to you in the whole game.', 'It lands between them before either is set. Point.', null),
    'smash|bodyL': g(3, 'Just as good. She is the one still travelling, and a steep ball into the hip on her racket side, while she is off balance, does not come back.', 'Jammed on the move. She cannot get the racket there.', null),
    'smash|midR': g(2, 'Solid and steep, but you have aimed at the player closest to being ready, and given the shuttle the extra distance out to the sideline.', 'He gets a racket on it. Short block back.', { x: 4.60, y: 8.00 }),
    'smash|*':   g(2, 'Take it early and hit down. Almost any downward shot is good from here — just keep it away from whichever of them is already set.', 'Weak reply, attack kept.', { x: 3.05, y: 8.40 }),
    'halfSmash|*': g(1, 'You were given a free ball above the net and took the pace off it. That is the one way to let two off-balance players back into the rally.', 'They recover in time and block it back tight.', { x: 3.05, y: 8.20 }),
    'drive|*':  g(1, 'Flat, when you had the height to hit down. A drive from above the net is a wasted angle.', 'Driven back flat through the middle. Level.', { x: 3.05, y: 9.80 }),
    'drop|*':   g(0, 'They are already coming forwards out of the lift. A drop meets them exactly where they are heading.', 'Killed at the net.', { x: 3.05, y: 9.60 }),
  },
},

/* ---------- Chapter 2: keeping the attack ---------- */
{
  id: 'b1', chapter: 'keep-attack',
  title: 'At the net: they blocked it tight',
  brief: 'You are the player at the net. Your partner smashed, they took the pace off it and dropped it just over the net on your right. You have got there early, but the shuttle is already below the top of the net.',
  you: { x: 4.40, y: 7.55 }, partner: { x: 3.80, y: 11.10 },
  opps: [ { x: 2.20, y: 3.60, hand: 'R' }, { x: 4.20, y: 4.10, hand: 'R' } ],
  contact: { x: 4.55, y: 7.35 },
  shots: ['netKill', 'netShot', 'push', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midL'), z('midR'), z('seam'), z('rearL') ],
  best: 'netShot|netR',
  key: 'Below the top of the net means play it tight. Above the top of the net means hit it down. And never lift when the attack is already yours.',
  grades: {
    'netShot|netR': g(3, 'Tight, straight, dropping just the other side into target {netR}. From below the net this is the only shot that keeps them underneath the shuttle — and if it is tight enough their only answer is to lift, which hands your partner another free smash.', 'She has to lift. Your partner smashes again, better placed.', { x: 4.60, y: 10.60 }),
    'netShot|netMid': g(2, 'Tight is right, down the middle is loose. Target {netMid} gives both of them a chance at it and narrows what your partner can do next.', 'Returned tight. Even exchange at the net.', { x: 3.60, y: 7.60 }),
    'netShot|netL': g(2, 'Playing it diagonally works, but from below the net it travels further and stays in the air longer — and that is the ball that gets killed.', 'She reaches it early and kills it.', null),
    'push|midL': g(2, 'A flat shot into target {midL} is a genuine alternative, especially if they are crowding the net expecting the tight one. Just make sure it is flat enough to pass over them.', 'Passes them. Rally stays yours, barely.', { x: 1.60, y: 9.40 }),
    'push|*':   g(2, 'Reasonable variation. It works when they are leaning forwards, not when they are set.', 'Returned. Level.', { x: 3.05, y: 9.60 }),
    'netKill|*': g(0, 'The shuttle is below the top of the net. There is no downward angle to hit — you either find the net or pop it up into two waiting rackets.', 'Into the net.', null),
    'lift|*':   g(0, 'You owned the attack and gave it to them. This is the single most common way club pairs lose a rally they were winning.', 'They are hitting down now. You are spread out and defending.', { x: 4.00, y: 10.20 }),
    'netShot|*': g(1, 'Right shot, wrong place. A net shot only works when it is tight and close to a sideline.', 'Loose. Killed.', null),
  },
},
{
  id: 'b2', chapter: 'keep-attack',
  title: 'At the net: they hit it flat at you',
  brief: 'You are the player at the net. Instead of taking the pace off, the defender has hit it back flat and hard straight at you, around shoulder height, trying to push you backwards and take over the attack.',
  you: { x: 3.60, y: 7.90 }, partner: { x: 3.90, y: 11.00 },
  opps: [ { x: 2.40, y: 3.80, hand: 'R' }, { x: 4.10, y: 3.90, hand: 'R' } ],
  contact: { x: 3.55, y: 7.70 },
  shots: ['drive', 'block', 'netShot', 'lift'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'), z('netMid'), z('rearR') ],
  best: 'drive|seam',
  key: 'Meet a flat shot in front of your body and punch it back flat into the middle. Whoever takes the flat exchange earlier wins it — and whoever steps backwards loses it.',
  grades: {
    'drive|seam': g(3, 'Take it early, in front of you, with a short punch into target {seam}. Flat into the middle is the answer to flat: it gives neither of them room to swing, and it keeps you standing at the net instead of retreating out of it.', 'They are jammed in the middle. The reply pops up and your partner takes it.', { x: 3.05, y: 9.20 }),
    'drive|midL': g(2, 'Hitting it away from the player who hit it is sound. Diagonally is the longer shot though, and in a flat exchange distance is time you are handing over.', 'Returned flat. Exchange continues, even.', { x: 1.80, y: 8.80 }),
    'drive|*':  g(2, 'Right answer — do not let a flat shot push you backwards. Tighten the target and it becomes the best answer.', 'Flat exchange continues.', { x: 3.05, y: 9.00 }),
    'block|netMid': g(2, 'Taking the pace off into the front court is playable if you were late to the shuttle. It is passive though — you had the chance to take the initiative and gave it to whoever reaches the net first.', 'She comes in and plays it tight. Level.', { x: 3.20, y: 7.70 }),
    'block|*':  g(1, 'Taking the pace off a fast flat shot usually means you were late. Loose ones from this position get killed.', 'Reached early and killed.', null),
    'netShot|*': g(1, 'A flat shot at shoulder height is too fast to turn into a tight net shot. You will either float it up or find the net.', 'Popped up. Killed.', null),
    'lift|*':   g(0, 'Retreating from a flat exchange gives them exactly what that shot was asking for.', 'They smash. You are defending.', { x: 3.60, y: 10.20 }),
  },
},
{
  id: 'b3', chapter: 'keep-attack', kind: 'position', zoneSide: 'own',
  title: 'Where do you stand while your partner smashes?',
  brief: 'Your partner has just smashed diagonally, from the back right of your court across to their left side. You are the player at the net. The shuttle has not come back yet — where should you be standing at the moment they reach it?',
  you: { x: 3.05, y: 7.90 }, partner: { x: 4.40, y: 11.00 },
  opps: [ { x: 1.90, y: 3.40, hand: 'R' }, { x: 4.20, y: 3.40, hand: 'R' } ],
  contact: { x: 3.05, y: 7.90 },
  incoming: { from: { x: 4.45, y: 10.80 }, to: { x: 1.90, y: 3.40 }, label: 'partner’s smash' },
  shots: ['move'],
  zones: [ { id: 'frontL', label: 'At the net, your left',  x: 1.85, y: 7.85 },
           { id: 'frontC', label: 'At the net, middle',     x: 3.05, y: 7.85 },
           { id: 'frontR', label: 'At the net, your right', x: 4.35, y: 7.85 },
           { id: 'midC',   label: 'Back off, middle of your court', x: 3.05, y: 9.70 },
           { id: 'deepC',  label: 'Behind the service line', x: 3.05, y: 10.40 } ],
  best: 'move|frontL',
  key: 'The net player follows the line of the smash. The most likely reply to any smash is a block straight back down the same line — so stand on that line before it is played.',
  grades: {
    'move|frontL': g(3, 'The smash went to their left, so the straight reply comes back down your left. Position {frontL} puts you on the most likely shot before it is even played, and that is the difference between a net player who intercepts and one who chases.', 'The block comes back straight. You are already there — killed.', null),
    'move|frontC': g(2, 'Position {frontC} is not wrong, it is just average. You can reach both replies late instead of one of them early, and arriving early is the entire point of being at the net.', 'You reach the block, but only just. Tight reply, level.', { x: 1.90, y: 7.70 }),
    'move|frontR': g(0, 'You have followed your partner instead of the shuttle. The reply is coming back down the other side and neither of you is near it.', 'Blocked straight back. Untouched.', null),
    'move|midC':  g(1, 'Drifting backwards while your own partner attacks is the classic club mistake. It puts both of you in the middle of the court with nobody at the net, which is the one shape that cannot finish a rally.', 'The reply drops in front of you. Nobody can reach it.', null),
    'move|deepC': g(0, 'You have abandoned the front of the court entirely while your side is attacking.', 'A tight reply wins the rally without them having to hit hard.', null),
    'move|*':     g(1, 'Follow the line of the smash and stay at the net. Those two rules cover most of what a net player has to decide.', 'Late to the reply.', { x: 2.20, y: 8.20 }),
  },
},
{
  id: 'b4', chapter: 'keep-attack', kind: 'position', zoneSide: 'own',
  title: 'The lift came down the middle',
  brief: 'You are the player at the net. They have lifted high and deep straight down the middle of your court. Your partner is behind you and calls for it. Where do you go as he hits it?',
  you: { x: 3.05, y: 7.90 }, partner: { x: 3.30, y: 10.60 },
  opps: [ { x: 2.10, y: 3.40, hand: 'R' }, { x: 4.20, y: 3.40, hand: 'R' } ],
  contact: { x: 3.05, y: 7.90 },
  incoming: { from: { x: 3.05, y: 5.20 }, to: { x: 3.40, y: 11.60 }, label: 'their lift' },
  shots: ['move'],
  zones: [ { id: 'frontL', label: 'At the net, your left',  x: 2.00, y: 7.80 },
           { id: 'frontC', label: 'At the net, middle',     x: 3.05, y: 7.80 },
           { id: 'frontR', label: 'At the net, your right', x: 4.20, y: 7.80 },
           { id: 'midC',   label: 'Back off, middle of your court', x: 3.05, y: 9.80 },
           { id: 'sideL',  label: 'Spread out beside him, your left', x: 1.90, y: 9.60 } ],
  best: 'move|frontL',
  key: 'A lift down the middle is your partner’s ball. Your job is to stay at the net and shift towards the side his smash will travel down — not to help.',
  grades: {
    'move|frontL': g(3, 'He will take it on his forehand from the right, so his straight smash travels down your left. Position {frontL} keeps you tight to the net and standing on the reply before it is hit.', 'The straight block arrives in your racket. Killed.', null),
    'move|frontC': g(2, 'Holding the middle at the net is acceptable and never a disaster. But once you know which side he is hitting from, standing in the middle means covering both replies badly instead of one of them well.', 'You reach the block late but keep it alive.', { x: 2.10, y: 7.70 }),
    'move|frontR': g(1, 'You have moved to the same side the smash came from, rather than the side it is going to. The straight reply comes back down the other line.', 'It passes you. Your partner has to chase it.', { x: 2.00, y: 7.60 }),
    'move|midC':  g(1, 'Backing away because the shuttle went over your head is instinct, not tactics. It leaves the two of you in a line, which covers neither the width nor the front.', 'Tight reply in front of you. Nobody can get it.', null),
    'move|sideL': g(0, 'You have moved into a defensive shape while your own partner is about to attack. Now the net is empty and the one reply you are guaranteed to get is unguarded.', 'Blocked short. Uncontested winner.', null),
    'move|*':     g(1, 'Stay at the net, shift towards the side your partner’s smash will travel down.', 'Out of position for the reply.', { x: 2.60, y: 8.20 }),
  },
},

/* ---------- Chapter 3: defending the smash ---------- */
{
  id: 'c1', chapter: 'defence', kind: 'defence',
  title: 'The straight smash',
  brief: 'You lifted, you spread out, you are balanced. He has smashed from the back of his court on your right, straight down the line at you. Their other player is at the net in the middle. You have time to choose.',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.05, y: 5.60, hand: 'R' }, { x: 4.55, y: 1.80, hand: 'R' } ],
  contact: { x: 4.35, y: 9.20 },
  incoming: { from: { x: 4.55, y: 1.90 }, to: { x: 4.35, y: 9.20 }, label: 'smash' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midR'), z('midL'), z('seam'), z('rearL'), z('rearR') ],
  best: 'block|netR',
  key: 'The best defensive shot is whichever one stops them hitting down at you. Either take the pace off it straight back into target {netR}, or push it flat into the space behind their net player.',
  grades: {
    'block|netR': g(3, 'Shortest distance, least that can go wrong. Take the pace off and drop it into target {netR}, and if it is tight they cannot hit down off it. This is the backbone of doubles defence — everything else is a variation you play once they start reading it.', 'Their net player has to play it tight or lift. You follow it in and the rally is turning.', { x: 4.90, y: 5.90 }),
    'push|midL': g(3, 'The answer the good players use. They have one player at the net and one at the back, so the space behind their net player is the biggest empty area on their court. A flat shot into target {midL} either wins the rally outright or forces a lift — and it breaks their shape rather than just surviving it.', 'It passes over her head and lands behind her. The smasher has to scramble across.', { x: 1.20, y: 3.40 }),
    'push|midR': g(2, 'Same idea, harder to pull off — target {midR} is on the side the smasher is already recovering into. It works, but you have given him the shortest route to it.', 'He covers it and attacks again.', { x: 4.60, y: 9.60 }),
    'push|*': g(2, 'Pushing it flat is a strong idea against a front-and-back attack — it just has to be flat, and it has to land behind their net player rather than on her.', 'She reaches it. Level exchange at the net.', { x: 3.05, y: 6.40 }),
    'block|netL': g(1, 'Target {netL} means playing it diagonally across the net, which is the most intercepted shot in doubles. It travels slowly through exactly the area their net player is standing in, and she is looking for it.', 'Killed at the net.', null),
    'drive|*':  g(1, 'Against a full smash from the back of the court, the shuttle is dropping too steeply to hit back flat. You will make contact below the top of the net and float it up into two rackets.', 'Popped up. Put away.', null),
    'lift|rearL': g(2, 'A high shot deep into target {rearL} is a legitimate reset — it moves the smasher the full width of the court and buys you time to get balanced. But you are still defending, so it is the shot for when you are stretched, not your first choice when you are set.', 'He gets there and smashes again. You are still defending.', { x: 3.05, y: 9.40 }),
    'lift|*':   g(1, 'Lifting short or down the middle from a balanced position just gives him a better smash than the one you have survived.', 'Steeper smash, harder to defend.', { x: 4.10, y: 9.60 }),
    'block|*': g(2, 'Taking the pace off is the right idea here. Keep it tight and keep it straight.', 'Returned tight. Rally continues.', { x: 3.40, y: 6.20 }),
  },
},
{
  id: 'c2', chapter: 'defence', kind: 'defence',
  title: 'Smashed straight at your body',
  brief: 'He has smashed at your body — steep, fast, and aimed at your right hip. You are right-handed. There is no room to take a full swing and the shuttle is already on you.',
  you: { x: 3.70, y: 9.20 }, partner: { x: 1.70, y: 9.30 },
  opps: [ { x: 3.00, y: 5.50, hand: 'R' }, { x: 4.00, y: 1.90, hand: 'R' } ],
  contact: { x: 3.60, y: 9.10 },
  incoming: { from: { x: 4.00, y: 2.00 }, to: { x: 3.60, y: 9.10 }, label: 'smash at your body' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midR'), z('midL'), z('rearL') ],
  best: 'block|netR',
  key: 'Racket up and in front, thumb behind the grip, and take a body smash on the backhand side. Short punch, no swing — a jammed player who tries to swing is a player who pops it up.',
  grades: {
    'block|netR': g(3, 'Turn the racket in front of you, thumb behind the grip, and punch it short into target {netR}. Taking it on the backhand side gives you the only compact swing available, and straight is the shortest and safest place to put it.', 'Blocked short. They have to play it up. You are back in the rally.', { x: 4.40, y: 6.00 }),
    'block|netL': g(1, 'Jammed like this you have no racket speed for a diagonal shot. It will float, and it floats right through their net player’s area.', 'Killed at the net.', null),
    'block|netMid': g(2, 'Surviving it is most of the job here. Target {netMid} is a little loose — their net player can cover it — but getting it down at all from a jammed position is an acceptable outcome.', 'She takes it tight. Level exchange at the net.', { x: 3.05, y: 6.20 }),
    'push|midL': g(2, 'Ambitious, and good if you get it away — but jammed at the hip you rarely have the racket speed to make it flat enough to clear their net player.', 'It floats up. She intercepts it.', null),
    'drive|*':  g(0, 'There is no room to swing. This is the shot that turns a body smash into a winner for them — the racket comes back late, the face opens, and the shuttle goes straight up.', 'Popped up and put away.', null),
    'lift|rearL': g(2, 'Under real pressure a deep high shot is an honest escape. You are still defending, but you have survived the ball that was meant to end the rally.', 'Another smash, but you are set for it now.', { x: 3.05, y: 9.50 }),
    'lift|*':   g(1, 'A short lift out of trouble is the worst of both — you keep defending and you make their next smash steeper.', 'Steeper smash. Harder.', { x: 3.30, y: 9.60 }),
    'push|*':   g(1, 'Too much to ask from a cramped position. Keep it simple until you have room.', 'Loose. Intercepted.', null),
    'block|*': g(2, 'Taking the pace off is the only realistic option from a jammed position. Keep it short and keep it straight.', 'Survived. Rally continues.', { x: 3.60, y: 6.30 }),
  },
},
{
  id: 'c3', chapter: 'defence', kind: 'defence',
  title: 'A slow smash from way back',
  brief: 'He has smashed from very deep, almost off his own baseline. It has come through flat rather than steep, and it is arriving at about waist height with the pace gone off it. Their net player is tight to the net.',
  you: { x: 4.10, y: 9.20 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.05, y: 5.40, hand: 'R' }, { x: 4.40, y: 0.90, hand: 'R' } ],
  contact: { x: 4.15, y: 9.00 },
  incoming: { from: { x: 4.40, y: 1.00 }, to: { x: 4.15, y: 9.00 }, label: 'slow flat smash' },
  shots: ['drive', 'block', 'push', 'lift'],
  zones: [ z('midR'), z('midL'), z('seam'), z('netR'), z('netL'), z('rearL') ],
  best: 'drive|midR',
  key: 'A slow, flat smash from the baseline is a gift. Hit it back flat down the same line and the roles have swapped — you are the ones attacking now.',
  grades: {
    'drive|midR': g(3, 'You have time and height, so attack. Flat into target {midR} passes their net player before she can react and lands behind her, which forces the smasher to take it moving backwards. One shot and you have taken the attack.', 'He is driven back. Weak lift — now you are the ones smashing.', { x: 4.60, y: 3.20 }),
    'drive|seam': g(2, 'Flat through the middle is a good counter and hard to intercept, but down the line is quicker to the empty space and gets past the net player sooner.', 'Driven back. Flat exchange, roughly even.', { x: 3.05, y: 9.40 }),
    'drive|midL': g(2, 'Target {midL} is a good surprise, but it is the longest shot and it passes within their net player’s reach. Save it for when they start over-covering the line.', 'She gets a racket to it. Scrambled.', { x: 2.40, y: 8.60 }),
    'push|midR': g(2, 'A push does much the same job as a drive but with less pace. Against a slow ball you can afford to be more aggressive.', 'Passes the net player. Level to good.', { x: 4.70, y: 3.60 }),
    'block|*':  g(1, 'Taking the pace off a slow smash hands the attack straight back to a pair who just played a weak one. Their net player is tight to the net waiting for exactly this.', 'She kills the loose reply.', null),
    'lift|*':   g(0, 'Lifting off a slow smash rewards a bad shot. They get to start their attack again, this time from a comfortable position.', 'A proper smash this time. You are defending again.', { x: 3.60, y: 9.60 }),
    'push|*':   g(2, 'Right instinct — keep it flat and low, and make sure it clears their net player.', 'Passes her. Rally is level.', { x: 3.05, y: 3.80 }),
    'drive|*':  g(2, 'Attacking is the right answer to a slow smash. Keep it flat and get it past their net player.', 'Driven back. Rally is level.', { x: 3.60, y: 3.60 }),
  },
},
{
  id: 'c4', chapter: 'defence', kind: 'defence',
  title: 'Their net player is crowding',
  brief: 'Their net player is standing almost on top of the net, leaning in, killing anything loose. He has smashed straight at you again and she is already creeping forward for the reply.',
  you: { x: 4.20, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.20, y: 6.15, hand: 'R' }, { x: 4.45, y: 1.70, hand: 'R' } ],
  contact: { x: 4.25, y: 9.15 },
  incoming: { from: { x: 4.45, y: 1.80 }, to: { x: 4.25, y: 9.15 }, label: 'smash' },
  shots: ['push', 'block', 'drive', 'lift'],
  zones: [ z('midL'), z('midR'), z('seam'), z('netR'), z('netL'), z('rearL'), z('rearR') ],
  best: 'push|midL',
  key: 'A net player who crowds the net has given up everything behind her. Push it flat over her shoulder — and she will stop crowding.',
  grades: {
    'push|midL': g(3, 'She has bought the net by giving up the space behind her. A flat shot over her shoulder into target {midL} lands in the biggest hole on the court, and the smasher is on the wrong side to cover it.', 'It lands behind her. He cannot get across. Point.', null),
    'push|midR': g(3, 'The same hole, on the near side. Slightly easier to play and the smasher is closer to it — but he is still recovering from his own smash, so it is a genuine winner more often than not.', 'He scrambles it back high. You are attacking now.', { x: 4.80, y: 3.40 }),
    'block|netR': g(1, 'Normally the best shot in defence — but not against someone standing on top of the net. You are playing the shuttle into the exact spot she has chosen to own.', 'Killed. That is why she stands there.', null),
    'block|*':  g(1, 'Anything soft near the net feeds a crowding net player. Change the length before you change anything else.', 'Killed at the net.', null),
    'drive|*':  g(1, 'Off a steep smash you do not have the height to hit back flat, and a low flat shot goes straight into her racket at head height.', 'Intercepted.', null),
    'lift|rearL': g(2, 'A deep high shot is safe and moves him the full width. It does not punish her position, but it does not lose the rally either.', 'He smashes again. Still defending.', { x: 3.20, y: 9.50 }),
    'lift|*':   g(1, 'Short lifts give a set attacker a steeper smash. If you are going to lift, make it deep and make it diagonal.', 'Steeper smash. Harder to defend.', { x: 4.00, y: 9.60 }),
    'push|*':   g(2, 'Right shot. Get it flatter and further from her reach and it becomes a winner.', 'Just about passes her. Level.', { x: 3.05, y: 4.00 }),
  },
},
{
  id: 'c5', chapter: 'defence', kind: 'defence',
  title: 'Steep, fast and right on you',
  brief: 'He has jumped and smashed from well inside his own half, a long way forward of the baseline — very steep, very fast, and on you almost immediately. You are barely set. There is no time for anything clever.',
  you: { x: 4.00, y: 9.40 }, partner: { x: 1.80, y: 9.30 },
  opps: [ { x: 2.80, y: 5.70, hand: 'R' }, { x: 4.10, y: 3.40, hand: 'R' } ],
  contact: { x: 4.05, y: 9.30 },
  incoming: { from: { x: 4.10, y: 3.50 }, to: { x: 4.05, y: 9.30 }, label: 'steep jump smash' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midL'), z('midR'), z('rearL') ],
  best: 'block|netR',
  key: 'Against a steep, fast smash there is one shot: absorb it and put it down. Choosing anything else is choosing to pop it up.',
  grades: {
    'block|netR': g(3, 'Racket in front, soft hands, let the shuttle do the work into target {netR}. Straight is the shortest and needs the least racket speed — which is all you have. Surviving this ball at all is a win.', 'Tight. She has to play it up. Rally alive.', { x: 4.50, y: 5.95 }),
    'block|netMid': g(2, 'Survival, slightly loose. Target {netMid} is reachable by both of them, but against this ball getting it down at all is most of the job.', 'Returned tight. Still defending.', { x: 3.05, y: 6.10 }),
    'block|netL': g(1, 'Playing it diagonally needs racket speed you do not have off a ball this steep. It will sit up on the way across.', 'Intercepted and killed.', null),
    'block|*': g(2, 'Taking the pace off is the only shot here. Straight and tight is the version that keeps you in the rally.', 'Returned. Still defending, but alive.', { x: 3.60, y: 6.20 }),
    'push|*':   g(1, 'A push needs a firm, flat contact. Off a smash arriving this fast, firm contact sends the shuttle up, not flat.', 'Floated. Put away.', null),
    'drive|*':  g(0, 'The shuttle is coming down at you from above. There is nothing to hit flat — the racket face has to open just to reach it, and it goes straight up.', 'Popped up. Point to them.', null),
    'lift|*':   g(1, 'If you can get a lift away from here, fine — but you almost certainly cannot get it deep enough, and a short one from this position is fatal.', 'Short lift. An even steeper smash.', { x: 3.80, y: 9.70 }),
  },
},

/* ---------- Chapter 4: where to stand ---------- */
{
  id: 'd1', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'Your partner has just lifted',
  brief: 'You were the player at the back. Your partner, at the net on your left, has just been forced to lift from the front left corner. He is backing away down that side. They are about to attack. Where do you go?',
  you: { x: 3.30, y: 10.80 }, partner: { x: 1.70, y: 8.20 },
  opps: [ { x: 2.60, y: 4.60, hand: 'R' }, { x: 1.90, y: 2.20, hand: 'R' } ],
  contact: { x: 3.30, y: 10.80 },
  incoming: { from: { x: 1.60, y: 7.80 }, to: { x: 1.90, y: 2.10 }, label: 'partner’s lift' },
  shots: ['move'],
  zones: [ { id: 'defR',   label: 'Level with him, your right', x: 4.30, y: 9.40 },
           { id: 'defL',   label: 'Level with him, your left',  x: 1.80, y: 9.40 },
           { id: 'rearC',  label: 'Back, middle',               x: 3.05, y: 11.20 },
           { id: 'netC',   label: 'Forward, at the net',        x: 3.05, y: 7.90 },
           { id: 'midC',   label: 'Middle of your court',       x: 3.05, y: 9.50 } ],
  best: 'move|defR',
  key: 'Lift, leave the net, spread out. Whoever lifted takes their own side; the partner takes the other. It is a shared habit both of you run at the same moment, not a rotation to memorise.',
  grades: {
    'move|defR': g(3, 'He lifted from the left, so the left is his. Position {defR} takes the other side. Between the two of you, you now cover the full width of the court, and whichever side they smash to, someone is already standing there.', 'They smash. Whichever side it goes, one of you is balanced and on it.', null),
    'move|defL': g(2, 'The right instinct — spread out — but you have taken the side your partner is already backing into. You will both be defending the same half.', 'They smash diagonally. Nobody is there.', null),
    'move|rearC': g(1, 'One in front of the other is an attacking shape. Against two players about to hit down at you, a line cannot cover the width — the smash goes to whichever sideline you are not on, and that is both of them.', 'Smashed into the open side. Neither of you moves.', null),
    'move|midC': g(1, 'Standing in the middle feels safe and covers nothing. A smash to either sideline beats a player in the middle, and your partner is on the same line as you.', 'Smashed wide. Out of reach.', null),
    'move|netC': g(0, 'You have moved towards the net while the opponents are about to hit downwards at you. This is the worst place on the court to be standing.', 'Smashed at your feet.', null),
    'move|*':   g(1, 'Spread out level with each other. Whoever lifted takes their own side, you take the other.', 'Caught out of shape.', null),
  },
},
{
  id: 'd2', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'Be there before he hits it',
  brief: 'You lifted from the front and you are still travelling backwards. He is under the shuttle at the back of his court with the racket already going up. Where do you need to be at the exact moment his racket meets the shuttle?',
  you: { x: 3.60, y: 8.60 }, partner: { x: 1.85, y: 9.40 },
  opps: [ { x: 2.60, y: 5.30, hand: 'R' }, { x: 4.30, y: 1.60, hand: 'R' } ],
  contact: { x: 3.60, y: 8.60 },
  incoming: { from: { x: 3.60, y: 8.00 }, to: { x: 4.30, y: 1.60 }, label: 'your lift' },
  shots: ['move'],
  zones: [ { id: 'slotR',  label: 'Your right, a metre behind the service line', x: 4.30, y: 9.40 },
           { id: 'deepR',  label: 'Your right, but deeper',       x: 4.45, y: 10.60 },
           { id: 'shallowR', label: 'Your right, closer to the net', x: 4.20, y: 8.50 },
           { id: 'midC',   label: 'Middle of your court',         x: 3.05, y: 9.50 },
           { id: 'slotL',  label: 'Your left, beside your partner', x: 1.85, y: 9.40 } ],
  best: 'move|slotR',
  key: 'Be balanced before their racket hits the shuttle. Late and still moving means you reach for it; early and standing still means you choose what to do with it.',
  grades: {
    'move|slotR': g(3, 'Your partner has the left, so the right is yours — position {slotR}, roughly level with him and about a metre behind the front service line. But the real point is not the spot: it is arriving there stopped, feet split, racket up, before he makes contact.', 'You are set. The smash comes and you have a choice of replies.', null),
    'move|deepR': g(2, 'Too deep. You will cover a deep smash comfortably, but a steep one drops in front of you, and anything you do reach you are hitting from below — which means lifting again.', 'The steep smash lands short of you. Scrambled.', null),
    'move|shallowR': g(1, 'Too close to the net to defend from. A smash past your shoulder is unreachable, and anything aimed at you arrives before you can move.', 'Smashed past you.', null),
    'move|midC': g(1, 'The middle is not a defensive position when your partner already has the left — you have doubled up on his half and left your own sideline empty.', 'Smashed down your line. Untouched.', null),
    'move|slotL': g(0, 'Both of you on the same side. The entire right half of the court is open.', 'Smashed into the open half.', null),
    'move|*':   g(1, 'Take the side your partner has not taken, about a metre behind the front service line, and be standing still before he hits it.', 'Caught moving.', null),
  },
},
{
  id: 'd3', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'You defended well — now what?',
  brief: 'You took the pace off their smash and dropped it tight into their front right corner. It is a good one — they will have to lift it or play it tight. Where do you move as they reach it?',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 4.60, y: 5.90, hand: 'R' }, { x: 4.20, y: 2.60, hand: 'R' } ],
  contact: { x: 4.30, y: 9.30 },
  incoming: { from: { x: 4.30, y: 9.20 }, to: { x: 4.85, y: 6.00 }, label: 'your reply' },
  shots: ['move'],
  zones: [ { id: 'netR',  label: 'Forward to the net, your right', x: 4.20, y: 7.85 },
           { id: 'netC',  label: 'Forward to the net, middle',     x: 3.05, y: 7.85 },
           { id: 'stay',  label: 'Stay where you are',             x: 4.30, y: 9.30 },
           { id: 'midC',  label: 'Middle of your court',           x: 3.05, y: 9.50 },
           { id: 'rearC', label: 'Back, middle',                   x: 3.05, y: 11.00 } ],
  best: 'move|netR',
  key: 'A good defensive shot is an invitation to attack. Follow it forward — do not admire it from the middle of your court. Whoever played it takes the net; the partner slides in behind.',
  grades: {
    'move|netR': g(3, 'You played the shot, so the front of the court on that side is yours. Position {netR} turns a defensive shape into an attacking one in a single step — and if they lift, your partner is already behind you to smash it.', 'She lifts. Your partner smashes and you are at the net for the reply.', null),
    'move|netC': g(2, 'Coming forward is right; the middle is slightly greedy. Their tight reply will come back down the same line you played to, and you have drifted off it.', 'Tight reply down the line. You are late.', null),
    'move|stay': g(1, 'The shot did its job and you did not collect. Staying spread out means that when they play it tight, nobody is anywhere near it.', 'Tight net shot. You have to lift, and you are defending again.', null),
    'move|midC': g(1, 'Neither defending nor attacking. Against a tight reply, the middle of your own court is the one place you can do nothing useful from.', 'Tight reply. Forced to lift.', null),
    'move|rearC': g(0, 'You have retreated after winning the exchange, leaving the whole front of the court empty.', 'Any net shot wins the rally.', null),
    'move|*':   g(1, 'Follow it forward. Whoever plays the block takes the net.', 'Too slow to convert.', null),
  },
},
{
  id: 'd4', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'Your lift came up short',
  brief: 'You meant to lift it to their baseline. It came off flat and landed around the middle of their court instead. He is stepping under it early and is going to jump. Your partner has taken the left. Where do you stand?',
  you: { x: 3.40, y: 9.10 }, partner: { x: 1.85, y: 9.40 },
  opps: [ { x: 2.70, y: 5.60, hand: 'R' }, { x: 4.20, y: 3.20, hand: 'R' } ],
  contact: { x: 3.40, y: 9.10 },
  incoming: { from: { x: 3.40, y: 8.40 }, to: { x: 4.20, y: 3.20 }, label: 'your short lift' },
  shots: ['move'],
  zones: [ { id: 'deepR',   label: 'Your right, half a step deeper', x: 4.40, y: 10.20 },
           { id: 'slotR',   label: 'Your right, normal position',    x: 4.30, y: 9.40 },
           { id: 'closeR',  label: 'Your right, further forward',    x: 4.20, y: 8.40 },
           { id: 'midC',    label: 'Middle of your court',           x: 3.05, y: 9.60 },
           { id: 'rearR',   label: 'Right back near your baseline',  x: 4.40, y: 11.80 } ],
  best: 'move|deepR',
  key: 'A short lift means a steeper, faster smash. Give yourself room — half a step back buys you the whole reply.',
  grades: {
    'move|deepR': g(3, 'He is hitting it from further forward and higher up, so the smash will be steeper and arrive sooner. Position {deepR} — half a step deeper than normal — gives you the extra fraction of time to get the racket in front of it, and keeps a steep ball in front of you rather than on top of you.', 'The smash is steep but it lands in front of you. You block it back.', { x: 4.50, y: 6.00 }),
    'move|slotR': g(2, 'The standard position is not a disaster, but it is set up for a smash from the baseline. This one is coming from three metres closer and much steeper.', 'It arrives before you are ready. Scrambled reply.', null),
    'move|closeR': g(0, 'Moving forward against a steep smash played from that far up the court puts you directly underneath it, with no time and no angle.', 'Smashed at your feet.', null),
    'move|midC': g(1, 'The middle, with your partner already on the left. Your own sideline is open and this smash has enough angle to find it.', 'Steep smash down your line.', null),
    'move|rearR': g(1, 'Too deep — you have over-corrected. A steep smash from the middle of the court will land well in front of you and you cannot come forward that fast.', 'It drops short of you. Untouched.', null),
    'move|*':   g(1, 'A short lift means step back, not forward.', 'Beaten for time.', null),
  },
},
{
  id: 'd5', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'The smash went to your partner',
  brief: 'You are the defender on the right. He has smashed diagonally across to your partner on the left. Your partner is about to play it. You are not involved in this shot — so what do you do?',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.80, y: 9.30 },
  opps: [ { x: 3.05, y: 5.70, hand: 'R' }, { x: 4.40, y: 1.70, hand: 'R' } ],
  contact: { x: 4.30, y: 9.30 },
  incoming: { from: { x: 4.40, y: 1.80 }, to: { x: 1.75, y: 9.20 }, label: 'smash across court' },
  shots: ['move'],
  zones: [ { id: 'shiftC', label: 'Slide across towards the middle', x: 2.95, y: 9.20 },
           { id: 'stay',   label: 'Hold your position',              x: 4.30, y: 9.30 },
           { id: 'netR',   label: 'Move forward to the net',         x: 4.20, y: 7.90 },
           { id: 'wideR',  label: 'Cover your own sideline',         x: 5.20, y: 9.30 },
           { id: 'deepC',  label: 'Drop back towards the middle',    x: 3.05, y: 10.60 } ],
  best: 'move|shiftC',
  key: 'Standing side-by-side does not mean standing still. Both of you slide towards the shuttle — the pair moves as one, and the gap between you never opens.',
  grades: {
    'move|shiftC': g(3, 'The shuttle has gone left, so the whole pair shifts left. Position {shiftC} covers the middle instead of a sideline you no longer need, and whatever comes back through the centre — the flat reply, the interception — is yours.', 'Their net player intercepts and drives it through the middle. You are standing there.', { x: 3.00, y: 9.20 }),
    'move|stay': g(1, 'Staying put opens a metre and a half of empty court between you and your partner. A flat reply through the middle is the most common way pairs get beaten in defence, and this is how the gap gets made.', 'Driven through the middle between you.', null),
    'move|wideR': g(0, 'You have moved further from your partner while the shuttle moved further from you. The middle is now completely undefended.', 'Straight through the gap.', null),
    'move|netR': g(1, 'Coming forward while your side is still defending — your partner has not yet played a shot that gives you the attack.', 'Driven past you at chest height.', null),
    'move|deepC': g(2, 'Moving towards the middle is right; dropping back is unnecessary. The next shot out of an exchange like this is usually flat and fast, not deep.', 'Flat reply in front of you. Late.', null),
    'move|*':   g(1, 'Move with the shuttle. Both defenders slide together.', 'Gap opened in the middle.', null),
  },
},

/* ---------- Chapter 5: left-handers ---------- */
{
  id: 'e1', chapter: 'hands',
  title: 'A left-hander in front of you',
  brief: 'The same spread-out defence as before, with one difference: the player on your right is left-handed. Look at the white pips — they show which side each player’s racket is on. You are behind the shuttle at the back right, balanced and ready.',
  you: { x: 4.20, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.90, y: 3.35, hand: 'R' }, { x: 4.30, y: 3.35, hand: 'L' } ],
  contact: { x: 4.25, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'),
           { id: 'bodyR', label: 'Jam the left-hander’s racket hand', bodyOf: 1 },
           { id: 'bodyL', label: 'Jam the right-hander’s racket hand', bodyOf: 0 } ],
  best: 'smash|bodyR',
  key: 'Check the hands before you pick the target. A left-hander’s racket is on the other side of their body — the ball that jams a right-hander is the ball a left-hander enjoys.',
  grades: {
    'smash|bodyR': g(3, 'His racket hand is on the outside now, so the place he has no room to swing has moved out towards the sideline. Target {bodyR} puts him in the same trouble the right-hander had in the middle: nowhere to swing, and a decision he does not want to make.', 'Jammed on the outside. Weak reply — your partner finishes it.', { x: 4.80, y: 8.20 }),
    'smash|seam': g(1, 'Against a right-hander this was the free ball. Against this left-hander it is not — his forehand now covers the middle, so target {seam} is the strongest racket on the court.', 'Controlled forehand reply, tight. Now you are under pressure.', { x: 4.60, y: 7.80 }),
    'smash|midR': g(2, 'The sideline is a fair target and beats him on the outside. His racket is on that side though, so he reaches it more comfortably than a right-hander would.', 'Reached on the forehand. Blocked back.', { x: 4.70, y: 7.90 }),
    'smash|bodyL': g(2, 'The right-hander on the other side still has her racket hand on the inside, so target {bodyL} is a genuine target — but it is the diagonal ball, the longest on the court, and she gets time you did not have to give.', 'She has time. Blocks it back across.', { x: 4.90, y: 8.60 }),
    'smash|midL': g(1, 'Smashing diagonally to the far sideline: longest distance, most time for her, and it drags your partner away from the net.', 'Driven back into the space she left.', { x: 5.20, y: 9.60 }),
    'smash|*':  g(1, 'Wrong length for a smash.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|*': g(2, 'Fine — just apply the same check of the hands. The target moves, the shot does not.', 'Rally continues.', { x: 3.60, y: 8.60 }),
    'drop|*':   g(1, 'Too early, and it does not use the thing that makes this pair different.', 'Taken at the net.', { x: 3.05, y: 9.20 }),
    'clear|*':  g(0, 'A free attack handed back.', 'They attack.', { x: 3.60, y: 9.80 }),
  },
},
{
  id: 'e2', chapter: 'hands',
  title: 'Two weak sides in the middle',
  brief: 'A mixed pair. The player on your left is right-handed; the one on your right is left-handed. Look at the white pips and work out where both of their rackets are pointing before you choose.',
  you: { x: 3.60, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 3.30, hand: 'R' }, { x: 4.25, y: 3.30, hand: 'L' } ],
  contact: { x: 3.65, y: 10.90 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'),
           { id: 'bodyL', label: 'Jam the right-hander’s racket hand', bodyOf: 0 },
           { id: 'bodyR', label: 'Jam the left-hander’s racket hand', bodyOf: 1 } ],
  best: 'smash|seam',
  key: 'Right-hander on your left, left-hander on your right: both rackets point away from the middle, so the gap between them is covered by two backhands. That is the softest target in doubles — take it every time.',
  grades: {
    'smash|seam': g(3, 'Both of their racket hands are on the outside of the court, which means the middle is guarded by two backhands and nobody’s strong side. A hard flat ball into target {seam} is the single best target this pair can offer you, and it is there for the whole rally.', 'Neither of them wants it. A weak backhand reply, straight to your partner.', { x: 3.20, y: 8.10 }),
    'smash|bodyL': g(2, 'Her racket hand is on the inside, so this ball drifts towards the middle anyway — a decent version of the right idea. Target {seam} is better, because it also creates the hesitation between them.', 'Jammed. Weak reply.', { x: 2.60, y: 8.40 }),
    'smash|bodyR': g(2, 'His racket hand is on the outside. A fine jamming target on its own, but you are attacking the outside when the middle is this pair’s structural weakness.', 'Cramped, but he handles it.', { x: 4.70, y: 8.20 }),
    'smash|midL': g(1, 'You have hit to her forehand side. Against a mixed pair like this the sidelines are the strong sides — that is the whole point of the shape.', 'Forehand reply. Comfortable.', { x: 1.40, y: 7.90 }),
    'smash|midR': g(1, 'His forehand side. The same mistake in the other direction.', 'Controlled forehand reply.', { x: 4.90, y: 7.90 }),
    'smash|*':  g(1, 'Wrong length. Power does not matter if the shuttle is not landing in the back two-thirds of their court.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|seam': g(3, 'The same read, and against two backhands you barely need full power — a steep three-quarter ball into target {seam} is enough to force a weak reply.', 'Backhand reply, floated. Killed at the net.', { x: 3.05, y: 8.30 }),
    'halfSmash|*': g(2, 'Right kind of shot. Put it down the middle and it becomes the best answer.', 'Rally continues.', { x: 3.05, y: 8.60 }),
    'drop|*':   g(1, 'They are balanced and you have a free structural weakness to attack. Use it.', 'Returned tight.', { x: 3.05, y: 9.00 }),
    'clear|*':  g(0, 'Handing back the attack against the one defensive shape you can pull apart.', 'They attack.', { x: 3.30, y: 9.80 }),
  },
},
{
  id: 'e3', chapter: 'hands',
  title: 'Two strong sides in the middle',
  brief: 'The same mixed pair, but they have swapped sides. The left-hander is now on your left and the right-hander on your right. Check the pips again before you choose.',
  you: { x: 3.50, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 3.30, hand: 'L' }, { x: 4.25, y: 3.30, hand: 'R' } ],
  contact: { x: 3.55, y: 10.90 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'),
           { id: 'bodyL', label: 'Jam the left-hander’s racket hand', bodyOf: 0 },
           { id: 'bodyR', label: 'Jam the right-hander’s racket hand', bodyOf: 1 } ],
  best: 'smash|midR',
  key: 'Left-hander on your left, right-hander on your right: both rackets point into the middle. Two forehands are guarding the gap — leave it alone and attack the sidelines.',
  grades: {
    'smash|midR': g(3, 'Both of their forehands cover the centre, which means the outsides are backhands and the sidelines are the weak targets. Target {midR} is the shortest of those from where you are standing.', 'Backhand reach, floated reply. Your partner takes it.', { x: 4.60, y: 8.20 }),
    'smash|midL': g(2, 'The correct read — attack the outsides — but target {midL} is the longest ball on the court and gives her time to get her backhand there properly.', 'She reaches it and blocks it back across.', { x: 1.40, y: 8.40 }),
    'smash|seam': g(0, 'The worst target available against this pair. You have hit into the one spot where two forehands overlap — and a controlled forehand reply from a set defender puts you under pressure immediately.', 'Tight forehand reply. Now you are lifting.', { x: 3.20, y: 7.80 }),
    'smash|bodyR': g(2, 'His racket hand is on the inside, towards the middle — the area this pair covers best. It still cramps him, but you are working in their strongest zone.', 'Jammed, but he blocks it.', { x: 3.90, y: 8.10 }),
    'smash|bodyL': g(2, 'Her racket hand is on the inside too. Same story: a real target, in the part of the court they defend best.', 'Cramped but handled.', { x: 2.30, y: 8.30 }),
    'smash|*':  g(1, 'Wrong length.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|midR': g(3, 'Same read, safer execution, and against a backhand reach on the outside you do not need full power to force a weak reply.', 'Floated backhand reply. Attack kept.', { x: 4.50, y: 8.40 }),
    'halfSmash|*': g(2, 'Right kind of shot — push it out towards the sidelines.', 'Rally continues.', { x: 3.05, y: 8.60 }),
    'drop|netR': g(2, 'The front corners are always available against a pair standing back in the middle of their court, and target {netR} is the shorter of the two.', 'Scrambled reply.', { x: 4.60, y: 8.10 }),
    'drop|*':   g(1, 'Too early and too central.', 'Taken comfortably.', { x: 3.05, y: 9.00 }),
    'clear|*':  g(0, 'A free attack handed back.', 'They attack.', { x: 3.30, y: 9.80 }),
  },
},
];

/* ============================================================
   Post-processing: resolve body targets, then number every target
   ============================================================ */
SCENARIOS.forEach((s) => {
  // a body target is a point on a person, so it depends on which hand they hold
  // the racket in. Facing you, a right-hander's racket side is on YOUR left.
  s.zones = s.zones.map((zone) => {
    if (zone.bodyOf === undefined) return zone;
    const o = s.opps[zone.bodyOf];
    // offset far enough that the numbered disc sits beside the player rather
    // than on top of them — the side is the tactical point, not the millimetre
    const dx = o.hand === 'R' ? -0.60 : 0.60;
    return Object.assign({}, zone, {
      x: o.x + dx, y: o.y + 0.70, isBody: true,
      ownerX: o.x, ownerY: o.y,   // drawn as a connector, so it is obvious whose hip it is
    });
  });

  // number them in reading order across the picture: top row first, then
  // left to right. The numbers are what the coaching text refers to, so the
  // player never has to work out whose left is whose.
  s.zones.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  s.zones.forEach((zone, i) => { zone.n = i + 1; });
});

/* ============================================================
   Left-handed view
   A left-handed player stands on the other side of their own shots, so the
   whole picture is reflected: every position, and every player's racket hand,
   flips together. Because it is a true reflection, every tactical
   relationship survives it — a defender's racket hip sits the same way
   relative to the middle, straight stays straight, across stays across.

   The consequence, stated plainly: opponents' handedness mirrors too, so
   where a right-hander is told "both right-handed", a left-hander is told
   "both left-handed". The decisions being trained are identical.
   ============================================================ */

/* Only these phrases are directional. "the right idea", "Right shot" and the
   like use "right" to mean correct and must never be touched, which is why
   this is a fixed list rather than a search for the word. Longer phrases come
   first so the alternation cannot match a prefix of one of them. */
const SIDE_SWAPS = [
  ['right-handers', 'left-handers'], ['Right-handers', 'Left-handers'],
  ['right-handed', 'left-handed'],   ['Right-handed', 'Left-handed'],
  ['right-hander', 'left-hander'],   ['Right-hander', 'Left-hander'],
  ['your right', 'your left'],       ['Your right', 'Your left'],
  ['YOUR right', 'YOUR left'],
  ['right hip', 'left hip'],         ['Right hip', 'Left hip'],
  ['back right', 'back left'],       ['front right', 'front left'],
  ['rear right', 'rear left'],       ['on the right', 'on the left'],
];

const SIDE_MAP = (function () {
  const m = {};
  SIDE_SWAPS.forEach((pair) => { m[pair[0]] = pair[1]; m[pair[1]] = pair[0]; });
  return m;
})();

const SIDE_RE = new RegExp(
  Object.keys(SIDE_MAP)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'), 'g');

/* One pass, so a phrase already swapped is never swapped back. */
function swapSides(text) {
  if (!text) return text;
  return String(text).replace(SIDE_RE, (m) => SIDE_MAP[m] || m);
}

function mirrorX(x) { return COURT.W - x; }
function mirrorPoint(p) { return p ? { x: mirrorX(p.x), y: p.y } : p; }

function mirrorScenario(scn) {
  const out = Object.assign({}, scn);
  out.mirrored = true;
  out.title = swapSides(scn.title);
  out.brief = swapSides(scn.brief);
  out.key = swapSides(scn.key);

  out.you = mirrorPoint(scn.you);
  out.partner = mirrorPoint(scn.partner);
  out.contact = mirrorPoint(scn.contact);
  out.opps = scn.opps.map((o) => ({ x: mirrorX(o.x), y: o.y, hand: o.hand === 'R' ? 'L' : 'R' }));

  if (scn.incoming) {
    out.incoming = Object.assign({}, scn.incoming, {
      from: mirrorPoint(scn.incoming.from),
      to: mirrorPoint(scn.incoming.to),
    });
  }

  out.zones = scn.zones.map((zn) => {
    const z2 = Object.assign({}, zn, { x: mirrorX(zn.x), label: swapSides(zn.label) });
    if (zn.ownerX !== undefined) z2.ownerX = mirrorX(zn.ownerX);
    return z2;
  });
  // reading order across the picture changes under reflection, so renumber
  out.zones.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  out.zones.forEach((zn, i) => { zn.n = i + 1; });

  out.grades = {};
  Object.keys(scn.grades).forEach((k) => {
    const g0 = scn.grades[k];
    out.grades[k] = {
      score: g0.score,
      why: swapSides(g0.why),
      outcome: swapSides(g0.outcome),
      reply: mirrorPoint(g0.reply),
    };
  });
  return out;
}

/* The one place the rest of the app asks for a scenario. */
function viewOf(scn, hand) {
  return hand === 'L' ? mirrorScenario(scn) : scn;
}

/* ---------- text with {zoneId} placeholders resolved to target numbers ---------- */
function fmt(text, scn) {
  if (!text) return '';
  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, id) => {
    const zone = scn.zones.find((zn) => zn.id === id);
    return zone ? String(zone.n) : whole;
  });
}

function zoneOf(scn, id) {
  return scn.zones.find((zn) => zn.id === id);
}

/* a target as the player sees it: "3 · the gap between them" */
function zoneName(scn, id) {
  const zone = zoneOf(scn, id);
  return zone ? zone.n + ' · ' + zone.label : id;
}

/* ---------- the grader ---------- */
function judge(scn, shotId, zoneId) {
  const G = scn.grades;
  const hit = G[shotId + '|' + zoneId] || G[shotId + '|*'] || {
    score: 1,
    why: 'Playable, but not one of the shots this position is asking for.',
    outcome: 'The rally goes on.',
    reply: null,
  };
  return {
    score: hit.score,
    why: fmt(hit.why, scn),
    outcome: fmt(hit.outcome, scn),
    reply: hit.reply,
    verdict: VERDICTS[hit.score],
    isBest: hit.score === 3,
  };
}

function bestAnswer(scn) {
  const [shotId, zoneId] = scn.best.split('|');
  return { shotId, zoneId, zone: zoneOf(scn, zoneId), grade: judge(scn, shotId, zoneId) };
}

function scenariosOf(chapterId) {
  return SCENARIOS.filter((s) => s.chapter === chapterId);
}

/* ---------- load-time checks, so content mistakes surface immediately ---------- */
(function validate() {
  const problems = [];
  SCENARIOS.forEach((s) => {
    const ids = s.zones.map((zn) => zn.id);

    s.shots.forEach((sh) => {
      const keys = Object.keys(s.grades).filter((k) => k.startsWith(sh + '|'));
      if (!keys.length) problems.push(s.id + ': no grades at all for shot "' + sh + '"');
      else if (!s.grades[sh + '|*'] && keys.length < s.zones.length) {
        problems.push(s.id + ': shot "' + sh + '" has no "|*" fallback, so some targets fall through');
      }
    });

    if (!s.grades[s.best]) problems.push(s.id + ': best answer "' + s.best + '" has no grade');

    // every {placeholder} must name a target that exists in this scenario
    const texts = [s.brief, s.key, s.title];
    Object.keys(s.grades).forEach((k) => {
      texts.push(s.grades[k].why, s.grades[k].outcome);
    });
    texts.forEach((t) => {
      if (!t) return;
      const found = t.match(/\{([A-Za-z][A-Za-z0-9]*)\}/g) || [];
      found.forEach((ph) => {
        const id = ph.slice(1, -1);
        if (ids.indexOf(id) === -1) problems.push(s.id + ': text refers to {' + id + '}, which is not a target here');
      });
    });

    // a grade key must name a real target too
    Object.keys(s.grades).forEach((k) => {
      const zoneId = k.split('|')[1];
      if (zoneId !== '*' && ids.indexOf(zoneId) === -1) {
        problems.push(s.id + ': grade key "' + k + '" names a target that does not exist');
      }
    });
  });

  if (problems.length) {
    console.warn('[tactics] ' + problems.length + ' content problem(s):');
    problems.forEach((p) => console.warn('  ' + p));
  }
})();
