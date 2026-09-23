/* ============================================================
   Badminton IQ — tactics model
   Court geometry, shot vocabulary, scenarios and the grader.
   All coordinates are in metres on a real doubles court.
     x: 0 .. 6.10   (0 = your left sideline, 6.10 = your right)
     y: 0 .. 13.40  (0 = opponents' baseline, 13.40 = your baseline)
     net at y = 6.70
   Everything is described from YOUR point of view, standing at
   the bottom of the picture looking at the net.
   ============================================================ */

const COURT = {
  W: 6.10,          // doubles width
  L: 13.40,         // full length
  NET: 6.70,        // net line
  SHORT_SVC: 1.98,  // short service line, from the net
  LONG_SVC: 0.76,   // doubles long service line, from the back
  SINGLES_IN: 0.46, // singles sideline inset
  MARGIN: 0.80,     // drawing margin outside the lines
};

/* ---------- shot vocabulary ---------- */
/* flight: 'steep' | 'flat' | 'soft' | 'lob' — drives the drawn arc */
const SHOTS = {
  smash:     { label: 'Smash',      flight: 'steep', hint: 'Full pace, downward.' },
  halfSmash: { label: 'Half smash', flight: 'steep', hint: 'Three-quarter pace, steeper, you stay balanced.' },
  slice:     { label: 'Slice',      flight: 'soft',  hint: 'Cut across it — looks like a smash, lands short.' },
  drop:      { label: 'Drop',       flight: 'soft',  hint: 'Soft, into the front court.' },
  drive:     { label: 'Drive',      flight: 'flat',  hint: 'Flat and fast, over the net at tape height.' },
  push:      { label: 'Push',       flight: 'flat',  hint: 'Firm, flat, into the mid-court.' },
  block:     { label: 'Block',      flight: 'soft',  hint: 'Absorb the pace, drop it into the front court.' },
  netShot:   { label: 'Net shot',   flight: 'soft',  hint: 'Tight, tumbling, over the tape.' },
  netKill:   { label: 'Kill',       flight: 'steep', hint: 'Punch it down from above the tape.' },
  lift:      { label: 'Lift',       flight: 'lob',   hint: 'High to the back — resets, but hands over the attack.' },
  clear:     { label: 'Clear',      flight: 'lob',   hint: 'High and deep from the rear court.' },
  move:      { label: 'Move here',  flight: 'none',  hint: 'Pick the position, not the shot.' },
};

const VERDICTS = [
  { name: 'Punished', cls: 'v0' },
  { name: 'Risky',    cls: 'v1' },
  { name: 'Solid',    cls: 'v2' },
  { name: 'Best',     cls: 'v3' },
];

/* ---------- shared target zones on the OPPONENTS' half ---------- */
const Z = {
  rearL:   { id: 'rearL',   label: 'Rear left corner',   x: 1.05, y: 0.95 },
  rearR:   { id: 'rearR',   label: 'Rear right corner',  x: 5.05, y: 0.95 },
  rearMid: { id: 'rearMid', label: 'Deep middle',        x: 3.05, y: 0.95 },
  midL:    { id: 'midL',    label: 'Left tramline',      x: 0.65, y: 3.30 },
  midR:    { id: 'midR',    label: 'Right tramline',     x: 5.45, y: 3.30 },
  seam:    { id: 'seam',    label: 'Middle seam',        x: 3.05, y: 3.30 },
  netL:    { id: 'netL',    label: 'Front left corner',  x: 0.95, y: 5.95 },
  netR:    { id: 'netR',    label: 'Front right corner', x: 5.15, y: 5.95 },
  netMid:  { id: 'netMid',  label: 'Front middle',       x: 3.05, y: 5.85 },
};
const z = (k, over) => Object.assign({}, Z[k], over || {});

/* grade helper: score 0-3, why it is that, what happens next */
const g = (score, why, outcome, reply) => ({ score, why, outcome, reply });

/* ============================================================
   CHAPTERS
   ============================================================ */
const CHAPTERS = [
  { id: 'set-defence', name: 'Breaking the set defence',
    blurb: 'They lifted, they split, they are waiting. Where does the shuttle go?' },
  { id: 'keep-attack', name: 'Keeping the attack',
    blurb: 'The front player’s job, and what to do when the first smash does not win it.' },
  { id: 'defence',     name: 'Defending the smash',
    blurb: 'Block, drive, push. One shot that stops them hitting down.' },
  { id: 'shape',       name: 'Shape and rotation',
    blurb: 'Where to stand. The half of doubles that decides the other half.' },
  { id: 'hands',       name: 'Reading the hands',
    blurb: 'Left-handers move every target on the court. Learn to check first.' },
];

/* ============================================================
   SCENARIOS
   ============================================================ */
