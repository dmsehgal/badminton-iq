/* ============================================================
   Badminton IQ — configuration
   Paste your Supabase project values here to switch the shared
   leaderboard on. Leave them empty and the app works exactly as
   before, with the leaderboard hidden.

   Both values are safe to publish: the anon key is designed to sit
   in client-side code, and the table's access rules (see README)
   allow only reading the board and adding a score — nothing else.
   ============================================================ */
const ANALYTICS = {
  // GA4 measurement ID. This is the same property as the rest of
  // deepmohansehgal.com, so the trainer shows up there as its own page path
  // rather than as a separate property. Empty means no analytics at all and
  // nothing is loaded — which is what a fork of this repo should use.
  id: 'G-08Z54W5TSZ',
};

const SUPABASE = {
  // The project base URL. Pasting the full REST endpoint is fine too —
  // leaderboard.js trims a trailing slash or /rest/v1 either way.
  url: 'https://arzawpptptpthcimhcpd.supabase.co',
  key: 'sb_publishable_yTZNkmq_T-2zpqMKsNwHgA_qHBcWAPU',
};
