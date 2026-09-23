# Badminton IQ

A doubles tactics trainer. Each position is frozen mid-rally: read the defence, pick a shot,
tap where you are putting it, and find out why that was the right or wrong ball.

Built for one question in particular — *they lifted, they split, they are waiting for the smash;
where does the shuttle go?* — and then for the other half of the same problem, which is
surviving that situation when you are the one defending.

## Play

Plain HTML/CSS/JS, no build step and no dependencies.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. Opening `index.html` directly works too. Progress is kept in
`localStorage` on the device you played on.

## What is in it

**23 positions across five chapters**

| Chapter | What it drills |
| --- | --- |
| Breaking the set defence | Where to attack a balanced side-by-side defence: the seam, the racket hip, the tramlines, and when to stop smashing |
| Keeping the attack | The front player's job — the tight block, the flat counter, and where to stand while your partner smashes |
| Defending the smash | Straight block, the mid-court push that breaks a front-and-back attack, when to counter-drive, and body smashes |
| Shape and rotation | Positioning questions: splitting on the lift, arriving balanced, following a block in, and moving as a pair |
| Reading the hands | How a left-hander moves every target, and the two mixed-handed shapes worth recognising |

**Two ways to work**

- **Chapters** — untimed, in order, for learning the reads.
- **Decision drill** — ten random positions, ten seconds each. Knowing the answer and finding it
  in under ten seconds are different skills, and only the second one shows up in a match.

Every answer is graded *Best / Solid / Risky / Punished* with the reasoning, the likely
consequence animated on the court, the coached answer when you miss it, and a one-line principle
to take to training. The **Principles** page collects the whole model in one place with sources.

## How the tactics model works

Everything lives in `tactics.js`, so scenarios and grading can be edited without touching engine code.

Coordinates are metres on a real doubles court (6.10 × 13.40, net at 6.70). You are always at the
bottom of the picture, and every brief is written from your point of view.

A scenario declares the four player positions, your contact point, the shots you are allowed,
and a set of target zones. A tap on the court snaps to the nearest zone. Grades are keyed
`shot|zone`, with a `shot|*` fallback so every combination has a real answer rather than a
generic one:

```js
grades: {
  'smash|seam': g(3, 'why this is the shot…', 'what happens next', { x: 3.2, y: 9.8 }),
  'smash|*':    g(1, 'why anything else is worse…', 'what happens next'),
}
```

Body targets are declared as `{ bodyOf: 0 }` and resolved against that defender's racket hand —
facing you, a right-hander's racket side is on your left, a left-hander's is on your right. That
one detail is why the body smash and the middle seam are nearly the same ball against a
right-handed pair, and why they are not against a mixed one.

A load-time validator warns in the console if any allowed shot is missing grade coverage.

### Adding a position

Append an object to `SCENARIOS` with a `chapter` matching one in `CHAPTERS`, a `best` key, and a
`key` line. Set `kind: 'position'` and `zoneSide: 'own'` for a where-do-I-stand question — those
use the single pseudo-shot `move` and put the target zones on your own half.

## Honest limits

This builds recognition and decision speed: seeing the shape and knowing the answer before the
shuttle arrives. That is genuinely half the problem and it is the half that trains on a phone.
The other half is your body producing the shot under pressure, and that comes from multi-shuttle
feeds and half-court drills with a partner. Use this to know what you are trying to do; use the
court to make it automatic.

## Sources

The grading model is built on these:

- [Badminton House — attack-to-defense rotation](https://badmintonhouse.ca/blogs/news/badminton-doubles-attack-to-defense-rotation)
- [Badminton House — doubles positioning and shot placement](https://badmintonhouse.ca/blogs/news/doubles-shot-placement-tactics)
- [Shuttle Lab — turning defence into attack](https://www.joinshuttlelab.com/learn/badminton-doubles-defense)
- [BadmintonSkills — positioning, rotation and communication](https://badmintonskills.com/badminton-doubles-tactics-positioning-rotation-and-communication-explained/)
- [Badminton Peak — three attacking rotation systems](https://badmintonpeak.com/en/blog/rotation-double-badminton-attaque-equipe)
- [Doubles tactics: attack & defence (PDF)](https://www.wolfberg.net/badminton/Doubles%20Tactics%20Part%202.pdf)

## Files

```
index.html    screens and the principles reference
style.css     dark theme, mobile-first
tactics.js    court constants, shot vocabulary, scenarios, grader
court.js      top-down canvas renderer and the world/screen transform
app.js        screen flow, scoring, drill timer, localStorage
```

No dependencies, no build step, no external assets — the court and every marker are drawn on a
canvas at runtime.

## Deploying

Live at **https://deepmohansehgal.com/games/badminton-iq/**.

GitHub Pages serves a project repo at `/<repo-name>/` and that path is not configurable, so the
`/games/` prefix has to come from files inside the site repo. `.github/workflows/deploy.yml`
handles that: on every push to `main` it copies the tracked files into
`dmsehgal.github.io/games/badminton-iq/` and pushes. This repo stays the single source of truth —
never edit the copy in the site repo, it gets overwritten.

The workflow needs one repository secret, `SITE_DEPLOY_TOKEN`: a token with **Contents: read and
write** on `dmsehgal/dmsehgal.github.io`, added under *Settings → Secrets and variables →
Actions*. Without it the workflow skips with a warning instead of failing. Fine-grained tokens
expire — when that happens the deploy starts failing and the token needs regenerating.

Any other static host will serve the folder as-is, with no build step.