const SCENARIOS = [

/* ---------- Chapter 1: breaking the set defence ---------- */
{
  id: 'a1', chapter: 'set-defence',
  title: 'The set defence',
  brief: 'They lifted high to your rear forehand. You are balanced behind it, your partner is at the net. They have split side-by-side, squared up, both covering their outside lanes. Both right-handed.',
  you: { x: 4.30, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.85, y: 3.35, hand: 'R' }, { x: 4.30, y: 3.35, hand: 'R' } ],
  contact: { x: 4.35, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearMid'),
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 },
           { id: 'bodyL', label: 'Left defender’s racket hip', bodyOf: 0 } ],
  best: 'smash|bodyR',
  key: 'Both defenders wide means the middle is open. And a right-hander’s racket hip sits on their inside — so the body smash and the seam are very nearly the same ball.',
  grades: {
    'smash|bodyR': g(3, 'The racket-side hip of a right-hander is on the inside of their body. Jamming it there cramps the swing, forces the forehand/backhand decision, and the reply comes back weak and high.', 'He fends it off short. Your partner kills it at the net.', { x: 3.60, y: 8.10 }),
    'smash|seam':  g(3, 'The classic answer. Both of them are covering their outside lanes, so the middle is the biggest gap — and a shuttle down the seam kills your angle problem and creates a moment of who-is-taking-it between them.', 'They hesitate, the reply is a loose lift. You smash again, better placed.', { x: 3.20, y: 9.80 }),
    'smash|midR':  g(2, 'A real option and better than the cross, but he is already standing wide on that side. You are hitting into his strength and giving him the easiest straight block.', 'He blocks it straight and tight. Your partner has to lift.', { x: 4.90, y: 7.60 }),
    'smash|midL':  g(1, 'The cross smash travels the furthest distance on the court, which gives the defender the most time and you the least. It also drags your front player out of position to cover a reply she can no longer reach.', 'He has time. Flat drive down your open side, and you are defending.', { x: 5.30, y: 9.60 }),
    'smash|*':     g(1, 'A smash has to land in the mid or rear court to be a smash. Aimed short, it is just a slow, high drop that they step in and kill.', 'Killed at the net.', { x: 3.05, y: 8.60 }),
    'halfSmash|midR': g(2, 'Nothing wrong with it — steeper, safer, and you stay balanced. But they are fresh and balanced too, and a half smash lets them counter-drive.', 'Blocked back tight. Rally continues, neutral.', { x: 4.80, y: 7.70 }),
    'halfSmash|seam': g(2, 'Good target, slightly soft choice. From a balanced position behind the shuttle you can afford full pace at that seam.', 'Weak reply, but they had time to reach it.', { x: 3.05, y: 8.90 }),
    'halfSmash|*': g(2, 'Reasonable — the half smash is the shot that keeps the attack alive when you are not quite set. Here you were set.', 'Rally continues, still roughly yours.', { x: 3.60, y: 8.80 }),
    'drop|netR':  g(2, 'A good shot at the wrong moment. The drop works after you have pulled them deep — right now they have not moved, so they walk onto it.', 'She meets it early and pushes it past your partner.', { x: 4.60, y: 9.40 }),
    'drop|*':     g(1, 'Too early. You had a free attack from a balanced position and gave up the pace before making them move once.', 'They take it early at the net. You are defending now.', { x: 3.05, y: 9.40 }),
    'clear|*':    g(0, 'You had the attack handed to you and gave it straight back. From here a clear means they are the ones hitting down for the rest of the rally.', 'They lift nothing — they smash. You are split and defending.', { x: 4.20, y: 9.50 }),
  },
},
{
  id: 'a2', chapter: 'set-defence',
  title: 'Deep in the backhand corner',
  brief: 'The lift went over your backhand shoulder into the rear corner. You are taking it round-the-head, still moving backwards, not fully behind it. They are split and balanced.',
  you: { x: 1.60, y: 12.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.90, y: 3.35, hand: 'R' }, { x: 4.25, y: 3.35, hand: 'R' } ],
  contact: { x: 1.45, y: 12.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'), z('rearL'), z('rearMid') ],
  best: 'halfSmash|midL',
  key: 'Your feet decide your shot. From a deep corner, off balance, the half smash keeps the attack — the full smash gives it away.',
  grades: {
    'halfSmash|midL': g(3, 'Straight, three-quarter pace, steep enough to stay a downward shot. It is the shortest distance from where you are, it costs you the least recovery time, and you keep the attack instead of gambling it.', 'Blocked back. You are already moving in — attack retained.', { x: 1.30, y: 8.20 }),
    'halfSmash|seam': g(2, 'Fine target, but from the corner the seam is a longer, flatter ball than the straight one. It arrives slower, which is exactly what you cannot afford from here.', 'He reads it and drives it flat past you.', { x: 4.60, y: 10.20 }),
    'halfSmash|*':   g(2, 'The right shot family from a deep corner. Placement could be tighter.', 'Rally continues, roughly even.', { x: 2.60, y: 9.00 }),
    'smash|*':       g(1, 'From this far back and still moving, a full smash arrives slow and flat. It is the exact ball a set defence is standing there hoping for — and you have no time to recover for the counter.', 'Counter-driven through the middle. You never got back.', { x: 3.40, y: 10.60 }),
    'drop|netL':     g(2, 'Straight drop from the corner is playable and keeps the shuttle low — but it is slow, and their front-court player is already looking for it.', 'She takes it early, tight net reply. Neutral at best.', { x: 1.40, y: 8.00 }),
    'drop|*':        g(1, 'Slow shot, long distance, plenty of time for them to step in. Cross-court drops from the corner get intercepted.', 'Intercepted early and pushed into your open court.', { x: 4.80, y: 9.60 }),
    'clear|rearL':   g(2, 'Not glamorous, but honest. When your feet have lost the rally, a deep attacking clear into the corner buys the time to get balanced again.', 'They attack, but you are set and split properly.', { x: 1.20, y: 10.40 }),
    'clear|*':       g(1, 'You survive, but a short or central clear from trouble just invites a better smash than the one you were avoiding.', 'They step under it and smash steeply into your middle.', { x: 3.05, y: 10.00 }),
  },
},
{
  id: 'a3', chapter: 'set-defence',
  title: 'They have closed the middle',
  brief: 'Same attacking position, but these two have played you before. They have narrowed their split and are both shading the middle, daring you to hit the seam.',
  you: { x: 4.20, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 2.35, y: 3.30, hand: 'R' }, { x: 3.80, y: 3.30, hand: 'R' } ],
  contact: { x: 4.25, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearR'),
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 } ],
  best: 'smash|midR',
  key: 'Hit where they are not. The middle is not a magic target — it is just usually the gap. When they close it, the tramlines open.',
  grades: {
    'smash|midR': g(3, 'They have paid for the middle by giving up the lines. Straight to the tramline is the shortest ball from where you are standing, it beats him on the outside, and your partner is already covering the straight block.', 'He is stretched wide. Loose lift — your partner puts it away.', { x: 4.20, y: 8.40 }),
    'halfSmash|midR': g(3, 'Same read, safer execution. Into the open tramline, steep, and you stay balanced for the reply. Against a narrow defence this is the percentage ball.', 'Stretched reply, floated back. Attack retained.', { x: 4.10, y: 8.60 }),
    'smash|midL': g(2, 'The cross tramline is genuinely open, so the read is right. But it is the longest shot on the court and it pulls your partner across — do it as a surprise, not as your first choice.', 'He reaches it and blocks cross. Your partner is late.', { x: 0.90, y: 8.20 }),
    'smash|seam': g(1, 'This is the ball they have set up to take. Two rackets are already pointing at it — you are hitting into the one place they have over-covered.', 'Intercepted flat and driven back through your middle.', { x: 3.05, y: 10.20 }),
    'smash|bodyR': g(2, 'Body targets still cramp them, but when a defender has shaded inward their racket hip has moved inward too — you are drifting back toward the covered middle.', 'Jammed, but he handles it. Neutral block.', { x: 3.90, y: 8.00 }),
    'smash|*':   g(1, 'Off target for a smash. Short and central is the one place a narrow defence is perfectly placed.', 'Easy interception.', { x: 3.05, y: 9.00 }),
    'halfSmash|*': g(2, 'Sound shot family. Keep pushing it wider — their weakness today is the lines.', 'Rally continues, still yours.', { x: 3.60, y: 8.80 }),
    'drop|netR': g(2, 'A narrow defence standing deep is vulnerable to the front corners. Good idea — just make sure you have made them move backwards first.', 'She scrambles it back tight. Even rally.', { x: 4.70, y: 8.00 }),
    'drop|*':   g(1, 'Slow and central against two players already covering the middle.', 'Taken early, pushed past your partner.', { x: 3.05, y: 9.20 }),
    'clear|*':  g(0, 'A free attack, given away.', 'Now you are the ones split and defending.', { x: 3.60, y: 9.80 }),
  },
},
{
  id: 'a4', chapter: 'set-defence',
  title: 'The third smash',
  brief: 'You have smashed twice. Both came back — deep, controlled blocks. They are absorbing the pace well and have settled a step further back, grooved into the rhythm of your smash.',
  you: { x: 3.60, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 2.90, hand: 'R' }, { x: 4.20, y: 2.90, hand: 'R' } ],
  contact: { x: 3.65, y: 10.90 },
  shots: ['smash', 'halfSmash', 'slice', 'drop'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('netMid') ],
  best: 'slice|netL',
  key: 'The third smash is the one they are expecting. Change the tempo, not the pace — the drop after two smashes is worth more than the smash after two smashes.',
  grades: {
    'slice|netL': g(3, 'Same arm speed, same body shape, completely different shuttle. They are standing deep and leaning back for pace — a sliced drop into the front corner is the shot their feet cannot answer.', 'She lunges and lifts it short. Your partner kills it.', { x: 2.20, y: 8.10 }),
    'slice|netR': g(3, 'Same idea to the other corner. Deep, grooved defenders are beaten by the change of tempo, not by more pace.', 'Scrambled lift, short. Free attack for you.', { x: 4.10, y: 8.30 }),
    'slice|*': g(2, 'The change of tempo is the right idea here — aim it into a front corner rather than the middle and it becomes the best shot on the court.', 'Reached, but the reply is short. Attack retained.', { x: 3.05, y: 8.30 }),
    'drop|netL': g(2, 'Right instinct, softer disguise. A plain drop telegraphs earlier than a slice, so they get a step on it — but against defenders standing this deep it is still a good ball.', 'Reached, but the reply floats. Attack retained.', { x: 2.40, y: 8.40 }),
    'drop|*':   g(2, 'Correct family of shot. Aim for the corners — a central drop lets either of them take it comfortably.', 'Returned tight. Neutral.', { x: 3.05, y: 8.20 }),
    'smash|*':  g(1, 'The same ball a third time, from a position they have already solved twice. They are deeper and set for it now; repetition is what makes a defence comfortable.', 'Blocked calmly again. You are running out of legs before they run out of defence.', { x: 3.05, y: 8.60 }),
    'halfSmash|*': g(2, 'Better than another full smash because the angle is steeper and you stay fresh — but it is still pace into a defence that has settled onto pace.', 'Controlled block. Even rally.', { x: 3.05, y: 8.50 }),
  },
},
{
  id: 'a5', chapter: 'set-defence',
  title: 'The defender who moved',
  brief: 'They blocked, your partner played it tight, and the defender on your left has come forward to cover the net exchange. Her partner is still back in the defensive slot. Then they lifted again — and she has not fully recovered.',
  you: { x: 3.90, y: 11.00 }, partner: { x: 3.30, y: 7.80 },
  opps: [ { x: 2.05, y: 5.00, hand: 'R' }, { x: 4.30, y: 3.30, hand: 'R' } ],
  contact: { x: 3.95, y: 10.80 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ { id: 'behindL', label: 'The space she left', x: 1.45, y: 2.10 },
           z('seam'), z('midR'), z('netR'), z('rearR'), z('rearL'),
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 } ],
  best: 'smash|behindL',
  key: 'Hit where the defender just left. The hole is always behind the player who moved — and it stays open for exactly one shot.',
  grades: {
    'smash|behindL': g(3, 'She is committed forward and her weight is going the wrong way. A smash into the ground she has just vacated cannot be answered by her partner either — he is covering his own half.', 'Nobody moves. Clean winner.', null),
    'smash|rearL': g(3, 'Same read — behind the player who came forward. Slightly deeper than the mid-court hole, so she gets a fraction more time, but she is still travelling backwards to reach it.', 'She scrambles it up short. Put away at the net.', { x: 2.40, y: 8.60 }),
    'smash|seam': g(2, 'A decent default, but today it is the one ball her partner is perfectly placed to take — he is the only one in a proper defensive position, and the seam is on his side of the problem.', 'He covers it. Block back, rally continues.', { x: 3.30, y: 8.30 }),
    'smash|midR': g(1, 'You have smashed at the one defender who is actually ready, and left the hole untouched. The read was there and you did not take it.', 'Comfortable block from a balanced player.', { x: 4.40, y: 8.10 }),
    'smash|bodyR': g(1, 'Jamming works on a set defender, but you are choosing the set defender over the stranded one.', 'He handles it. Missed opportunity.', { x: 3.90, y: 8.40 }),
    'smash|*':  g(1, 'Off the hole. When a defence is broken, the target picks itself — do not overthink it.', 'They recover their shape.', { x: 3.05, y: 8.80 }),
    'halfSmash|*': g(2, 'Any downward ball into the space she left is fine. Full pace is better — she is short of time and you want to take the rest of it away.', 'Reached late, weak reply.', { x: 2.20, y: 8.70 }),
    'drop|*':   g(0, 'She is already at the front of the court. A drop plays the shuttle straight to the one place she is standing.', 'Killed at the net.', { x: 3.05, y: 9.60 }),
    'clear|*':  g(0, 'A broken defence, repaired for free.', 'They reset and you have lost the attack.', { x: 3.30, y: 9.80 }),
  },
},
{
  id: 'a6', chapter: 'set-defence',
  title: 'The short lift',
  brief: 'Under pressure at the net they have lifted flat and short — it is only just past the short service line on your side. You can get above it, early and high. They are still recovering into their split.',
  you: { x: 3.40, y: 9.40 }, partner: { x: 3.05, y: 8.00 },
  opps: [ { x: 2.20, y: 4.20, hand: 'R' }, { x: 4.00, y: 3.80, hand: 'R' } ],
  contact: { x: 3.45, y: 9.20 },
  shots: ['smash', 'halfSmash', 'drop', 'drive'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'), z('rearMid'),
           { id: 'bodyL', label: 'Left defender’s racket hip', bodyOf: 0 } ],
  best: 'smash|seam',
  key: 'A short lift is the free point in doubles. Take it early — the height of your contact is what makes a smash steep, and the steeper it is, the less time exists for anyone.',
  grades: {
    'smash|seam': g(3, 'Early contact, high above the tape, straight down the middle into two players who are still arriving. The angle does the work — this is the steepest ball available to you in the whole game.', 'It lands between them before either is set. Point.', null),
    'smash|bodyL': g(3, 'Equally good. She is the one still travelling, and a steep ball into the racket hip of a player who is not yet balanced does not come back.', 'Jammed on the move. She cannot get the racket there.', null),
    'smash|midR': g(2, 'Solid and steep, but you have aimed at the defender who is closest to being ready, and given the shuttle the extra distance to the sideline.', 'He gets a racket on it. Short block back.', { x: 4.60, y: 8.00 }),
    'smash|*':   g(2, 'Take it early and hit down. Almost any downward ball is good from here — just keep it away from the one who is already set.', 'Weak reply, attack retained.', { x: 3.05, y: 8.40 }),
    'halfSmash|*': g(1, 'You were given a free ball above the tape and took the pace off it. That is the one way to let two unbalanced players back into the rally.', 'They recover in time and block it back tight.', { x: 3.05, y: 8.20 }),
    'drive|*':  g(1, 'Flat, when you have height to hit down. A drive from above the tape is a wasted angle.', 'Driven back flat through the middle. Neutral.', { x: 3.05, y: 9.80 }),
    'drop|*':   g(0, 'They are already coming forward out of the lift. A drop meets them exactly where they are going.', 'Killed at the net.', { x: 3.05, y: 9.60 }),
  },
},

