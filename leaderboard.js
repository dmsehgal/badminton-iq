/* ============================================================
   Badminton IQ — shared leaderboard
   Talks to Supabase over plain REST, so there is no SDK to load.
   Every call fails soft: if the network or the config is not there,
   the trainer carries on working and the board just stays hidden.
   ============================================================ */

const LB_NAME_KEY = 'biq_name';
const LB_MAX_NAME = 24;

const LB = {
  enabled() {
    return !!(SUPABASE && SUPABASE.url && SUPABASE.key);
  },

  savedName() {
    try { return localStorage.getItem(LB_NAME_KEY) || ''; } catch (e) { return ''; }
  },

  rememberName(name) {
    try { localStorage.setItem(LB_NAME_KEY, name); } catch (e) {}
  },

  /* Trim, collapse whitespace, drop control characters, cap the length.
     The database checks this too — this is just so the player sees the
     problem before the round trip. */
  cleanName(raw) {
    return String(raw || '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LB_MAX_NAME);
  },

  headers(extra) {
    return Object.assign({
      apikey: SUPABASE.key,
      Authorization: 'Bearer ' + SUPABASE.key,
    }, extra || {});
  },

  async submit(entry) {
    if (!this.enabled()) throw new Error('Leaderboard is not configured.');
    const name = this.cleanName(entry.name);
    if (!name) throw new Error('Enter a name first.');

    const res = await fetch(SUPABASE.url + '/rest/v1/scores', {
      method: 'POST',
      headers: this.headers({
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        name: name,
        pct: entry.pct,
        points: entry.points,
        total: entry.total,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error('Could not post the score (' + res.status + '). ' + detail.slice(0, 140));
    }
    this.rememberName(name);
    return true;
  },

  async top(limit) {
    if (!this.enabled()) return [];
    const url = SUPABASE.url + '/rest/v1/scores' +
      '?select=name,pct,points,total,created_at' +
      '&order=pct.desc,points.desc,created_at.asc&limit=300';
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error('Could not load the leaderboard (' + res.status + ').');
    const rows = await res.json();

    // one line per player: everybody's personal best, not their every attempt
    const best = new Map();
    rows.forEach((r) => {
      const k = String(r.name).toLowerCase();
      const prev = best.get(k);
      if (!prev || r.pct > prev.pct || (r.pct === prev.pct && r.points > prev.points)) {
        best.set(k, r);
      }
    });

    return Array.from(best.values())
      .sort((a, b) => (b.pct - a.pct) || (b.points - a.points) ||
                      (new Date(a.created_at) - new Date(b.created_at)))
      .slice(0, limit || 20);
  },
};
