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

**23 positions across five levels**

| Level | What it drills |
| --- | --- |
| Breaking the set defence | Where to attack a balanced side-by-side defence: the seam, the racket hip, the tramlines, and when to stop smashing |
| Keeping the attack | The front player's job — the tight block, the flat counter, and where to stand while your partner smashes |
| Defending the smash | Straight block, the mid-court push that breaks a front-and-back attack, when to counter-drive, and body smashes |
| Shape and rotation | Positioning questions: splitting on the lift, arriving balanced, following a block in, and moving as a pair |
| Reading the hands | How a left-hander moves every target, and the two mixed-handed shapes worth recognising |

**Levels**

They open in order: score **60%** on a level and the next one unlocks. A level's standing comes
from your best result on each of its positions, so replaying one to fix what you missed moves you
forward rather than starting over. The decision drill opens once you have passed a level, and only
ever asks about levels you have opened.

*Back door:* entering **Deep Mohan Sehgal** as your name opens every level at once, for practising
a particular one without grinding back to it. It is checked in the browser and this repository is
public, so anyone who reads `app.js` can find it — it is a convenience, not a secret.

**Two ways to work**

- **Levels** — untimed, in order, for learning the reads.
- **Decision drill** — ten random positions, ten seconds each. Knowing the answer and finding it
  in under ten seconds are different skills, and only the second one shows up in a match.

Every answer is graded *Best / Solid / Risky / Punished* with the reasoning, the likely
consequence animated on the court, the coached answer when you miss it, and a one-line principle
to take to training. The **Principles** page collects the whole model in one place with sources.

**Targets are numbered, not named.** Tap a number to place your shot, and the coaching afterwards
refers to the same number — so there is never any confusion about whose left is whose. The
language avoids court jargon throughout, and the home screen has a short glossary for the few
terms that are genuinely worth knowing.

## Leaderboard

Drill scores can be posted to a shared board. It is off until `config.js` has a Supabase project
in it; with the fields empty the trainer works exactly as it does otherwise and the board is
hidden.

Finishing a run posts it automatically and shows where it landed, rather than asking. The player
is asked for their name once on the home screen; if they have not given one, the run's summary
asks then and posts on save.

Each kind of run is ranked on its own board — one per chapter, plus the decision drill. A
six-question untimed chapter at 100% and a ten-question timed drill at 90% are not the same
achievement, so pooling them into one ranking would be meaningless.

**Overall** adds the levels together: each player's best run of each chapter, summed. It is a
total rather than an average, so playing more chapters counts for more, and each row shows how
many chapters that player has posted. The drill is excluded, since it draws its positions from
every chapter and would double-count them. It is computed in the browser from the rows the board
already returns, which keeps the table to the single insert-only shape above.

**Setting it up**

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run:

   ```sql
   create table public.scores (
     id         uuid primary key default gen_random_uuid(),
     name       text        not null check (char_length(trim(name)) between 1 and 24),
     mode       text        not null default 'drill' check (char_length(mode) between 1 and 32),
     pct        int         not null check (pct between 0 and 100),
     points     int         not null check (points >= 0),
     total      int         not null check (total > 0),
     created_at timestamptz not null default now()
   );

   alter table public.scores enable row level security;

   create policy "anyone can read the board"
     on public.scores for select using (true);

   -- insert only, and the numbers have to make sense
   create policy "anyone can add a score"
     on public.scores for insert with check (
       char_length(trim(name)) between 1 and 24
       and pct between 0 and 100
       and points >= 0 and points <= total
       and total between 1 and 100
     );

   create index scores_rank_idx on public.scores (mode, pct desc, points desc, created_at asc);
   ```

   The `mode` column names the board a score belongs to: `drill`, or a chapter id.

   There is deliberately no update or delete policy, so with row level security on, nobody can
   change or remove a posted score — only read the board and add to it.

   **If you created the table before per-chapter boards existed**, add the column instead of
   recreating it:

   ```sql
   alter table public.scores
     add column mode text not null default 'drill'
     check (char_length(mode) between 1 and 32);

   drop index if exists scores_rank_idx;
   create index scores_rank_idx on public.scores (mode, pct desc, points desc, created_at asc);
   ```