/* ---------- Chapter 2: keeping the attack ---------- */
{
  id: 'b1', chapter: 'keep-attack',
  title: 'At the net: the tight block',
  brief: 'You are the front player. Your partner smashed, they blocked it straight and tight — the shuttle is dropping just below the tape on your right. You have reached it early, but you are taking it from below net height.',
  you: { x: 4.40, y: 7.55 }, partner: { x: 3.80, y: 11.10 },
  opps: [ { x: 2.20, y: 3.60, hand: 'R' }, { x: 4.20, y: 4.10, hand: 'R' } ],
  contact: { x: 4.55, y: 7.35 },
  shots: ['netKill', 'netShot', 'push', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midL'), z('midR'), z('seam'), z('rearL') ],
  best: 'netShot|netR',
  key: 'Below the tape means tight net. Above the tape means kill. And never lift when you already own the attack.',
  grades: {
    'netShot|netR': g(3, 'Tight, straight, tumbling. From below the tape this is the only shot that keeps them underneath the shuttle — and if it is tight enough their only reply is another lift, which hands your partner a second free smash.', 'She has to lift. Your partner smashes again, better placed.', { x: 4.60, y: 10.60 }),
    'netShot|netMid': g(2, 'Tight is right, central is loose. A net shot down the middle gives both of them a chance at it and shortens your partner’s options.', 'Returned tight. Even net exchange.', { x: 3.60, y: 7.60 }),
    'netShot|netL': g(2, 'The cross net shot works, but from below the tape it travels further and stays up longer — that is the ball that gets killed.', 'She reaches it early and kills it.', null),
    'push|midL': g(2, 'A flat push into the mid-court is a genuine alternative, especially if they crowd the net expecting the tight one. Just be sure it is flat enough to pass them.', 'Pushed past. Rally stays yours, barely.', { x: 1.60, y: 9.40 }),
    'push|*':   g(2, 'Reasonable variation. The push works when they are leaning forward, not when they are set.', 'Returned. Neutral.', { x: 3.05, y: 9.60 }),
    'netKill|*': g(0, 'The shuttle is below the tape. There is no downward angle to hit — you either find the net or pop it up into two waiting rackets.', 'Into the net.', null),
    'lift|*':   g(0, 'You owned the attack and gave it to them. This is the single most common way club pairs lose a rally they were winning.', 'They are hitting down now. You are split and defending.', { x: 4.00, y: 10.20 }),
    'netShot|*': g(1, 'Right shot, wrong place. A net shot only works when it is tight and close to a sideline.', 'Loose. Killed.', null),
  },
},
{
  id: 'b2', chapter: 'keep-attack',
  title: 'At the net: the flat counter',
  brief: 'You are the front player. Instead of blocking, the defender has driven it flat and hard straight at you, at about shoulder height, trying to push you backwards and take the attack.',
  you: { x: 3.60, y: 7.90 }, partner: { x: 3.90, y: 11.00 },
  opps: [ { x: 2.40, y: 3.80, hand: 'R' }, { x: 4.10, y: 3.90, hand: 'R' } ],
  contact: { x: 3.55, y: 7.70 },
  shots: ['drive', 'block', 'netShot', 'lift'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'), z('netMid'), z('rearR') ],
  best: 'drive|seam',
  key: 'Meet the drive in front of your body and punch it flat into the seam. Whoever takes the flat exchange earlier wins it — and the one who steps back loses it.',
  grades: {
    'drive|seam': g(3, 'Take it early, in front, with a short punch. Flat into the middle is the answer to a flat exchange: it gives neither of them room to swing and it keeps you standing at the net instead of retreating out of it.', 'They are jammed in the middle. The reply pops up — your partner takes it.', { x: 3.05, y: 9.20 }),
    'drive|midL': g(2, 'Driving it away from the driver is sound. Cross-court is the longer ball though, and in a flat exchange distance is time you are handing over.', 'Returned flat. Exchange continues, even.', { x: 1.80, y: 8.80 }),
    'drive|*':  g(2, 'Right answer — do not let a drive push you backwards. Tighten the target and it becomes the best answer.', 'Flat exchange continues.', { x: 3.05, y: 9.00 }),
    'block|netMid': g(2, 'Absorbing it into the front court is playable if you were late to the shuttle. It is passive though — you had the chance to take the initiative and gave it to whoever gets to the net first.', 'She comes in and plays it tight. Neutral.', { x: 3.20, y: 7.70 }),
    'block|*':  g(1, 'Blocking a drive from the net usually means you were late. Loose blocks from this position get killed.', 'Reached early and killed.', null),
    'netShot|*': g(1, 'A drive at shoulder height is too fast and too flat to convert into a tight net shot. You will either float it up or find the tape.', 'Popped up. Killed.', null),
    'lift|*':   g(0, 'Retreating from a flat exchange gives them exactly what the drive was asking for.', 'They smash. You are defending.', { x: 3.60, y: 10.20 }),
  },
},
{
  id: 'b3', chapter: 'keep-attack',
  title: 'Where does the front player stand?',
  brief: 'Your partner has just smashed cross-court, from your rear right to their left side. You are the front player. The shuttle has not been returned yet — where should you be standing as they make contact?',
  kind: 'position', zoneSide: 'own',
  you: { x: 3.05, y: 7.90 }, partner: { x: 4.40, y: 11.00 },
  opps: [ { x: 1.90, y: 3.40, hand: 'R' }, { x: 4.20, y: 3.40, hand: 'R' } ],
  contact: { x: 3.05, y: 7.90 },
  incoming: { from: { x: 4.45, y: 10.80 }, to: { x: 1.90, y: 3.40 }, label: 'partner’s cross smash' },
  shots: ['move'],
  zones: [ { id: 'frontL', label: 'Net, left side',  x: 1.85, y: 7.85 },
           { id: 'frontC', label: 'Net, centre',     x: 3.05, y: 7.85 },
           { id: 'frontR', label: 'Net, right side', x: 4.35, y: 7.85 },
           { id: 'midC',   label: 'Mid-court centre', x: 3.05, y: 9.70 },
           { id: 'deepC',  label: 'Behind the service line', x: 3.05, y: 10.40 } ],
  best: 'move|frontL',
  key: 'The front player follows the line of the smash. The straight block is the most likely reply to any smash — so stand on the line it will come back down.',
  grades: {
    'move|frontL': g(3, 'The smash went to their left, so the straight block comes back to your left. Shade to the side the shuttle went and you are standing on the most likely reply before it is played — which is what lets a front player intercept instead of chase.', 'The block comes straight. You are already there — killed.', null),
    'move|frontC': g(2, 'Central is not wrong, it is just average. You can reach both replies late rather than either one early, and the whole point of the front position is arriving early.', 'You reach the block, but only just. Tight reply, neutral.', { x: 1.90, y: 7.70 }),
    'move|frontR': g(0, 'You have followed your partner rather than the shuttle. The block is coming down the other line and neither of you is anywhere near it.', 'Straight block. Untouched.', null),
    'move|midC':  g(1, 'Drifting backwards during your partner’s attack is the classic club error — it puts two players in the middle of the court and nobody on the net, which is the one shape that cannot finish a rally.', 'The block drops in front of you. Nobody can reach it.', null),
    'move|deepC': g(0, 'You have abandoned the front of the court entirely while your own side is attacking.', 'A tight block wins the rally without them having to hit hard.', null),
    'move|*':     g(1, 'Follow the line of the smash and stay at the net. Those two rules cover most of what a front player has to decide.', 'Late to the reply.', { x: 2.20, y: 8.20 }),
  },
},
{
  id: 'b4', chapter: 'keep-attack',
  title: 'The lift down the middle',
  brief: 'You are the front player. They have lifted high and deep straight down the middle of your court. Your partner is behind you and calls for it. Where do you go as he hits it?',
  kind: 'position', zoneSide: 'own',
  you: { x: 3.05, y: 7.90 }, partner: { x: 3.30, y: 10.60 },
  opps: [ { x: 2.10, y: 3.40, hand: 'R' }, { x: 4.20, y: 3.40, hand: 'R' } ],
  contact: { x: 3.05, y: 7.90 },
  incoming: { from: { x: 3.05, y: 5.20 }, to: { x: 3.40, y: 11.60 }, label: 'their lift' },
  shots: ['move'],
  zones: [ { id: 'frontL', label: 'Net, left side',  x: 2.00, y: 7.80 },
           { id: 'frontC', label: 'Net, centre',     x: 3.05, y: 7.80 },
           { id: 'frontR', label: 'Net, right side', x: 4.20, y: 7.80 },
           { id: 'midC',   label: 'Mid-court centre', x: 3.05, y: 9.80 },
           { id: 'sideL',  label: 'Side-by-side, left', x: 1.90, y: 9.60 } ],
  best: 'move|frontL',
  key: 'A middle lift is your partner’s ball. Your job is to stay at the net and shade to the side he will smash from — not to help.',
  grades: {
    'move|frontL': g(3, 'He will take it on his forehand from the right, so his straight smash goes down your left. Shade left, stay tight to the tape, and you are standing on the block before it is hit.', 'The straight block arrives into your racket. Killed.', null),
    'move|frontC': g(2, 'Holding the centre at the net is acceptable and never a disaster. But once you know which side he is hitting from, standing centrally means covering both replies badly instead of one well.', 'You reach the block late but keep it alive.', { x: 2.10, y: 7.70 }),
    'move|frontR': g(1, 'You have shaded to the same side as the smash rather than the side it is going to. The straight block comes back down the other line.', 'Block past you. Your partner has to chase it.', { x: 2.00, y: 7.60 }),
    'move|midC':  g(1, 'Backing out of the net because the shuttle went over your head is instinct, not tactics. It leaves your side in a line, which covers neither the width nor the front.', 'Tight block in front of you. Nobody can get it.', null),
    'move|sideL': g(0, 'You have gone into a defensive shape while your own partner is about to attack. Now the net is empty and the one reply you are guaranteed to get — a block — is unguarded.', 'Block. Uncontested winner.', null),
    'move|*':     g(1, 'Stay at the net, shade to the straight side of your partner’s smash.', 'Out of position for the reply.', { x: 2.60, y: 8.20 }),
  },
},

/* ---------- Chapter 3: defending the smash ---------- */
{
  id: 'c1', chapter: 'defence',
  title: 'The straight smash',
  brief: 'You lifted, you split, you are balanced. He has smashed from his rear court on your right, straight down the line at you. Their front player is at the net in the centre. You have time to choose.',
  kind: 'defence',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.05, y: 5.60, hand: 'R' }, { x: 4.55, y: 1.80, hand: 'R' } ],
  contact: { x: 4.35, y: 9.20 },
  incoming: { from: { x: 4.55, y: 1.90 }, to: { x: 4.35, y: 9.20 }, label: 'smash' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midR'), z('midL'), z('seam'), z('rearL'), z('rearR') ],
  best: 'block|netR',
  key: 'The best defensive shot is the one that stops them hitting down. Tight straight block, or a flat push into the mid-court hole behind their front player.',
  grades: {
    'block|netR': g(3, 'Shortest distance, least that can go wrong, and if it is tight they cannot hit down off it. The straight block is the backbone of doubles defence — everything else is a variation you play once they start reading this.', 'Their front player has to play it tight or lift. You follow it in and the attack is turning.', { x: 4.90, y: 5.90 }),
    'push|midL': g(3, 'The professional answer. They are in front-and-back, so the mid-court behind their net player is the largest empty space on their court. A flat push into it either wins the rally outright or forces a lift — and it breaks their shape rather than just surviving it.', 'It passes over the net player and lands behind her. The smasher has to scramble across.', { x: 1.20, y: 3.40 }),
    'push|midR': g(2, 'Same idea, harder execution — you are pushing it back toward the side the smasher is already recovering into. It works, but you have given him the shortest route to it.', 'He covers it and attacks again.', { x: 4.60, y: 9.60 }),
    'push|*': g(2, 'The push is a strong idea against a front-and-back attack — it just has to be flat, and it has to land behind their net player rather than on her.', 'She reaches it. Net exchange, roughly even.', { x: 3.05, y: 6.40 }),
    'block|netL': g(1, 'The cross block is the most intercepted shot in doubles. It travels slowly through exactly the zone their front player is standing in, and she is looking for it.', 'Killed at the net.', null),
    'drive|*':  g(1, 'Against a full smash from the rear court, the shuttle is arriving too steeply to drive. You will make contact below the tape and float it up into two rackets.', 'Popped up. Put away.', null),
    'lift|rearL': g(2, 'A deep cross lift is a legitimate reset — it moves the smasher the full width of the court and buys you time to rebalance. But you are still defending, so it is the shot you play when stretched, not the one you choose when set.', 'He gets there and smashes again. You are still defending.', { x: 3.05, y: 9.40 }),
    'lift|*':   g(1, 'Lifting short or down the middle from a balanced defensive position just gives him a better smash than the one you have just survived.', 'Steeper smash, harder to defend.', { x: 4.10, y: 9.60 }),
    'block|*': g(2, 'Blocking is the right family of shot here. Keep it tight and keep it straight.', 'Returned tight. Rally continues.', { x: 3.40, y: 6.20 }),
  },
},
{
  id: 'c2', chapter: 'defence',
  title: 'Jammed at the racket hip',
  brief: 'He has smashed at your body — steep, fast, and aimed at your right hip. You are right-handed. There is no room to take a full swing and the shuttle is on you.',
  kind: 'defence',
  you: { x: 3.70, y: 9.20 }, partner: { x: 1.70, y: 9.30 },
  opps: [ { x: 3.00, y: 5.50, hand: 'R' }, { x: 4.00, y: 1.90, hand: 'R' } ],
  contact: { x: 3.60, y: 9.10 },
  incoming: { from: { x: 4.00, y: 2.00 }, to: { x: 3.60, y: 9.10 }, label: 'body smash' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midR'), z('midL'), z('rearL') ],
  best: 'block|netR',
  key: 'Racket up and in front, thumb on the grip, take the body ball on the backhand side. Short punch, no swing — a jammed defender who tries to swing is a defender who pops it up.',
  grades: {
    'block|netR': g(3, 'Rotate the racket in front of you, thumb behind the grip, and punch it short and straight. Taking the body smash on the backhand side gives you the only compact swing available, and straight is the shortest and safest place to put it.', 'Blocked short. They have to play it up. You are back in the rally.', { x: 4.40, y: 6.00 }),
    'block|netL': g(1, 'From a jammed position you have no racket speed for a cross block. It will float, and it floats right through their front player’s zone.', 'Killed at the net.', null),
    'block|netMid': g(2, 'Surviving it is most of the job here. Central is a little loose — their front player can cover it — but a short block from a jammed position is an acceptable outcome.', 'She takes it tight. Neutral net exchange.', { x: 3.05, y: 6.20 }),
    'block|*': g(2, 'Blocking is the only realistic family of shot from a jammed body position. Keep it short and keep it straight.', 'Survived. Rally continues.', { x: 3.60, y: 6.30 }),
    'push|midL': g(2, 'Ambitious and good if you get it away — but jammed at the hip you rarely have the racket speed to make a push flat enough to clear their net player.', 'It floats up. She intercepts it.', null),
    'drive|*':  g(0, 'There is no room to swing. This is the shot that turns a body smash into a winner for them — the racket comes back late, the face opens, and the shuttle goes straight up.', 'Popped up and put away.', null),
    'lift|rearL': g(2, 'Under real pressure, a deep lift is an honest escape. You are still defending, but you have survived the ball that was designed to end the rally.', 'Another smash, but you are set for it now.', { x: 3.05, y: 9.50 }),
    'lift|*':   g(1, 'A short lift out of a jam is the worst of both — you keep defending and you make their next smash steeper.', 'Steeper smash. Harder.', { x: 3.30, y: 9.60 }),
    'push|*':   g(1, 'Too much to ask from a cramped position. Keep it simple until you have room.', 'Loose. Intercepted.', null),
  },
},
{
  id: 'c3', chapter: 'defence',
  title: 'The slow smash',
  brief: 'He has smashed from very deep in his rear court, almost off the baseline. It has come flat rather than steep, and it is arriving at about waist height with the pace off it. Their front player is tight to the tape.',
  kind: 'defence',
  you: { x: 4.10, y: 9.20 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.05, y: 5.40, hand: 'R' }, { x: 4.40, y: 0.90, hand: 'R' } ],
  contact: { x: 4.15, y: 9.00 },
  incoming: { from: { x: 4.40, y: 1.00 }, to: { x: 4.15, y: 9.00 }, label: 'flat smash from deep' },
  shots: ['drive', 'block', 'push', 'lift'],
  zones: [ z('midR'), z('midL'), z('seam'), z('netR'), z('netL'), z('rearL') ],
  best: 'drive|midR',
  key: 'A slow, flat smash from the baseline is a gift. Drive it back down the line and the roles have swapped — you are the attackers now.',
  grades: {
    'drive|midR': g(3, 'You have time and height, so counter-attack. Flat down the line passes their front player before she can react and it lands behind her, which forces the smasher to take it moving backwards. In one shot you have taken the attack.', 'He is driven back. Weak lift — now you are the ones smashing.', { x: 4.60, y: 3.20 }),
    'drive|seam': g(2, 'Flat through the middle is a fine counter and hard to intercept, but down the line is faster to the open space and gets it past the net player sooner.', 'Driven back. Flat exchange, roughly even.', { x: 3.05, y: 9.40 }),
    'drive|midL': g(2, 'The cross drive is a good surprise, but it is the longest ball and it passes through their front player’s reach. Save it for when they start over-covering the line.', 'She gets a racket to it. Scrambled.', { x: 2.40, y: 8.60 }),
    'drive|*': g(2, 'Counter-attacking is the right answer to a slow smash. Keep it flat and get it past their net player.', 'Driven back. Rally is level.', { x: 3.60, y: 3.60 }),
    'push|midR': g(2, 'A push does much the same job as the drive but with less pace. Against a slow ball you can afford the extra aggression.', 'Passes the net player. Neutral-to-good.', { x: 4.70, y: 3.60 }),
    'block|*':  g(1, 'Blocking a slow smash hands the attack straight back to a pair who just played a weak one. Their front player is tight to the tape and she is waiting for exactly this.', 'She kills the loose block.', null),
    'lift|*':   g(0, 'Lifting off a slow smash rewards a bad shot. They get to start their attack again, this time from a comfortable position.', 'A proper smash this time. You are defending again.', { x: 3.60, y: 9.60 }),
    'push|*':   g(2, 'Right instinct — keep it flat and low, and make sure it clears their front player.', 'Passes her. Rally is level.', { x: 3.05, y: 3.80 }),
  },
},
{
  id: 'c4', chapter: 'defence',
  title: 'The net player who crowds',
  brief: 'Their front player is standing almost on the tape, leaning in, killing everything loose. He has smashed straight at you again and she is already creeping forward for the block.',
  kind: 'defence',
  you: { x: 4.20, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 3.20, y: 6.15, hand: 'R' }, { x: 4.45, y: 1.70, hand: 'R' } ],
  contact: { x: 4.25, y: 9.15 },
  incoming: { from: { x: 4.45, y: 1.80 }, to: { x: 4.25, y: 9.15 }, label: 'smash' },
  shots: ['push', 'block', 'drive', 'lift'],
  zones: [ z('midL'), z('midR'), z('seam'), z('netR'), z('netL'), z('rearL'), z('rearR') ],
  best: 'push|midL',
  key: 'A net player who crowds the tape leaves the whole mid-court behind her. Push it flat over her shoulder — and she will stop crowding.',
  grades: {
    'push|midL': g(3, 'She has given up everything behind her to own the tape. A flat push over her shoulder into the cross mid-court lands in the biggest hole on the court, and the smasher is on the wrong side to cover it.', 'It lands behind her. He cannot get across. Point.', null),
    'push|midR': g(3, 'Same hole, straight version. Slightly easier to execute and the smasher is closer to it — but he is still recovering from his own smash, so it is a genuine winner more often than not.', 'He scrambles it back high. You are attacking now.', { x: 4.80, y: 3.40 }),
    'block|netR': g(1, 'Normally the best shot in defence — but not against a player standing on the tape. You are playing the shuttle into the exact spot she has chosen to own.', 'Killed. That is why she stands there.', null),
    'block|*':  g(1, 'Any block feeds a crowding net player. Change the length before you change anything else.', 'Killed at the net.', null),
    'drive|*':  g(1, 'Off a steep smash you do not have the height to drive, and a low drive goes straight into her racket at head height.', 'Intercepted.', null),
    'lift|rearL': g(2, 'A deep lift is safe and moves him the full width. It does not punish her position, but it does not lose the rally either.', 'He smashes again. Still defending.', { x: 3.20, y: 9.50 }),
    'lift|*':   g(1, 'Short lifts give a set attacker a steeper smash. If you are going to lift, make it deep and make it cross.', 'Steeper smash. Harder to defend.', { x: 4.00, y: 9.60 }),
    'push|*':   g(2, 'Right shot. Get it flatter and further from her reach and it becomes a winner.', 'Just about passes her. Neutral.', { x: 3.05, y: 4.00 }),
  },
},
{
  id: 'c5', chapter: 'defence',
  title: 'Steep and close',
  brief: 'He has jumped and smashed from inside his mid-court — very steep, very fast, and it is on you almost immediately. You are barely set. There is no time for anything clever.',
  kind: 'defence',
  you: { x: 4.00, y: 9.40 }, partner: { x: 1.80, y: 9.30 },
  opps: [ { x: 2.80, y: 5.70, hand: 'R' }, { x: 4.10, y: 3.40, hand: 'R' } ],
  contact: { x: 4.05, y: 9.30 },
  incoming: { from: { x: 4.10, y: 3.50 }, to: { x: 4.05, y: 9.30 }, label: 'steep jump smash' },
  shots: ['block', 'push', 'drive', 'lift'],
  zones: [ z('netR'), z('netL'), z('netMid'), z('midL'), z('midR'), z('rearL') ],
  best: 'block|netR',
  key: 'Against a steep, close smash there is one shot: absorb it and put it down. Choosing anything else is choosing to pop it up.',
  grades: {
    'block|netR': g(3, 'Racket in front, soft hands, let the shuttle do the work. Straight is the shortest and needs the least racket speed — which is all you have. Surviving this ball with a tight block is a win.', 'Tight block. She has to play it up. Rally alive.', { x: 4.50, y: 5.95 }),
    'block|netMid': g(2, 'Survival, slightly loose. Central blocks are reachable by both of them, but against this ball getting it down at all is most of the job.', 'Returned tight. Still defending.', { x: 3.05, y: 6.10 }),
    'block|netL': g(1, 'A cross block needs racket speed you do not have off a ball this steep. It will sit up on the way across.', 'Intercepted and killed.', null),
    'block|*': g(2, 'Block is the only shot here. Straight and tight is the version that keeps you in the rally.', 'Returned. Still defending, but alive.', { x: 3.60, y: 6.20 }),
    'push|*':   g(1, 'A push needs a firm, flat contact. Off a steep smash arriving this fast, firm contact means the shuttle goes up, not flat.', 'Floated. Put away.', null),
    'drive|*':  g(0, 'The shuttle is coming down at you from above. There is nothing to drive — the racket face has to open just to reach it, and it goes straight up.', 'Popped up. Point to them.', null),
    'lift|*':   g(1, 'If you can get a lift away from here, fine — but you almost certainly cannot get it deep enough, and a short one from this position is fatal.', 'Short lift. Even steeper smash.', { x: 3.80, y: 9.70 }),
  },
},

