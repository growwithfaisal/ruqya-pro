/* RuqyaPro reminders: what to show when the reminder server pokes this phone.
   The server sends an EMPTY push at the minutes the phone asked for. It never knows what a reminder says; the phone keeps its own
   schedule (written by src/lib/reminders.ts into IndexedDB "rp-reminders") and this decides which of its items are due.
   Pure functions, so tests can load it in Node (scripts/check-reminders.mts). Loaded by sw.js with importScripts. */
(function (root) {
  var AHEAD = 2 * 60 * 1000; // a poke can come a little before the clock says so
  var BEHIND = 20 * 60 * 1000; // and a late one is still worth showing for a while
  var REPLAY = 5 * 60 * 1000; // a second poke for something just shown replaces it instead of buzzing again

  /** What to do for a poke at `now`. items: [{id, at (ms), title, body, url, until?}]. shown: {id: shownAtMs}. */
  function dueNow(items, shown, now) {
    var due = (items || [])
      .filter(function (i) { return i && i.at <= now + AHEAD && i.at > now - BEHIND && !(i.until && i.until < now); })
      .sort(function (a, b) { return a.at - b.at; });
    var fresh = due.filter(function (i) { return !shown[i.id]; });
    if (fresh.length) return { show: fresh, mark: true };
    var recent = due.filter(function (i) { return shown[i.id] && now - shown[i.id] < REPLAY; });
    if (recent.length) return { show: recent, mark: false };
    // Nothing matches (an old schedule, or a cleared one). A push that shows nothing can cost the app its permission on iOS.
    return { show: [{ id: "refresh", title: "RuqyaPro", body: "Open the app to refresh your reminders.", url: "/settings#reminders-title" }], mark: false };
  }

  /** The shown-record without entries too old to matter. */
  function prune(shown, now) {
    var out = {};
    for (var k in shown) if (now - shown[k] < 3 * 24 * 3600 * 1000) out[k] = shown[k];
    return out;
  }

  var api = { dueNow: dueNow, prune: prune };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RPReminders = api;
})(typeof self !== "undefined" ? self : this);