3. Put the project URL and the anon (publishable) key into `config.js` and push.

Both values are meant to live in client-side code and are safe to commit. What stops abuse is the
table's access rules, not secrecy.

**What it is not:** tamper-proof. Anyone who opens the browser console can post a score they did
not earn — the rules above constrain the shape of a score, not its honesty. That is the right
trade for a board you share with friends; it would be the wrong trade for anything that mattered.

The board shows one row per player — everyone's personal best, not every attempt.

## Analytics

Google Analytics 4, pointed at the same property as the rest of
deepmohansehgal.com, so the trainer appears there as its own page path rather than as a separate
property. The measurement ID lives in `config.js`; blank means nothing is loaded and no request is
made, which is what a fork of this repo should use.

This is one page, so a plain install would record a single pageview per visit and could never
answer which chapters people actually play. `analytics.js` therefore also sends a `screen_view` on
every screen change, plus `chapter_start`, `drill_start`, `drill_complete` (with the score and
whether the clock was on), `chapter_complete` and `score_posted`.

Every call is guarded and swallowed. An ad blocker making the tag missing at runtime is an
ordinary case, not an error, and analytics can never break the trainer.

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

Targets are numbered automatically, sorted into reading order across the picture, and the
coaching text refers to them with `{zoneId}` placeholders that resolve to those numbers when
displayed. That means the words can never drift out of step with the diagram, however the targets
are reordered or renumbered.

Body targets are declared as `{ bodyOf: 0 }` and resolved against that defender's racket hand —
facing you, a right-hander's racket side is on your left, a left-hander's is on your right. That
one detail is why the body smash and the middle seam are nearly the same ball against a
right-handed pair, and why they are not against a mixed one.

A load-time validator runs on every page load and warns in the console if a shot is missing grade
coverage, if a grade or a sentence names a target that does not exist, or if the designated best
answer has no grade. Content mistakes surface immediately rather than as a wrong lesson months
later.

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
index.html      screens, glossary and the principles reference
style.css       dark theme, mobile-first
config.js       Supabase project and GA4 measurement ID (empty = that feature off)
tactics.js      court constants, shot vocabulary, scenarios, grader, validator
court.js        top-down canvas renderer and the world/screen transform
leaderboard.js  Supabase REST client, fails soft if unreachable
analytics.js    GA4 loader and event helper, no-op when unconfigured
app.js          screen flow, scoring, drill timer, localStorage
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

**Cache busting.** GitHub Pages sends long-lived caching headers for static assets and does not
let you configure them, so a browser will keep serving yesterday's `app.js` indefinitely. The
workflow therefore stamps the commit onto every local asset URL in the published `index.html`
(`app.js?v=fc425fb`), so each deploy is a set of URLs no cache can answer from. Source files are
left unstamped; only the published copy is rewritten, and the step fails rather than shipping if
the stamp does not apply.

That leaves `index.html` itself, which GitHub Pages caches for about ten minutes and which cannot
be changed. So a fresh deploy can take up to ten minutes to appear — but once it does, the HTML
and every asset update together, instead of the page being stuck on stale code until someone
clears their cache. A hard reload (Cmd/Ctrl+Shift+R) skips the wait.

The workflow needs one repository secret, `SITE_DEPLOY_TOKEN`: a token with **Contents: read and
write** on `dmsehgal/dmsehgal.github.io`, added under *Settings → Secrets and variables →
Actions*. Without it the workflow skips with a warning instead of failing. Fine-grained tokens
expire — when that happens the deploy starts failing and the token needs regenerating.

Any other static host will serve the folder as-is, with no build step.

## Licence

MIT — see [LICENSE](LICENSE). Use it, change it, build on it; keep the copyright notice.

If you fork this, clear both values in `config.js` first: the Supabase project so your scores do
not land on someone else's leaderboard, and the GA4 measurement ID so your traffic is not reported
into someone else's analytics. Empty means the feature is off and nothing is requested.