/* ---------- Chapter 4: shape and rotation ---------- */
{
  id: 'd1', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'Your partner has lifted',
  brief: 'You were the rear player. Your partner, at the net on the left, has just been forced to lift from the front left corner. He is retreating down that side. They are about to attack. Where do you go?',
  you: { x: 3.30, y: 10.80 }, partner: { x: 1.70, y: 8.20 },
  opps: [ { x: 2.60, y: 4.60, hand: 'R' }, { x: 1.90, y: 2.20, hand: 'R' } ],
  contact: { x: 3.30, y: 10.80 },
  incoming: { from: { x: 1.60, y: 7.80 }, to: { x: 1.90, y: 2.10 }, label: 'partner’s lift' },
  shots: ['move'],
  zones: [ { id: 'defR',   label: 'Defensive slot, right', x: 4.30, y: 9.40 },
           { id: 'defL',   label: 'Defensive slot, left',  x: 1.80, y: 9.40 },
           { id: 'rearC',  label: 'Rear centre',           x: 3.05, y: 11.20 },
           { id: 'netC',   label: 'Net, centre',           x: 3.05, y: 7.90 },
           { id: 'midC',   label: 'Mid-court centre',      x: 3.05, y: 9.50 } ],
  best: 'move|defR',
  key: 'Lift, release the net, split. The player who lifted retreats down their own side; the partner takes the other side. It is a shared trigger, not a memorised rotation.',
  grades: {
    'move|defR': g(3, 'He lifted from the left, so he owns the left. You take the right. Between you the two of you cover the full width of the court, and whichever side they smash to, someone is already standing there.', 'They smash. Whichever side it goes, one of you is balanced and on it.', null),
    'move|defL': g(2, 'The right instinct — get into a defensive slot — but you have taken the side your partner is already retreating into. You will both be defending the same half.', 'They smash cross. Nobody is there.', null),
    'move|rearC': g(1, 'Front-and-back is an attacking shape. Against two players about to hit down, a line cannot cover the width — the smash goes to whichever sideline you are not on, and that is both of them.', 'Smash into the open side. Neither of you moves.', null),
    'move|midC': g(1, 'Standing in the middle feels safe and covers nothing. A smash to either sideline beats a central defender, and your partner is on the same line as you.', 'Smash wide. Out of reach.', null),
    'move|netC': g(0, 'You have moved toward the net while the opponents are about to hit downwards at you. This is the worst place on the court to be standing.', 'Smashed at your feet.', null),
    'move|*':   g(1, 'Split side-by-side. The one who lifted takes their own side, you take the other.', 'Caught out of shape.', null),
  },
},
{
  id: 'd2', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'Be there before contact',
  brief: 'You lifted from the front and you are still travelling backwards. He is under the shuttle in his rear court with the racket already going up. Where do you need to be at the moment his racket meets the shuttle?',
  you: { x: 3.60, y: 8.60 }, partner: { x: 1.85, y: 9.40 },
  opps: [ { x: 2.60, y: 5.30, hand: 'R' }, { x: 4.30, y: 1.60, hand: 'R' } ],
  contact: { x: 3.60, y: 8.60 },
  incoming: { from: { x: 3.60, y: 8.00 }, to: { x: 4.30, y: 1.60 }, label: 'your lift' },
  shots: ['move'],
  zones: [ { id: 'slotR',  label: 'Defensive slot, right',       x: 4.30, y: 9.40 },
           { id: 'deepR',  label: 'Deeper, right',               x: 4.45, y: 10.60 },
           { id: 'shallowR', label: 'Just behind the service line', x: 4.20, y: 8.50 },
           { id: 'midC',   label: 'Mid-court centre',            x: 3.05, y: 9.50 },
           { id: 'slotL',  label: 'Defensive slot, left',        x: 1.85, y: 9.40 } ],
  best: 'move|slotR',
  key: 'Be balanced before their racket hits the shuttle. Late and still moving means you reach for the ball; early and still means you choose what to do with it.',
  grades: {
    'move|slotR': g(3, 'Your partner has taken the left, so the right is yours, roughly level with him and about a metre behind the short service line. The point is not just the spot — it is arriving there stopped, split-stepped, racket up, before he makes contact.', 'You are set. The smash comes and you have a choice of replies.', null),
    'move|deepR': g(2, 'Too deep. You will cover the deep smash comfortably but a steep one drops in front of you, and everything you do reach you are hitting from below, which means lifting again.', 'Steep smash lands short of you. Scrambled.', null),
    'move|shallowR': g(1, 'Too close to the net for a defensive position. A smash past your shoulder is unreachable, and anything at you arrives before you can move.', 'Smashed past you.', null),
    'move|midC': g(1, 'The middle is not a defensive position when your partner is already covering the left — you have doubled up on his half and left your own sideline empty.', 'Smash down your line. Untouched.', null),
    'move|slotL': g(0, 'Both of you on the same side. The entire right half of the court is open.', 'Smashed into the open half.', null),
    'move|*':   g(1, 'Take the side your partner has not taken, about a metre behind the short service line, and be stopped before he hits it.', 'Caught moving.', null),
  },
},
{
  id: 'd3', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'You blocked well — now what?',
  brief: 'You defended the smash with a tight straight block into their front right corner. It is a good one — they are going to have to lift it or play it tight. Where do you move as they reach it?',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.90, y: 9.30 },
  opps: [ { x: 4.60, y: 5.90, hand: 'R' }, { x: 4.20, y: 2.60, hand: 'R' } ],
  contact: { x: 4.30, y: 9.30 },
  incoming: { from: { x: 4.30, y: 9.20 }, to: { x: 4.85, y: 6.00 }, label: 'your block' },
  shots: ['move'],
  zones: [ { id: 'netR',  label: 'Net, right side',      x: 4.20, y: 7.85 },
           { id: 'netC',  label: 'Net, centre',          x: 3.05, y: 7.85 },
           { id: 'stay',  label: 'Stay in the slot',     x: 4.30, y: 9.30 },
           { id: 'midC',  label: 'Mid-court centre',     x: 3.05, y: 9.50 },
           { id: 'rearC', label: 'Rear centre',          x: 3.05, y: 11.00 } ],
  best: 'move|netR',
  key: 'A good block is an invitation to attack. Follow it in — do not admire it from the mid-court. The player who played the block takes the net; the partner slides behind.',
  grades: {
    'move|netR': g(3, 'You played the block, so you own the front court on that side. Moving in turns a defensive shape into an attacking one in a single step — and if they lift, your partner is already behind you to smash it.', 'She lifts. Your partner smashes and you are at the net for the block.', null),
    'move|netC': g(2, 'Coming forward is right; centre is slightly greedy. Their tight reply will come back down the line you blocked to, and you have drifted off it.', 'Tight net reply down the line. You are late.', null),
    'move|stay': g(1, 'The block did its job and you did not take the profit. You stay side-by-side, which means when they play a tight net shot nobody is anywhere near it.', 'Tight net shot. You have to lift, and you are defending again.', null),
    'move|midC': g(1, 'Neither defending nor attacking. Against a tight reply the mid-court is the one place you cannot do anything useful from.', 'Tight reply. Forced to lift.', null),
    'move|rearC': g(0, 'You have retreated after winning the exchange, leaving the whole front court empty.', 'Any net shot wins the rally.', null),
    'move|*':   g(1, 'Follow the block in. The player who blocks takes the net.', 'Too slow to convert.', null),
  },
},
{
  id: 'd4', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'The lift that came out short',
  brief: 'You meant to lift it to the baseline. It came off flat and landed around their mid-court instead. He is stepping under it early and is going to jump. Your partner has taken the left. Where do you stand?',
  you: { x: 3.40, y: 9.10 }, partner: { x: 1.85, y: 9.40 },
  opps: [ { x: 2.70, y: 5.60, hand: 'R' }, { x: 4.20, y: 3.20, hand: 'R' } ],
  contact: { x: 3.40, y: 9.10 },
  incoming: { from: { x: 3.40, y: 8.40 }, to: { x: 4.20, y: 3.20 }, label: 'your short lift' },
  shots: ['move'],
  zones: [ { id: 'deepR',   label: 'Deeper, right',          x: 4.40, y: 10.20 },
           { id: 'slotR',   label: 'Normal slot, right',     x: 4.30, y: 9.40 },
           { id: 'closeR',  label: 'Forward, right',         x: 4.20, y: 8.40 },
           { id: 'midC',    label: 'Mid-court centre',       x: 3.05, y: 9.60 },
           { id: 'rearR',   label: 'Back near the baseline', x: 4.40, y: 11.80 } ],
  best: 'move|deepR',
  key: 'A short lift means a steeper, faster smash. Give yourself depth — half a step back buys you the whole reply.',
  grades: {
    'move|deepR': g(3, 'He is contacting it further forward and higher, so the smash will be steeper and will arrive sooner. Half a step deeper than your normal slot gives you the extra fraction of time to get the racket in front of it, and it keeps the steep ball in front of you rather than on top of you.', 'The smash is steep but it lands in front of you. You block it back.', { x: 4.50, y: 6.00 }),
    'move|slotR': g(2, 'The standard position is not a disaster, but it is calibrated for a smash from the baseline. This one is coming from three metres closer and steeper.', 'It arrives before you are ready. Scrambled reply.', null),
    'move|closeR': g(0, 'Moving forward against a steep smash from the mid-court puts you directly underneath it, with no time and no angle.', 'Smashed at your feet.', null),
    'move|midC': g(1, 'Central, with your partner already on the left. Your own sideline is open and this is a smash with enough angle to find it.', 'Steep smash down your line.', null),
    'move|rearR': g(1, 'Too deep. You have over-corrected — a steep smash from the mid-court will land well in front of you and you cannot come forward that fast.', 'It drops short of you. Untouched.', null),
    'move|*':   g(1, 'Short lift means step back, not forward.', 'Beaten for time.', null),
  },
},
{
  id: 'd5', chapter: 'shape', kind: 'position', zoneSide: 'own',
  title: 'The smash went to your partner',
  brief: 'You are the right-hand defender. He has smashed cross-court to your partner on the left. Your partner is about to play it. You are not involved in this shot — so what do you do?',
  you: { x: 4.30, y: 9.30 }, partner: { x: 1.80, y: 9.30 },
  opps: [ { x: 3.05, y: 5.70, hand: 'R' }, { x: 4.40, y: 1.70, hand: 'R' } ],
  contact: { x: 4.30, y: 9.30 },
  incoming: { from: { x: 4.40, y: 1.80 }, to: { x: 1.75, y: 9.20 }, label: 'cross smash' },
  shots: ['move'],
  zones: [ { id: 'shiftC', label: 'Slide toward the centre', x: 2.95, y: 9.20 },
           { id: 'stay',   label: 'Hold your position',      x: 4.30, y: 9.30 },
           { id: 'netR',   label: 'Move up to the net',      x: 4.20, y: 7.90 },
           { id: 'wideR',  label: 'Cover your sideline',     x: 5.20, y: 9.30 },
           { id: 'deepC',  label: 'Drop back and centre',    x: 3.05, y: 10.60 } ],
  best: 'move|shiftC',
  key: 'Side-by-side is not two statues. Both defenders slide toward the shuttle — the pair moves as one, and the gap between you never opens.',
  grades: {
    'move|shiftC': g(3, 'The shuttle has gone to the left, so the whole pair shifts left. You are now covering the middle instead of a sideline you no longer need, and whatever comes back through the centre — the drive, the interception — is yours.', 'Their net player intercepts the block and drives it through the middle. You are standing there.', { x: 3.00, y: 9.20 }),
    'move|stay': g(1, 'Staying put opens a metre and a half of empty court between you and your partner. The flat reply through the middle is the most common way pairs get beaten in defence, and this is how the gap gets made.', 'Driven through the middle between you.', null),
    'move|wideR': g(0, 'You have moved further from your partner while the shuttle moved further from you. The middle is now completely undefended.', 'Straight through the gap.', null),
    'move|netR': g(1, 'Coming forward while your side is still defending — your partner has not yet played a shot that gives you the attack.', 'Driven past you at chest height.', null),
    'move|deepC': g(2, 'Centring is right, dropping back is unnecessary. The next ball out of a cross-smash exchange is usually flat and fast, not deep.', 'Flat reply in front of you. Late.', null),
    'move|*':   g(1, 'Move with the shuttle. Both defenders slide together.', 'Gap opened in the middle.', null),
  },
},

