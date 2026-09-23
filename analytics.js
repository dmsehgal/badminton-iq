/* ============================================================
   Badminton IQ — analytics
   Loads Google Analytics only when config.js names a property, and
   never lets a blocked or missing tag break anything. This is a single
   page, so without the events below GA would only ever record one
   pageview per visit and could not answer which chapters people play.
   ============================================================ */

const Analytics = {
  id() {
    return (typeof ANALYTICS !== 'undefined' && ANALYTICS && ANALYTICS.id) || '';
  },

  on() {
    return !!this.id();
  },

  init() {
    if (!this.on()) return;
    const id = this.id();
    window.dataLayer = window.dataLayer || [];
    // gtag reads `arguments`, so this cannot be an arrow function
    window.gtag = function () { window.dataLayer.push(arguments); };

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(tag);

    gtag('js', new Date());
    gtag('config', id);
  },

  /* Analytics must never be able to break the trainer, so every call is
     guarded and swallowed — ad blockers make the tag missing at runtime a
     completely ordinary case, not an error. */
  track(name, params) {
    if (!this.on() || typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  },

  screen(name) {
    this.track('screen_view', { screen_name: name });
  },
};