/* ---------- Chapter 5: reading the hands ---------- */
{
  id: 'e1', chapter: 'hands',
  title: 'The left-hander in the slot',
  brief: 'Same set defence as before, with one difference: the defender on your right is left-handed. You are behind the shuttle in your rear right, balanced and ready to attack.',
  you: { x: 4.20, y: 11.20 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.90, y: 3.35, hand: 'R' }, { x: 4.30, y: 3.35, hand: 'L' } ],
  contact: { x: 4.25, y: 11.00 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midR'), z('midL'), z('netR'), z('netL'),
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 },
           { id: 'bodyL', label: 'Left defender’s racket hip', bodyOf: 0 } ],
  best: 'smash|bodyR',
  key: 'Check the hands before you pick the target. A left-hander’s racket hip is on the other side of their body — the ball that jams a right-hander is the ball a left-hander eats.',
  grades: {
    'smash|bodyR': g(3, 'His racket hand is on the outside now, so his cramping point has moved out toward the tramline. Jam him there and he has the same problem the right-hander had in the middle: no room to swing, and a choice he does not want to make.', 'Jammed on the outside. Weak reply — your partner finishes it.', { x: 4.80, y: 8.20 }),
    'smash|seam': g(1, 'Against a right-hander this was the free ball. Against this left-hander it is not — his forehand now covers the middle, and you have hit into the strongest racket on the court.', 'Forehand block, controlled and tight. You are the one under pressure.', { x: 4.60, y: 7.80 }),
    'smash|midR': g(2, 'The tramline is a fair target and beats him on the outside. His racket is on that side though, so he reaches it more comfortably than a right-hander would.', 'Reached on the forehand. Blocked back.', { x: 4.70, y: 7.90 }),
    'smash|bodyL': g(2, 'The right-hander on the other side still has his racket hip on the inside, so this is a genuine target — but it is the cross ball, the longest on the court, and she gets time you did not have to give.', 'She has time. Blocks cross.', { x: 4.90, y: 8.60 }),
    'smash|midL': g(1, 'Cross smash to the far tramline: longest distance, most time for her, and it drags your partner out of the front court.', 'Counter-driven into your open side.', { x: 5.20, y: 9.60 }),
    'smash|*':  g(1, 'Wrong length for a smash.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|*': g(2, 'Fine — just apply the same hand-reading. The target moves, the shot does not.', 'Rally continues.', { x: 3.60, y: 8.60 }),
    'drop|*':   g(1, 'Too early, and it does not exploit the thing that makes this pair different.', 'Taken at the net.', { x: 3.05, y: 9.20 }),
    'clear|*':  g(0, 'A free attack handed back.', 'They attack.', { x: 3.60, y: 9.80 }),
  },
},
{
  id: 'e2', chapter: 'hands',
  title: 'Two backhands in the middle',
  brief: 'A mixed-handed pair. The defender on your left is right-handed; the one on your right is left-handed. Look at where both of their rackets are pointing before you choose.',
  you: { x: 3.60, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 3.30, hand: 'R' }, { x: 4.25, y: 3.30, hand: 'L' } ],
  contact: { x: 3.65, y: 10.90 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'),
           { id: 'bodyL', label: 'Left defender’s racket hip', bodyOf: 0 },
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 } ],
  best: 'smash|seam',
  key: 'Right-hander on the left, left-hander on the right: both rackets point away from the middle, so the seam is two backhands. That is the softest target in doubles — take it every time.',
  grades: {
    'smash|seam': g(3, 'Both of their racket hands are on the outside of the court, which means the middle is covered by two backhands and by nobody’s strong side. A hard, flat ball down that seam is the single best target this pair can give you, and it is there for the whole rally.', 'Neither of them wants it. The reply is a weak backhand block, straight to your partner.', { x: 3.20, y: 8.10 }),
    'smash|bodyL': g(2, 'Her racket hip is on the inside, so this ball drifts toward the seam anyway — it is a decent version of the right idea. The pure seam is better because it also creates the hesitation between them.', 'Jammed. Weak reply.', { x: 2.60, y: 8.40 }),
    'smash|bodyR': g(2, 'His racket hip is on the outside. A fine jamming target on its own, but you are attacking the outside when the middle is the structural weakness of this pair.', 'Cramped, but he handles it.', { x: 4.70, y: 8.20 }),
    'smash|midL': g(1, 'You have hit to her forehand side. Against a mixed pair the tramlines are the strong sides — that is the whole point of the shape.', 'Forehand block. Comfortable.', { x: 1.40, y: 7.90 }),
    'smash|midR': g(1, 'His forehand side. Same mistake in the other direction.', 'Forehand block, controlled.', { x: 4.90, y: 7.90 }),
    'smash|*':  g(1, 'Wrong length. Pace does not matter if the shuttle is not in the mid or rear court.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|seam': g(3, 'The same read, and against two backhands you barely need full pace — a steep three-quarter ball into the seam is enough to force a weak block.', 'Backhand block, floated. Killed at the net.', { x: 3.05, y: 8.30 }),
    'halfSmash|*': g(2, 'Right shot family. Put it down the middle and it becomes the best answer.', 'Rally continues.', { x: 3.05, y: 8.60 }),
    'drop|*':   g(1, 'They are balanced and you have a free structural weakness to attack. Use it.', 'Returned tight.', { x: 3.05, y: 9.00 }),
    'clear|*':  g(0, 'Handing back the attack against the one defensive shape you can dismantle.', 'They attack.', { x: 3.30, y: 9.80 }),
  },
},
{
  id: 'e3', chapter: 'hands',
  title: 'Two forehands in the middle',
  brief: 'The same mixed pair, but they have swapped sides. The left-hander is now on your left and the right-hander on your right. Check the rackets again.',
  you: { x: 3.50, y: 11.10 }, partner: { x: 3.05, y: 7.90 },
  opps: [ { x: 1.95, y: 3.30, hand: 'L' }, { x: 4.25, y: 3.30, hand: 'R' } ],
  contact: { x: 3.55, y: 10.90 },
  shots: ['smash', 'halfSmash', 'drop', 'clear'],
  zones: [ z('seam'), z('midL'), z('midR'), z('netL'), z('netR'),
           { id: 'bodyL', label: 'Left defender’s racket hip', bodyOf: 0 },
           { id: 'bodyR', label: 'Right defender’s racket hip', bodyOf: 1 } ],
  best: 'smash|midR',
  key: 'Left-hander left, right-hander right: both rackets point into the middle. Two forehands guard the seam — leave it alone and attack the lines.',
  grades: {
    'smash|midR': g(3, 'Both of their forehands are covering the centre, which means the outsides are backhands and the tramlines are the weak targets. Straight to the right tramline is the shortest of those from where you are standing.', 'Backhand reach, floated reply. Your partner takes it.', { x: 4.60, y: 8.20 }),
    'smash|midL': g(2, 'The correct read — attack the outsides — but the cross tramline is the longest ball on the court and gives her time to get the backhand there properly.', 'She reaches it and blocks cross.', { x: 1.40, y: 8.40 }),
    'smash|seam': g(0, 'The worst target available against this pair. You have hit into the one spot where two forehands overlap — and a forehand block from a set defender is a controlled, tight shot that puts you under pressure.', 'Tight forehand block. Now you are lifting.', { x: 3.20, y: 7.80 }),
    'smash|bodyR': g(2, 'His racket hip is on the inside, toward the middle — which is the area this pair covers best. It still cramps him, but you are working in their strong zone.', 'Jammed, but he blocks it.', { x: 3.90, y: 8.10 }),
    'smash|bodyL': g(2, 'Her racket hip is on the inside too. Same story: a real target, in the part of the court they defend best.', 'Cramped but handled.', { x: 2.30, y: 8.30 }),
    'smash|*':  g(1, 'Wrong length.', 'Taken early.', { x: 3.05, y: 8.80 }),
    'halfSmash|midR': g(3, 'Same read, safer execution, and against a backhand reach on the outside you do not need full pace to force a weak reply.', 'Floated backhand block. Attack retained.', { x: 4.50, y: 8.40 }),
    'halfSmash|*': g(2, 'Right family — push it out toward the lines.', 'Rally continues.', { x: 3.05, y: 8.60 }),
    'drop|netR': g(2, 'The front corners are always available against a pair standing in a mid-court split, and this is the shorter of the two.', 'Scrambled reply.', { x: 4.60, y: 8.10 }),
    'drop|*':   g(1, 'Too early and too central.', 'Taken comfortably.', { x: 3.05, y: 9.00 }),
    'clear|*':  g(0, 'A free attack handed back.', 'They attack.', { x: 3.30, y: 9.80 }),
  },
},
];

/* ---------- expand body-relative zones into coordinates ---------- */
SCENARIOS.forEach((s) => {
  s.zones = s.zones.map((zone) => {
    if (zone.bodyOf === undefined) return zone;
    const o = s.opps[zone.bodyOf];
    // Facing you, a right-hander's racket side appears on YOUR left.
    const dx = o.hand === 'R' ? -0.38 : 0.38;
    return Object.assign({}, zone, { x: o.x + dx, y: o.y + 0.15, isBody: true });
  });
});

/* ---------- the grader ---------- */
function judge(scn, shotId, zoneId) {
  const G = scn.grades;
  const hit = G[shotId + '|' + zoneId] || G[shotId + '|*'] || {
    score: 1,
    why: 'Playable, but not one of the shots this position is asking for.',
    outcome: 'The rally goes on.',
    reply: null,
  };
  const out = Object.assign({}, hit);
  out.verdict = VERDICTS[out.score];
  out.isBest = out.score === 3;
  return out;
}

function bestAnswer(scn) {
  const [shotId, zoneId] = scn.best.split('|');
  const zone = scn.zones.find((z2) => z2.id === zoneId);
  return { shotId, zoneId, zone, grade: judge(scn, shotId, zoneId) };
}

function scenariosOf(chapterId) {
  return SCENARIOS.filter((s) => s.chapter === chapterId);
}

/* ---------- sanity check: every allowed shot needs a fallback ---------- */
(function validate() {
  SCENARIOS.forEach((s) => {
    s.shots.forEach((sh) => {
      const hasAny = Object.keys(s.grades).some((k) => k.startsWith(sh + '|'));
      if (!hasAny) console.warn('[tactics] ' + s.id + ': no grades for shot ' + sh);
      if (!s.grades[sh + '|*']) {
        const specific = Object.keys(s.grades).filter((k) => k.startsWith(sh + '|'));
        if (specific.length < s.zones.length) {
          console.warn('[tactics] ' + s.id + ': shot ' + sh + ' has no "|*" fallback');
        }
      }
    });
    if (!s.grades[s.best]) console.warn('[tactics] ' + s.id + ': best key ' + s.best + ' has no grade');
  });
})();
